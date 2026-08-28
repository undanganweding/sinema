import { Scene, Shot, PromptTarget } from '../src/types';

export interface ModelDurationCapability {
  model_id: string;
  supported_durations: number[];
  default_duration: number;
  supports_extended: boolean;
}

export const MODEL_DURATION_CAPABILITIES: Record<string, ModelDurationCapability> = {
  veo: {
    model_id: 'veo',
    supported_durations: [10],
    default_duration: 10,
    supports_extended: false,
  },
  gemini_omni: {
    model_id: 'gemini_omni',
    supported_durations: [10],
    default_duration: 10,
    supports_extended: false,
  },
  seedance: {
    model_id: 'seedance',
    supported_durations: [10, 30],
    default_duration: 10,
    supports_extended: true,
  },
};

/**
 * Duration Resolution Engine: TIMELINE DETERMINES SCENE, MODEL FOLLOWS SCENE DURATION
 */
export function resolveOutputDuration(
  timelineSceneDuration: number,
  durationMode: 'match_scene' | 'extended',
  selectedExtendedDuration: number = 30,
  model: string = 'veo'
): number {
  const cap = MODEL_DURATION_CAPABILITIES[model] || MODEL_DURATION_CAPABILITIES['veo'];
  
  if (durationMode === 'extended' && cap.supports_extended) {
    if (cap.supported_durations.includes(selectedExtendedDuration)) {
      return selectedExtendedDuration;
    }
  }
  
  // Default match_scene behavior: follow timelineSceneDuration
  if (cap.supported_durations.includes(timelineSceneDuration)) {
    return timelineSceneDuration;
  }
  
  return timelineSceneDuration;
}

/**
 * ============================================================================
 * PATCH 5.5-R1: STRICT PROMPT DURATION RESOLVER
 * ============================================================================
 * Authoritative duration per explicit PromptTarget.
 *
 * This is deliberately NOT derived from shot/scene length. The target decides
 * the duration; a shot that happens to be 7s does not turn a Veo prompt into a
 * 7s prompt, and it does not get promoted to seedance_30 either.
 *
 * Stills (banana_master_frame / banana_image) carry no video timeline, so their
 * only contractual duration is the canonical 10s reference used by the master
 * scene serializer. Any other value is a contract violation, not a hint.
 */
export const PROMPT_TARGET_SUPPORTED_DURATIONS: Record<PromptTarget, number[]> = {
  banana_master_frame: [10],
  banana_image: [10],
  veo: [10],
  omni: [10],
  seedance_10: [10],
  seedance_30: [30],
};

export const PROMPT_DURATION_CONTRACT_FAILED = 'PROMPT_DURATION_CONTRACT_FAILED' as const;

/**
 * Structured failure raised when a requested duration is not supported by the
 * explicit prompt target. Carries the full contract payload so API layers can
 * report exactly what was asked for and what was allowed.
 */
export class PromptDurationContractError extends Error {
  readonly code = PROMPT_DURATION_CONTRACT_FAILED;
  readonly model: PromptTarget;
  readonly requestedDuration: number;
  readonly supportedDurations: number[];

  constructor(model: PromptTarget, requestedDuration: number, supportedDurations: number[]) {
    super(
      `${PROMPT_DURATION_CONTRACT_FAILED}: target "${model}" tidak mendukung durasi ${requestedDuration}s ` +
        `(didukung: ${supportedDurations.join(', ')}s). Tidak ada koersi otomatis.`
    );
    this.name = 'PromptDurationContractError';
    this.model = model;
    this.requestedDuration = requestedDuration;
    this.supportedDurations = supportedDurations;
    // Preserve instanceof across the TS -> JS downlevel boundary.
    Object.setPrototypeOf(this, PromptDurationContractError.prototype);
  }

  toPayload(): { code: typeof PROMPT_DURATION_CONTRACT_FAILED; model: PromptTarget; requestedDuration: number; supportedDurations: number[] } {
    return {
      code: this.code,
      model: this.model,
      requestedDuration: this.requestedDuration,
      supportedDurations: this.supportedDurations,
    };
  }
}

