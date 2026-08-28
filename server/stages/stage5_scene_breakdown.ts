import { executeLLMRequest, safeParseJSON } from '../llm_provider';
import { Type } from '../gemini';
import { NarrativeBeats, ReasoningConfig, Scene } from '../../src/types';
import { buildNarrativeVoiceInstruction, recommendSceneTone } from '../narrative_tone';

export interface Stage5SceneBreakdownInput {
  narrativeBeats: NarrativeBeats;
  totalDurationTargetSec: number;
  maxSceneDurationSec: number; // Effective ceiling (e.g. 30 if null/Auto)
  fixedSceneDurationSec?: number | null; // Fixed duration per scene if specified by user
  allowFinalSceneOverride?: boolean;
  language: 'id' | 'en';
  model?: string;
  reasoningConfig?: ReasoningConfig;
  feedbackPrompt?: string; // Corrective prompt on retry
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

  const systemInstruction = `${baseInstruction}\n\n${narrativeDoctrine}`;

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
        location_name: { type: Type.STRING, description: 'Associated set or location name' },
        time_of_day: { type: Type.STRING, description: 'DAWN, DAY, DUSK, NIGHT, MIDNIGHT' },
        character_names: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Characters present in this scene',
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

  // Handle final scene override / duration rounding for fixed mode if total doesn't match perfectly
  if (isFixed && input.fixedSceneDurationSec && sanitizedScenes.length > 0) {
    let currentTotal = sanitizedScenes.reduce((sum, s) => sum + s.duration_sec, 0);
    const target = input.totalDurationTargetSec;
    const diff = target - currentTotal;
    if (diff !== 0) {
      if (input.allowFinalSceneOverride) {
        sanitizedScenes[sanitizedScenes.length - 1].duration_sec += diff;
      } else {
        // Adjust scene count to fit target exactly
        const expectedCount = Math.max(1, Math.round(target / input.fixedSceneDurationSec));
        if (sanitizedScenes.length > expectedCount) {
          sanitizedScenes.splice(expectedCount);
        }
      }
    }
  }

  return sanitizedScenes;
}
