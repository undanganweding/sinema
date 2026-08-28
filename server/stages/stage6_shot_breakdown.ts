import { executeLLMRequest, safeParseJSON } from '../llm_provider';
import { Type } from '../gemini';
import { ContextPackage, Scene, CharacterBible, LocationBible, ObjectBible, Shot, ReasoningConfig } from '../../src/types';
import {
  buildNarrativeVoiceInstruction,
  buildSceneToneInstruction,
  resolveSceneTone,
} from '../narrative_tone';

export interface Stage6ShotBreakdownInput {
  scene: Scene;
  characters: CharacterBible[];
  locations: LocationBible[];
  objects: ObjectBible[];
  contextPackage?: ContextPackage | null;
  language: 'id' | 'en';
  model?: string;
  reasoningConfig?: ReasoningConfig;
  feedbackPrompt?: string;
}

export type DetectedShot = Omit<
  Shot,
  'id' | 'scene_id' | 'project_id' | 'version' | 'created_at' | 'updated_at'
>;

export function getMaxShotsForDuration(durationSec: number): number {
  if (durationSec < 10) return 1; // 5 <= duration < 10: 1 shot
  if (durationSec < 20) return 2; // 10 <= duration < 20: 1-2 shots
  return 3;                       // 20 <= duration <= 30: 2-3 shots
}

export interface Stage6ValidationResult {
  valid: boolean;
  calculatedTotal: number;
  expectedDuration: number;
  maxAllowedShots: number;
  actualShotCount: number;
  errorMessage?: string;
  correctivePrompt?: string;
}

/**
 * Validates shot duration total strictly against parent scene duration
 */
export function validateShotDurationTotal(
  scene: { duration_sec: number },
  shots: DetectedShot[]
): { valid: boolean; total: number; expected: number; error?: string } {
  if (!shots || shots.length === 0) {
    return { valid: false, total: 0, expected: scene.duration_sec, error: 'Daftar shot kosong' };
  }

  let total = 0;
  for (const shot of shots) {
    if (typeof shot.duration_sec !== 'number' || isNaN(shot.duration_sec) || shot.duration_sec <= 0) {
      return {
        valid: false,
        total,
        expected: scene.duration_sec,
        error: `Shot #${shot.shot_number} memiliki durasi tidak valid (${shot.duration_sec})`,
      };
    }
    total += shot.duration_sec;
  }

  const roundedTotal = Math.round(total * 10) / 10;
  const roundedExpected = Math.round(scene.duration_sec * 10) / 10;

  if (roundedTotal !== roundedExpected) {
    return {
      valid: false,
      total: roundedTotal,
      expected: roundedExpected,
      error: `Total durasi shot (${roundedTotal}s) tidak sama dengan durasi scene (${roundedExpected}s)`,
    };
  }

  return { valid: true, total: roundedTotal, expected: roundedExpected };
}

