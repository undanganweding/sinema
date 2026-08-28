export type PromptLanguage = 'id' | 'en';
export type VideoPlatform = 'veo' | 'gemini_omni' | 'seedance';
export type ContinuityStatus = 'PASS' | 'CONFLICT' | 'UNSPECIFIED' | 'FILTERED';
export type EntityState = 'clean' | 'dirty' | 'stale' | 'superseded' | 'failed';
export type HistoricalSourceType = 'Quran' | 'Hadith' | 'Sirah' | 'Historical Record' | 'Scholarly Reference';

// --- CONTINUITY ENGINE SCHEMAS ---
export type ContinuityViolationSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ContinuityLockStatus = 'locked' | 'unlocked' | 'modified';

export interface CharacterIdentityLockState {
  face: 'locked' | 'unlocked';
  body: 'locked' | 'unlocked';
  age: 'locked' | 'unlocked';
  skin_tone: 'locked' | 'unlocked';
  hair: 'locked' | 'unlocked';
}

export interface CostumeItem {
  value: string;
  status: 'required' | 'optional';
  notes?: string;
}

export interface CostumeStructure {
  head_cover?: CostumeItem; // Hijab, turban, kufi, scarf, etc.
  outer_garment?: CostumeItem; // Robe, cloak, jubah, etc.
  upper_garment?: CostumeItem; // Shirt, tunic, etc.
  lower_garment?: CostumeItem; // Pants, izar, etc.
  footwear?: CostumeItem; // Sandals, boots, etc.
  accessories?: string[];
  colors?: string[];
  materials?: string[];
  distinctive_details?: string[];
}

export interface ApprovedCostumeTransition {
  from_costume_version: number | string;
  to_costume_version: number | string;
  reason: string;
  approved?: boolean;
  approved_at?: string;
  scene_number?: number;
  transition_time?: string;
}

export interface CharacterContinuityState {
  character_id: string;
  name: string;
  identity_version: number;
  identity: CharacterIdentityLockState;
  costume: CostumeStructure;
  appearance: {
    accessories: string[];
    facial_features: string[];
    body_features: string[];
  };
  continuity_rules: {
    appearance_change_requires_approval: boolean;
    costume_change_requires_approval: boolean;
  };
  current_state: {
    scene_id?: string | null;
    costume_version: number;
    temporary_props?: string[];
    temporary_state?: string;
  };
  approved_transitions?: ApprovedCostumeTransition[];
}

export interface LocationContinuityState {
  location_id: string;
  name: string;
  architecture: string;
  terrain: string;
  layout: string;
  materials: string;
  environmental_identity: string;
  historical_period: string;
  recurring_landmarks: string[];
  lighting_conditions: string;
  prohibited_elements?: string[]; // e.g. ["no modern buildings", "no asphalt roads"]
}

export interface ObjectContinuityState {
  object_id: string;
  name: string;
  appearance: string;
  material: string;
  dimensions_scale?: string;
  color: string;
  condition: string; // e.g. 'pristine', 'battle-worn', 'dusty'
  owner?: string;
  current_location?: string;
  current_state: string; // e.g. 'active', 'stored', 'damaged', 'lost'
}

export interface ContinuitySnapshot {
  characters: CharacterContinuityState[];
  locations: LocationContinuityState[];
  objects: ObjectContinuityState[];
  environment?: string[];
  visual_style?: string[];
  previous_scene_state?: {
    scene_number: number;
    character_states: Record<string, { costume_version: number; head_cover?: string; outer_garment?: string; temporary_props?: string[] }>;
    location_name: string;
  };
}

export interface ContinuityViolation {
  type:
    | 'costume_change'
    | 'identity_change'
    | 'location_drift'
    | 'object_mismatch'
    | 'period_violation'
    | 'head_cover_missing';
  field: string;
  expected: string;
  actual: string;
  severity: ContinuityViolationSeverity;
  character_name?: string;
  location_name?: string;
  object_name?: string;
  scene_number?: number;
  shot_number?: number;
  message: string;
}

