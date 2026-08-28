import {
  serializeMasterSceneData,
  adaptBananaMasterFrame,
  adaptBananaImagePrompt,
  adaptVeoVideoPrompt,
  adaptOmniVideoPrompt,
  adaptSeedanceVideoPrompt,
  validateProductionPromptContract,
  assertProductionPromptContract,
  PromptContractValidationError,
  compileNegativePrompt,
  MasterSceneData,
  VideoModelTarget,
} from '../cinematic_prompt_engine';
import {
  PROMPT_TARGET_SUPPORTED_DURATIONS,
  resolveOutputDurationStrict,
} from '../duration_engine';
import {
  Scene,
  Shot,
  ProjectFoundation,
  CharacterBible,
  LocationBible,
  VideoPrompt,
  VideoPromptTimeline,
  PromptTarget,
  ReasoningConfig,
} from '../../src/types';

export const INVALID_PROMPT_TARGET = 'INVALID_PROMPT_TARGET' as const;

/** Targets that produce a still image prompt (no video timeline, no VideoPrompt row). */
export type StillPromptTarget = 'banana_master_frame' | 'banana_image';
/** Targets that produce a persisted VideoPrompt row. */
export type VideoOnlyPromptTarget = 'veo' | 'omni' | 'seedance_10' | 'seedance_30';

export const ALL_PROMPT_TARGETS: PromptTarget[] = [
  'banana_master_frame',
  'banana_image',
  'veo',
  'omni',
  'seedance_10',
  'seedance_30',
];

export function isPromptTarget(value: unknown): value is PromptTarget {
  return typeof value === 'string' && (ALL_PROMPT_TARGETS as string[]).includes(value);
}

/**
 * Legacy platform identifiers still emitted by the pre-5.5 regenerate endpoint
 * and by the persisted `video_prompts.target_platform` column.
 */
export type LegacyPlatformName = 'veo' | 'gemini_omni' | 'seedance';

/**
 * Legacy platform -> explicit PromptTarget translation. Deliberately 1:1 and
 * duration-free: legacy `seedance` always means the 10s contract. A 30s output
 * must be requested as the explicit `seedance_30` target.
 */
export const LEGACY_PLATFORM_TARGET: Record<LegacyPlatformName, PromptTarget> = {
  veo: 'veo',
  gemini_omni: 'omni',
  seedance: 'seedance_10',
};

export function isLegacyPlatformName(value: unknown): value is LegacyPlatformName {
  return value === 'veo' || value === 'gemini_omni' || value === 'seedance';
}

/**
 * Normalizes any caller-supplied target into an explicit PromptTarget.
 * Throws InvalidPromptTargetError for anything unrecognised — never falls back.
 */
export function normalizePromptTarget(value: unknown): PromptTarget {
  if (isPromptTarget(value)) return value;
  if (isLegacyPlatformName(value)) return LEGACY_PLATFORM_TARGET[value];
  throw new InvalidPromptTargetError(value);
}

export interface Stage8VideoPromptInput {
  scene: Scene;
  shot: Shot;
  shotIndex: number; // 0-indexed position in scene
  totalShotsInScene: number;
  masterFrameImageUrl?: string | null;
  foundation: ProjectFoundation | null;
  characters: CharacterBible[];
  locations: LocationBible[];
  videoModels: ('veo' | 'gemini_omni')[];
  includeSeedance: boolean;
  language: 'id' | 'en';
  model?: string;
  reasoningConfig?: ReasoningConfig;
  /**
   * PATCH 5.5-R1: explicit single prompt target (regenerate / retry path).
   * The target — never the shot length — selects the adapter and the duration.
   */
  target?: PromptTarget;
  /** PATCH 5.5-R1: explicit multi-target batch. Wins over videoModels/includeSeedance. */
  targets?: PromptTarget[];
  /**
   * PATCH 5.5-R1: optional caller-requested duration, validated against the
   * target contract by resolveOutputDurationStrict(). When omitted the target's
   * canonical contract duration is used. A mismatch is a hard failure, never
   * coerced (e.g. seedance_10 + 30 -> PROMPT_DURATION_CONTRACT_FAILED).
   */
  requestedDuration?: number;
  /**
   * @deprecated PATCH 5.5-R1: superseded by `target`.
   * Still accepts the legacy platform names ('veo' | 'gemini_omni' | 'seedance')
   * sent by POST /shots/:id/regenerate-prompt, which are translated 1:1 by
   * LEGACY_PLATFORM_TARGET (no duration inspection, no guessing). Anything
   * outside that map is rejected with INVALID_PROMPT_TARGET.
   * Removed once server/routes.ts sends `target` (Fase 4).
   */
  specificPlatform?: PromptTarget | LegacyPlatformName;
}

