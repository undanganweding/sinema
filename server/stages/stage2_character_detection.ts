import { executeLLMRequest, safeParseJSON } from '../llm_provider';
import { Type } from '../gemini';
import { CharacterBible, ContextPackage, ProjectFoundation, ReasoningConfig } from '../../src/types';

export interface Stage2CharacterDetectionInput {
  rawScript: string;
  foundation: Omit<ProjectFoundation, 'id' | 'project_id' | 'updated_at'>;
  contextPackage?: ContextPackage | null;
  language: 'id' | 'en';
  model?: string;
  reasoningConfig?: ReasoningConfig;
}

export type DetectedCharacter = Omit<
  CharacterBible,
  'id' | 'project_id' | 'version' | 'created_at' | 'updated_at'
>;

export async function runStage2CharacterDetection(
  input: Stage2CharacterDetectionInput
): Promise<DetectedCharacter[]> {
  const isIndo = input.language === 'id';

  const groundingContext = input.contextPackage ? JSON.stringify(input.contextPackage, null, 2) : 'No grounding context available.';
  const systemInstruction = isIndo
    ? `Anda adalah Casting Director & Character Bible Architect untuk produksi film sinematik.
Tugas Anda: Deteksi dan buat profil mendalam (Character Bible) untuk SEMUA karakter utama dan pendukung yang muncul atau teridentifikasi dalam naskah.
Penting: Berikan detail fisik, pakaian, aksesori, rambut, janggut, gaya suara, dan gaya gerak tubuh yang sangat spesifik dan konsisten untuk produksi film.
Jika karakter tidak memiliki janggut atau tidak relevan, tulis "None" atau "Tidak ada". face_identity_locked default adalah false.`
    : `You are a Hollywood Casting Director & Character Bible Architect for cinematic film productions.
Your task: Detect and generate comprehensive Character Bibles for ALL main and supporting characters in the script.
Provide ultra-specific physical, wardrobe, facial, vocal, and body language traits that maintain strict production continuity.
If beard is not applicable, write "None". face_identity_locked defaults to false.`;
  const groundedSystemInstruction = `${systemInstruction}\n\nGROUNDING CONTEXT:\n${groundingContext}`;

  const prompt = `Analisis naskah dan Story Understanding berikut untuk membangun Character Bible:

=== STORY FOUNDATION ===
Era: ${input.foundation.era}
Genre: ${input.foundation.genre}
Theme: ${input.foundation.theme}
Main Characters: ${input.foundation.main_characters.join(', ')}
Supporting Characters: ${input.foundation.supporting_characters.join(', ')}
Visual Tone: ${input.foundation.visual_tone}

=== RAW SCRIPT / STORYBOARD ===
${input.rawScript}
===============================`;

  const responseSchema = {
    type: Type.ARRAY,
    description: 'Array of detected characters with complete production bible profiles',
    items: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Full character name' },
        age: { type: Type.STRING, description: 'Apparent or stated age (e.g., 34 years old, Early 20s)' },
        gender: { type: Type.STRING, description: 'Gender identity / presentation' },
        physical_appearance: {
          type: Type.STRING,
          description: 'Detailed build, height, skin tone, facial features, distinctive marks/scars',
        },
        face_identity_locked: {
          type: Type.BOOLEAN,
          description: 'Whether actor facial consistency lock is enabled (default false)',
        },
        hair: {
          type: Type.STRING,
          description: 'Hair color, length, styling, texture (e.g., Jet black slicked pompadour, Messy silver curls)',
        },
        beard: {
          type: Type.STRING,
          description: 'Facial hair style or "None" / "Clean shaven"',
        },
        clothing: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Key wardrobe items, fabric texture, style, wear condition',
        },
        accessories: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Signature accessories (e.g., antique bronze watch, neon visor, tactical gloves)',
        },
        personality: {
          type: Type.STRING,
          description: 'Core psychological profile, temperament, and character motivations',
        },
        voice_character: {
          type: Type.STRING,
          description: 'Vocal timbre, cadence, pitch, accent, and speech rhythm',
        },
        movement_style: {
          type: Type.STRING,
          description: 'Body language, posture, gait, tempo of physical gestures',
        },
      },
      required: [
        'name',
        'age',
        'gender',
        'physical_appearance',
        'face_identity_locked',
        'hair',
        'beard',
        'clothing',
        'accessories',
        'personality',
        'voice_character',
        'movement_style',
      ],
    },
  };

  const response = await executeLLMRequest({
    reasoningConfig: input.reasoningConfig,
    model: input.model,
    prompt,
    systemInstruction: groundedSystemInstruction,
    temperature: 0.3,
    responseSchema,
  });

  if (!response.text) {
    throw new Error('Stage 2 failed: LLM provider returned an empty response.');
  }

  const parsed = safeParseJSON(response.text) as DetectedCharacter[];
  return parsed;
}