export interface ContinuityValidationResult {
  valid: boolean;
  status: 'passed' | 'continuity_failed' | 'warning';
  violations: ContinuityViolation[];
  auto_corrected?: boolean;
  correction_notes?: string[];
}

// --- CINEMATIC STORY ARCHITECTURE SCHEMAS ---
export type NarrativeMode =
  | 'NARRATOR'
  | 'DIALOGUE'
  | 'ACTION'
  | 'VISUAL_ONLY'
  | 'REACTION'
  | 'MIXED';

export interface ColdOpen {
  id?: string;
  title: string;
  visual_hook: string;
  dramatic_question: string;
  dialogue_minimal: string;
  cut_to_black_transition: string;
  forward_scene_reference?: string;
  duration_sec?: number;
}

export interface Act {
  act_id: string;
  act_number: number;
  title: string;
  purpose: string;
  dramatic_goal: string;
  emotional_arc: string;
  sequence_ids: string[];
}

export interface StorySequence {
  sequence_id: string;
  act_id: string;
  sequence_number: number;
  title: string;
  purpose: string;
  dramatic_goal: string;
  scene_ids: string[];
}

export interface Beat {
  id?: string;
  beat_id?: string;
  scene_id?: string;
  beat_number: number;
  description?: string;
  purpose?: string;
  action?: string;
  character?: string;
  dialogue?: string;
  narration?: string;
  emotional_state?: string;
  visual_objective?: string;
  audio?: string;
  narrative_mode: NarrativeMode;
  camera_recommendation?: string;
}

export type ColdOpenArchitecture = ColdOpen;

export interface StoryArchitecture {
  id?: string;
  project_id: string;
  title: string;
  premise: string;
  historical_period: string;
  narrative_objective: string;
  audience: string;
  total_target_duration: number;
  global_narrative_voice: string;
  visual_language: string;
  cold_open?: ColdOpen | null;
  acts: Act[];
  sequences: StorySequence[];
  ending_epilogue?: string;
  created_at?: string;
  updated_at: string;
}

export interface HistoricalFinding {
  id?: string;
  source_type: HistoricalSourceType;
  source_title: string;
  reference: string;
  evidence: string;
  confidence: 'High' | 'Medium' | 'Low';
  description?: string;
}

export type ReasoningProviderType = 'google' | 'openrouter' | 'openai' | 'xai' | 'custom_openai';

export type ModelPreferenceMode = 'fixed' | 'adaptive' | 'custom';
export type FallbackPolicy = 'strict' | 'smart' | 'off';
export type TaskTier = 'deep_reasoning' | 'general_reasoning' | 'fast_structured' | 'lightweight';

export interface ModelReference {
  provider: ReasoningProviderType | string;
  model_id: string;
  priority?: number;
  display_name?: string;
  pricing_class?: 'unknown' | 'free' | 'paid' | 'mixed';
}

export interface ReasoningModelPreferences {
  mode: ModelPreferenceMode;
  primary_model: ModelReference;
  fallback_policy: FallbackPolicy;
  fallback_pool: ModelReference[];
  force_model?: boolean;
  stage_routing?: Record<string, string>;
}

export interface FallbackLogEntry {
  requested_provider: string;
  requested_model: string;
  actual_provider: string;
  actual_model: string;
  fallback: boolean;
  fallback_reason?: string;
  stage?: string;
  entity_id?: string;
  attempt: number;
  timestamp: string;
  user_preference_mode: ModelPreferenceMode;
}

export interface ReasoningConfig {
  provider_type: ReasoningProviderType;
  provider_name: string;
  base_url?: string;
  model_id: string;
  display_name?: string;
  api_key?: string;
}

export interface GeminiModelOption {
  id: string;
  name: string;
  badge?: string;
  description: string;
  isRecommended?: boolean;
  tier?: 'flash' | 'pro' | 'lite';
}

export type PacingType = 'slow' | 'medium' | 'fast';