/** A still-image prompt produced by a banana_* target. */
export interface Stage8StillPrompt {
  target: StillPromptTarget;
  prompt_text: string;
  negative_prompt: string;
  resolved_duration_sec: number;
}

export interface Stage8Result {
  prompts: Omit<VideoPrompt, 'id' | 'created_at' | 'updated_at'>[];
  stills: Stage8StillPrompt[];
}

/**
 * Structured failure raised when a caller asks for a prompt target that is not
 * a member of the canonical PromptTarget union. There is deliberately NO
 * fallback to Seedance (or anything else) — an unknown target is a bug in the
 * caller, not a hint to be guessed at.
 */
export class InvalidPromptTargetError extends Error {
  readonly code = INVALID_PROMPT_TARGET;
  readonly received: unknown;
  readonly supportedTargets: PromptTarget[] = ALL_PROMPT_TARGETS;

  constructor(received: unknown) {
    super(
      `${INVALID_PROMPT_TARGET}: target "${String(received)}" tidak dikenal ` +
        `(didukung: ${ALL_PROMPT_TARGETS.join(', ')}). Tidak ada fallback target.`
    );
    this.name = 'InvalidPromptTargetError';
    this.received = received;
    // Preserve instanceof across the TS -> JS downlevel boundary.
    Object.setPrototypeOf(this, InvalidPromptTargetError.prototype);
  }

  toPayload(): { code: typeof INVALID_PROMPT_TARGET; received: unknown; supportedTargets: PromptTarget[] } {
    return { code: this.code, received: this.received, supportedTargets: this.supportedTargets };
  }
}

export function isInvalidPromptTargetError(err: unknown): err is InvalidPromptTargetError {
  return err instanceof InvalidPromptTargetError;
}

/**
 * PATCH 5.5-R1: EXPLICIT TARGET -> ADAPTER TABLE.
 *
 * This is the single source of truth for dispatch. It is intentionally a data
 * table (not a chain of duration heuristics) so the mapping is provable:
 *   banana_master_frame -> adaptBananaMasterFrame
 *   banana_image        -> adaptBananaImagePrompt
 *   veo                 -> adaptVeoVideoPrompt
 *   omni                -> adaptOmniVideoPrompt
 *   seedance_10         -> adaptSeedanceVideoPrompt
 *   seedance_30         -> adaptSeedanceVideoPrompt
 */
export interface PromptTargetAdapterTable {
  banana_master_frame: typeof adaptBananaMasterFrame;
  banana_image: typeof adaptBananaImagePrompt;
  veo: typeof adaptVeoVideoPrompt;
  omni: typeof adaptOmniVideoPrompt;
  seedance_10: typeof adaptSeedanceVideoPrompt;
  seedance_30: typeof adaptSeedanceVideoPrompt;
}

export const PROMPT_TARGET_ADAPTERS: PromptTargetAdapterTable = {
  banana_master_frame: adaptBananaMasterFrame,
  banana_image: adaptBananaImagePrompt,
  veo: adaptVeoVideoPrompt,
  omni: adaptOmniVideoPrompt,
  seedance_10: adaptSeedanceVideoPrompt,
  seedance_30: adaptSeedanceVideoPrompt,
};

// Compile-time proof that the adapter table covers exactly the PromptTarget union.
type AdapterTableCoversAllTargets = [PromptTarget] extends [keyof PromptTargetAdapterTable]
  ? [keyof PromptTargetAdapterTable] extends [PromptTarget]
    ? true
    : never
  : never;
