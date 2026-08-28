import { executeLLMRequest, safeParseJSON } from '../llm_provider';
import { Type } from '../gemini';
import { ProjectFoundation, ReasoningConfig } from '../../src/types';
import { buildNarrativeVoiceInstruction, validateNarrativeStyle } from '../narrative_tone';

export interface Stage1StoryUnderstandingInput {
  rawScript: string;
  language: 'id' | 'en';
  model?: string;
  reasoningConfig?: ReasoningConfig;
}

export type Stage1Output = Omit<ProjectFoundation, 'id' | 'project_id' | 'updated_at' | 'narrative_beats'>;

export async function runStage1StoryUnderstanding(
  input: Stage1StoryUnderstandingInput
): Promise<Stage1Output> {
  const isIndo = input.language === 'id';
  const narrativeDoctrine = buildNarrativeVoiceInstruction(null, input.language);

  const baseInstruction = isIndo
    ? `Anda adalah Lead Film Director & Story Analyst AI sinematik kelas dunia.
Tugas Anda adalah menganalisis naskah / storyboard mentah dan mengekstrak fondasi cerita sinematik yang komprehensif.
Berikan analisis mendalam, tajam, dan siap digunakan untuk blueprint produksi film sinematik tingkat tinggi.
Gunakan Bahasa Indonesia yang elegan, bermartabat, dan sinematik.`
    : `You are a world-class Cinematic Lead Film Director & Narrative Analyst AI.
Your task is to analyze raw scripts or storyboards and extract a comprehensive cinematic story foundation.
Provide profound, sharp cinematic narrative insights ready for high-end film production blueprinting.
Output in English with high narrative dignity.`;

  const systemInstruction = `${baseInstruction}\n\n${narrativeDoctrine}`;

  const prompt = `Lakukan analisis mendalam (Story Understanding) pada naskah/storyboard berikut:\n\n=== RAW SCRIPT / STORYBOARD ===\n${input.rawScript}\n===============================`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      era: {
        type: Type.STRING,
        description: 'The historical or futuristic era/period of the story (e.g., Cyberpunk 2088, Victorian 1890, Modern Urban 2026, Feudal Nusantara)',
      },
      theme: {
        type: Type.STRING,
        description: 'Core thematic motifs (e.g., Sacrifice vs Ambition, Man vs Artificial Consciousness, Redemption)',
      },
      genre: {
        type: Type.STRING,
        description: 'Cinematic genre (e.g., Neo-Noir Sci-Fi Thriller, Psychological Drama, Epic Historical Fantasy)',
      },
      timeline: {
        type: Type.STRING,
        description: 'Story timeline scope (e.g., 24 hours of intense chase, A single fateful rainy evening, Multi-year chronicle)',
      },
      main_characters: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'List of key protagonist/antagonist names',
      },
      supporting_characters: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'List of supporting character names or notable figures',
      },
      locations: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Key cinematic environments and sets mentioned or implied',
      },
      main_conflict: {
        type: Type.STRING,
        description: 'The central dramatic conflict driving the plot and tension',
      },
      emotional_arc: {
        type: Type.STRING,
        description: 'The trajectory of emotional resonance and psychological shifts throughout the piece',
      },
      narrative_arc: {
        type: Type.STRING,
        description: 'The dramatic narrative structure from inciting incident to climax and resolution',
      },
      visual_tone: {
        type: Type.STRING,
        description: 'Cinematic visual direction, mood, color palette atmosphere, and lighting aesthetics (e.g., Desaturated anamorphic tones, high-contrast chiaroscuro, neon rain reflections)',
      },
    },
    required: [
      'era',
      'theme',
      'genre',
      'timeline',
      'main_characters',
      'supporting_characters',
      'locations',
      'main_conflict',
      'emotional_arc',
      'narrative_arc',
      'visual_tone',
    ],
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
    throw new Error('Stage 1 failed: LLM provider returned an empty response.');
  }

  const parsed = safeParseJSON(response.text) as Partial<Stage1Output> | null;
  return {
    era: parsed?.era || 'Unknown Era',
    theme: parsed?.theme || 'General Theme',
    genre: parsed?.genre || 'Cinematic Drama',
    timeline: parsed?.timeline || 'Linear Timeline',
    main_characters: Array.isArray(parsed?.main_characters) ? parsed.main_characters : ['Protagonist'],
    supporting_characters: Array.isArray(parsed?.supporting_characters) ? parsed.supporting_characters : [],
    locations: Array.isArray(parsed?.locations) ? parsed.locations : ['Main Location'],
    main_conflict: parsed?.main_conflict || 'Dramatic conflict',
    emotional_arc: parsed?.emotional_arc || 'Transformation and growth',
    narrative_arc: parsed?.narrative_arc || 'Inciting incident, rising action, climax, resolution',
    visual_tone: parsed?.visual_tone || 'Cinematic panavision 35mm film grain',
  };
}