export type AtmosphereType =
  | 'peaceful'
  | 'solemn'
  | 'contemplative'
  | 'mysterious'
  | 'hopeful'
  | 'tense'
  | 'dramatic'
  | 'action'
  | 'tragic'
  | 'triumphant'
  | 'urgent';

export type TonePresetName =
  | 'SOLEMN'
  | 'CONTEMPLATIVE'
  | 'MYSTERIOUS'
  | 'TENSE'
  | 'ACTION'
  | 'TRAGIC'
  | 'TRIUMPHANT'
  | 'CUSTOM';

export interface GlobalConstraints {
  religious_adab: 'strict';
  historical_fidelity: 'strict';
  dignity: 'strict';
  clarity: 'high';
  cinematic_quality: 'high';
}

export interface DefaultSceneTone {
  intensity: number; // 0-100 (default 50)
  emotional_weight: number; // 0-100 (default 50)
  pacing: PacingType; // default 'medium'
  atmosphere: AtmosphereType; // default 'dramatic'
  dramatic_tension?: number; // 0-100 (default 50)
}

export interface NarrativeStyleConfig {
  language: string; // e.g. 'id-ID'
  narrative_mode: 'cinematic_sirah';
  global_constraints: GlobalConstraints;
  default_scene_tone: DefaultSceneTone;
}

export interface SceneTone {
  intensity: number; // 0-100
  emotional_weight: number; // 0-100
  pacing: PacingType;
  atmosphere: AtmosphereType;
  dramatic_tension: number; // 0-100
  preset?: TonePresetName;
  is_ai_recommended?: boolean;
}

export interface Project {
  id: string;
  title: string;
  raw_script: string;
  total_duration_target_sec: number;
  max_scene_shot_duration_sec: number | null; // Deprecated alias for scene_duration_sec
  scene_duration_sec?: number | null; // null = AUTO, 5-30 = FIXED scene duration
  duration_mode?: 'fixed' | 'auto'; // 'fixed' = strictly fixed duration per scene, 'auto' = dynamic weighted split
  fixed_scene_duration?: number | null; // e.g. 5, 10, 15, 20, 30
  // Patch v1.2: Duration Architecture separation
  projectDuration?: number;
  timelineSceneDuration?: number;
  durationMode?: 'match_scene' | 'extended';
  modelOutputDuration?: number;
  selectedExtendedDuration?: number;
  primaryVideoModel?: 'veo' | 'gemini_omni' | 'seedance';
  foundation_status?: 'not_initialized' | 'initializing' | 'ready' | 'incomplete' | 'failed';
  allow_final_scene_override?: boolean;
  prompt_language: PromptLanguage;
  narrative_style_config?: NarrativeStyleConfig;
  ai_model?: string; // e.g. 'gemini-3.7-flash', 'gemini-3.6-flash', etc.
  reasoning_config?: ReasoningConfig;
  reasoning_model_preferences?: ReasoningModelPreferences;
  image_model: 'nano_banana_pro';
  video_model: ('veo' | 'gemini_omni')[];
  include_seedance_format: boolean;
  created_at: string;
  updated_at: string;
  status: 'draft' | 'processing' | 'completed' | 'failed';
  current_stage?: number;
  error_message?: string | null;
  duration_validation_passed?: boolean;
  retry_count?: number;
}

export interface ProjectFoundation {
  id?: string;
  project_id: string;
  era: string;
  theme: string;
  genre: string;
  timeline: string;
  main_characters: string[];
  supporting_characters: string[];
  locations: string[];
  main_conflict: string;
  emotional_arc: string;
  narrative_arc: string;
  visual_tone: string;
  narrative_beats?: NarrativeBeats;
  updated_at: string;
}

export interface CharacterBible {
  id?: string;
  project_id: string;
  name: string;
  age: string;
  gender: string;
  physical_appearance: string;
  physical_description?: string;
  role?: string;
  face_identity_locked: boolean;
  identity_version?: number;
  hair: string;
  beard: string;
  clothing: string[];
  costume?: string;
  wardrobe?: string;
  accessories: string[];
  personality: string;
  voice_character: string;
  movement_style: string;
  master_portrait_prompt?: string;
  version: number;
  created_at?: string;
  updated_at: string;
}

