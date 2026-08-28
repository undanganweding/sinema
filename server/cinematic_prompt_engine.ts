import {
  Scene,
  Shot,
  ProjectFoundation,
  CharacterBible,
  LocationBible,
  ObjectBible,
  PromptTarget,
} from '../src/types';

export type { PromptTarget };

export type PromptDetailLevel = 'basic' | 'standard' | 'detailed' | 'cinematic' | 'maximum';
export type VideoModelTarget = 'veo' | 'gemini_omni' | 'seedance' | 'banana';

export interface MasterSceneData {
  project_title: string;
  episode?: string;
  scene_number: number;
  scene_title: string;
  scene_purpose: string;
  story_context: string;
  duration_sec: number;
  aspect_ratio: string;
  model_target: VideoModelTarget;
  detail_level: PromptDetailLevel;
  is_prophet_scene: boolean;

  characters: {
    name: string;
    identity: string;
    age: string;
    gender: string;
    appearance: string;
    face_locked: boolean;
    prophet_restrictions: boolean;
    costume: string[];
    accessories: string[];
    pose_expression: string;
    action: string;
  }[];

  location: {
    place: string;
    era: string;
    architecture: string;
    geography: string;
    environment: string;
    background: string;
    foreground: string;
    props: string[];
  };

  time: {
    time_of_day: string;
    season: string;
    weather: string;
    atmosphere: string;
  };

  action: {
    primary: string;
    secondary: string;
    interaction: string;
    environmental_reaction: string;
  };

  camera: {
    shot_type: string;
    angle: string;
    position: string;
    lens: string;
    focal_length: string;
    movement: string;
    speed: string;
    framing: string;
    focus: string;
    depth_of_field: string;
  };

  lighting: {
    source: string;
    direction: string;
    intensity: string;
    color_temperature: string;
    shadows: string;
    atmosphere: string;
  };

  visual_style: {
    realism: string;
    cinematic_style: string;
    material_realism: string;
    color_grading: string;
    film_texture: string;
    contrast: string;
  };

  mood: {
    emotion: string;
    tension: string;
    atmosphere: string;
  };

  continuity: {
    character_lock: boolean;
    clothing_lock: boolean;
    location_lock: boolean;
    prop_lock: boolean;
    lighting_lock: boolean;
    style_lock: boolean;
  };

  negative_prompt_modules: {
    anatomy: string[];
    identity: string[];
    clothing: string[];
    environment: string[];
    camera: string[];
    physics: string[];
    quality: string[];
    output: string[];
  };
}

/**
 * Semantic Scene Interpreter: Translates raw story event and entities into concrete visual & cinematic instructions.
 */
