import { executeLLMRequest, safeParseJSON } from '../llm_provider';
import { Type } from '../gemini';
import { CharacterBible, ContextPackage, LocationBible, NarrativeBeats, ProjectFoundation, ReasoningConfig } from '../../src/types';
import { buildNarrativeVoiceInstruction } from '../narrative_tone';

export interface Stage4NarrativeStructureInput {
  rawScript: string;
  foundation: Omit<ProjectFoundation, 'id' | 'project_id' | 'updated_at'>;
  characters: CharacterBible[];
  locations: LocationBible[];
  contextPackage?: ContextPackage | null;
  language: 'id' | 'en';
  model?: string;
  reasoningConfig?: ReasoningConfig;
}

export async function runStage4NarrativeStructure(
  input: Stage4NarrativeStructureInput
): Promise<NarrativeBeats> {
  const isIndo = input.language === 'id';
  const narrativeDoctrine = buildNarrativeVoiceInstruction(null, input.language);

  const baseInstruction = isIndo
    ? `Anda adalah Master Script Doctor & Narrative Structure Architect perfilman dunia.
Tugas Anda: Menganalisis naskah secara holistik bersama dengan seluruh konteks fondasi cerita, karakter-karakter, dan lokasi yang telah teridentifikasi.
Susun Peta Struktur Naratif 5-Babak Global (Beginning, Development, Climax, Consequence, Ending).
PENTING: Ini adalah pemahaman makro/global cerita yang menjadi fondasi mutlak sebelum naskah dipecah menjadi scene. Jelaskan bobot emosional dan peristiwa kunci di tiap babak dengan artikulasi sinematik yang tajam.`
    : `You are a world-renowned Master Script Doctor & Narrative Structure Architect.
Your task: Synthesize the full script alongside all identified foundation context, characters, and locations.
Formulate a Global 5-Beat Narrative Structure Map (Beginning, Development, Climax, Consequence, Ending).
IMPORTANT: This represents the macro-level cinematic story architecture required prior to scene breakdowns. Detail the emotional weight and key dramatic beats for each phase with high precision.`;

  const groundingContext = input.contextPackage ? JSON.stringify(input.contextPackage, null, 2) : 'No grounding context available.';
  const systemInstruction = `${baseInstruction}\n\n${narrativeDoctrine}\n\nGROUNDING CONTEXT:\n${groundingContext}`;

  const charSummary = input.characters
    .map((c) => `${c.name} (${c.gender}, ${c.age}): ${c.personality}`)
    .join('\n');

  const locSummary = input.locations
    .map((l) => `${l.name} (${l.era}, ${l.environment}): ${l.lighting_style}`)
    .join('\n');

  const prompt = `Analisis naskah dengan memperhitungkan seluruh konteks Stage 1-3 berikut untuk menghasilkan Narrative Beats 5-Babak:

=== STORY FOUNDATION ===
Era: ${input.foundation.era}
Genre: ${input.foundation.genre}
Theme: ${input.foundation.theme}
Main Conflict: ${input.foundation.main_conflict}
Emotional Arc: ${input.foundation.emotional_arc}
Narrative Arc: ${input.foundation.narrative_arc}
Visual Tone: ${input.foundation.visual_tone}

=== DETECTED CHARACTERS ===
${charSummary || 'None explicitly identified'}

=== DETECTED LOCATIONS ===
${locSummary || 'None explicitly identified'}

=== RAW SCRIPT / STORYBOARD ===
${input.rawScript}
===============================`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      beginning: {
        type: Type.STRING,
        description: 'Beginning (Exposition / Inciting Incident): Setting the world, normal status quo, introduction of primary characters, and the spark that disrupts equilibrium.',
      },
      development: {
        type: Type.STRING,
        description: 'Development (Rising Action / Escalation): Deepening conflict, obstacles, rising stakes, character choices, and tension buildup towards unavoidable collision.',
      },
      climax: {
        type: Type.STRING,
        description: 'Climax (Point of Maximum Dramatic Tension): The central confrontation, truth revelation, ultimate choice, or critical turning point of the entire film.',
      },
      consequence: {
        type: Type.STRING,
        description: 'Consequence (Falling Action / Immediate Aftermath): Direct repercussions of the climax, emotional fallout, unraveling stakes, and shifts in relationships.',
      },
      ending: {
        type: Type.STRING,
        description: 'Ending (Resolution / Final Resonance): The new normal, thematic payoff, final cinematic image/lingering emotion left with the audience.',
      },
    },
    required: ['beginning', 'development', 'climax', 'consequence', 'ending'],
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
    throw new Error('Stage 4 failed: LLM provider returned an empty response.');
  }

  const parsed = safeParseJSON(response.text) as NarrativeBeats;
  return parsed;
}