const ADAPTER_TABLE_IS_EXHAUSTIVE: AdapterTableCoversAllTargets = true;
void ADAPTER_TABLE_IS_EXHAUSTIVE;

/**
 * Serialization style passed to serializeMasterSceneData(). This only selects
 * how the master scene data is shaped (MasterSceneData.model_target); it does
 * NOT select the adapter — PROMPT_TARGET_ADAPTERS does that.
 */
export const PROMPT_TARGET_SERIALIZATION: Record<PromptTarget, VideoModelTarget> = {
  banana_master_frame: 'banana',
  banana_image: 'banana',
  veo: 'veo',
  omni: 'gemini_omni',
  seedance_10: 'seedance',
  seedance_30: 'seedance',
};

/** Legacy persisted column mapping for the video targets. */
export const PROMPT_TARGET_PLATFORM_COLUMN: Record<VideoOnlyPromptTarget, 'veo' | 'gemini_omni' | 'seedance'> = {
  veo: 'veo',
  omni: 'gemini_omni',
  seedance_10: 'seedance',
  seedance_30: 'seedance',
};

export function isStillPromptTarget(target: PromptTarget): target is StillPromptTarget {
  return target === 'banana_master_frame' || target === 'banana_image';
}

/**
 * Resolves the explicit list of prompt targets for this Stage 8 run.
 *
 * Precedence: `target` (single, explicit) -> `targets` (explicit batch) ->
 * project configuration batch. Every branch yields explicit PromptTarget values;
 * none of them inspect scene/shot duration, and none of them fall back to
 * Seedance when a target is unrecognised.
 */
export function resolvePromptTargets(args: {
  explicitTarget?: PromptTarget | LegacyPlatformName | null;
  targets?: PromptTarget[] | null;
  videoModels?: ('veo' | 'gemini_omni')[];
  includeSeedance?: boolean;
}): PromptTarget[] {
  const { explicitTarget, targets, videoModels, includeSeedance } = args;

  if (explicitTarget !== undefined && explicitTarget !== null) {
    return [normalizePromptTarget(explicitTarget)];
  }

  if (targets !== undefined && targets !== null) {
    if (!Array.isArray(targets) || targets.length === 0) {
      throw new InvalidPromptTargetError(targets);
    }
    return targets.map((t) => normalizePromptTarget(t));
  }

  // Batch (full pipeline) path. Derived from project configuration, still one
  // explicit target per entry. Seedance defaults to the 10s target: extended
  // 30s output must be requested explicitly as `seedance_30`, never inferred
  // from a scene that happens to be 30 seconds long.
  const batch: PromptTarget[] = [];
  if (videoModels?.includes('veo')) batch.push('veo');
  if (videoModels?.includes('gemini_omni')) batch.push('omni');
  if (includeSeedance) batch.push('seedance_10');
  if (batch.length === 0) batch.push('veo');
  return batch;
}

/**
 * The contractual duration of a target, used when the caller does not request
 * one explicitly. Still routed through the strict resolver so there is exactly
 * one code path that can produce a duration.
 */
export function contractDurationFor(target: PromptTarget): number {
  const supported = PROMPT_TARGET_SUPPORTED_DURATIONS[target];
  if (!supported || supported.length === 0) {
    throw new InvalidPromptTargetError(target);
  }
  return supported[0];
}