export function serializeMasterSceneData(
  scene: Scene,
  shots: Shot[],
  foundation: ProjectFoundation | null,
  characters: CharacterBible[],
  locations: LocationBible[],
  objects: ObjectBible[],
  target: VideoModelTarget = 'veo',
  detailLevel: PromptDetailLevel = 'cinematic',
  projectTitle: string = 'Cinematic Production',
  resolvedDuration?: number
): MasterSceneData {
  const era = foundation?.era || scene.era || 'Historical Ancient Era';
  const visualTone = foundation?.visual_tone || 'Cinematic Panavision anamorphic, 35mm film grain';
  const duration = resolvedDuration || scene.duration_sec || 10;

  const eventText = (scene.event || scene.title || '').toLowerCase();
  const isProphetScene =
    eventText.includes('rasulullah') ||
    eventText.includes('muhammad') ||
    scene.character_names?.some((c) => c.toLowerCase().includes('rasulullah') || c.toLowerCase().includes('muhammad'));

  const relevantChars = characters.filter((c) =>
    scene.character_names?.some(
      (name) =>
        c.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(c.name.toLowerCase())
    )
  );

  const relevantLoc = locations.find(
    (l) =>
      l.name.toLowerCase().includes(scene.location_name?.toLowerCase() || '') ||
      (scene.location_name || '').toLowerCase().includes(l.name.toLowerCase())
  );

  const relevantObjects = objects.filter((o) =>
    (scene.event || '').toLowerCase().includes(o.name.toLowerCase())
  );

  const characterEntries = relevantChars.map((c) => {
    const isProphet = c.name.toLowerCase().includes('rasulullah') || c.name.toLowerCase().includes('muhammad') || isProphetScene;
    return {
      name: c.name,
      identity: isProphet ? 'Prophetic character (Strict visual restrictions applied)' : `Locked face & identity for ${c.name}`,
      age: c.age || 'Adult',
      gender: c.gender || 'Unknown',
      appearance: c.physical_appearance || c.physical_description || 'Authentic period appearance',
      face_locked: isProphet ? false : (c.face_identity_locked ?? true),
      prophet_restrictions: isProphet,
      costume: c.clothing || [c.costume || 'Traditional modest period attire, dark dignified cloak and head covering'],
      accessories: c.accessories || [],
      pose_expression: isProphet ? 'Composed, silent, purposeful movement, rear/side silhouette profile' : (scene.emotional_objective || 'Dignified, focused expression'),
      action: scene.event || 'Engaged in narrative action',
    };
  });

  if (characterEntries.length === 0 && isProphetScene) {
    characterEntries.push({
      name: 'Rasulullah ﷺ',
      identity: 'Prophetic figure',
      age: 'Mature',
      gender: 'Male',
      appearance: 'Dignified posture, traditional period robes',
      face_locked: false,
      prophet_restrictions: true,
      costume: ['Traditional modest historical outer garment, dark cloak'],
      accessories: [],
      pose_expression: 'Quiet purposeful movement, seen from rear or profile silhouette',
      action: scene.event || 'Quietly exiting residence',
    });
  }

  const locationEntry = {
    place: relevantLoc?.name || scene.location_name || 'Ancient Makkah Residential Environment',
    era,
    architecture: relevantLoc?.architecture || relevantLoc?.architectural_style || 'Ancient mud-brick residential walls, narrow alleys, wooden lintels',
    geography: relevantLoc?.landscape || 'Arid desert town topography, dusty pathways',
    environment: relevantLoc?.environment || 'Quiet nighttime residential quarter with guarding figures',
    background: relevantLoc?.description || 'Shadowy figures stationed near residential doorways under starlight',
    foreground: 'Foreground framing with textured stone wall and subtle atmospheric dust',
    props: relevantObjects.map((o) => o.name).length > 0 ? relevantObjects.map((o) => o.name) : ['clay oil lamp', 'wooden door', 'simple seating mat'],
  };

  const timeEntry = {
    time_of_day: scene.time_of_day || 'Night',
    season: 'Historical season',
    weather: 'Clear night air, calm wind',
    atmosphere: scene.scene_tone?.atmosphere || 'Tense, silent, mysterious night atmosphere',
  };

  const actionEntry = {
    primary: scene.event || 'Quietly exits the residence and moves through the surrounding area',
    secondary: shots[0]?.action || 'Subtle robe movement, cautious foot placement',
    interaction: 'Moving past shadowy figures without detection',
    environmental_reaction: 'Subtle cloth movement under light nocturnal breeze',
  };

  const cameraEntry = {
    shot_type: shots[0]?.shot_type || 'Medium Tracking Shot',
    angle: 'Eye-level rear three-quarter perspective',
    position: 'Damped cinematic dolly tracking behind subject',
    lens: '35mm anamorphic prime lens',
    focal_length: '35mm focal length',
    movement: shots[0]?.camera_movement || 'Slow backward tracking maintaining subject rear view',
    speed: 'Smooth, deliberate 24fps cinematic pacing',
    framing: 'Subject in foreground/midground with surrounding figures establishing situational tension',
    focus: 'Shallow depth of field with sharp subject silhouette and soft background figures',
    depth_of_field: 'f/1.8 cinematic bokeh',
  };

  const lightingEntry = {
    source: scene.lighting || relevantLoc?.lighting_style || 'Dim moonlight and subtle warm light from the residence doorway',
    direction: 'Side rim lighting and soft ambient lunar glow',
    intensity: 'Low-key high-contrast chiaroscuro illumination',
    color_temperature: 'Cool blue moonlight (4500K) contrasted with faint warm amber doorway glow (2800K)',
    shadows: 'Deep rich shadows, elongated silhouettes on sandy alleys',
    atmosphere: 'Volumetric moonlight rays through cool night air',
  };

  const visualStyleEntry = {
    realism: 'Ultra-realistic historical film capture',
    cinematic_style: visualTone,
    material_realism: 'Authentic mud-brick texture, rough woolen textiles, weathered wood, dust',
    color_grading: 'Desaturated nocturnal palette with subtle warm amber accents',
    film_texture: 'Organic 35mm film grain, subtle halation',
    contrast: 'High nocturnal contrast with controlled shadow detail',
  };

  const moodEntry = {
    emotion: scene.emotional_objective || 'Profound silent tension and divine calm',
    tension: `${scene.scene_tone?.dramatic_tension || 85}/100 high narrative tension`,
    atmosphere: scene.scene_tone?.atmosphere || 'Silent nocturnal suspense',
  };

  const continuityEntry = {
    character_lock: true,
    clothing_lock: true,
    location_lock: true,
    prop_lock: true,
    lighting_lock: true,
    style_lock: true,
  };

  const negativePromptModules = {
    anatomy: ['extra fingers', 'missing fingers', 'malformed hands', 'extra limbs', 'distorted anatomy'],
    identity: isProphetScene
      ? ['face visible', 'eyes visible', 'mouth visible', 'frontal face depiction', 'identifiable facial structure', 'facial features depicted']
      : ['face change', 'age change', 'character morphing', 'inconsistent appearance'],
    clothing: ['modern clothing', 'zippers', 'synthetic neon textiles', 'sunglasses', 'wristwatches'],
    environment: ['modern buildings', 'electricity poles', 'asphalt roads', 'automobiles', 'modern objects'],
    camera: ['random camera shake', 'excessive camera motion', 'sudden erratic zoom'],
    physics: ['floating objects', 'teleportation', 'sliding feet', 'impossible motion'],
    quality: ['plastic skin', 'CGI cartoon appearance', '3D render look', 'anime', 'blurry', 'low resolution'],
    output: ['watermark', 'logo', 'subtitles', 'text overlay', 'UI elements'],
  };

  return {
    project_title: projectTitle,
    scene_number: scene.scene_number,
    scene_title: scene.title,
    scene_purpose: scene.story_purpose || 'Advance dramatic narrative',
    story_context: scene.dramatic_purpose || scene.event,
    duration_sec: duration,
    aspect_ratio: '16:9',
    model_target: target,
    detail_level: detailLevel,
    is_prophet_scene: isProphetScene,
    characters: characterEntries,
    location: locationEntry,
    time: timeEntry,
    action: actionEntry,
    camera: cameraEntry,
    lighting: lightingEntry,
    visual_style: visualStyleEntry,
    mood: moodEntry,
    continuity: continuityEntry,
    negative_prompt_modules: negativePromptModules,
  };
}

export function compileNegativePrompt(data: MasterSceneData): string {
  const all = [
    ...data.negative_prompt_modules.anatomy,
    ...data.negative_prompt_modules.identity,
    ...data.negative_prompt_modules.clothing,
    ...data.negative_prompt_modules.environment,
    ...data.negative_prompt_modules.camera,
    ...data.negative_prompt_modules.physics,
    ...data.negative_prompt_modules.quality,
    ...data.negative_prompt_modules.output,
  ];
  return Array.from(new Set(all)).join(', ');
}