export interface LocationBible {
  id?: string;
  project_id: string;
  name: string;
  era: string;
  architecture: string;
  architectural_style?: string;
  environment: string;
  landscape: string;
  climate: string;
  culture: string;
  lighting_style: string;
  lighting_atmosphere?: string;
  description?: string;
  color_palette: string[];
  material: string;
  master_environment_prompt?: string;
  version: number;
  created_at?: string;
  updated_at: string;
}

export interface ObjectBible {
  id?: string;
  project_id: string;
  name: string;
  category: string;
  description: string;
  continuity_notes: string;
  material?: string;
  owner?: string;
  version: number;
  created_at?: string;
  updated_at: string;
}

export interface NarrativeBeats {
  beginning: string;
  development: string;
  climax: string;
  consequence: string;
  ending: string;
}

export interface MasterImagePrompt {
  subject: string;
  characters_note: string;
  costume: string;
  location: string;
  era: string;
  architecture: string;
  environment: string;
  lighting: string;
  composition: string;
  camera: string;
  lens: string;
  mood: string;
  cinematic_style: string;
  negative_prompt: string;
}

export interface Scene {
  id?: string;
  project_id: string;
  scene_number: number;
  title: string;
  duration_sec: number;
  story_purpose: string;
  location_name: string;
  time_of_day: string;
  character_names: string[];
  emotional_objective: string;
  event: string;
  narrative_function: string;
  sequence_id?: string;
  act_id?: string;
  conflict?: string;
  beginning_state?: string;
  ending_state?: string;
  beats?: Beat[];
  narrative_modes?: NarrativeMode[];
  scene_tone?: SceneTone;
  era?: string;
  tone?: string;
  lighting?: string;
  characters_present?: string[];
  dramatic_purpose?: string;
  action_summary?: string;
  master_frame_image_url?: string | null;
  master_image_prompt?: string;
  master_image_prompt_json?: MasterImagePrompt | null;
  image_gen_status?: 'pending' | 'success' | 'failed' | 'processing';
  image_gen_error?: string | null;
  full_scene_prompt?: string;
  full_scene_prompt_status?: 'ready' | 'generating' | 'failed';
  continuity_snapshot?: ContinuitySnapshot;
  continuity_status?: 'passed' | 'continuity_failed' | 'warning' | 'pending';
  continuity_violations?: ContinuityViolation[];
  status?:
    | 'pending'
    | 'processing'
    | 'ready'
    | 'incomplete'
    | 'completed'
    | 'shot_breakdown_failed'
    | 'continuity_failed'
    | 'failed';
  version: number;
  created_at?: string;
  updated_at: string;
}

export interface ShotDialogue {
  character_name: string;
  line: string;
}

export interface Shot {
  id?: string;
  scene_id: string;
  project_id: string;
  shot_number: number;
  start_time_sec: number;
  end_time_sec: number;
  duration_sec: number;
  event_detail: string; // Detail Kejadian (single source of truth for Stage 7 & 8)
  character_action: string;
  camera_note: string;
  dialogue: ShotDialogue[];
  emotion: string;
  audio_note: string;
  beat_id?: string;
  beat_number?: number;
  narrative_mode?: NarrativeMode;
  cinematic_grammar?: any;
  shot_image_url?: string | null;
  image_url?: string | null;
  visual_description?: string;
  action?: string;
  camera_movement?: string;
  shot_type?: string;
  audio_narration?: string;
  sound_effects?: string;
  master_image_prompt?: string;
  video_prompt?: string;
  seedance_prompt?: string;
  version: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Canonical prompt target union (PATCH 5.5-R1).
 *
 * Every production prompt is generated for exactly ONE explicit target. The
 * target — never the shot length — determines which adapter runs and which
 * duration contract applies:
 *   - banana_master_frame : still master frame (image, no video timeline)
 *   - banana_image        : still shot image
 *   - veo                 : 10s video
 *   - omni                : 10s video
 *   - seedance_10         : 10s video
 *   - seedance_30         : 30s video (extended mode)
 */
export type PromptTarget =
  | 'banana_master_frame'
  | 'banana_image'
  | 'veo'
  | 'omni'
  | 'seedance_10'
  | 'seedance_30';

export interface VideoPromptTimeline {
  // For Veo & Gemini Omni
  prompt?: string;
  camera?: string; // sub-timestamps "00-04s: ...\n04-07s: ..."
  dialog?: string;
  sfx_ambient?: string;
  clip_duration_sec?: number;
  negative_prompt?: string;
  reference_image?: string;
  follow_up_edit_instructions?: string; // for gemini_omni