export function isPromptDurationContractError(err: unknown): err is PromptDurationContractError {
  return err instanceof PromptDurationContractError;
}

/**
 * Strict duration resolver for production prompt generation.
 *
 * Returns the requested duration ONLY if the target genuinely supports it.
 * Never coerces, never rounds to the nearest supported value, never promotes
 * 10 -> 30. Anything else throws PromptDurationContractError.
 *
 * @throws {PromptDurationContractError} when target is unknown, or the duration
 *         is not an exact member of the target's supported set.
 */
export function resolveOutputDurationStrict(
  target: PromptTarget,
  requestedDuration: number
): number {
  const supported = PROMPT_TARGET_SUPPORTED_DURATIONS[target];

  // Unknown / legacy target name reaching here at runtime (e.g. from an
  // untyped JSON body) is itself a contract failure.
  if (!supported) {
    throw new PromptDurationContractError(target, requestedDuration, []);
  }

  if (
    typeof requestedDuration !== 'number' ||
    !Number.isFinite(requestedDuration) ||
    !Number.isInteger(requestedDuration) ||
    requestedDuration <= 0
  ) {
    throw new PromptDurationContractError(target, requestedDuration, supported);
  }

  if (!supported.includes(requestedDuration)) {
    throw new PromptDurationContractError(target, requestedDuration, supported);
  }

  return requestedDuration;
}

export interface DurationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sceneCount: number;
  resolvedOutputDuration: number;
}

/**
 * Validates duration compatibility across project duration, timeline scene duration, and model capability.
 */