export function validateShotBreakdown(
  shots: DetectedShot[],
  sceneDurationSec: number,
  language: 'id' | 'en'
): Stage6ValidationResult {
  const isIndo = language === 'id';
  const maxAllowedShots = getMaxShotsForDuration(sceneDurationSec);
  let calculatedTotal = 0;
  const violations: string[] = [];

  if (!shots || shots.length === 0) {
    return {
      valid: false,
      calculatedTotal: 0,
      expectedDuration: sceneDurationSec,
      maxAllowedShots,
      actualShotCount: 0,
      errorMessage: isIndo ? 'Daftar shot kosong' : 'Shot list is empty',
      correctivePrompt: `The previous shot breakdown has an invalid total duration. Scene duration: ${sceneDurationSec} seconds. Generated shot total: 0 seconds. Correct ONLY the shot durations so that the total equals exactly ${sceneDurationSec} seconds. Do not change the scene narrative, characters, locations, or dramatic intent.`,
    };
  }

  // 1. Check max shot count
  if (shots.length > maxAllowedShots) {
    violations.push(
      isIndo
        ? `Jumlah shot (${shots.length}) melebihi batas maksimal untuk durasi scene ${sceneDurationSec}s (Maks: ${maxAllowedShots} shot).`
        : `Shot count (${shots.length}) exceeds hard cap for scene duration ${sceneDurationSec}s (Max: ${maxAllowedShots} shot(s)).`
    );
  }

  // 2. Check sum & continuous timeline
  let expectedStart = 0;
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    calculatedTotal += shot.duration_sec;

    if (shot.duration_sec <= 0) {
      violations.push(
        isIndo
          ? `Shot #${shot.shot_number} memiliki durasi tidak valid (${shot.duration_sec} detik).`
          : `Shot #${shot.shot_number} has invalid duration (${shot.duration_sec}s).`
      );
    }

    if (shot.start_time_sec !== expectedStart) {
      violations.push(
        isIndo
          ? `Shot #${shot.shot_number} memiliki start_time_sec (${shot.start_time_sec}s) yang tidak kontinu (diharapkan ${expectedStart}s).`
          : `Shot #${shot.shot_number} has non-continuous start time (${shot.start_time_sec}s, expected ${expectedStart}s).`
      );
    }

    if (shot.end_time_sec !== shot.start_time_sec + shot.duration_sec) {
      violations.push(
        isIndo
          ? `Shot #${shot.shot_number} memiliki end_time_sec (${shot.end_time_sec}s) yang tidak cocok dengan start (${shot.start_time_sec}s) + duration (${shot.duration_sec}s).`
          : `Shot #${shot.shot_number} end_time_sec (${shot.end_time_sec}s) does not match start + duration.`
      );
    }

    expectedStart = shot.end_time_sec;
  }

  if (expectedStart !== sceneDurationSec) {
    violations.push(
      isIndo
        ? `Timeline shot berakhir pada ${expectedStart}s, tidak pas dengan durasi scene induk ${sceneDurationSec}s.`
        : `Shot timeline ends at ${expectedStart}s, does not match parent scene duration ${sceneDurationSec}s.`
    );
  }

  const diff = calculatedTotal - sceneDurationSec;
  if (diff !== 0) {
    violations.push(
      isIndo
        ? `Total durasi seluruh shot adalah ${calculatedTotal} detik, tidak sama dengan durasi scene induk ${sceneDurationSec} detik (selisih: ${
            diff > 0 ? `+${diff}` : `${diff}`
          } detik).`
        : `Total shot duration is ${calculatedTotal}s, not equal to parent scene duration ${sceneDurationSec}s (variance: ${
            diff > 0 ? `+${diff}` : `${diff}`
          }s).`
    );
  }

  if (violations.length === 0) {
    return {
      valid: true,
      calculatedTotal,
      expectedDuration: sceneDurationSec,
      maxAllowedShots,
      actualShotCount: shots.length,
    };
  }

  const errorMessage = violations.join(' ');
  const correctivePrompt = `The previous shot breakdown has an invalid total duration. Scene duration: ${sceneDurationSec} seconds. Generated shot total: ${calculatedTotal} seconds. Correct ONLY the shot durations so that the total equals exactly ${sceneDurationSec} seconds. Do not change the scene narrative, characters, locations, or dramatic intent.`;

  return {
    valid: false,
    calculatedTotal,
    expectedDuration: sceneDurationSec,
    maxAllowedShots,
    actualShotCount: shots.length,
    errorMessage,
    correctivePrompt,
  };
}

