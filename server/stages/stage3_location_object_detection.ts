import { executeLLMRequest, safeParseJSON } from '../llm_provider';
import { Type } from '../gemini';
import { LocationBible, ObjectBible, ProjectFoundation, ReasoningConfig } from '../../src/types';

export interface Stage3LocationObjectInput {
  rawScript: string;
  foundation: Omit<ProjectFoundation, 'id' | 'project_id' | 'updated_at'>;
  language: 'id' | 'en';
  model?: string;
  reasoningConfig?: ReasoningConfig;
}

export type DetectedLocation = Omit<
  LocationBible,
  'id' | 'project_id' | 'version' | 'created_at' | 'updated_at'
>;

export type DetectedObject = Omit<
  ObjectBible,
  'id' | 'project_id' | 'version' | 'created_at' | 'updated_at'
>;

export interface Stage3Output {
  locations: DetectedLocation[];
  objects: DetectedObject[];
}

export async function runStage3LocationObjectDetection(
  input: Stage3LocationObjectInput
): Promise<Stage3Output> {
  const isIndo = input.language === 'id';

  const systemInstruction = isIndo
    ? `Anda adalah Production Designer & Location Scout sinematik legendaris.
Tugas Anda: Deteksi dan formulasikan spesifikasi produksi mendalam untuk SEMUA LOKASI (Location Bible) dan OBJEK/PROPERTI KUNCI (Object Bible) yang penting untuk kontinuitas film dari naskah.
Berikan deskripsi visual arsitektur, iklim, pencahayaan, palet warna, material, serta catatan kontinuitas properti yang presisi.`
    : `You are a legendary Cinematic Production Designer & Master Location Scout.
Your task: Detect and establish in-depth production specifications for ALL key Locations (Location Bible) and significant Props/Objects (Object Bible) essential for filmmaking continuity.
Provide rich architectural aesthetics, lighting setups, color palettes, materials, and strict continuity tracking notes.`;

  const prompt = `Analisis naskah dan Story Understanding berikut untuk membangun Location & Object Bible:

=== STORY FOUNDATION ===
Era: ${input.foundation.era}
Genre: ${input.foundation.genre}
Locations Mentioned: ${input.foundation.locations.join(', ')}
Visual Tone: ${input.foundation.visual_tone}

=== RAW SCRIPT / STORYBOARD ===
${input.rawScript}
===============================`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      locations: {
        type: Type.ARRAY,
        description: 'Comprehensive Location Bible entries',
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Location name or set title' },
            era: { type: Type.STRING, description: 'Era / architectural period of the set' },
            architecture: { type: Type.STRING, description: 'Architectural style, structural features, ceiling heights, textures' },
            environment: { type: Type.STRING, description: 'Interior / Exterior, urban / wild, ambient atmosphere' },
            landscape: { type: Type.STRING, description: 'Surrounding terrain, cityscape, or geographical features' },
            climate: { type: Type.STRING, description: 'Weather conditions, humidity, precipitation, seasonal atmosphere' },
            culture: { type: Type.STRING, description: 'Cultural decor, cultural markers, socio-economic backdrop' },
            lighting_style: { type: Type.STRING, description: 'Cinematographic lighting scheme (e.g., volumetric haze, warm Edison rim light, neon reflection)' },
            color_palette: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Array of dominant color names / hex tones for set dressing',
            },
            material: { type: Type.STRING, description: 'Primary construction & surface materials (e.g., exposed brutalist concrete, weathered teak wood, anodized steel)' },
          },
          required: [
            'name',
            'era',
            'architecture',
            'environment',
            'landscape',
            'climate',
            'culture',
            'lighting_style',
            'color_palette',
            'material',
          ],
        },
      },
      objects: {
        type: Type.ARRAY,
        description: 'Key props, tools, artifacts, vehicles, or symbolic objects',
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Object / prop name' },
            category: { type: Type.STRING, description: 'Category (e.g., Weapon, Tech Device, Heirloom, Vehicle, Document, Key Prop)' },
            description: { type: Type.STRING, description: 'Physical specifications, wear condition, material, color, branding/insignia' },
            continuity_notes: { type: Type.STRING, description: 'Critical continuity rules (e.g., must have crack on screen in Act 2, bloodstain on left corner, glowing blue LED when activated)' },
          },
          required: ['name', 'category', 'description', 'continuity_notes'],
        },
      },
    },
    required: ['locations', 'objects'],
  };

  const response = await executeLLMRequest({
    reasoningConfig: input.reasoningConfig,
    model: input.model,
    prompt,
    systemInstruction,
    temperature: 0.3,
    responseSchema,
  });

  if (!response.text) {
    throw new Error('Stage 3 failed: LLM provider returned an empty response.');
  }

  const parsed = safeParseJSON(response.text) as Stage3Output;
  return parsed;
}