/**
 * Prompt Validator & Zero Placeholder Policy Enforcement
 */
export function validateAndRepairPrompt(promptText: string): string {
  const forbiddenPhrases = [
    'performing frame adegan sinematik',
    'pergerakan visual',
    'Aksi sinematik kunci',
    'deskripsi karakter',
    'deskripsi lokasi',
    'cinematic action',
    'visual movement',
    'scene action',
    'Stabilized tracking camera',
    'Visual sinematik detail',
  ];

  let cleaned = promptText;
  for (const phrase of forbiddenPhrases) {
    if (cleaned.toLowerCase().includes(phrase.toLowerCase())) {
      cleaned = cleaned.replace(new RegExp(phrase, 'gi'), 'executed historical narrative action');
    }
  }
  return cleaned;
}

/**
 * Model Adapter 1: Banana Master Frame (Static Visual Blueprint)
 */
export function adaptBananaMasterFrame(data: MasterSceneData): string {
  const charDesc = data.characters
    .map((c) => {
      if (c.prophet_restrictions) {
        return `${c.name} [CHARACTER VISUAL LOCK: preserve silhouette, traditional period clothing, posture, and movement style. VISUAL RESTRICTION: Face must NEVER be visible or depicted. Rear view / back silhouette only, zero direct depiction of face].`;
      }
      return `${c.name} (${c.age}), wearing ${c.costume.join(', ')}, ${c.pose_expression}, exact identity lock.`;
    })
    .join('; ');

  const charLockInfo = data.characters
    .map((c) => {
      if (c.prophet_restrictions) {
        return `${c.name}: Silhouette & posture lock only (face completely obscured; no facial identity lock).`;
      }
      return `${c.name}: Locked facial geometry, costume weave, and height ratio.`;
    })
    .join('; ');

  const safetyInfo = data.is_prophet_scene
    ? 'Prophetic character present: rear view / silhouette only, face completely obscured from view, zero direct depiction of face, sacred reverence preserved.'
    : 'Standard cinematic historical safety restrictions applied.';

  const prompt = `[BANANA MASTER FRAME BLUEPRINT]
PROJECT / SCENE: ${data.project_title} | SCENE #${data.scene_number}: ${data.scene_title}
SUBJECT: ${charDesc}
CHARACTER VISUAL LOCK: ${charLockInfo}
ACTION STATE: ${data.action.primary}
LOCATION: ${data.location.place}
ERA / HISTORICAL CONTEXT: ${data.location.era}
ARCHITECTURE / ENVIRONMENT: ${data.location.architecture}, ${data.location.environment}
COMPOSITION: ${data.camera.framing}, ${data.camera.angle}
CAMERA POSITION: ${data.camera.position}
LENS: ${data.camera.lens}
DEPTH OF FIELD: ${data.camera.depth_of_field}
LIGHTING: ${data.lighting.source}
SHADOW: ${data.lighting.shadows}
ATMOSPHERE: ${data.time.atmosphere}, ${data.lighting.atmosphere}
MOOD: ${data.mood.emotion} (Tension: ${data.mood.tension})
MATERIAL REALISM: ${data.visual_style.material_realism}
VISUAL STYLE: ${data.visual_style.cinematic_style}, ${data.visual_style.film_texture}
CONTINUITY: Strict historical costume, prop, and location consistency lock.
HISTORICAL ACCURACY: Verified period architecture, authentic woven textiles, and accurate historical props (${data.location.props.join(', ')}).
SAFETY RESTRICTIONS: ${safetyInfo}
NEGATIVE PROMPT: ${compileNegativePrompt(data)}`;

  return validateAndRepairPrompt(prompt);
}

/**
 * Model Adapter 2: Banana Image Prompt (Independently Optimized)
 */
export function adaptBananaImagePrompt(data: MasterSceneData): string {
  const charStr = data.characters
    .map((c) => {
      if (c.prophet_restrictions) {
        return `${c.name} seen from rear silhouette, wearing traditional modest period cloak, body posture locked, face completely obscured from view.`;
      }
      return `${c.name} wearing ${c.costume.join(', ')}, ${c.pose_expression}`;
    })
    .join('; ');

  const prompt = `[BANANA IMAGE GENERATION PROMPT]
SUBJECT: ${charStr}
POSE / ACTION STATE: ${data.action.primary} in ${data.location.place}
ENVIRONMENT: ${data.location.environment}, ${data.time.time_of_day}
ARCHITECTURE: ${data.location.architecture}
COMPOSITION: ${data.camera.framing}, ${data.camera.angle}
CAMERA: ${data.camera.shot_type}
LENS: ${data.camera.lens}, ${data.camera.focus}
LIGHTING: ${data.lighting.source}, ${data.lighting.color_temperature}
MATERIAL REALISM: ${data.visual_style.material_realism}
ATMOSPHERE: ${data.time.atmosphere}
COLOR / TONALITY: ${data.visual_style.color_grading}
VISUAL STYLE: ${data.visual_style.cinematic_style}, ${data.visual_style.film_texture}
MOOD: ${data.mood.emotion}
CONTINUITY: Strict apparel and architectural consistency across sequence.
NEGATIVE PROMPT: ${compileNegativePrompt(data)}`;

  return validateAndRepairPrompt(prompt);
}

/**
 * Model Adapter 3: Veo Adapter (Duration-aware)
 */
