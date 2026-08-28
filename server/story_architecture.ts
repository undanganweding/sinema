import {
  Project,
  ProjectFoundation,
  StoryArchitecture,
  ColdOpen,
  Act,
  StorySequence,
  Beat,
  NarrativeMode,
  Scene,
  Shot,
} from '../src/types';
import { executeLLMRequest } from './llm_provider';

/**
 * Cinematic Grammar mappings for Narrative Modes
 */
export const CINEMATIC_GRAMMAR_GUIDELINES: Record<
  NarrativeMode,
  {
    recommendedFraming: string[];
    cameraMovement: string;
    lightingAndMood: string;
    audioFocus: string;
    description: string;
  }
> = {
  NARRATOR: {
    recommendedFraming: ['Wide Establishing Shot', 'Extreme Wide Panoramic', 'Environmental Montage', 'High Angle Tracking'],
    cameraMovement: 'Slow grand dolly, slow atmospheric pan, or smooth tracking movement',
    lightingAndMood: 'Atmospheric natural lighting, expansive horizon, dignified scale',
    audioFocus: 'Authoritative dignified Voice-Over narration, atmospheric ambient soundscape, subtle orchestral resonance',
    description: 'Mode Narator: Memberikan pemahaman konteks, wawasan historis, dan pengantar babak secara bermartabat.',
  },
  DIALOGUE: {
    recommendedFraming: ['Medium Shot', 'Over-The-Shoulder (OTS)', 'Close-Up', 'Reverse Reaction Shot'],
    cameraMovement: 'Restrained, steady eye-level camera, subtle push-in on key statements',
    lightingAndMood: 'Warm key light on speaker face, soft fill, shallow depth of field focusing on subtle micro-expressions',
    audioFocus: 'Intimate, crystal-clear spoken dialogue, subtle natural room tone, subdued ambient background',
    description: 'Mode Dialog: Interaksi verbal antar karakter untuk membangun relasi, konflik, atau resolusi.',
  },
  ACTION: {
    recommendedFraming: ['Dynamic Wide Action Shot', 'Low Angle Push-In', 'Rapid Tracking Shot', 'Controlled Handheld Follow'],
    cameraMovement: 'Dynamic follow-cam, fast tracking, rhythmic kinetic pacing',
    lightingAndMood: 'High contrast lighting, motion blur highlights, sharp shadows, dusty atmospheric back-lighting',
    audioFocus: 'Impactful SFX (footsteps, horse gallops, clash of armor/tools), heavy atmospheric rush',
    description: 'Mode Aksi: Pergerakan dinamis, ketegangan fisik, mobilitas karakter, atau manuver skala besar.',
  },
  VISUAL_ONLY: {
    recommendedFraming: ['Cinematic Environmental Tableaux', 'Macro Detail Insert', 'Poetic Atmospheric Wide', 'Symmetrical Silhouette'],
    cameraMovement: 'Static locked-off majestic frame or ultra-slow drifting slider',
    lightingAndMood: 'Deep dramatic chiaroscuro, poetic god rays, silhouette against golden hour sunset',
    audioFocus: 'Rich environmental soundscape (wind howling, desert sand shifting, distant birds), zero spoken voice',
    description: 'Mode Visual Murni: Menyampaikan emosi dan makna melalui visual dan atmosfer tanpa kata-kata.',
  },
  REACTION: {
    recommendedFraming: ['Tight Close-Up', 'Extreme Close-Up on eyes/expression', 'Profile Reaction Shot'],
    cameraMovement: 'Subtle slow zoom-in capturing internal realizations and psychological weight',
    lightingAndMood: 'Focused directional lighting emphasizing emotional contemplation and eye catchlight',
    audioFocus: 'Sudden ambient ducking, heartbeat thud, intake of breath, resonant silence',
    description: 'Mode Reaksi: Respons emosional, keterkejutan, perenungan, atau kepedihan mendalam seorang tokoh.',
  },
  MIXED: {
    recommendedFraming: ['Medium Tracking into Close-Up', 'Two-Shot transitioning to Wide Action'],
    cameraMovement: 'Fluid combination of tracking and reframing',
    lightingAndMood: 'Dynamic cinematic contrast matching unfolding events',
    audioFocus: 'Layered blend of succinct dialogue, ambient SFX, and short narrator punctuation',
    description: 'Mode Campuran: Paduan terukur antara aksi visual, dialog singkat, dan narasi penghubung.',
  },
};

/**
 * Derives default Acts (Babak), Sequences, and Beats for backward compatibility on legacy projects
 */
