import {
  serializeMasterSceneData,
  adaptBananaMasterFrame,
  adaptBananaImagePrompt,
  compileNegativePrompt,
  assertProductionPromptContract,
} from '../cinematic_prompt_engine';
import { resolveOutputDurationStrict } from '../duration_engine';
import {
  Scene,
  ProjectFoundation,
  CharacterBible,
  LocationBible,
  ObjectBible,
  MasterImagePrompt,
  ReasoningConfig,
} from '../../src/types';

export interface Stage7MasterFrameInput {
  scene: Scene;
  foundation: ProjectFoundation | null;
  characters: CharacterBible[];
  locations: LocationBible[];
  objects: ObjectBible[];
  language: 'id' | 'en';
  model?: string;
  reasoningConfig?: ReasoningConfig;
  /**
   * PATCH 5.5-R1 (Fase 4): optional caller-requested duration for the still
   * contract. Validated by resolveOutputDurationStrict() against the banana
   * targets, which support [10] only. When omitted, the canonical contract
   * duration is used.
   *
   * Deliberately NOT defaulted from `scene.duration_sec`: a 30s scene does not
   * make a master frame a 30s still. If a caller genuinely wants to assert the
   * scene length as the still duration it must pass it explicitly and accept
   * PROMPT_DURATION_CONTRACT_FAILED.
   */
  requestedDuration?: number;
}

export interface Stage7Result {
  promptJson: MasterImagePrompt;
  compiledPromptText: string;
  masterFramePromptText: string;
  resolvedDurationSec: number;
}

export async function runStage7MasterFrameAndImagePrompt(
  input: Stage7MasterFrameInput
): Promise<Stage7Result> {
  const { scene, foundation, characters, locations, objects, requestedDuration } = input;

  // ------------------------------------------------------------------
  // PATCH 5.5-R1 (Fase 4): the still targets own their duration.
  //
  // banana_master_frame and banana_image both declare supported = [10], so the
  // strict resolver is the ONLY source of the number handed to the serializer
  // and to the contract validator. `scene.duration_sec || 10` is gone: a 30s
  // scene now produces PROMPT_DURATION_CONTRACT_FAILED instead of being
  // silently rewritten to 10s.
  // ------------------------------------------------------------------
  const resolvedDuration = resolveOutputDurationStrict(
    'banana_master_frame',
    requestedDuration ?? 10
  );
  // Same contract for the shot-image variant; asserted separately so a future
  // divergence in supported durations cannot pass unnoticed.
  const resolvedImageDuration = resolveOutputDurationStrict('banana_image', resolvedDuration);

  const masterData = serializeMasterSceneData(
    scene,
    [],
    foundation,
    characters,
    locations,
    objects,
    'banana',
    'cinematic',
    'Cinematic Production',
    resolvedDuration
  );

  const masterFrameText = adaptBananaMasterFrame(masterData);
  const imagePromptText = adaptBananaImagePrompt(masterData);

  // Contract gatekeeping before anything is returned for persistence. Throws
  // PromptContractValidationError (code PROMPT_CONTRACT_VALIDATION_FAILED).
  assertProductionPromptContract(masterFrameText, 'banana_master_frame', resolvedDuration, {
    sceneId: scene.id,
    isProphetScene: masterData.is_prophet_scene,
  });

  assertProductionPromptContract(imagePromptText, 'banana_image', resolvedImageDuration, {
    sceneId: scene.id,
    isProphetScene: masterData.is_prophet_scene,
  });

  const parsedJson: MasterImagePrompt = {
    subject: masterData.action.primary,
    characters_note: masterData.characters.map((c) => `${c.name}: ${c.appearance} (${c.pose_expression})`).join('; '),
    costume: masterData.characters.flatMap((c) => c.costume).join(', '),
    location: masterData.location.place,
    era: masterData.location.era,
    architecture: masterData.location.architecture,
    environment: `${masterData.time.time_of_day}, ${masterData.time.atmosphere}`,
    lighting: masterData.lighting.source,
    composition: masterData.camera.framing,
    camera: masterData.camera.shot_type,
    lens: masterData.camera.lens,
    mood: `${masterData.mood.emotion}, ${masterData.mood.tension}`,
    cinematic_style: masterData.visual_style.cinematic_style,
    negative_prompt: compileNegativePrompt(masterData),
  };

  return {
    promptJson: parsedJson,
    compiledPromptText: imagePromptText,
    masterFramePromptText: masterFrameText,
    resolvedDurationSec: resolvedDuration,
  };
}