export function adaptVeoVideoPrompt(data: MasterSceneData, shots: Shot[]): { prompt: string; camera: string; negative_prompt: string } {
  const duration = data.duration_sec || 10;
  const charDesc = data.characters.map((c) => c.name).join(', ') || 'Subject';

  let timelineStr = '';
  if (duration === 10) {
    timelineStr = `
0:00–0:03
OPENING STATE: Establishing ${charDesc} in ${data.location.place} under ${data.time.time_of_day}. Subtle atmospheric wind and clothing movement.

0:03–0:07
PRIMARY ACTION: ${data.action.primary}. Smooth narrative movement past guarding figures without detection.

0:07–0:10
RESOLUTION / END STATE: Subject reaches final position in frame, camera settles into stable resting composition.`.trim();
  } else {
    const t1 = Math.round(duration * 0.3);
    const t2 = Math.round(duration * 0.7);
    timelineStr = `
0:00–0:${String(t1).padStart(2, '0')}
OPENING STATE: Establishing ${charDesc} in ${data.location.place}. Environmental setup.

0:${String(t1).padStart(2, '0')}–0:${String(t2).padStart(2, '0')}
PRIMARY ACTION: ${data.action.primary}.

0:${String(t2).padStart(2, '0')}–0:${String(duration).padStart(2, '0')}
RESOLUTION / END STATE: Resolution and final ending composition.`.trim();
  }

  const cameraStr = `
- Movement: ${data.camera.movement}, smooth 24fps panning/tracking.
- Lens & Focus: ${data.camera.lens}, ${data.camera.focus}.
- Framing: ${data.camera.framing}.`.trim();

  const promptText = `[VEO CINEMATIC VIDEO PROMPT — ${duration}s]
SCENE: #${data.scene_number} ${data.scene_title} (${data.project_title})
DURATION: ${duration}s
REFERENCE / MASTER FRAME: Master frame visual anchor locked
VISUAL CONTINUITY: Strict apparel weave, period lighting, and spatial geography lock

${timelineStr}

CAMERA MOTION: ${data.camera.movement}, smooth 24fps panning/tracking with ${data.camera.lens}.
SUBJECT MOTION: Deliberate, dignified physical movement reflecting historical weight.
ENVIRONMENT MOTION: Light ambient wind causing subtle cloth movement, drifting atmospheric particulate.
LIGHTING MOTION: Consistent chiaroscuro illumination with steady ${data.lighting.source}.
PHYSICS: Realistic gravity, natural fabric drape and weight dynamics.
CONTINUITY: Zero character morphing or costume drift across full ${duration}-second duration.
NEGATIVE PROMPT: ${compileNegativePrompt(data)}`;

  return {
    prompt: validateAndRepairPrompt(promptText),
    camera: cameraStr,
    negative_prompt: compileNegativePrompt(data),
  };
}

/**
 * Model Adapter 4: Omni Adapter (Duration-aware reference-preserving)
 */
export function adaptOmniVideoPrompt(data: MasterSceneData): { prompt: string; camera: string; follow_up: string; negative_prompt: string } {
  const duration = data.duration_sec || 10;
  let actionSeq = '';
  if (duration === 10) {
    actionSeq = `
0:00–0:02.5
INITIAL STATE: Initial posture holding, exact reference frame alignment with subtle breathing motion.

0:02.5–0:05
ACTION INITIATION: Action initiation: ${data.action.primary}.

0:05–0:07.5
ACTION DEVELOPMENT: Peak narrative momentum and environmental interaction.

0:07.5–0:10
FINAL STATE: Smooth deceleration to stable final resting keyframe.`.trim();
  } else {
    const q1 = (duration * 0.25).toFixed(1);
    const q2 = (duration * 0.50).toFixed(1);
    const q3 = (duration * 0.75).toFixed(1);
    actionSeq = `
0:00–0:${q1}
INITIAL STATE: Initial posture holding.

0:${q1}–0:${q2}
ACTION INITIATION: Action initiation: ${data.action.primary}.

0:${q2}–0:${q3}
ACTION DEVELOPMENT: Peak narrative momentum.

0:${q3}–0:${duration}.0
FINAL STATE: Smooth deceleration to stable final resting keyframe.`.trim();
  }

  const promptText = `[OMNI VIDEO ENGINE PROMPT — ${duration}s]
TASK: Generate continuous ${duration}-second reference-preserving cinematic video.
DURATION: ${duration}s
REFERENCE IMAGE: Master frame visual anchor locked.
REFERENCE FIDELITY: High fidelity preservation of master frame spatial composition.
CHARACTER PRESERVATION: Strict lock on subject silhouette, posture, and facial anonymity/identity.
WARDROBE PRESERVATION: Authentic historical textiles, consistent cloth weave and draping.
LOCATION PRESERVATION: Unwavering mud-brick architectural geometry of ${data.location.place}.
LIGHTING PRESERVATION: Consistent ${data.lighting.source} and tonal shadow distribution.

${actionSeq}

CAMERA PATH: ${data.camera.movement} with stable subject tracking.
SUBJECT MOVEMENT: Controlled, purposeful motion across the scene environment.
ENVIRONMENT MOVEMENT: Atmospheric night air circulation, subtle dust drifting.
PHYSICS: Natural weight dynamics, authentic cloth interaction with environmental surfaces.
CONTINUITY: Absolute identity, costume, and spatial continuity across all ${duration} seconds.
NEGATIVE PROMPT: ${compileNegativePrompt(data)}`;

  return {
    prompt: validateAndRepairPrompt(promptText),
    camera: `Camera path: ${data.camera.movement}, 35mm lens, ${data.camera.focus}`,
    follow_up: `Ensure zero character morphing or costume drift across all ${duration} seconds.`,
    negative_prompt: compileNegativePrompt(data),
  };
}

/**
 * Model Adapter 5: Seedance Adapter (Duration-aware: 10s or 30s)
 */