export function synthesizeStoryArchitectureForLegacyProject(
  project: Project,
  foundation: ProjectFoundation | null,
  scenes: Scene[],
  shotsMap?: Record<string, Shot[]>
): StoryArchitecture {
  const acts: Act[] = [];
  const sequences: StorySequence[] = [];

  // Group scenes into logical Acts (e.g. 5-Act structure based on Narrative Beats)
  const actCount = Math.max(1, Math.min(6, Math.ceil(scenes.length / 3)));
  const scenesPerAct = Math.ceil(scenes.length / actCount);

  const actTitles = [
    { title: 'Babak I: Fajar Permulaan & Fondasi', goal: 'Membangun dunia, identitas para tokoh, dan latar waktu' },
    { title: 'Babak II: Benih Ketegangan & Isyarat', goal: 'Memunculkan dinamika awal dan tantangan yang mendekat' },
    { title: 'Babak III: Puncak Krisis & Konfrontasi', goal: 'Menghadapi peristiwa krusial dan titik balik cerita' },
    { title: 'Babak IV: Resolusi & Dampak', goal: 'Penyelesaian peristiwa besar dan konsekuensi yang timbul' },
    { title: 'Babak V: Hikmah Abadi & Penutup', goal: 'Menutup kisah dengan pesan moral dan renungan mendalam' },
    { title: 'Babak VI: Epilog Historis', goal: 'Gema sejarah yang membekas sepanjang masa' },
  ];

  for (let a = 0; a < actCount; a++) {
    const actId = `act_${a + 1}`;
    const actScenes = scenes.slice(a * scenesPerAct, (a + 1) * scenesPerAct);
    const seqId = `seq_${a + 1}_1`;

    const seq: StorySequence = {
      sequence_id: seqId,
      act_id: actId,
      sequence_number: 1,
      title: `Rangkaian ${a + 1}: ${actScenes[0]?.title || `Peristiwa ${a + 1}`}`,
      purpose: actScenes[0]?.story_purpose || 'Mengembangkan peristiwa naratif babak ini',
      dramatic_goal: actTitles[a]?.goal || 'Mendorong progresivitas kisah',
      scene_ids: actScenes.map(s => s.id || `scene_${s.scene_number}`),
    };
    sequences.push(seq);

    acts.push({
      act_id: actId,
      act_number: a + 1,
      title: actTitles[a]?.title || `Babak ${a + 1}`,
      purpose: `Membawakan alur ${a + 1} dari narasi global`,
      dramatic_goal: actTitles[a]?.goal || 'Pengembangan alur dramatis',
      emotional_arc: foundation?.emotional_arc || 'Perjalanan emosi yang mendalam',
      sequence_ids: [seqId],
    });
  }

  // Generate Cold Open preview from initial premise or first scene
  const coldOpen: ColdOpen = {
    title: `Prolog Epik: Pembuka ${project.title}`,
    visual_hook: 'Kilasan dramatis yang memancing rasa ingin tahu penonton tentang takdir agung yang akan terjadi',
    dramatic_question: 'Bagaimana peristiwa besar ini bermula dari lembah sunyi yang penuh kemuliaan?',
    dialogue_minimal: '',
    cut_to_black_transition: 'Layar memudar ke hitam pekat (CUT TO BLACK)... Muncul teks: "Namun untuk memahami bagaimana peristiwa ini tiba..."',
    duration_sec: 10,
  };

  return {
    project_id: project.id,
    title: project.title,
    premise: foundation?.theme || project.raw_script.slice(0, 200),
    historical_period: foundation?.era || 'Era Klasik',
    narrative_objective: foundation?.narrative_arc || 'Menyajikan kisah otentik nan bermartabat',
    audience: 'Penonton umum, penikmat sinema sejarah, dan generasi muda',
    total_target_duration: project.total_duration_target_sec,
    global_narrative_voice: project.narrative_style_config?.narrative_mode || 'cinematic_sirah',
    visual_language: foundation?.visual_tone || 'Sinematik bermartabat dengan palet earth-tone otentik',
    cold_open: coldOpen,
    acts,
    sequences,
    ending_epilogue: 'Refleksi abadi tentang nilai-nilai keteguhan, kemuliaan, dan takdir Ilahi.',
    updated_at: new Date().toISOString(),
  };
}

/**
 * Generates Beats for a Scene based on its shots and narrative purpose
 */
