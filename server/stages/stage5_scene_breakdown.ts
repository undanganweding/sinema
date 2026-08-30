import { executeLLMRequest, safeParseJSON } from '../llm_provider';
import { Type } from '../gemini';
import { ContextPackage, NarrativeBeats, ReasoningConfig, Scene } from '../../src/types';
import { buildNarrativeVoiceInstruction, recommendSceneTone } from '../narrative_tone';

export interface Stage5SceneBreakdownInput {
  narrativeBeats: NarrativeBeats;
  totalDurationTargetSec: number;
  maxSceneDurationSec: number; // Effective ceiling (e.g. 30 if null/Auto)
  fixedSceneDurationSec?: number | null; // Fixed duration per scene if specified by user
  allowFinalSceneOverride?: boolean;
  contextPackage?: ContextPackage | null;
  language: 'id' | 'en';
  model?: string;
  reasoningConfig?: ReasoningConfig;
  feedbackPrompt?: string; // Corrective prompt on retry
  // Canonical asset rosters produced by S2 (Character Bible) and S3 (Location
  // Bible). S6 asset-integrity gate matches scene.character_names /
  // scene.location_name against these exact names, so S5 must not invent new
  // ones. When supplied, generated names are canonicalized against them.
  characterRoster?: string[];
  locationRoster?: string[];
}

export type DetectedScene = Omit<
  Scene,
  'id' | 'project_id' | 'version' | 'created_at' | 'updated_at'
>;

export interface Stage5ValidationResult {
  valid: boolean;
  totalCalculated: number;
  targetTotal: number;
  maxViolations: { scene_number: number; title: string; duration_sec: number }[];
  fixedViolations?: { scene_number: number; title: string; duration_sec: number; expected: number }[];
  errorMessage?: string;
  correctivePrompt?: string;
}

export interface SceneAssetNameViolation {
  scene_number: number;
  assetType: 'CHARACTER' | 'LOCATION';
  value: string;
}

export interface Stage5AssetNameValidationResult {
  valid: boolean;
  violations: SceneAssetNameViolation[];
  errorMessage?: string;
  correctivePrompt?: string;
}

// Generic honorifics / articles carry no identifying signal, so they are
// excluded from similarity scoring ("Sang Putri" must resolve to
// "Putri Nelayan", not tie with "Sang Nelayan").
const ASSET_NAME_STOPWORDS = new Set([
  'sang', 'si', 'the', 'a', 'an', 'of', 'dan', 'and', 'de', 'da', 'di', 'ke', 'pada',
]);

function normalizeAssetName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Drops parenthetical qualifiers, e.g. "Danau Berkabut (Fajar)" -> "danau berkabut". */
function baseAssetName(value: string): string {
  return normalizeAssetName(value.replace(/\([^)]*\)/g, ' '));
}

function assetNameTokens(value: string): string[] {
  return baseAssetName(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !ASSET_NAME_STOPWORDS.has(token));
}

function assetNameSimilarity(candidate: string, target: string): number {
  const candidateTokens = new Set(assetNameTokens(candidate));
  const targetTokens = new Set(assetNameTokens(target));
  if (candidateTokens.size === 0 || targetTokens.size === 0) return 0;
  let intersection = 0;
  candidateTokens.forEach((token) => {
    if (targetTokens.has(token)) intersection++;
  });
  const union = new Set([...candidateTokens, ...targetTokens]).size;
  return intersection / union;
}

/**
 * Snap an LLM-generated asset name onto the canonical roster entry it refers to.
 * Returns null when the reference is ambiguous or genuinely absent, so the
 * caller can force an S5 regeneration instead of silently mapping a scene onto
 * the wrong asset.
 */
export function resolveCanonicalAssetName(candidate: string, roster: string[]): string | null {
  if (!candidate || !candidate.trim() || roster.length === 0) return null;
  const normalizedCandidate = baseAssetName(candidate);
  if (!normalizedCandidate) return null;

  const exact = roster.find((entry) => baseAssetName(entry) === normalizedCandidate);
  if (exact) return exact;

  // Qualifier-tolerant containment: "Danau Berkabut" -> "Danau Berkabut (Fajar)".
  const contained = roster.filter((entry) => {
    const normalizedEntry = baseAssetName(entry);
    return normalizedEntry.startsWith(`${normalizedCandidate} `) || normalizedCandidate.startsWith(`${normalizedEntry} `);
  });
  if (contained.length === 1) return contained[0];

  const scored = roster
    .map((entry) => ({ name: entry, score: assetNameSimilarity(candidate, entry) }))
    .sort((left, right) => right.score - left.score);
  const best = scored[0];
  const runnerUp = scored[1];
  if (best && best.score >= 0.5 && (!runnerUp || best.score > runnerUp.score)) {
    return best.name;
  }
  return null;
}