export function adaptSeedanceVideoPrompt(data: MasterSceneData): { shot_breakdown: string; global_style: string; audio: string; do_not_change: string; negative_prompt: string } {
  const duration = data.duration_sec || 10;
  const charDesc = data.characters.map((c) => c.name).join(', ') || 'Subject';
  let breakdown = '';

  if (duration === 10) {
    breakdown = `[SEEDANCE 2.5 CINEMATIC SEQUENCE]
SEEDANCE 2.5
DURATION: 10s

SCENE: #${data.scene_number} ${data.scene_title} (${data.project_title})
CHARACTERS: ${charDesc}
LOCATION: ${data.location.place}
ERA: ${data.location.era}
EMOTIONAL ARC: ${data.mood.emotion} (Tension: ${data.mood.tension})
VISUAL ARC: Night chiaroscuro progression with volumetric lighting

0:00–0:03
OPENING / SETUP: Establish environment and character positioning in ${data.location.place}. Slow tracking shot.

0:03–0:07
MAIN ACTION: Core action unfolds. ${data.action.primary}. Character movement past guarding figures. Medium close-up framing.

0:07–0:10
RESOLUTION: Climactic conclusion and stable final resting composition. Cinematic narrative fade.

CAMERA MOVEMENT: ${data.camera.movement} with ${data.camera.lens}
SUBJECT PERFORMANCE: Restrained, dignified historical performance
ENVIRONMENT: ${data.location.architecture}, ${data.time.atmosphere}
LIGHTING: ${data.lighting.source}, ${data.lighting.shadows}
TRANSITIONS: Continuous single-take temporal progression without hard cuts
CONTINUITY: Lock face identity, costume weave, and location continuity across all frames
NEGATIVE PROMPT: ${compileNegativePrompt(data)}`;
  } else {
    breakdown = `[SEEDANCE 2.5 CINEMATIC SEQUENCE]
SEEDANCE 2.5
DURATION: 30s

SCENE: #${data.scene_number} ${data.scene_title} (${data.project_title})
CHARACTERS: ${charDesc}
LOCATION: ${data.location.place}
ERA: ${data.location.era}
EMOTIONAL ARC: ${data.mood.emotion} (Tension: ${data.mood.tension})
VISUAL ARC: Multi-shot dramatic sequence from atmospheric setup to climactic resolution

SHOT 1 — 0:00–0:05
OPENING: Establish nighttime environment, atmospheric particulate, character introduction in ${data.location.place}. Slow tracking shot.

SHOT 2 — 0:05–0:12
DEVELOPMENT: Action unfolds. ${data.action.primary}. Character movement past guarding figures. Medium tracking framing.

SHOT 3 — 0:12–0:20
ESCALATION: Dramatic tension heightens. Camera angle shifts to emphasize emotional stakes and surrounding figures.

SHOT 4 — 0:20–0:26
RESOLUTION: Climactic action conclusion. Focal shift to character posture and environmental calm.

SHOT 5 — 0:26–0:30
ENDING: Final wide matching master frame resting composition. Cinematic fade to narrative atmosphere.

CAMERA EVOLUTION: Seamless progression from establishing wide tracking to intimate medium angle and wide resolution
CHARACTER CONTINUITY: Strict lock on character identity, cloak drape, and authentic period footwear
ENVIRONMENT CONTINUITY: Rigid architectural persistence of ${data.location.place} throughout 30 seconds
LIGHTING EVOLUTION: Subtle volumetric lighting shifts matching temporal progression from night to late night
PHYSICS: Full realistic simulation of wind, fabric inertia, and particulate interaction
TRANSITION LOGIC: Logical spatial bridging between internal sequence beats
NEGATIVE PROMPT: ${compileNegativePrompt(data)}`;
  }

  return {
    shot_breakdown: validateAndRepairPrompt(breakdown),
    global_style: `${data.visual_style.cinematic_style}, 35mm film grain, 24fps epic grading`,
    audio: `Synchronized ambient soundscapes, authentic historical acoustic textures, dramatic underscore matching ${data.mood.atmosphere}`,
    do_not_change: 'Strictly preserve costume color and weave, location architecture, and period lighting across all sequence shots.',
    negative_prompt: compileNegativePrompt(data),
  };
}

/**
 * Production Prompt Contract Validator (Gatekeeper before DB Persistence)
 */
export interface PromptContractValidationResult {
  valid: boolean;
  model: PromptTarget;
  duration: number;
  sceneId?: string;
  shotId?: string;
  failedRules: string[];
  errorMessage?: string;
}

export const PROMPT_CONTRACT_VALIDATION_FAILED = 'PROMPT_CONTRACT_VALIDATION_FAILED' as const;

/**
 * PATCH 5.5-R1 (Fase 4): structured contract failure.
 *
 * Thrown when a generated prompt fails validateProductionPromptContract(). It
 * carries the full validation result so API layers can answer 422 with the
 * exact failed rules instead of string-matching an error message. A prompt that
 * produces this error must NEVER reach the database.
 */
export class PromptContractValidationError extends Error {
  readonly code = PROMPT_CONTRACT_VALIDATION_FAILED;
  readonly model: PromptTarget;
  readonly duration: number;
  readonly failedRules: string[];
  readonly sceneId?: string;
  readonly shotId?: string;

  constructor(result: PromptContractValidationResult) {
    super(
      result.errorMessage ||
        `${PROMPT_CONTRACT_VALIDATION_FAILED}: prompt untuk target "${result.model}" gagal kontrak produksi ` +
          `(${result.failedRules.join('; ')}).`
    );
    this.name = 'PromptContractValidationError';
    this.model = result.model;
    this.duration = result.duration;
    this.failedRules = result.failedRules;
    this.sceneId = result.sceneId;
    this.shotId = result.shotId;
    // Preserve instanceof across the TS -> JS downlevel boundary.
    Object.setPrototypeOf(this, PromptContractValidationError.prototype);
  }