export async function runStage6ShotBreakdownAttempt(
  input: Stage6ShotBreakdownInput
): Promise<DetectedShot[]> {
  const { scene, characters, locations, objects, language, feedbackPrompt, contextPackage } = input;
  const isIndo = language === 'id';

  const maxAllowedShots = getMaxShotsForDuration(scene.duration_sec);

  // Filter relevant characters & locations for this scene
  const relevantCharacters = characters.filter((c) =>
    scene.character_names.some((name) =>
      c.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(c.name.toLowerCase())
    )
  );
  const relevantLocation = locations.find((l) =>
    l.name.toLowerCase().includes(scene.location_name.toLowerCase()) ||
    scene.location_name.toLowerCase().includes(l.name.toLowerCase())
  );

  const narrativeDoctrine = buildNarrativeVoiceInstruction(null, language);
  const sceneTone = resolveSceneTone(scene);
  const sceneToneInstruction = buildSceneToneInstruction(scene, sceneTone, language);

  const baseInstruction = isIndo
    ? `Anda adalah Master Director & Cinematographer AI (Stage 6: Shot Breakdown Agent).
Tugas Anda adalah memecah SATU ADEGAN SINEMATIK menjadi rentetan SHOT kamera presisi.

BATASAN MUTLAK & ATURAN KERAS (NON-NEGOTIABLE HARD RULES):
1. Durasi Scene Induk: ${scene.duration_sec} DETIK.
2. Berdasarkan tabel durasi resmi:
   - 5-10 detik: MAKSIMAL 1 shot.
   - 10-20 detik: MAKSIMAL 1-2 shot.
   - 20-30 detik: MAKSIMAL 2-3 shot.
   - >30 detik: MAKSIMAL ceil(durasi/15), hard cap 3 shot.
   Untuk scene ini (durasi ${scene.duration_sec}s), JUMLAH SHOT MAKSIMAL ADALAH: ${maxAllowedShots} SHOT.
3. KESEIMBANGAN WAKTU: sum(shot.duration_sec) WAJIB TEPAT SAMA DENGAN ${scene.duration_sec} DETIK (toleransi 0).
4. Rentang waktu (start_time_sec & end_time_sec) harus berurutan tanpa gap dan tanpa overlap. Shot 1 mulai dari 0s.
5. "event_detail" (Detail Kejadian): Tulis ringkasan kejadian spesifik visual untuk shot ini secara jelas dan kaya narasi. Field ini akan menjadi SUMBER KEBENARAN TUNGGAL (Single Source of Truth) untuk pembuatan Image Prompt dan Video Prompt berikutnya!
6. "character_action": Aksi visual fisik karakter di dalam frame.
7. "camera_note": Jenis lensa, angle (low-angle, eye-level), framing (wide, medium, close-up), dan pergerakan kamera (dolly in, panning, static).
8. "dialogue": Dialog karakter jika ada pada shot ini (array of {character_name, line}), jika tidak ada berikan array kosong [].
9. "emotion": Nuansa emosional beat shot ini.
10. "audio_note": Ambience lingkungan & efek suara spesifik.`
    : `You are a Master AI Director & Cinematographer (Stage 6: Shot Breakdown Agent).
Your task is to break down ONE CINEMATIC SCENE into a precise sequence of CAMERA SHOTS.

NON-NEGOTIABLE HARD RULES:
1. Parent Scene Duration: ${scene.duration_sec} SECONDS.
2. Duration hard-cap table:
   - 5-10s: MAX 1 shot.
   - 10-20s: MAX 1-2 shots.
   - 20-30s: MAX 2-3 shots.
   - >30s: MAX ceil(duration/15), hard cap 3 shots.
   For this scene (${scene.duration_sec}s), MAXIMUM ALLOWED SHOTS IS: ${maxAllowedShots} SHOT(S).
3. EXACT DURATION SUM: sum(shot.duration_sec) MUST EQUAL EXACTLY ${scene.duration_sec} SECONDS.
4. Time range (start_time_sec to end_time_sec) must be contiguous from 0s to ${scene.duration_sec}s.
5. "event_detail": Write a vivid, precise summary of what happens in this shot. This field is the Single Source of Truth for subsequent Image and Video Prompts!
6. "character_action": Specific physical action of characters in frame.
7. "camera_note": Framing, camera movement, angle, and lens note.
8. "dialogue": Dialogue spoken during this shot ({character_name, line}) or empty [].
9. "emotion": Emotional beat.
10. "audio_note": Specific ambient and foley sound effects.`;

  const groundingContext = contextPackage ? JSON.stringify(contextPackage, null, 2) : 'No grounding context available.';
  const systemInstruction = `${baseInstruction}\n\n${narrativeDoctrine}\n\n${sceneToneInstruction}\n\nGROUNDING CONTEXT:\n${groundingContext}`;

  const userPrompt = `
=== DETAIL SCENE INDUK ===
Scene #${scene.scene_number}: ${scene.title}
Durasi Wajib: ${scene.duration_sec} detik
Lokasi: ${scene.location_name} (${scene.time_of_day})
Karakter Terlibat: ${scene.character_names.join(', ') || 'None'}
Tujuan Naratif: ${scene.story_purpose}
Tujuan Emosional: ${scene.emotional_objective}
Peristiwa Scene: ${scene.event}
Scene Tone: Preset=${sceneTone.preset || 'CUSTOM'}, Atmosphere=${sceneTone.atmosphere}, Pacing=${sceneTone.pacing}, Intensity=${sceneTone.intensity}/100, Tension=${sceneTone.dramatic_tension}/100

=== BIBLE KARAKTER TERKAIT ===
${relevantCharacters.map((c) => `- ${c.name}: ${c.physical_appearance}, Pakaian: ${c.clothing.join(', ')}, Wajah Terkunci: ${c.face_identity_locked}`).join('\n') || 'Tidak ada karakter spesifik'}

=== BIBLE LOKASI TERKAIT ===
${relevantLocation ? `Nama: ${relevantLocation.name}\nEra: ${relevantLocation.era}\nArsitektur & Lingkungan: ${relevantLocation.architecture}, ${relevantLocation.environment}\nPencahayaan: ${relevantLocation.lighting_style}` : 'Lokasi Umum'}

=== BIBLE OBJEK TERKAIT ===
${objects.map((o) => `- ${o.name} (${o.category}): ${o.description}`).join('\n') || 'None'}

${feedbackPrompt ? `\n=== INSTRUKSI KOREKSI / FEEDBACK DARI PERCOBAAN SEBELUMNYA ===\n${feedbackPrompt}\n` : ''}

Pecah scene ini menjadi maksimal ${maxAllowedShots} shot yang total durasinya pas ${scene.duration_sec} detik.
Kembalikan format JSON sesuai schema.
`;

  const response = await executeLLMRequest({
    reasoningConfig: input.reasoningConfig,
    model: input.model,
    prompt: userPrompt,
    systemInstruction,
    temperature: 0.2,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        shots: {
          type: Type.ARRAY,
          description: `Daftar shot yang membagi durasi scene ${scene.duration_sec}s secara tepat`,
          items: {
            type: Type.OBJECT,
            properties: {
              shot_number: { type: Type.INTEGER, description: 'Nomor shot urut mulai 1' },
              start_time_sec: { type: Type.NUMBER, description: 'Waktu mulai shot dalam scene (detik)' },
              end_time_sec: { type: Type.NUMBER, description: 'Waktu selesai shot dalam scene (detik)' },
              duration_sec: { type: Type.NUMBER, description: 'Durasi shot dalam detik' },
              event_detail: { type: Type.STRING, description: 'Ringkasan kejadian detail & visual untuk shot ini' },
              character_action: { type: Type.STRING, description: 'Aksi karakter pada shot ini' },
              camera_note: { type: Type.STRING, description: 'Pergerakan kamera, framing, lens & angle' },
              dialogue: {
                type: Type.ARRAY,
                description: 'Dialog pada shot ini, atau kosong jika hening/non-verbal',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    character_name: { type: Type.STRING },
                    line: { type: Type.STRING },
                  },
                  required: ['character_name', 'line'],
                },
              },
              emotion: { type: Type.STRING, description: 'Nuansa emosi' },
              audio_note: { type: Type.STRING, description: 'Catatan audio, SFX & ambience' },
            },
            required: [
              'shot_number',
              'start_time_sec',
              'end_time_sec',
              'duration_sec',
              'event_detail',
              'character_action',
              'camera_note',
              'dialogue',
              'emotion',
              'audio_note',
            ],
          },
        },
      },
      required: ['shots'],
    },
  });

  const rawText = response.text?.trim() || '{}';
  const parsed = safeParseJSON(rawText);
  if (!parsed.shots || !Array.isArray(parsed.shots)) {
    throw new Error('Format JSON response Gemini tidak mengandung array "shots" yang valid.');
  }

  // Normalize shot numbers and times if slight float rounding
  const rawShots = parsed.shots as DetectedShot[];
  const normalizedShots: DetectedShot[] = rawShots.map((s, idx) => ({
    shot_number: idx + 1,
    start_time_sec: Number(s.start_time_sec),
    end_time_sec: Number(s.end_time_sec),
    duration_sec: Math.round(Number(s.duration_sec) * 10) / 10,
    event_detail: s.event_detail || '',
    character_action: s.character_action || '',
    camera_note: s.camera_note || '',
    dialogue: Array.isArray(s.dialogue) ? s.dialogue : [],
    emotion: s.emotion || '',
    audio_note: s.audio_note || '',
  }));

  return normalizedShots;
}