  // For Seedance
  global_style?: string;
  characters?: string;
  references?: string; // @Image/@Video/@Audio
  shot_breakdown?: string;
  audio?: string;
  do_not_change?: string;

  // PATCH 5.5-R1: authoritative duration the prompt text was generated for.
  // Comes from the target's model capability via the strict duration resolver,
  // never from the raw shot length.
  resolved_duration_sec?: number;
}

export interface VideoPrompt {
  id?: string;
  shot_id: string;
  scene_id: string;
  project_id: string;
  target_platform: 'veo' | 'gemini_omni' | 'seedance';
  /**
   * PATCH 5.5-R1: explicit prompt target this row was generated for.
   * Optional for backward compatibility with rows persisted before 5.5;
   * all newly generated prompts MUST set it.
   */
  prompt_target?: PromptTarget;
  generation_type: 'direct' | 'prompt_target';
  status?: 'ready' | 'video_prompt_failed' | 'processing';
  error?: string | null;
  timeline_json: VideoPromptTimeline;
  negative_prompt: string;
  version: number;
  created_at?: string;
  updated_at?: string;
}

export interface CombinedScenePrompt {
  status: 'complete' | 'incomplete';
  readyShots: number;
  totalShots: number;
  platform: string;
  text?: string;
  full_scene_prompt?: string;
  full_scene_prompt_status?: EntityState;
  message?: string;
  header?: string;
  shots_text?: {
    shot_number: number;
    time_range: string;
    event_summary: string;
    body: string;
  }[];
}

export type StageCode = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8';
export type StageScope = 'project' | 'scene' | 'shot';
export type ErrorClassification = 'schema_validation' | 'duration_mismatch' | 'auth_error' | 'quota_exceeded' | 'rate_limit' | 'network' | 'unknown';

export interface StageExecutionTelemetry {
  id?: string;
  project_id: string;
  scene_id?: string;
  shot_id?: string;
  stage: number;
  stage_code: StageCode;
  scope: StageScope;
  attempt: number;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  status: 'started' | 'completed' | 'failed' | 'retrying';
  error_type?: ErrorClassification;
  error_message?: string;
}

export interface PipelineLogEvent {
  timestamp: string;
  stage: number;
  stage_name: string;
  stage_code?: StageCode;
  scope?: StageScope;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  duration_ms?: number;
  error_type?: ErrorClassification;
}

export interface ProjectFullData {
  project: Project;
  foundation: ProjectFoundation | null;
  story_architecture?: StoryArchitecture | null;
  characters: CharacterBible[];
  continuity_states?: CharacterContinuityState[];
  locations: LocationBible[];
  objects: ObjectBible[];
  scenes: Scene[];
  shots?: Record<string, Shot[]>; // keyed by scene_id
  video_prompts?: Record<string, VideoPrompt[]>; // keyed by shot_id
}

export type StudioWorkspaceTab =
  | 'overview'
  | 'story'
  | 'characters'
  | 'locations'
  | 'objects'
  | 'bibles'
  | 'scenes'
  | 'shots'
  | 'prompts'
  | 'continuity'
  | 'pipeline'
  | 'queue'
  | 'export'
  | 'settings';