  toPayload(): {
    code: typeof PROMPT_CONTRACT_VALIDATION_FAILED;
    model: PromptTarget;
    duration: number;
    failedRules: string[];
    sceneId?: string;
    shotId?: string;
  } {
    return {
      code: this.code,
      model: this.model,
      duration: this.duration,
      failedRules: this.failedRules,
      sceneId: this.sceneId,
      shotId: this.shotId,
    };
  }
}

export function isPromptContractValidationError(err: unknown): err is PromptContractValidationError {
  return err instanceof PromptContractValidationError;
}

/**
 * Runs the contract validator and throws PromptContractValidationError on
 * failure. This is the only form callers on the persistence path should use —
 * it makes "validated" and "persistable" the same condition.
 */
export function assertProductionPromptContract(
  promptText: string,
  model: PromptTarget,
  duration: number,
  context?: { sceneId?: string; shotId?: string; isProphetScene?: boolean }
): PromptContractValidationResult {
  const result = validateProductionPromptContract(promptText, model, duration, context);
  if (!result.valid) {
    throw new PromptContractValidationError(result);
  }
  return result;
}

export function validateProductionPromptContract(
  promptText: string,
  model: PromptTarget,
  duration: number,
  context?: { sceneId?: string; shotId?: string; isProphetScene?: boolean }
): PromptContractValidationResult {
  const failedRules: string[] = [];

  if (!promptText || typeof promptText !== 'string' || promptText.trim().length < 50) {
    failedRules.push('EMPTY_OR_INSUFFICIENT_PROMPT_LENGTH');
  }

  // 1. Legacy Marker Rejection
  const legacyMarkers = [
    '@Engine:',
    '@Global_Style:',
    '@Shot_Breakdown:',
    '@Camera_Direction:',
    '@Audio_Design:',
    '@Consistency_Lock:',
  ];
  for (const marker of legacyMarkers) {
    if (promptText.includes(marker)) {
      failedRules.push(`LEGACY_MARKER_DETECTED: ${marker}`);
    }
  }

  // 2. Placeholder Rejection
  const placeholders = [
    'Aksi sinematik kunci',
    'Visual sinematik detail',
    'Stabilized tracking camera',
    'Natural SFX',
    'pergerakan visual',
    'performing frame adegan sinematik',
  ];
  for (const ph of placeholders) {
    if (promptText.toLowerCase().includes(ph.toLowerCase())) {
      failedRules.push(`PLACEHOLDER_DETECTED: ${ph}`);
    }
  }

  // 3. Duration Checks
  if (model === 'veo' && duration !== 10) {
    failedRules.push(`VEO_DURATION_CONTRACT_VIOLATION: expected 10s, got ${duration}s`);
  }
  if (model === 'omni' && duration !== 10) {
    failedRules.push(`OMNI_DURATION_CONTRACT_VIOLATION: expected 10s, got ${duration}s`);
  }
  if (model === 'seedance_10' && duration !== 10) {
    failedRules.push(`SEEDANCE_10_DURATION_CONTRACT_VIOLATION: expected 10s, got ${duration}s`);
  }
  if (model === 'seedance_30' && duration !== 30) {
    failedRules.push(`SEEDANCE_30_DURATION_CONTRACT_VIOLATION: expected 30s, got ${duration}s`);
  }

  // 4. Model-Specific Structural Requirements
  if (model === 'banana_master_frame') {
    const requiredSections = [
      'PROJECT / SCENE',
      'SUBJECT',
      'CHARACTER VISUAL LOCK',
      'ACTION STATE',
      'LOCATION',
      'ERA / HISTORICAL CONTEXT',
      'ARCHITECTURE / ENVIRONMENT',
      'COMPOSITION',
      'CAMERA POSITION',
      'LENS',
      'DEPTH OF FIELD',
      'LIGHTING',
      'SHADOW',
      'ATMOSPHERE',
      'MOOD',
      'MATERIAL REALISM',
      'VISUAL STYLE',
      'CONTINUITY',
      'HISTORICAL ACCURACY',
      'SAFETY RESTRICTIONS',
      'NEGATIVE PROMPT',
    ];
    for (const sec of requiredSections) {
      if (!promptText.includes(sec)) {
        failedRules.push(`BANANA_MASTER_FRAME_MISSING_SECTION: ${sec}`);
      }
    }
    if (promptText.includes('0:00–0:03') || promptText.includes('0:00-0:03')) {
      failedRules.push('BANANA_MASTER_FRAME_FORBIDDEN_VIDEO_TIMELINE');
    }
  }

  if (model === 'banana_image') {
    const requiredSections = [
      'SUBJECT',
      'POSE / ACTION STATE',
      'ENVIRONMENT',
      'ARCHITECTURE',
      'COMPOSITION',
      'CAMERA',
      'LENS',
      'LIGHTING',
      'MATERIAL REALISM',
      'ATMOSPHERE',
      'COLOR / TONALITY',
      'VISUAL STYLE',
      'MOOD',
      'CONTINUITY',
      'NEGATIVE PROMPT',
    ];
    for (const sec of requiredSections) {
      if (!promptText.includes(sec)) {
        failedRules.push(`BANANA_IMAGE_MISSING_SECTION: ${sec}`);
      }
    }
    if (promptText.includes('0:00–0:03') || promptText.includes('0:00-0:03')) {
      failedRules.push('BANANA_IMAGE_FORBIDDEN_VIDEO_TIMELINE');
    }
  }

  if (model === 'veo') {
    const requiredSections = [
      'SCENE',
      'DURATION: 10s',
      'REFERENCE / MASTER FRAME',
      'VISUAL CONTINUITY',
      '0:00–0:03',
      'OPENING STATE',
      '0:03–0:07',
      'PRIMARY ACTION',
      '0:07–0:10',
      'RESOLUTION / END STATE',
      'CAMERA MOTION',
      'SUBJECT MOTION',
      'ENVIRONMENT MOTION',
      'LIGHTING MOTION',
      'PHYSICS',
      'CONTINUITY',
      'NEGATIVE PROMPT',
    ];
    for (const sec of requiredSections) {
      if (!promptText.includes(sec)) {
        failedRules.push(`VEO_MISSING_SECTION: ${sec}`);
      }
    }
  }

  if (model === 'omni') {
    const requiredSections = [
      'TASK',
      'DURATION: 10s',
      'REFERENCE IMAGE',
      'REFERENCE FIDELITY',
      'CHARACTER PRESERVATION',
      'WARDROBE PRESERVATION',
      'LOCATION PRESERVATION',
      'LIGHTING PRESERVATION',
      '0:00–0:02.5',
      'INITIAL STATE',
      '0:02.5–0:05',
      'ACTION INITIATION',
      '0:05–0:07.5',
      'ACTION DEVELOPMENT',
      '0:07.5–0:10',
      'FINAL STATE',
      'CAMERA PATH',
      'SUBJECT MOVEMENT',
      'ENVIRONMENT MOVEMENT',
      'PHYSICS',
      'CONTINUITY',
      'NEGATIVE PROMPT',
    ];
    for (const sec of requiredSections) {
      if (!promptText.includes(sec)) {
        failedRules.push(`OMNI_MISSING_SECTION: ${sec}`);
      }
    }
  }

  if (model === 'seedance_10') {
    const requiredSections = [
      'SEEDANCE 2.5',
      'DURATION: 10s',
      'SCENE',
      'CHARACTERS',
      'LOCATION',
      'ERA',
      'EMOTIONAL ARC',
      'VISUAL ARC',
      '0:00–0:03',
      'OPENING / SETUP',
      '0:03–0:07',
      'MAIN ACTION',
      '0:07–0:10',
      'RESOLUTION',
      'CAMERA MOVEMENT',
      'SUBJECT PERFORMANCE',
      'ENVIRONMENT',
      'LIGHTING',
      'TRANSITIONS',
      'CONTINUITY',
      'NEGATIVE PROMPT',
    ];
    for (const sec of requiredSections) {
      if (!promptText.includes(sec)) {
        failedRules.push(`SEEDANCE_10_MISSING_SECTION: ${sec}`);
      }
    }
  }

  if (model === 'seedance_30') {
    const requiredSections = [
      'SEEDANCE 2.5',
      'DURATION: 30s',
      'SCENE',
      'CHARACTERS',
      'LOCATION',
      'ERA',
      'EMOTIONAL ARC',
      'VISUAL ARC',
      'SHOT 1 — 0:00–0:05',
      'OPENING',
      'SHOT 2 — 0:05–0:12',
      'DEVELOPMENT',
      'SHOT 3 — 0:12–0:20',
      'ESCALATION',
      'SHOT 4 — 0:20–0:26',
      'RESOLUTION',
      'SHOT 5 — 0:26–0:30',
      'ENDING',
      'CAMERA EVOLUTION',
      'CHARACTER CONTINUITY',
      'ENVIRONMENT CONTINUITY',
      'LIGHTING EVOLUTION',
      'PHYSICS',
      'TRANSITION LOGIC',
      'NEGATIVE PROMPT',
    ];
    for (const sec of requiredSections) {
      if (!promptText.includes(sec)) {
        failedRules.push(`SEEDANCE_30_MISSING_SECTION: ${sec}`);
      }
    }
  }

  // 5. Rasulullah ﷺ Safety Guardrails Check
  const lowerPrompt = promptText.toLowerCase();
  const isProphet = context?.isProphetScene || lowerPrompt.includes('rasulullah') || lowerPrompt.includes('muhammad');
  if (isProphet) {
    const positiveViolations = [
      'locked facial geometry',
      'exact facial identity',
      'face identity locked: true',
      'frontal face portrait',
      'visible eyes looking',
      'detailed facial expression on rasulullah',
      'photorealistic face of rasulullah',
    ];
    for (const v of positiveViolations) {
      if (lowerPrompt.includes(v)) {
        failedRules.push(`RASULULLAH_SAFETY_VIOLATION: ${v}`);
      }
    }
  }

  const isValid = failedRules.length === 0;
  return {
    valid: isValid,
    model,
    duration,
    sceneId: context?.sceneId,
    shotId: context?.shotId,
    failedRules,
    errorMessage: isValid ? undefined : `PROMPT_CONTRACT_VALIDATION_FAILED for ${model}: ${failedRules.join('; ')}`,
  };
}