export function deriveBeatsForScene(scene: Scene, shots: Shot[]): Beat[] {
  if (scene.beats && scene.beats.length > 0) {
    return scene.beats;
  }

  const beats: Beat[] = [];
  const narrativeModeCycle: NarrativeMode[] = ['NARRATOR', 'ACTION', 'DIALOGUE', 'REACTION', 'VISUAL_ONLY', 'MIXED'];

  if (shots && shots.length > 0) {
    shots.forEach((shot, index) => {
      // Determine appropriate narrative mode for shot
      let mode: NarrativeMode = 'VISUAL_ONLY';
      if (shot.dialogue && shot.dialogue.length > 0) {
        mode = 'DIALOGUE';
      } else if (shot.event_detail.toLowerCase().includes('berlari') || shot.event_detail.toLowerCase().includes('berjalan') || shot.character_action.toLowerCase().includes('bergerak')) {
        mode = 'ACTION';
      } else if (shot.emotion && (shot.emotion.toLowerCase().includes('terkejut') || shot.emotion.toLowerCase().includes('haru') || shot.emotion.toLowerCase().includes('sedih'))) {
        mode = 'REACTION';
      } else if (index === 0) {
        mode = 'NARRATOR';
      } else {
        mode = narrativeModeCycle[index % narrativeModeCycle.length];
      }

      const grammar = CINEMATIC_GRAMMAR_GUIDELINES[mode];

      beats.push({
        beat_id: `beat_${scene.scene_number}_${index + 1}`,
        scene_id: scene.id || `scene_${scene.scene_number}`,
        beat_number: index + 1,
        purpose: `Beat ${index + 1}: ${shot.event_detail.slice(0, 60)}...`,
        action: shot.character_action || shot.event_detail,
        character: shot.dialogue?.[0]?.character_name || scene.character_names?.[0],
        dialogue: shot.dialogue?.map(d => `${d.character_name}: "${d.line}"`).join('\n') || undefined,
        narration: mode === 'NARRATOR' ? scene.story_purpose : undefined,
        emotional_state: shot.emotion || scene.emotional_objective,
        visual_objective: shot.camera_note,
        audio: shot.audio_note,
        narrative_mode: mode,
        camera_recommendation: grammar.recommendedFraming[0],
      });
    });
  } else {
    // Default 3-beat structure if shots not yet generated
    beats.push(
      {
        beat_id: `beat_${scene.scene_number}_1`,
        scene_id: scene.id || `scene_${scene.scene_number}`,
        beat_number: 1,
        purpose: 'Pengenalan situasi dan atmosfer adegan',
        action: scene.event,
        narrative_mode: 'NARRATOR',
        camera_recommendation: 'Wide Establishing Shot',
      },
      {
        beat_id: `beat_${scene.scene_number}_2`,
        scene_id: scene.id || `scene_${scene.scene_number}`,
        beat_number: 2,
        purpose: 'Inti aksi dan dinamika tokoh',
        action: scene.story_purpose,
        narrative_mode: 'ACTION',
        camera_recommendation: 'Medium Action Shot',
      },
      {
        beat_id: `beat_${scene.scene_number}_3`,
        scene_id: scene.id || `scene_${scene.scene_number}`,
        beat_number: 3,
        purpose: 'Transisi dan resonansi emosional penutup adegan',
        action: scene.emotional_objective,
        narrative_mode: 'REACTION',
        camera_recommendation: 'Close-Up Reaction',
      }
    );
  }

  return beats;
}

/**
 * Validates Narrative / Dialogue balance across all scenes
 * Target guideline: Narrator 40-50%, Dialogue 25-35%, Visual/Action 15-25%
 */
export function analyzeNarrativeBalance(scenes: Scene[]): {
  narratorRatio: number;
  dialogueRatio: number;
  visualActionRatio: number;
  isBalanced: boolean;
  recommendations: string[];
} {
  let narratorCount = 0;
  let dialogueCount = 0;
  let visualActionCount = 0;
  let totalBeats = 0;

  for (const scene of scenes) {
    if (scene.beats && scene.beats.length > 0) {
      for (const beat of scene.beats) {
        totalBeats++;
        if (beat.narrative_mode === 'NARRATOR') narratorCount++;
        else if (beat.narrative_mode === 'DIALOGUE') dialogueCount++;
        else visualActionCount++;
      }
    }
  }

  if (totalBeats === 0) {
    return {
      narratorRatio: 0.4,
      dialogueRatio: 0.35,
      visualActionRatio: 0.25,
      isBalanced: true,
      recommendations: [],
    };
  }

  const narratorRatio = narratorCount / totalBeats;
  const dialogueRatio = dialogueCount / totalBeats;
  const visualActionRatio = visualActionCount / totalBeats;

  const recommendations: string[] = [];
  if (narratorRatio > 0.65) {
    recommendations.push('Porsi narator terlalu dominan (>65%). Tambahkan lebih banyak dialog langsung dan aksi visual.');
  }
  if (dialogueRatio < 0.15 && scenes.length > 3) {
    recommendations.push('Porsi dialog interaktif cukup rendah (<15%). Pertimbangkan interaksi verbal bermartabat antar tokoh.');
  }

  return {
    narratorRatio,
    dialogueRatio,
    visualActionRatio,
    isBalanced: recommendations.length === 0,
    recommendations,
  };
}