/**
 * Rewrites scene asset references to canonical Bible names in place of LLM
 * paraphrases. Names that cannot be resolved unambiguously are left untouched
 * and surfaced by validateSceneAssetNames().
 */
export function canonicalizeSceneAssetNames(
  scenes: DetectedScene[],
  characterRoster: string[],
  locationRoster: string[]
): DetectedScene[] {
  if (characterRoster.length === 0 && locationRoster.length === 0) return scenes;
  return scenes.map((scene) => {
    const canonicalLocation = scene.location_name
      ? resolveCanonicalAssetName(scene.location_name, locationRoster)
      : null;
    const canonicalCharacters = (scene.character_names || []).map(
      (name) => resolveCanonicalAssetName(name, characterRoster) || name
    );
    const dedupedCharacters = Array.from(new Set(canonicalCharacters));
    return {
      ...scene,
      location_name: canonicalLocation || scene.location_name,
      character_names: dedupedCharacters,
      ...(scene.characters_present
        ? { characters_present: Array.from(new Set(scene.characters_present.map((name) => resolveCanonicalAssetName(name, characterRoster) || name))) }
        : {}),
    };
  });
}

/**
 * Guards the S5 -> S6 contract: every scene asset reference must exist in the
 * Character/Location Bible. Unresolvable references are reported with a
 * corrective prompt so the existing S5 retry loop can regenerate against the
 * exact roster, instead of letting the S6 asset-integrity gate block every
 * scene at the end of the run.
 */
export function validateSceneAssetNames(
  scenes: DetectedScene[],
  characterRoster: string[],
  locationRoster: string[],
  language: 'id' | 'en'
): Stage5AssetNameValidationResult {
  if (characterRoster.length === 0 && locationRoster.length === 0) {
    return { valid: true, violations: [] };
  }
  const isIndo = language === 'id';
  const violations: SceneAssetNameViolation[] = [];

  for (const scene of scenes) {
    if (locationRoster.length > 0 && scene.location_name && !locationRoster.some((entry) => baseAssetName(entry) === baseAssetName(scene.location_name))) {
      violations.push({ scene_number: scene.scene_number, assetType: 'LOCATION', value: scene.location_name });
    }
    if (characterRoster.length > 0) {
      for (const name of scene.character_names || []) {
        if (!characterRoster.some((entry) => baseAssetName(entry) === baseAssetName(name))) {
          violations.push({ scene_number: scene.scene_number, assetType: 'CHARACTER', value: name });
        }
      }
    }
  }

  if (violations.length === 0) {
    return { valid: true, violations: [] };
  }

  const summary = violations
    .map((violation) => `Scene #${violation.scene_number} ${violation.assetType} "${violation.value}"`)
    .join(', ');
  const errorMessage = isIndo
    ? `Referensi asset di luar Character/Location Bible: ${summary}.`
    : `Scene asset references outside the Character/Location Bible: ${summary}.`;
  const correctivePrompt = isIndo
    ? `WAJIB gunakan HANYA nama asset kanonik berikut, ditulis PERSIS sama. KARAKTER: ${characterRoster.join(' | ') || '(tidak ada)'}. LOKASI: ${locationRoster.join(' | ') || '(tidak ada)'}. Jangan membuat nama karakter atau lokasi baru, jangan menyingkat, jangan menambah gelar. Referensi bermasalah: ${summary}.`
    : `Use ONLY these canonical asset names, spelled EXACTLY. CHARACTERS: ${characterRoster.join(' | ') || '(none)'}. LOCATIONS: ${locationRoster.join(' | ') || '(none)'}. Do not invent, abbreviate, or re-title any character or location. Offending references: ${summary}.`;

  return { valid: false, violations, errorMessage, correctivePrompt };
}