export function validateDurationCompatibility(
  projectDuration: number,
  timelineSceneDuration: number,
  model: string,
  durationMode: 'match_scene' | 'extended',
  selectedExtendedDuration: number = 30
): DurationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cap = MODEL_DURATION_CAPABILITIES[model] || MODEL_DURATION_CAPABILITIES['veo'];

  const resolvedOutputDuration = resolveOutputDuration(
    timelineSceneDuration,
    durationMode,
    selectedExtendedDuration,
    model
  );

  if (projectDuration <= 0 || timelineSceneDuration <= 0) {
    errors.push('Project duration dan timeline scene duration harus lebih besar dari 0.');
  }

  const remainder = projectDuration % timelineSceneDuration;
  const sceneCount = Math.floor(projectDuration / timelineSceneDuration) + (remainder > 0 ? 1 : 0);

  if (remainder !== 0) {
    warnings.push(
      `Project duration (${projectDuration}s) tidak dapat dibagi rata dengan scene duration (${timelineSceneDuration}s). Scene terakhir akan berdurasi ${remainder}s.`
    );
    // Check if remainder is supported
    if (!cap.supported_durations.includes(remainder)) {
      errors.push(
        `Scene terakhir berdurasi ${remainder}s tidak didukung oleh model ${model} (hanya mendukung: ${cap.supported_durations.join(', ')}s). Harap sesuaikan durasi proyek atau scene.`
      );
    }
  }

  if (durationMode === 'extended' && !cap.supports_extended) {
    errors.push(`Model "${model}" tidak mendukung Extended Mode.`);
  }

  if (!cap.supported_durations.includes(resolvedOutputDuration)) {
    errors.push(
      `Model output duration ${resolvedOutputDuration}s tidak didukung oleh model "${model}". Model hanya mendukung: ${cap.supported_durations.join(', ')}s.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sceneCount,
    resolvedOutputDuration,
  };
}

/**
 * Converts timeline scenes for Extended Mode (e.g., merging 10s scenes into 30s scenes)
 * while preserving content, characters, locations, actions, and continuity data.
 */
export function convertTimelineForExtendedMode(
  existingScenes: Scene[],
  targetDuration: number = 30
): Scene[] {
  if (existingScenes.length === 0) return [];
  
  // Group existing scenes into chunks of targetDuration
  const newScenes: Scene[] = [];
  let currentChunkScenes: Scene[] = [];
  let accumulatedDuration = 0;
  let newSceneIndex = 1;

  for (const scene of existingScenes) {
    currentChunkScenes.push(scene);
    accumulatedDuration += scene.duration_sec || 10;

    if (accumulatedDuration >= targetDuration) {
      // Create merged extended scene
      const primary = currentChunkScenes[0];
      const mergedCharacters = Array.from(
        new Set(currentChunkScenes.flatMap((s) => s.character_names || []))
      );
      const mergedLocations = currentChunkScenes.map((s) => s.location_name).filter(Boolean);
      const primaryLocation = mergedLocations[0] || 'Studio Utama';
      const mergedEvents = currentChunkScenes.map((s) => s.event || s.title).join(' -> ');

      newScenes.push({
        ...primary,
        id: `scene_ext_${Date.now()}_${newSceneIndex}`,
        scene_number: newSceneIndex,
        title: `Extended Scene ${newSceneIndex}: ${primary.title}`,
        duration_sec: targetDuration,
        event: mergedEvents,
        character_names: mergedCharacters,
        location_name: primaryLocation,
      });

      newSceneIndex++;
      currentChunkScenes = [];
      accumulatedDuration = 0;
    }
  }

  // If leftover scenes remain
  if (currentChunkScenes.length > 0) {
    const primary = currentChunkScenes[0];
    const mergedCharacters = Array.from(
      new Set(currentChunkScenes.flatMap((s) => s.character_names || []))
    );
    const primaryLocation = currentChunkScenes[0]?.location_name || 'Studio Utama';
    const mergedEvents = currentChunkScenes.map((s) => s.event || s.title).join(' -> ');

    newScenes.push({
      ...primary,
      id: `scene_ext_${Date.now()}_${newSceneIndex}`,
      scene_number: newSceneIndex,
      title: `Extended Scene ${newSceneIndex}: ${primary.title}`,
      duration_sec: accumulatedDuration,
      event: mergedEvents,
      character_names: mergedCharacters,
      location_name: primaryLocation,
    });
  }

  return newScenes;
}

/**
 * Regression Test Runner for Duration & Model Architecture (Tests 01-08)
 */
export function runDurationArchitectureRegressionTests(): { testId: string; name: string; passed: boolean; details: string }[] {
  const results = [];

  // TEST 01: Project 60s, Scene 10s, Veo -> 6 x 10s
  {
    const val = validateDurationCompatibility(60, 10, 'veo', 'match_scene');
    const outputDur = resolveOutputDuration(10, 'match_scene', 30, 'veo');
    const passed = val.valid && val.sceneCount === 6 && outputDur === 10;
    results.push({
      testId: 'TEST 01',
      name: 'Project 60s, Scene 10s, Veo -> 6 x 10s',
      passed,
      details: `Scene count: ${val.sceneCount}, Output duration: ${outputDur}s, Valid: ${val.valid}`,
    });
  }

  // TEST 02: Project 60s, Scene 10s, Omni -> 6 x 10s
  {
    const val = validateDurationCompatibility(60, 10, 'gemini_omni', 'match_scene');
    const outputDur = resolveOutputDuration(10, 'match_scene', 30, 'gemini_omni');
    const passed = val.valid && val.sceneCount === 6 && outputDur === 10;
    results.push({
      testId: 'TEST 02',
      name: 'Project 60s, Scene 10s, Omni -> 6 x 10s',
      passed,
      details: `Scene count: ${val.sceneCount}, Output duration: ${outputDur}s, Valid: ${val.valid}`,
    });
  }

  // TEST 03: Project 60s, Scene 10s, Seedance Standard -> 6 x 10s
  {
    const val = validateDurationCompatibility(60, 10, 'seedance', 'match_scene');
    const outputDur = resolveOutputDuration(10, 'match_scene', 30, 'seedance');
    const passed = val.valid && val.sceneCount === 6 && outputDur === 10;
    results.push({
      testId: 'TEST 03',
      name: 'Project 60s, Scene 10s, Seedance Standard -> 6 x 10s',
      passed,
      details: `Scene count: ${val.sceneCount}, Output duration: ${outputDur}s, Valid: ${val.valid}`,
    });
  }

  // TEST 04: Project 60s, Seedance Extended -> 2 x 30s
  {
    const val = validateDurationCompatibility(60, 30, 'seedance', 'extended', 30);
    const outputDur = resolveOutputDuration(30, 'extended', 30, 'seedance');
    const passed = val.valid && val.sceneCount === 2 && outputDur === 30;
    results.push({
      testId: 'TEST 04',
      name: 'Project 60s, Seedance Extended -> 2 x 30s',
      passed,
      details: `Scene count: ${val.sceneCount}, Output duration: ${outputDur}s, Valid: ${val.valid}`,
    });
  }

  // TEST 05: Project 65s, Scene 10s, Model supports remainder -> Warning but valid or final scene check
  {
    const val = validateDurationCompatibility(65, 10, 'seedance', 'match_scene');
    const passed = val.warnings.length > 0;
    results.push({
      testId: 'TEST 05',
      name: 'Project 65s, Scene 10s with remainder warning',
      passed,
      details: `Warnings count: ${val.warnings.length}, Warnings: ${val.warnings.join('; ')}`,
    });
  }

  // TEST 06: Project 65s, Scene 10s, Model does NOT support remainder
  {
    // Veo only supports 10s, remainder 5s should fail validation
    const val = validateDurationCompatibility(65, 10, 'veo', 'match_scene');
    const passed = !val.valid && val.errors.length > 0;
    results.push({
      testId: 'TEST 06',
      name: 'Project 65s, Scene 10s, Veo unsupported remainder -> Validation error',
      passed,
      details: `Valid: ${val.valid}, Errors: ${val.errors.join('; ')}`,
    });
  }

  // TEST 07: Switching model Veo -> Seedance maintains timeline structure
  {
    const initialSceneDur = 10;
    const switchedDur = resolveOutputDuration(initialSceneDur, 'match_scene', 30, 'seedance');
    const passed = switchedDur === initialSceneDur;
    results.push({
      testId: 'TEST 07',
      name: 'Switching model Veo -> Seedance maintains scene duration',
      passed,
      details: `Initial: ${initialSceneDur}s, Switched output: ${switchedDur}s`,
    });
  }

  // TEST 08: Seedance Extended conversion preview & merge
  {
    const mockScenes: Scene[] = [
      { id: '1', project_id: 'p1', scene_number: 1, title: 'S1', duration_sec: 10, event: 'E1', character_names: ['A'], location_name: 'L1', story_purpose: '', time_of_day: 'Day', emotional_objective: '', narrative_function: '', version: 1, created_at: '', updated_at: '' },
      { id: '2', project_id: 'p1', scene_number: 2, title: 'S2', duration_sec: 10, event: 'E2', character_names: ['A'], location_name: 'L1', story_purpose: '', time_of_day: 'Day', emotional_objective: '', narrative_function: '', version: 1, created_at: '', updated_at: '' },
      { id: '3', project_id: 'p1', scene_number: 3, title: 'S3', duration_sec: 10, event: 'E3', character_names: ['B'], location_name: 'L1', story_purpose: '', time_of_day: 'Day', emotional_objective: '', narrative_function: '', version: 1, created_at: '', updated_at: '' },
    ] as unknown as Scene[];
    const converted = convertTimelineForExtendedMode(mockScenes, 30);
    const passed = converted.length === 1 && converted[0].duration_sec === 30 && converted[0].character_names?.length === 2;
    results.push({
      testId: 'TEST 08',
      name: 'Seedance Extended Timeline Conversion (3 x 10s -> 1 x 30s)',
      passed,
      details: `Converted scenes length: ${converted.length}, Target duration: ${converted[0]?.duration_sec}s`,
    });
  }

  return results;
}