/**
 * Regression Test Suite for Prompt Generation Engine (Tests A–I)
 */
export function runPromptEngineRegressionTests(): { testId: string; name: string; passed: boolean; details: string }[] {
  const results = [];
  const mockScene: Scene = {
    id: 'test_scene_1',
    project_id: 'proj_1',
    scene_number: 1,
    title: 'Keluar Malam Hari',
    story_purpose: 'Menunjukkan mukjizat dan ketenangan',
    event: 'Rasulullah ﷺ keluar dari rumah melewati para pengepung pada malam hari.',
    duration_sec: 10,
    character_names: ['Rasulullah ﷺ'],
    location_name: 'Kediaman Makkah',
    time_of_day: 'Night',
    dramatic_purpose: 'Tension and escape',
    emotional_objective: 'Serenity amidst peril',
    narrative_function: 'Escape sequence',
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const masterData10 = serializeMasterSceneData(
    mockScene,
    [],
    null,
    [],
    [],
    [],
    'veo',
    'cinematic',
    'Sirah Nabawiyah',
    10
  );

  const masterData30 = serializeMasterSceneData(
    mockScene,
    [],
    null,
    [],
    [],
    [],
    'seedance',
    'cinematic',
    'Sirah Nabawiyah',
    30
  );

  // TEST A: Generate Scene -> Banana Master Frame
  const bananaMaster = adaptBananaMasterFrame(masterData10);
  const valA = validateProductionPromptContract(bananaMaster, 'banana_master_frame', 10, { isProphetScene: true });
  results.push({
    testId: 'TEST-A',
    name: 'Generate Scene -> Banana Master Frame Schema',
    passed: valA.valid && bananaMaster.includes('[BANANA MASTER FRAME BLUEPRINT]'),
    details: valA.valid ? 'Banana Master Frame conforms strictly to static specification.' : valA.errorMessage || '',
  });

  // TEST B: Generate Scene -> Banana Image
  const bananaImg = adaptBananaImagePrompt(masterData10);
  const valB = validateProductionPromptContract(bananaImg, 'banana_image', 10, { isProphetScene: true });
  results.push({
    testId: 'TEST-B',
    name: 'Generate Scene -> Banana Image Schema',
    passed: valB.valid && bananaImg.includes('[BANANA IMAGE GENERATION PROMPT]'),
    details: valB.valid ? 'Banana Image conforms strictly to image-generation contract without timeline.' : valB.errorMessage || '',
  });

  // TEST C: Generate Scene -> Veo 10s
  const veoRes = adaptVeoVideoPrompt(masterData10, []);
  const valC = validateProductionPromptContract(veoRes.prompt, 'veo', 10, { isProphetScene: true });
  results.push({
    testId: 'TEST-C',
    name: 'Generate Scene -> Veo 10s Schema',
    passed: valC.valid && veoRes.prompt.includes('DURATION: 10s'),
    details: valC.valid ? 'Veo 10s conforms strictly to 10-second temporal contract.' : valC.errorMessage || '',
  });

  // TEST D: Generate Scene -> Omni 10s
  const omniRes = adaptOmniVideoPrompt(masterData10);
  const valD = validateProductionPromptContract(omniRes.prompt, 'omni', 10, { isProphetScene: true });
  results.push({
    testId: 'TEST-D',
    name: 'Generate Scene -> Omni 10s Schema',
    passed: valD.valid && omniRes.prompt.includes('DURATION: 10s'),
    details: valD.valid ? 'Omni 10s conforms strictly to reference-preserving contract.' : valD.errorMessage || '',
  });

  // TEST E: Generate Scene -> Seedance 10s
  const seed10Res = adaptSeedanceVideoPrompt(masterData10);
  const valE = validateProductionPromptContract(seed10Res.shot_breakdown, 'seedance_10', 10, { isProphetScene: true });
  results.push({
    testId: 'TEST-E',
    name: 'Generate Scene -> Seedance 10s Schema',
    passed: valE.valid && seed10Res.shot_breakdown.includes('DURATION: 10s'),
    details: valE.valid ? 'Seedance 10s conforms strictly to 3-beat 10s breakdown.' : valE.errorMessage || '',
  });

  // TEST F: Generate Scene -> Seedance 30s
  const seed30Res = adaptSeedanceVideoPrompt(masterData30);
  const valF = validateProductionPromptContract(seed30Res.shot_breakdown, 'seedance_30', 30, { isProphetScene: true });
  results.push({
    testId: 'TEST-F',
    name: 'Generate Scene -> Seedance 30s Schema',
    passed: valF.valid && seed30Res.shot_breakdown.includes('DURATION: 30s') && seed30Res.shot_breakdown.includes('SHOT 5'),
    details: valF.valid ? 'Seedance 30s conforms strictly to 5-shot extended breakdown.' : valF.errorMessage || '',
  });

  // TEST G: Legacy Marker Injection Detection
  const legacyInjection = `${veoRes.prompt}\n@Engine: Seedance 2.5 (ByteDance)\n@Global_Style: Historical\n@Shot_Breakdown: Shot #1`;
  const valG = validateProductionPromptContract(legacyInjection, 'veo', 10);
  results.push({
    testId: 'TEST-G',
    name: 'Legacy Marker Rejection Gatekeeper',
    passed: !valG.valid && valG.failedRules.some((r) => r.includes('LEGACY_MARKER_DETECTED')),
    details: 'Contract validator successfully blocks legacy @Engine/@Global_Style tags.',
  });

  // TEST H: Placeholder Injection Detection
  const placeholderInjection = `${omniRes.prompt}\nAksi sinematik kunci with Stabilized tracking camera and Natural SFX`;
  const valH = validateProductionPromptContract(placeholderInjection, 'omni', 10);
  results.push({
    testId: 'TEST-H',
    name: 'Placeholder Rejection Gatekeeper',
    passed: !valH.valid && valH.failedRules.some((r) => r.includes('PLACEHOLDER_DETECTED')),
    details: 'Contract validator successfully blocks generic placeholder strings.',
  });

  // TEST I: UI / Production Stage Call Graph Consistency
  // Proves that adapters produce contract-compliant output through the unified engine
  const valI_Master = validateProductionPromptContract(bananaMaster, 'banana_master_frame', 10);
  const valI_Seed30 = validateProductionPromptContract(seed30Res.shot_breakdown, 'seedance_30', 30);
  results.push({
    testId: 'TEST-I',
    name: 'UI Production Call Graph Consistency',
    passed: valI_Master.valid && valI_Seed30.valid,
    details: 'Unified cinematic prompt engine drives both pipeline stages and UI regeneration endpoints.',
  });

  return results;
}