export function validateSceneDurations(
  scenes: DetectedScene[],
  targetTotalSec: number,
  maxSceneSec: number,
  language: 'id' | 'en',
  fixedSceneSec?: number | null,
  allowFinalOverride?: boolean
): Stage5ValidationResult {
  const isIndo = language === 'id';
  let totalCalculated = 0;
  const maxViolations: { scene_number: number; title: string; duration_sec: number }[] = [];
  const fixedViolations: { scene_number: number; title: string; duration_sec: number; expected: number }[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    totalCalculated += scene.duration_sec;
    const effectiveCeiling = fixedSceneSec || maxSceneSec;

    if (scene.duration_sec > effectiveCeiling || scene.duration_sec < 5) {
      maxViolations.push({
        scene_number: scene.scene_number,
        title: scene.title,
        duration_sec: scene.duration_sec,
      });
    }

    if (fixedSceneSec) {
      const isLastScene = i === scenes.length - 1;
      if (!isLastScene && scene.duration_sec !== fixedSceneSec) {
        fixedViolations.push({
          scene_number: scene.scene_number,
          title: scene.title,
          duration_sec: scene.duration_sec,
          expected: fixedSceneSec,
        });
      } else if (isLastScene && !allowFinalOverride && scene.duration_sec !== fixedSceneSec) {
        fixedViolations.push({
          scene_number: scene.scene_number,
          title: scene.title,
          duration_sec: scene.duration_sec,
          expected: fixedSceneSec,
        });
      }
    }
  }

  const diff = totalCalculated - targetTotalSec;
  const hasSumError = totalCalculated !== targetTotalSec;
  const hasMaxError = maxViolations.length > 0;
  const hasFixedError = fixedViolations.length > 0;

  if (!hasSumError && !hasMaxError && !hasFixedError) {
    return {
      valid: true,
      totalCalculated,
      targetTotal: targetTotalSec,
      maxViolations: [],
      fixedViolations: [],
    };
  }

  let errorDetails: string[] = [];
  let correctiveNotes: string[] = [];

  if (hasSumError) {
    if (isIndo) {
      errorDetails.push(
        `Total durasi yang Anda hasilkan adalah ${totalCalculated} detik, padahal target eksak adalah ${targetTotalSec} detik (selisih: ${
          diff > 0 ? `+${diff}` : `${diff}`
        } detik).`
      );
      correctiveNotes.push(
        `Pastikan jumlah sum(scene.duration_sec) TEPAT ${targetTotalSec} detik (toleransi 0 detik).`
      );
    } else {
      errorDetails.push(
        `Calculated total duration is ${totalCalculated}s, while strict target is ${targetTotalSec}s (variance: ${
          diff > 0 ? `+${diff}` : `${diff}`
        }s).`
      );
      correctiveNotes.push(
        `Ensure sum(scene.duration_sec) equals EXACTLY ${targetTotalSec}s (0s tolerance).`
      );
    }
  }

  if (hasFixedError && fixedSceneSec) {
    if (isIndo) {
      errorDetails.push(
        `User telah menetapkan Fixed Scene Duration = ${fixedSceneSec}s. Seluruh scene WAJIB menggunakan durasi ${fixedSceneSec}s.`
      );
      correctiveNotes.push(
        `Ubah setiap scene agar durasinya TEPAT ${fixedSceneSec} detik.`
      );
    } else {
      errorDetails.push(
        `Fixed Scene Duration is locked to ${fixedSceneSec}s. All scenes MUST have duration ${fixedSceneSec}s.`
      );
      correctiveNotes.push(
        `Set every scene duration to EXACTLY ${fixedSceneSec} seconds.`
      );
    }
  }

  if (hasMaxError) {
    const violationSummary = maxViolations
      .map((v) => `Scene #${v.scene_number} ("${v.title}") = ${v.duration_sec}s`)
      .join(', ');
    if (isIndo) {
      errorDetails.push(
        `Terdapat scene dengan durasi di luar batas valid (5 - ${fixedSceneSec || maxSceneSec}s): ${violationSummary}.`
      );
      correctiveNotes.push(
        `Pastikan durasi setiap scene berada pada rentang valid (5 - ${fixedSceneSec || maxSceneSec} detik).`
      );
    } else {
      errorDetails.push(
        `There are scenes outside valid duration bounds (5 - ${fixedSceneSec || maxSceneSec}s): ${violationSummary}.`
      );
      correctiveNotes.push(
        `Ensure every scene duration is within valid bounds (5 - ${fixedSceneSec || maxSceneSec} seconds).`
      );
    }
  }

  const errorMessage = errorDetails.join(' ');
  const correctivePrompt = correctiveNotes.join(' ');

  return {
    valid: false,
    totalCalculated,
    targetTotal: targetTotalSec,
    maxViolations,
    fixedViolations,
    errorMessage,
    correctivePrompt,
  };
}