// Validation helper for runaway text / excessive length / repetition
function validatePlatformData(
  platform: 'veo' | 'gemini_omni' | 'seedance',
  data: any
): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: `Data platform ${platform} kosong atau bukan objek valid.` };
  }

  // Check for runaway repetition pattern (a phrase of >= 20 chars repeating 3+ times)
  const checkForRepetition = (str: string): boolean => {
    if (!str || str.length < 60) return false;
    const sample = str.substring(0, 30);
    const count = (str.match(new RegExp(sample.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    return count >= 3;
  };

  if (platform === 'veo' || platform === 'gemini_omni') {
    if (data.prompt) {
      if (typeof data.prompt !== 'string') {
        return { valid: false, error: 'Field PROMPT harus berupa string.' };
      }
      if (data.prompt.length > 650) {
        return { valid: false, error: `Field PROMPT terlalu panjang (${data.prompt.length} karakter, maksimal 650 karakter / ~80 kata).` };
      }
      if (checkForRepetition(data.prompt)) {
        return { valid: false, error: 'Terdeteksi pengulangan frasa/runaway loop pada field PROMPT.' };
      }
    }

    if (data.camera) {
      if (typeof data.camera !== 'string') {
        return { valid: false, error: 'Field CAMERA harus berupa string.' };
      }
      if (data.camera.length > 600) {
        return { valid: false, error: `Field CAMERA terlalu panjang (${data.camera.length} karakter, maksimal 600 karakter).` };
      }
      if (checkForRepetition(data.camera)) {
        return { valid: false, error: 'Terdeteksi pengulangan frasa/runaway loop pada field CAMERA.' };
      }
    }

    if (data.dialog && typeof data.dialog === 'string' && data.dialog.length > 2000) {
      data.dialog = data.dialog.substring(0, 2000);
    }

    if (data.sfx_ambient && typeof data.sfx_ambient === 'string' && data.sfx_ambient.length > 2000) {
      data.sfx_ambient = data.sfx_ambient.substring(0, 2000);
    }

    if (platform === 'gemini_omni' && data.follow_up_edit_instructions) {
      if (typeof data.follow_up_edit_instructions === 'string' && data.follow_up_edit_instructions.length > 2000) {
        data.follow_up_edit_instructions = data.follow_up_edit_instructions.substring(0, 2000);
      }
    }
  } else if (platform === 'seedance') {
    if (data.shot_breakdown) {
      if (typeof data.shot_breakdown !== 'string') {
        return { valid: false, error: 'Field SHOT_BREAKDOWN harus berupa string.' };
      }
      if (data.shot_breakdown.length > 2000) {
        data.shot_breakdown = data.shot_breakdown.substring(0, 2000);
      }
      if (checkForRepetition(data.shot_breakdown)) {
        return { valid: false, error: 'Terdeteksi pengulangan frasa pada field SHOT_BREAKDOWN.' };
      }
    }

    if (data.audio && typeof data.audio === 'string' && data.audio.length > 2000) {
      data.audio = data.audio.substring(0, 2000);
    }

    if (data.global_style && typeof data.global_style === 'string' && data.global_style.length > 2000) {
      data.global_style = data.global_style.substring(0, 2000);
    }

    if (data.do_not_change && typeof data.do_not_change === 'string' && data.do_not_change.length > 2000) {
      data.do_not_change = data.do_not_change.substring(0, 2000);
    }
  }

  return { valid: true };
}

/**
 * Builds the MasterSceneData for one explicit target.
 *
 * The `resolvedDuration` argument is the ONLY source of duration. Raw
 * shot.duration_sec / scene.duration_sec are deliberately not consulted here:
 * the serializer stamps `DURATION: <n>s` into the prompt body, and the contract
 * validator matches that literal, so a raw scene length would break the
 * contract for every target whose length differs from the scene.
 */
function buildMasterDataForTarget(
  target: PromptTarget,
  args: {
    scene: Scene;
    shot: Shot;
    foundation: ProjectFoundation | null;
    characters: CharacterBible[];
    locations: LocationBible[];
  },
  resolvedDuration: number
): MasterSceneData {
  const masterData = serializeMasterSceneData(
    args.scene,
    [args.shot],
    args.foundation,
    args.characters,
    args.locations,
    [],
    PROMPT_TARGET_SERIALIZATION[target],
    'cinematic',
    'Cinematic Production',
    resolvedDuration
  );

  // Defensive: the adapters read data.duration_sec to emit the DURATION literal.
  // If the serializer ever loses the resolved value, fail loudly here rather
  // than let the validator report a confusing MISSING_SECTION downstream.
  if (masterData.duration_sec !== resolvedDuration) {
    throw new Error(
      `PROMPT_DURATION_PROPAGATION_FAILED: target "${target}" resolved to ${resolvedDuration}s ` +
        `but MasterSceneData.duration_sec is ${masterData.duration_sec}s.`
    );
  }

  return masterData;
}

function buildDialogText(shot: Shot): string {
  return shot.dialogue.length > 0
    ? shot.dialogue.map((d) => `${d.character_name} berkata, "${d.line}"`).join('\n')
    : '';
}

export async function runStage8VideoPrompt(
  input: Stage8VideoPromptInput
): Promise<Stage8Result> {
  const {
    scene,
    shot,
    masterFrameImageUrl,
    foundation,
    characters,
    locations,
    videoModels,
    includeSeedance,
    target,
    targets,
    requestedDuration,
    specificPlatform,
  } = input;

  // ------------------------------------------------------------------
  // PATCH 5.5-R1: EXPLICIT TARGET RESOLUTION
  // No duration heuristics, no `is30s`, no fallback to Seedance. An unknown
  // target throws InvalidPromptTargetError.
  // ------------------------------------------------------------------
  const targetsToGenerate = resolvePromptTargets({
    explicitTarget: target ?? specificPlatform,
    targets,
    videoModels,
    includeSeedance,
  });

  const results: Omit<VideoPrompt, 'id' | 'created_at' | 'updated_at'>[] = [];
  const stills: Stage8StillPrompt[] = [];

  const serializerArgs = { scene, shot, foundation, characters, locations };

  for (const promptTarget of targetsToGenerate) {
    // STEP 1 — target -> strict resolver. The resolver throws
    // PromptDurationContractError for any unsupported pairing
    // (seedance_10 + 30, seedance_30 + 10, veo + 30, ...). No coercion.
    const resolvedDuration = resolveOutputDurationStrict(
      promptTarget,
      requestedDuration ?? contractDurationFor(promptTarget)
    );

    // STEP 2 — resolvedDuration -> serializer.
    const masterData = buildMasterDataForTarget(promptTarget, serializerArgs, resolvedDuration);

    // STEP 3 — explicit adapter dispatch, STEP 4 — validator with the SAME
    // resolvedDuration that produced the prompt text.
    switch (promptTarget) {
      case 'banana_master_frame': {
        const promptText = PROMPT_TARGET_ADAPTERS.banana_master_frame(masterData);
        assertProductionPromptContract(promptText, 'banana_master_frame', resolvedDuration, {
          sceneId: scene.id,
          shotId: shot.id,
          isProphetScene: masterData.is_prophet_scene,
        });
        stills.push({
          target: 'banana_master_frame',
          prompt_text: promptText,
          negative_prompt: compileNegativePrompt(masterData),
          resolved_duration_sec: resolvedDuration,
        });
        break;
      }

      case 'banana_image': {
        const promptText = PROMPT_TARGET_ADAPTERS.banana_image(masterData);
        assertProductionPromptContract(promptText, 'banana_image', resolvedDuration, {
          sceneId: scene.id,
          shotId: shot.id,
          isProphetScene: masterData.is_prophet_scene,
        });
        stills.push({
          target: 'banana_image',
          prompt_text: promptText,
          negative_prompt: compileNegativePrompt(masterData),
          resolved_duration_sec: resolvedDuration,
        });
        break;
      }

      case 'veo': {
        const veoRes = PROMPT_TARGET_ADAPTERS.veo(masterData, [shot]);
        const valVeo = validateProductionPromptContract(veoRes.prompt, 'veo', resolvedDuration, {
          sceneId: scene.id,
          shotId: shot.id,
          isProphetScene: masterData.is_prophet_scene,
        });
        if (!valVeo.valid) {
          throw new PromptContractValidationError(valVeo);
        }

        const timeline: VideoPromptTimeline = {
          prompt: veoRes.prompt,
          camera: veoRes.camera,
          dialog: buildDialogText(shot),
          sfx_ambient: shot.audio_note || 'Natural environmental ambient sounds',
          clip_duration_sec: resolvedDuration,
          resolved_duration_sec: resolvedDuration,
          negative_prompt: veoRes.negative_prompt,
          reference_image: masterFrameImageUrl || undefined,
        };

        results.push({
          shot_id: shot.id || '',
          scene_id: scene.id || '',
          project_id: scene.project_id,
          target_platform: PROMPT_TARGET_PLATFORM_COLUMN.veo,
          prompt_target: 'veo',
          generation_type: 'prompt_target',
          status: 'ready',
          timeline_json: timeline,
          negative_prompt: veoRes.negative_prompt,
          version: 1,
        });
        break;
      }

      case 'omni': {
        const omniRes = PROMPT_TARGET_ADAPTERS.omni(masterData);
        const valOmni = validateProductionPromptContract(omniRes.prompt, 'omni', resolvedDuration, {
          sceneId: scene.id,
          shotId: shot.id,
          isProphetScene: masterData.is_prophet_scene,
        });
        if (!valOmni.valid) {
          throw new PromptContractValidationError(valOmni);
        }

        const timeline: VideoPromptTimeline = {
          prompt: omniRes.prompt,
          camera: omniRes.camera,
          dialog: buildDialogText(shot),
          sfx_ambient: shot.audio_note || 'Historical ambient atmosphere',
          clip_duration_sec: resolvedDuration,
          resolved_duration_sec: resolvedDuration,
          negative_prompt: omniRes.negative_prompt,
          reference_image: masterFrameImageUrl || undefined,
          follow_up_edit_instructions: omniRes.follow_up,
        };

        results.push({
          shot_id: shot.id || '',
          scene_id: scene.id || '',
          project_id: scene.project_id,
          target_platform: PROMPT_TARGET_PLATFORM_COLUMN.omni,
          prompt_target: 'omni',
          generation_type: 'prompt_target',
          status: 'ready',
          timeline_json: timeline,
          negative_prompt: omniRes.negative_prompt,
          version: 1,
        });
        break;
      }

      // seedance_10 and seedance_30 share one adapter but remain SEPARATE
      // targets: the duration comes from the target contract, so the 30s
      // variant is never inferred from a long shot.
      case 'seedance_10':
      case 'seedance_30': {
        const seedRes = PROMPT_TARGET_ADAPTERS[promptTarget](masterData);
        const valSeed = validateProductionPromptContract(
          seedRes.shot_breakdown,
          promptTarget,
          resolvedDuration,
          {
            sceneId: scene.id,
            shotId: shot.id,
            isProphetScene: masterData.is_prophet_scene,
          }
        );
        if (!valSeed.valid) {
          throw new PromptContractValidationError(valSeed);
        }

        const timeline: VideoPromptTimeline = {
          global_style: seedRes.global_style,
          characters: masterData.characters.map((c) => `${c.name}: ${c.appearance}`).join('; '),
          references: masterFrameImageUrl ? `@Image(${masterFrameImageUrl})` : '@Image(MasterFrame_Anchor)',
          shot_breakdown: seedRes.shot_breakdown,
          audio: seedRes.audio,
          do_not_change: seedRes.do_not_change,
          clip_duration_sec: resolvedDuration,
          resolved_duration_sec: resolvedDuration,
          negative_prompt: seedRes.negative_prompt,
        };

        results.push({
          shot_id: shot.id || '',
          scene_id: scene.id || '',
          project_id: scene.project_id,
          target_platform: PROMPT_TARGET_PLATFORM_COLUMN[promptTarget],
          prompt_target: promptTarget,
          generation_type: 'prompt_target',
          status: 'ready',
          timeline_json: timeline,
          negative_prompt: seedRes.negative_prompt,
          version: 1,
        });
        break;
      }

      default: {
        // Exhaustiveness guard. If PromptTarget grows a member without a case
        // here, `never` fails the build; at runtime this throws instead of
        // silently falling back to Seedance.
        const exhaustive: never = promptTarget;
        throw new InvalidPromptTargetError(exhaustive);
      }
    }
  }

  return { prompts: results, stills };
}