export async function runStage5SceneBreakdownAttempt(
  input: Stage5SceneBreakdownInput
): Promise<DetectedScene[]> {
  const isIndo = input.language === 'id';

  const isFixed = Boolean(input.fixedSceneDurationSec && input.fixedSceneDurationSec > 0);
  const expectedSceneCount = isFixed
    ? Math.max(1, Math.round(input.totalDurationTargetSec / input.fixedSceneDurationSec!))
    : undefined;

  const narrativeDoctrine = buildNarrativeVoiceInstruction(null, input.language);
  const groundingContext = input.contextPackage ? JSON.stringify(input.contextPackage, null, 2) : 'No grounding context available.';
  const baseInstruction = isIndo
    ? isFixed
      ? `Anda adalah Master 1st Assistant Director (1st AD) & Cinematic Timeline Allocator kelas dunia.
Tugas Anda: Memecah cerita 5-Beat Narrative Structure menjadi urutan tepat ${expectedSceneCount} Scene Breakdown sinematik.

ATURAN SISTEM FIXED SCENE DURATION (MUTLAK):
1. Sistem telah menetapkan durasi tetap (Fixed Scene Duration) sebesar ${input.fixedSceneDurationSec} detik per scene.
2. Setiap scene WAJIB menggunakan durasi tepat ${input.fixedSceneDurationSec} detik. JANGAN mengubah durasi scene.
3. Total target durasi: ${input.totalDurationTargetSec} detik (${expectedSceneCount} scene x ${input.fixedSceneDurationSec}s).
4. Fokuskan seluruh kreativitas Anda pada: konten adegan, dramatic beat, tujuan naratif, aksi dramatis, lokasi, karakter, dan fungsi naratif.
5. scene_number harus berurutan 1, 2, 3, dst.`
      : `Anda adalah Master 1st Assistant Director (1st AD) & Cinematic Timeline Allocator kelas dunia.
Tugas Anda: Memecah cerita dari 5-Beat Narrative Structure menjadi urutan adegan sinematik (Scene Breakdown) yang presisi dengan alokasi durasi detik.

ATURAN ALOKASI DURASI (MUTLAK):
1. Alokasikan durasi berdasarkan BOBOT NARATIF (Climax, Pivotal Choices, dan Emotional Highs WAJIB mendapatkan alokasi durasi lebih panjang dan dramatis dibanding scene transisi/eksposisi pendek).
2. JANGAN membagi durasi secara rata (equal split). Film sinematik memiliki dinamika tempo yang bervariasi.
3. BATAS MAKSIMAL: TIDAK BOLEH ada SATU PUN scene yang durasinya melebihi ${input.maxSceneDurationSec} detik (Hard Ceiling: <= ${input.maxSceneDurationSec}s per scene).
4. TOTAL DURASI: Jumlah durasi seluruh scene (sum of duration_sec) HARUS TEPAT SAMA DENGAN ${input.totalDurationTargetSec} DETIK. Toleransi 0 detik!
5. scene_number harus berurutan 1, 2, 3, dst.`
    : isFixed
    ? `You are a world-class 1st Assistant Director (1st AD) & Cinematic Timeline Allocator.
Your task: Deconstruct the 5-Beat Narrative Structure into an exact sequence of ${expectedSceneCount} cinematic Scenes.

FIXED SCENE DURATION SYSTEM CONSTRAINT (NON-NEGOTIABLE):
1. The system has assigned a fixed duration of ${input.fixedSceneDurationSec} seconds. Every scene MUST use exactly ${input.fixedSceneDurationSec} seconds. Do not change scene duration.
2. Target total duration: ${input.totalDurationTargetSec} seconds (${expectedSceneCount} scenes x ${input.fixedSceneDurationSec}s).
3. Focus entirely on scene content, dramatic beat, narrative purpose, visual action, location, cast, and narrative function.
4. scene_number must be sequential 1, 2, 3...`
    : `You are a world-class 1st Assistant Director (1st AD) & Cinematic Timeline Allocator.
Your task: Deconstruct the 5-Beat Narrative Structure into a sequenced cinematic Scene Breakdown with exact second allocations.

STRICT DURATION RULES:
1. Allocate durations by NARRATIVE WEIGHT (Climax, critical decisions, and heavy emotional beats MUST receive larger time allocations than quick expository or transition scenes).
2. DO NOT distribute durations evenly. Cinematic pacing requires varied temporal dynamics.
3. CEILING: NO scene duration may exceed ${input.maxSceneDurationSec} seconds (Max <= ${input.maxSceneDurationSec}s per scene).
4. TOTAL SUM: The sum of duration_sec across all scenes MUST EXACTLY EQUAL ${input.totalDurationTargetSec} SECONDS (0s tolerance).
5. scene_number must be sequential 1, 2, 3...`;

  const systemInstruction = `${baseInstruction}\n\n${narrativeDoctrine}\n\nGROUNDING CONTEXT:\n${groundingContext}`;

  // Canonical asset roster contract (S2/S3 -> S5 -> S6). The S6 asset integrity
  // gate resolves scene.character_names / scene.location_name against the
  // Character & Location Bible by name, so a paraphrased name blocks the scene.
  const characterRoster = input.characterRoster?.filter((name) => Boolean(name && name.trim())) || [];
  const locationRoster = input.locationRoster?.filter((name) => Boolean(name && name.trim())) || [];
  const rosterInstruction = (characterRoster.length > 0 || locationRoster.length > 0)
    ? (isIndo
      ? `\n\n=== ASSET KANONIK (WAJIB DIPAKAI PERSIS) ===
KARAKTER: ${characterRoster.join(' | ') || '(tidak ada)'}
LOKASI: ${locationRoster.join(' | ') || '(tidak ada)'}
ATURAN MUTLAK:
1. Field character_names WAJIB berisi HANYA nama dari daftar KARAKTER di atas, ditulis PERSIS sama (huruf per huruf).
2. Field location_name WAJIB berisi PERSIS satu nama dari daftar LOKASI di atas.
3. JANGAN membuat karakter/lokasi baru, jangan menyingkat, jangan menambah/menghapus gelar, jangan menerjemahkan.`
      : `\n\n=== CANONICAL ASSETS (MUST BE USED VERBATIM) ===
CHARACTERS: ${characterRoster.join(' | ') || '(none)'}
LOCATIONS: ${locationRoster.join(' | ') || '(none)'}
NON-NEGOTIABLE RULES:
1. character_names MUST contain ONLY names from the CHARACTERS list above, spelled EXACTLY.
2. location_name MUST be EXACTLY one entry from the LOCATIONS list above.
3. Do NOT invent new characters/locations, abbreviate, add or drop titles, or translate them.`)
    : '';

  let prompt = isFixed
    ? `Pecah narasi berikut menjadi tepat ${expectedSceneCount} Scene dengan durasi tetap ${input.fixedSceneDurationSec} detik per scene (Total: ${input.totalDurationTargetSec} detik):

=== 5-BEAT NARRATIVE STRUCTURE ===
Beginning: ${input.narrativeBeats.beginning}
Development: ${input.narrativeBeats.development}
Climax: ${input.narrativeBeats.climax}
Consequence: ${input.narrativeBeats.consequence}
Ending: ${input.narrativeBeats.ending}

=== PRODUCTION CONSTRAINTS ===
Target Total Duration: ${input.totalDurationTargetSec} detik (EXACT)
Fixed Scene Duration: ${input.fixedSceneDurationSec} detik per scene (System Assigned)`
    : `Pecah narasi berikut menjadi daftar Scene dengan total durasi TEPAT ${input.totalDurationTargetSec} detik dan durasi maksimal per scene ${input.maxSceneDurationSec} detik:

=== 5-BEAT NARRATIVE STRUCTURE ===
Beginning: ${input.narrativeBeats.beginning}
Development: ${input.narrativeBeats.development}
Climax: ${input.narrativeBeats.climax}
Consequence: ${input.narrativeBeats.consequence}
Ending: ${input.narrativeBeats.ending}

=== PRODUCTION CONSTRAINTS ===
Target Total Duration: ${input.totalDurationTargetSec} detik (EXACT)
Max Scene Duration Ceiling: ${input.maxSceneDurationSec} detik per scene`;

  prompt += rosterInstruction;

  if (input.feedbackPrompt) {
    prompt += `\n\n=== REVISI PENTING DARI VALIDASI SEBELUMNYA ===\n${input.feedbackPrompt}\nPerbaiki dan pastikan hasil baru memenuhi seluruh aturan eksak ini!`;
  }

  const responseSchema = {
    type: Type.ARRAY,
    description: 'Array of scenes forming the complete film breakdown',
    items: {
      type: Type.OBJECT,
      properties: {
        scene_number: { type: Type.INTEGER, description: 'Sequential scene number (1, 2, 3...)' },
        title: { type: Type.STRING, description: 'Descriptive scene title (e.g., INT. ABANDONED LAB - THE AWAKENING)' },
        duration_sec: {
          type: Type.INTEGER,
          description: `Exact allocated scene duration in seconds (must be integer, <= ${input.maxSceneDurationSec}, and sum to ${input.totalDurationTargetSec})`,
        },
        story_purpose: { type: Type.STRING, description: 'Core narrative purpose of this specific scene' },
        location_name: {
          type: Type.STRING,
          description: locationRoster.length > 0
            ? `Associated set or location name. MUST be exactly one of: ${locationRoster.join(' | ')}`
            : 'Associated set or location name',
        },
        time_of_day: { type: Type.STRING, description: 'DAWN, DAY, DUSK, NIGHT, MIDNIGHT' },
        character_names: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: characterRoster.length > 0
            ? `Characters present in this scene. Each entry MUST be exactly one of: ${characterRoster.join(' | ')}`
            : 'Characters present in this scene',
        },
        emotional_objective: { type: Type.STRING, description: 'The emotional target beat felt by character and audience' },
        event: { type: Type.STRING, description: 'Key dramatic action or event taking place' },
        narrative_function: {
          type: Type.STRING,
          description: 'Narrative function (e.g., Inciting Incident, Escalation, Climax Beat 1, Resolution)',
        },
      },
      required: [
        'scene_number',
        'title',
        'duration_sec',
        'story_purpose',
        'location_name',
        'time_of_day',
        'character_names',
        'emotional_objective',
        'event',
        'narrative_function',
      ],
    },
  };

  const response = await executeLLMRequest({
    reasoningConfig: input.reasoningConfig,
    model: input.model,
    prompt,
    systemInstruction,
    temperature: 0.2,
    responseSchema,
  });

  if (!response.text) {
    throw new Error('Stage 5 failed: LLM provider returned an empty response.');
  }

  const parsed = safeParseJSON(response.text) as DetectedScene[];

  // System Assignment of Scene Durations & Recommended Scene Tone
  const sanitizedScenes: DetectedScene[] = parsed.map((sc, idx) => {
    let assignedDuration = Number(sc.duration_sec) || (isFixed ? input.fixedSceneDurationSec! : 10);
    if (isFixed && input.fixedSceneDurationSec) {
      assignedDuration = input.fixedSceneDurationSec;
    }
    const recommendedTone = sc.scene_tone || recommendSceneTone(sc);
    return {
      ...sc,
      scene_number: idx + 1,
      duration_sec: assignedDuration,
      scene_tone: recommendedTone,
    };
  });

  // Snap paraphrased asset references back to canonical Bible names so the S6
  // asset integrity gate can resolve them. Unresolvable references are left
  // as-is and reported by validateSceneAssetNames() for the S5 retry loop.
  const canonicalizedScenes = canonicalizeSceneAssetNames(sanitizedScenes, characterRoster, locationRoster);

  // Handle final scene override / duration rounding for fixed mode if total doesn't match perfectly
  if (isFixed && input.fixedSceneDurationSec && canonicalizedScenes.length > 0) {
    let currentTotal = canonicalizedScenes.reduce((sum, s) => sum + s.duration_sec, 0);
    const target = input.totalDurationTargetSec;
    const diff = target - currentTotal;
    if (diff !== 0) {
      if (input.allowFinalSceneOverride) {
        canonicalizedScenes[canonicalizedScenes.length - 1].duration_sec += diff;
      } else {
        // Adjust scene count to fit target exactly
        const expectedCount = Math.max(1, Math.round(target / input.fixedSceneDurationSec));
        if (canonicalizedScenes.length > expectedCount) {
          canonicalizedScenes.splice(expectedCount);
        }
      }
    }
  }

  return canonicalizedScenes;
}
