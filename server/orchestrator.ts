import { db } from './db';
import { runStage1StoryUnderstanding } from './stages/stage1_story_understanding';
import { runStage2CharacterDetection } from './stages/stage2_character_detection';
import { runStage3LocationObjectDetection } from './stages/stage3_location_object_detection';
import { runStage4NarrativeStructure } from './stages/stage4_narrative_structure';
import {
  runStage5SceneBreakdownAttempt,
  validateSceneDurations,
  DetectedScene,
} from './stages/stage5_scene_breakdown';
import {
  runStage6ShotBreakdownAttempt,
  validateShotBreakdown,
  validateShotDurationTotal,
  DetectedShot,
} from './stages/stage6_shot_breakdown';
import { runStage7MasterFrameAndImagePrompt } from './stages/stage7_master_frame';
import { runStage8VideoPrompt } from './stages/stage8_video_prompt';
import { classifyError } from './llm_provider';
import {
  buildContinuitySnapshot,
  buildContinuityInstruction,
  validateSceneContinuity,
  applyContinuityCorrectionToPrompt,
} from './continuity_engine';
import {
  synthesizeStoryArchitectureForLegacyProject,
  deriveBeatsForScene,
  CINEMATIC_GRAMMAR_GUIDELINES,
} from './story_architecture';
import { buildFullScenePrompt } from './full_scene_prompt';
import { ensureGroundingForProject, GROUNDING_VERSION, buildGroundingContextPackage, validateGroundingContext } from './grounding_engine';
import { executeResearchPackage, ResearchEngine } from './research_engine';
import { resolveResearchPackage } from './claim_resolution_engine';
import { extractClaimsFromEvidence } from './claim_extraction_engine';
import { assertStageConsistency, createGroundingState, evaluateStageOutput } from './consistency_engine';
import { createContinuityState, updateContinuityState } from './continuity_engine';
import {
  assertSceneAssetCoverage,
  createSceneAssetCoverageReport,
  validateMasterFrameCoverage,
  validatePromptCoverage,
  validateVideoPromptCoverage,
} from './scene_asset_integrity_engine';
import { assertFinalizationGate, evaluateFinalizationGate } from './finalization_gate';
import {
  Project,
  ProjectFoundation,
  Scene,
  Shot,
  StageCode,
  StageScope,
  StageExecutionTelemetry,
  ErrorClassification,
  ContinuitySnapshot,
  NarrativeMode,
} from '../src/types';

export interface OrchestratorRunOptions {
  projectId: string;
  onProgress?: (
    stage: number,
    stageName: string,
    message: string,
    level?: 'info' | 'success' | 'warn' | 'error'
  ) => void;
}

export interface FoundationVerificationResult {
  ready: boolean;
  missing: string[];
  foundation: ProjectFoundation | null;
  scenesCount: number;
}

export interface ProjectInitializationDependencies {
  researchEngine?: ResearchEngine;
  stage1Runner?: typeof runStage1StoryUnderstanding;
}

function enforceStageConsistency(projectId: string, stage: string, output: unknown, state: ReturnType<typeof createGroundingState> | null): void {
  if (!state) return;
  const report = evaluateStageOutput(stage, output, state);
  const project = db.getProject(projectId);
  if (project) {
    db.saveProject({
      ...project,
      consistencyReports: [...(project.consistencyReports || []), report],
    });
  }
  assertStageConsistency(report);
}

function advanceContinuity(projectId: string, stage: string, scene: { id?: string; scene_number?: number; location_name?: string; character_names?: string[]; event?: string; era?: string }, output: unknown, state: ReturnType<typeof createContinuityState> | null): ReturnType<typeof createContinuityState> | null {
  if (!state) return null;
  const result = updateContinuityState(state, scene, output);
  const project = db.getProject(projectId);
  if (project) db.saveProject({ ...project, continuityState: result.state });
  const blocking = result.issues.find((issue) => issue.severity === 'BLOCKING');
  if (blocking) throw new Error(`CONTINUITY_BLOCKED ${stage}: ${blocking.message}`);
  return result.state;
}

/**
 * Verifies if Project Foundation (S1-S5) is complete and valid.
 */
export function verifyProjectFoundation(projectId: string): FoundationVerificationResult {
  const missing: string[] = [];
  const foundation = db.getProjectFoundation(projectId);
  const characters = db.getCharacters(projectId);
  const locations = db.getLocations(projectId);
  const scenes = db.getScenes(projectId);

  if (!foundation || !foundation.genre || !foundation.era) {
    missing.push('Fondasi Cerita (S1)');
  }
  if (!characters || characters.length === 0) {
    missing.push('Character Bible (S2)');
  }
  if (!locations || locations.length === 0) {
    missing.push('Location Bible (S3)');
  }
  if (!foundation?.narrative_beats || !foundation.narrative_beats.beginning) {
    missing.push('Narrative Beats (S4)');
  }
  if (!scenes || scenes.length === 0) {
    missing.push('Scene Breakdown (S5)');
  }

  const isReady = missing.length === 0;

  // Update project foundation_status in db
  const project = db.getProject(projectId);
  if (project) {
    const newStatus = isReady ? 'ready' : missing.length === 5 ? 'not_initialized' : 'incomplete';
    if (project.foundation_status !== newStatus) {
      db.saveProject({
        ...project,
        foundation_status: newStatus,
      });
    }
  }

  return {
    ready: isReady,
    missing,
    foundation,
    scenesCount: scenes ? scenes.length : 0,
  };
}
/**
 * Helper to record telemetry event
 */
function recordTelemetry(
  projectId: string,
  telemetry: {
    stage: number;
    stage_code: StageCode;
    scope: StageScope;
    scene_id?: string;
    shot_id?: string;
    attempt: number;
    started_at: string;
    completed_at?: string;
    duration_ms?: number;
    status: 'started' | 'completed' | 'failed' | 'retrying';
    error_type?: ErrorClassification;
    error_message?: string;
  }
): StageExecutionTelemetry {
  return db.addTelemetry(projectId, {
    project_id: projectId,
    ...telemetry,
  });
}

/**
 * Runs Project Initialization Scope: Stages 1 to 5 ONLY.
 * Establishes project foundation, character bible, location bible, narrative beats, and scenes.
 */
export async function runProjectInitialization(
  projectId: string,
  onProgress?: (
    stage: number,
    stageName: string,
    message: string,
    level?: 'info' | 'success' | 'warn' | 'error'
  ) => void,
  dependencies: ProjectInitializationDependencies = {}
): Promise<{ success: boolean; error?: string }> {
  const project = db.getProject(projectId);
  if (!project) {
    throw new Error(`Project dengan ID ${projectId} tidak ditemukan.`);
  }

  const log = (
    stage: number,
    stageName: string,
    message: string,
    level: 'info' | 'success' | 'warn' | 'error' = 'info',
    stageCode?: StageCode,
    durationMs?: number,
    errorType?: ErrorClassification
  ) => {
    db.addLog(projectId, {
      stage,
      stage_name: stageName,
      stage_code: stageCode || (`S${stage}` as StageCode),
      scope: 'project',
      message,
      level,
      duration_ms: durationMs,
      error_type: errorType,
    });
    if (onProgress) {
      onProgress(stage, stageName, message, level);
    }
  };

  try {
    let groundedProject = ensureGroundingForProject(project);
    if (groundedProject.researchPackage &&
      (groundedProject.researchPackage.researchRequirement === 'RESEARCH_REQUIRED' ||
        groundedProject.researchPackage.researchRequirement === 'RESEARCH_RECOMMENDED')) {
      log(0, 'Research Engine', 'Menjalankan query riset yang masih berstatus PLANNED sebelum Stage 1...', 'info', 'S1');
      const executedResearch = await executeResearchPackage(
        groundedProject.researchPackage,
        dependencies.researchEngine || new ResearchEngine()
      );
      const extractedResearch = extractClaimsFromEvidence(executedResearch).researchPackage;
      groundedProject = { ...groundedProject, researchPackage: extractedResearch };
      if (extractedResearch.claims.length > 0) {
        const resolved = resolveResearchPackage(extractedResearch);
        groundedProject = {
          ...groundedProject,
          researchPackage: resolved.researchPackage,
          contextPackage: resolved.contextPackage,
          sourceRegistry: resolved.researchPackage.sources,
        };
        log(0, 'Research Engine', `Research resolved: ${resolved.acceptedKnowledge.acceptedClaims.length} accepted claims, ${resolved.researchPackage.conflicts.length} conflicts preserved.`, 'success', 'S1');
      } else {
        log(0, 'Research Engine', 'Retrieval completed without ClaimRecords; evidence remains available but automatic claim extraction is not enabled.', 'warn', 'S1');
      }
    }
    db.saveProject({
      ...groundedProject,
      status: 'processing',
      foundation_status: 'initializing',
      current_stage: 1,
      error_message: null,
    });

    const activeModel = project.reasoning_config?.display_name || project.ai_model || 'gemini-3.7-flash';

    if (groundedProject.contextPackage) {
      const groundingValidation = validateGroundingContext(groundedProject.contextPackage);
      db.saveProject({
        ...groundedProject,
        groundingVersion: GROUNDING_VERSION,
        contextPackage: groundedProject.contextPackage,
        sourceRegistry: groundedProject.contextPackage.sources,
        validationResult: groundingValidation,
        groundingStatus: groundedProject.contextPackage.groundingStatus,
      });
      if (groundingValidation.errors.length > 0) {
        log(0, 'Grounding Validator', `Grounding critical issues detected before Stage 1: ${groundingValidation.errors.join('; ')}`, 'warn', 'S1');
      }
    }

    const consistencyState = groundedProject.contextPackage
      ? createGroundingState(
          groundedProject.contextPackage,
          (groundedProject.researchPackage?.conflicts || []).filter((conflict) => conflict.status === 'UNRESOLVED')
        )
      : null;
    let continuityState = groundedProject.contextPackage
      ? createContinuityState(groundedProject.contextPackage)
      : null;
    if (continuityState) db.saveProject({ ...groundedProject, continuityState });

    // ==========================================
    // STAGE 1: Story Understanding Agent (S1)
    // ==========================================
    const s1Start = new Date().toISOString();
    const s1StartTime = Date.now();
    log(1, 'Story Understanding', `Memulai analisis naskah & fondasi cerita sinematik [Model: ${activeModel}]...`, 'info', 'S1');
    recordTelemetry(projectId, {
      stage: 1,
      stage_code: 'S1',
      scope: 'project',
      attempt: 1,
      started_at: s1Start,
      status: 'started',
    });

    let stage1Result;
    try {
      const stage1Runner = dependencies.stage1Runner || runStage1StoryUnderstanding;
      const stage1Input = {
        rawScript: project.raw_script,
        contextPackage: groundedProject.contextPackage || null,
        language: project.prompt_language,
        model: project.ai_model,
        reasoningConfig: project.reasoning_config,
      };
      stage1Result = await stage1Runner(stage1Input);
      enforceStageConsistency(projectId, 'S1', stage1Result, consistencyState);
      continuityState = advanceContinuity(projectId, 'S1', { id: `project_${projectId}`, scene_number: 1, event: 'Stage 1', character_names: stage1Result.main_characters }, stage1Result, continuityState);
      const s1Duration = Date.now() - s1StartTime;
      recordTelemetry(projectId, {
        stage: 1,
        stage_code: 'S1',
        scope: 'project',
        attempt: 1,
        started_at: s1Start,
        completed_at: new Date().toISOString(),
        duration_ms: s1Duration,
        status: 'completed',
      });
    } catch (err: any) {
      const s1Duration = Date.now() - s1StartTime;
      const errType = classifyError(err);
      recordTelemetry(projectId, {
        stage: 1,
        stage_code: 'S1',
        scope: 'project',
        attempt: 1,
        started_at: s1Start,
        completed_at: new Date().toISOString(),
        duration_ms: s1Duration,
        status: 'failed',
        error_type: errType,
        error_message: err.message,
      });
      throw err;
    }

    const foundationData: ProjectFoundation = {
      project_id: projectId,
      era: stage1Result.era,
      theme: stage1Result.theme,
      genre: stage1Result.genre,
      timeline: stage1Result.timeline,
      main_characters: stage1Result.main_characters,
      supporting_characters: stage1Result.supporting_characters,
      locations: stage1Result.locations,
      main_conflict: stage1Result.main_conflict,
      emotional_arc: stage1Result.emotional_arc,
      narrative_arc: stage1Result.narrative_arc,
      visual_tone: stage1Result.visual_tone,
      updated_at: new Date().toISOString(),
    };

    db.saveProjectFoundation(foundationData);
    log(
      1,
      'Story Understanding',
      `Selesai. Genre: "${stage1Result.genre}", Era: "${stage1Result.era}", Terdeteksi ${(stage1Result.main_characters || []).length} karakter utama. Tersimpan di collection 'project_foundation'.`,
      'success',
      'S1',
      Date.now() - s1StartTime
    );

    // ==========================================
    // STAGE 2: Character Detection Agent (S2)
    // ==========================================
    db.saveProject({ ...db.getProject(projectId)!, current_stage: 2 });
    const s2Start = new Date().toISOString();
    const s2StartTime = Date.now();
    log(2, 'Character Detection', `Mendeteksi profil karakter (Character Bible) & membaca database karakter yang ada [Model: ${activeModel}]...`, 'info', 'S2');
    recordTelemetry(projectId, {
      stage: 2,
      stage_code: 'S2',
      scope: 'project',
      attempt: 1,
      started_at: s2Start,
      status: 'started',
    });

    let savedCharacters;
    try {
      const stage2Result = await runStage2CharacterDetection({
        rawScript: project.raw_script,
        foundation: foundationData,
        contextPackage: project.contextPackage || null,
        language: project.prompt_language,
        model: project.ai_model,
        reasoningConfig: project.reasoning_config,
      });
      enforceStageConsistency(projectId, 'S2', stage2Result, consistencyState);
      continuityState = advanceContinuity(projectId, 'S2', { id: `project_${projectId}`, scene_number: 2, event: 'Stage 2', character_names: stage2Result.map((character) => character.name) }, stage2Result, continuityState);
      savedCharacters = db.saveAndMergeCharacters(projectId, stage2Result);
      const s2Duration = Date.now() - s2StartTime;
      recordTelemetry(projectId, {
        stage: 2,
        stage_code: 'S2',
        scope: 'project',
        attempt: 1,
        started_at: s2Start,
        completed_at: new Date().toISOString(),
        duration_ms: s2Duration,
        status: 'completed',
      });
    } catch (err: any) {
      const s2Duration = Date.now() - s2StartTime;
      const errType = classifyError(err);
      recordTelemetry(projectId, {
        stage: 2,
        stage_code: 'S2',
        scope: 'project',
        attempt: 1,
        started_at: s2Start,
        completed_at: new Date().toISOString(),
        duration_ms: s2Duration,
        status: 'failed',
        error_type: errType,
        error_message: err.message,
      });
      throw err;
    }

    log(
      2,
      'Character Detection',
      `Selesai. ${savedCharacters.length} karakter berhasil dipetakan dan disimpan ke collection 'characters' (merge verified).`,
      'success',
      'S2',
      Date.now() - s2StartTime
    );

    // ==========================================
    // STAGE 3: Location & Object Detection Agent (S3)
    // ==========================================
    db.saveProject({ ...db.getProject(projectId)!, current_stage: 3 });
    const s3Start = new Date().toISOString();
    const s3StartTime = Date.now();
    log(3, 'Location & Object Detection', `Mendeteksi set sinematik (Location Bible) dan properti kunci (Object Bible) [Model: ${activeModel}]...`, 'info', 'S3');
    recordTelemetry(projectId, {
      stage: 3,
      stage_code: 'S3',
      scope: 'project',
      attempt: 1,
      started_at: s3Start,
      status: 'started',
    });

    let savedLocations, savedObjects;
    try {
      const stage3Result = await runStage3LocationObjectDetection({
        rawScript: project.raw_script,
        foundation: foundationData,
        contextPackage: project.contextPackage || null,
        language: project.prompt_language,
        model: project.ai_model,
        reasoningConfig: project.reasoning_config,
      });
      enforceStageConsistency(projectId, 'S3', stage3Result, consistencyState);
      continuityState = advanceContinuity(projectId, 'S3', { id: `project_${projectId}`, scene_number: 3, event: 'Stage 3' }, stage3Result, continuityState);
      savedLocations = db.saveAndMergeLocations(projectId, stage3Result.locations);
      savedObjects = db.saveAndMergeObjects(projectId, stage3Result.objects);
      const s3Duration = Date.now() - s3StartTime;
      recordTelemetry(projectId, {
        stage: 3,
        stage_code: 'S3',
        scope: 'project',
        attempt: 1,
        started_at: s3Start,
        completed_at: new Date().toISOString(),
        duration_ms: s3Duration,
        status: 'completed',
      });
    } catch (err: any) {
      const s3Duration = Date.now() - s3StartTime;
      const errType = classifyError(err);
      recordTelemetry(projectId, {
        stage: 3,
        stage_code: 'S3',
        scope: 'project',
        attempt: 1,
        started_at: s3Start,
        completed_at: new Date().toISOString(),
        duration_ms: s3Duration,
        status: 'failed',
        error_type: errType,
        error_message: err.message,
      });
      throw err;
    }

    log(
      3,
      'Location & Object Detection',
      `Selesai. ${savedLocations.length} lokasi dan ${savedObjects.length} objek kunci tersimpan di collection 'locations' & 'objects'.`,
      'success',
      'S3',
      Date.now() - s3StartTime
    );

    // ==========================================
    // STAGE 4: Narrative Structure Agent (S4)
    // ==========================================
    db.saveProject({ ...db.getProject(projectId)!, current_stage: 4 });
    const s4Start = new Date().toISOString();
    const s4StartTime = Date.now();
    log(
      4,
      'Narrative Structure',
      `Menyusun Peta Struktur Naratif 5-Babak Global (Beginning, Development, Climax, Consequence, Ending) [Model: ${activeModel}]...`,
      'info',
      'S4'
    );
    recordTelemetry(projectId, {
      stage: 4,
      stage_code: 'S4',
      scope: 'project',
      attempt: 1,
      started_at: s4Start,
      status: 'started',
    });

    let narrativeBeats;
    try {
      narrativeBeats = await runStage4NarrativeStructure({
        rawScript: project.raw_script,
        foundation: foundationData,
        characters: savedCharacters,
        locations: savedLocations,
        contextPackage: project.contextPackage || null,
        language: project.prompt_language,
        model: project.ai_model,
        reasoningConfig: project.reasoning_config,
      });
      enforceStageConsistency(projectId, 'S4', narrativeBeats, consistencyState);
      continuityState = advanceContinuity(projectId, 'S4', { id: `project_${projectId}`, scene_number: 4, event: 'Stage 4' }, narrativeBeats, continuityState);

      db.saveProjectFoundation({
        ...foundationData,
        narrative_beats: narrativeBeats,
      });

      // Generate & save Cinematic Story Architecture (Cold Open, Acts/Babak, Sequences)
      const storyArch = synthesizeStoryArchitectureForLegacyProject(
        project,
        { ...foundationData, narrative_beats: narrativeBeats },
        []
      );
      db.saveStoryArchitecture(storyArch);

      const s4Duration = Date.now() - s4StartTime;
      recordTelemetry(projectId, {
        stage: 4,
        stage_code: 'S4',
        scope: 'project',
        attempt: 1,
        started_at: s4Start,
        completed_at: new Date().toISOString(),
        duration_ms: s4Duration,
        status: 'completed',
      });
    } catch (err: any) {
      const s4Duration = Date.now() - s4StartTime;
      const errType = classifyError(err);
      recordTelemetry(projectId, {
        stage: 4,
        stage_code: 'S4',
        scope: 'project',
        attempt: 1,
        started_at: s4Start,
        completed_at: new Date().toISOString(),
        duration_ms: s4Duration,
        status: 'failed',
        error_type: errType,
        error_message: err.message,
      });
      throw err;
    }

    log(
      4,
      'Narrative Structure',
      'Selesai. Pemahaman global 5 babak naratif berhasil disusun dan tersimpan di collection \'project_foundation\'.',
      'success',
      'S4',
      Date.now() - s4StartTime
    );

    // ==========================================
    // STAGE 5: Scene Breakdown & Duration Allocation Agent (S5)
    // ==========================================
    db.saveProject({ ...db.getProject(projectId)!, current_stage: 5 });
    
    const targetTotalSec = project.total_duration_target_sec;
    const fixedSceneSec = project.scene_duration_sec ?? project.max_scene_shot_duration_sec;
    const maxSceneSec = fixedSceneSec ?? 30;

    log(
      5,
      'Scene Breakdown & Duration',
      `Memulai pembagian Scene Breakdown. Target total: ${targetTotalSec}s | ${fixedSceneSec ? `Fixed Scene Duration: ${fixedSceneSec}s (System Constrained)` : `Auto Mode (Max ${maxSceneSec}s per scene)`}...`,
      'info',
      'S5'
    );

    const MAX_RETRIES = 3;
    let attempt = 0;
    let validatedScenes: DetectedScene[] | null = null;
    let feedbackPrompt: string | undefined = undefined;
    let lastValidationError: string | undefined = undefined;

    while (attempt < MAX_RETRIES) {
      attempt++;
      const s5AttemptStart = new Date().toISOString();
      const s5AttemptStartTime = Date.now();

      log(
        5,
        'Scene Breakdown & Duration',
        `Menjalankan generasi Scene Breakdown (Percobaan ${attempt}/${MAX_RETRIES})...`,
        'info',
        'S5'
      );
      recordTelemetry(projectId, {
        stage: 5,
        stage_code: 'S5',
        scope: 'project',
        attempt,
        started_at: s5AttemptStart,
        status: 'started',
      });

      try {
        const scenesAttempt = await runStage5SceneBreakdownAttempt({
          narrativeBeats,
          totalDurationTargetSec: targetTotalSec,
          maxSceneDurationSec: maxSceneSec,
          fixedSceneDurationSec: fixedSceneSec,
          allowFinalSceneOverride: project.allow_final_scene_override,
          contextPackage: project.contextPackage || null,
          language: project.prompt_language,
          model: project.ai_model,
          reasoningConfig: project.reasoning_config,
          feedbackPrompt,
        });
        enforceStageConsistency(projectId, 'S5', scenesAttempt, consistencyState);
        continuityState = advanceContinuity(projectId, 'S5', { id: `project_${projectId}`, scene_number: 5, event: 'Stage 5' }, scenesAttempt, continuityState);

        // Backend Validation
        const validation = validateSceneDurations(
          scenesAttempt,
          targetTotalSec,
          maxSceneSec,
          project.prompt_language,
          fixedSceneSec,
          project.allow_final_scene_override
        );

        if (validation.valid) {
          validatedScenes = scenesAttempt;
          const s5Duration = Date.now() - s5AttemptStartTime;
          recordTelemetry(projectId, {
            stage: 5,
            stage_code: 'S5',
            scope: 'project',
            attempt,
            started_at: s5AttemptStart,
            completed_at: new Date().toISOString(),
            duration_ms: s5Duration,
            status: 'completed',
          });

          log(
            5,
            'Scene Breakdown & Duration',
            `Validasi lolos sempurna pada percobaan ke-${attempt}! Total durasi ${validation.totalCalculated}s === ${targetTotalSec}s. Seluruh ${scenesAttempt.length} scene valid.`,
            'success',
            'S5',
            s5Duration
          );
          break;
        } else {
          lastValidationError = validation.errorMessage;
          const s5Duration = Date.now() - s5AttemptStartTime;
          recordTelemetry(projectId, {
            stage: 5,
            stage_code: 'S5',
            scope: 'project',
            attempt,
            started_at: s5AttemptStart,
            completed_at: new Date().toISOString(),
            duration_ms: s5Duration,
            status: attempt < MAX_RETRIES ? 'retrying' : 'failed',
            error_type: 'duration_mismatch',
            error_message: validation.errorMessage,
          });

          log(
            5,
            'Scene Breakdown & Duration',
            `Percobaan ${attempt} gagal validasi: ${validation.errorMessage}`,
            'warn',
            'S5'
          );

          if (attempt < MAX_RETRIES) {
            feedbackPrompt = validation.correctivePrompt;
          }
        }
      } catch (err: any) {
        lastValidationError = err?.message || 'Error generating Stage 5';
        const s5Duration = Date.now() - s5AttemptStartTime;
        const errType = classifyError(err);
        recordTelemetry(projectId, {
          stage: 5,
          stage_code: 'S5',
          scope: 'project',
          attempt,
          started_at: s5AttemptStart,
          completed_at: new Date().toISOString(),
          duration_ms: s5Duration,
          status: attempt < MAX_RETRIES ? 'retrying' : 'failed',
          error_type: errType,
          error_message: lastValidationError,
        });

        log(
          5,
          'Scene Breakdown & Duration',
          `Error panggilan Stage 5 (Percobaan ${attempt}): ${lastValidationError}`,
          'warn',
          'S5'
        );
      }
    }

    if (!validatedScenes) {
      const finalErrorMsg = `Gagal memenuhi batasan durasi setelah ${MAX_RETRIES} kali percobaan: ${
        lastValidationError || 'Kendala validasi durasi scene.'
      }`;
      
      log(5, 'Scene Breakdown & Duration', finalErrorMsg, 'error', 'S5');

      db.saveProject({
        ...db.getProject(projectId)!,
        status: 'failed',
        foundation_status: 'failed',
        error_message: finalErrorMsg,
        retry_count: attempt,
        duration_validation_passed: false,
      });

      return { success: false, error: finalErrorMsg };
    }

    // Save scenes to collection 'scenes'
    const savedScenes = db.saveScenes(projectId, validatedScenes);

    // Initialize & Save Continuity Snapshot for each scene
    const charStates = db.getCharacterContinuityStates(projectId);
    let prevSceneState: any = undefined;

    for (const sc of savedScenes) {
      const snap = buildContinuitySnapshot(
        savedCharacters,
        savedLocations,
        savedObjects,
        charStates,
        sc.scene_number,
        prevSceneState
      );
      db.saveContinuitySnapshot(projectId, sc.scene_number, snap);
      db.updateScene(sc.id!, {
        continuity_snapshot: snap,
        continuity_status: 'passed',
      });

      // Prepare state inheritance for next scene
      const charStateRecord: Record<string, any> = {};
      for (const c of snap.characters) {
        charStateRecord[c.name.toLowerCase()] = {
          costume_version: c.current_state.costume_version,
          head_cover: c.costume.head_cover?.value,
          outer_garment: c.costume.outer_garment?.value,
        };
      }
      prevSceneState = {
        scene_number: sc.scene_number,
        character_states: charStateRecord,
        location_name: sc.location_name,
      };
    }

    // Update Story Architecture with saved scenes
    const fullStoryArch = synthesizeStoryArchitectureForLegacyProject(
      project,
      { ...foundationData, narrative_beats: narrativeBeats },
      savedScenes
    );
    db.saveStoryArchitecture(fullStoryArch);

    // Update project foundation status to READY
    db.saveProject({
      ...db.getProject(projectId)!,
      foundation_status: 'ready',
      duration_validation_passed: true,
      retry_count: attempt,
      error_message: null,
    });

    log(
      5,
      'Scene Breakdown & Duration',
      `Inisialisasi Fondasi Proyek (S1–S5) SELESAI. ${savedScenes.length} adegan siap diproduksi di tahap S6–S8.`,
      'success',
      'S5'
    );

    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || 'Terjadi kesalahan pada inisialisasi fondasi proyek (S1-S5)';
    log(
      db.getProject(projectId)?.current_stage || 1,
      'Project Initialization',
      `Fatal error: ${errorMsg}`,
      'error'
    );

    db.saveProject({
      ...db.getProject(projectId)!,
      status: 'failed',
      foundation_status: 'failed',
      error_message: errorMsg,
    });

    return { success: false, error: errorMsg };
  }
}

/**
 * Runs Scene Generation Scope: Stages 6, 7, and 8 for a single scene.
 * NEVER re-runs Stages 1 to 5.
 */
export async function runPipelineForScene(
  sceneId: string,
  logFn?: (
    stage: number,
    stageName: string,
    message: string,
    level?: 'info' | 'success' | 'warn' | 'error'
  ) => void
): Promise<{ success: boolean; shots?: Shot[]; error?: string }> {
  const scene = db.getScene(sceneId);
  if (!scene) {
    throw new Error(`Scene ${sceneId} tidak ditemukan.`);
  }

  const projectId = scene.project_id;
  const project = db.getProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} tidak ditemukan.`);
  }

  const sceneConsistencyState = project.contextPackage
    ? createGroundingState(
        project.contextPackage,
        (project.researchPackage?.conflicts || []).filter((conflict) => conflict.status === 'UNRESOLVED')
      )
    : null;

  // Verification Guard: Check if Foundation (S1-S5) is ready
  const foundationCheck = verifyProjectFoundation(projectId);
  if (!foundationCheck.ready) {
    const initResult = await runProjectInitialization(projectId, logFn);
    if (!initResult.success) {
      throw new Error(`Fondasi project (S1-S5) belum siap dan gagal diinisialisasi: ${initResult.error}`);
    }
  }

  const refreshedProject = db.getProject(projectId) || project;
  let sceneContinuityState = refreshedProject.continuityState || (refreshedProject.contextPackage ? createContinuityState(refreshedProject.contextPackage) : null);

  const foundation = db.getProjectFoundation(projectId);
  const characters = db.getCharacters(projectId);
  const locations = db.getLocations(projectId);
  const objects = db.getObjects(projectId);
  let assetIntegrityReport = createSceneAssetCoverageReport(
    scene,
    characters,
    locations,
    objects,
    project.contextPackage || null,
    sceneContinuityState
  );
  assertSceneAssetCoverage(assetIntegrityReport);
  db.saveProject({
    ...project,
    assetIntegrityReports: [...(project.assetIntegrityReports || []).filter((report) => report.sceneId !== sceneId), assetIntegrityReport],
  });

  const log = (
    stage: number,
    stageName: string,
    message: string,
    level: 'info' | 'success' | 'warn' | 'error' = 'info',
    stageCode?: StageCode,
    durationMs?: number,
    errorType?: ErrorClassification
  ) => {
    db.addLog(projectId, {
      stage,
      stage_name: stageName,
      stage_code: stageCode || (`S${stage}` as StageCode),
      scope: 'scene',
      message,
      level,
      duration_ms: durationMs,
      error_type: errorType,
    });
    if (logFn) logFn(stage, stageName, message, level);
  };

  db.updateScene(sceneId, { status: 'processing' });

  // ----------------------------------------------------
  // STAGE 6: Shot Breakdown Agent (S6, per scene with isolated retry)
  // ----------------------------------------------------
  log(6, 'Shot Breakdown Agent', `Scene #${scene.scene_number}: Memulai breakdown shot sinematik (${scene.duration_sec}s)...`, 'info', 'S6');

  const MAX_SHOT_RETRIES = 3;
  let validatedShots: DetectedShot[] | null = null;
  let feedbackPrompt: string | undefined = undefined;
  let lastShotError: string | undefined = undefined;

  for (let attempt = 1; attempt <= MAX_SHOT_RETRIES; attempt++) {
    const s6Start = new Date().toISOString();
    const s6StartTime = Date.now();
    recordTelemetry(projectId, {
      stage: 6,
      stage_code: 'S6',
      scope: 'scene',
      scene_id: sceneId,
      attempt,
      started_at: s6Start,
      status: 'started',
    });

    try {
      const shotsAttempt = await runStage6ShotBreakdownAttempt({
        scene,
        characters,
        locations,
        objects,
        contextPackage: project.contextPackage || null,
        language: project.prompt_language,
        model: project.ai_model,
        reasoningConfig: project.reasoning_config,
        feedbackPrompt,
      });
      enforceStageConsistency(projectId, `S6:${sceneId}`, shotsAttempt, sceneConsistencyState);
      sceneContinuityState = advanceContinuity(projectId, `S6:${sceneId}`, scene, shotsAttempt, sceneContinuityState);
      assetIntegrityReport = validatePromptCoverage(assetIntegrityReport, JSON.stringify({ scene, shots: shotsAttempt }));
      assertSceneAssetCoverage(assetIntegrityReport);

      // Strict Shot Duration Total Validation
      const durationValidation = validateShotDurationTotal(scene, shotsAttempt);
      const comprehensiveValidation = validateShotBreakdown(shotsAttempt, scene.duration_sec, project.prompt_language);

      if (durationValidation.valid && comprehensiveValidation.valid) {
        validatedShots = shotsAttempt;
        const s6Duration = Date.now() - s6StartTime;
        recordTelemetry(projectId, {
          stage: 6,
          stage_code: 'S6',
          scope: 'scene',
          scene_id: sceneId,
          attempt,
          started_at: s6Start,
          completed_at: new Date().toISOString(),
          duration_ms: s6Duration,
          status: 'completed',
        });

        log(
          6,
          'Shot Breakdown Agent',
          `Scene #${scene.scene_number}: Validasi ${shotsAttempt.length} shot lolos! Total ${durationValidation.total}s === ${scene.duration_sec}s.`,
          'success',
          'S6',
          s6Duration
        );
        break;
      } else {
        lastShotError = durationValidation.error || comprehensiveValidation.errorMessage;
        const s6Duration = Date.now() - s6StartTime;
        recordTelemetry(projectId, {
          stage: 6,
          stage_code: 'S6',
          scope: 'scene',
          scene_id: sceneId,
          attempt,
          started_at: s6Start,
          completed_at: new Date().toISOString(),
          duration_ms: s6Duration,
          status: attempt < MAX_SHOT_RETRIES ? 'retrying' : 'failed',
          error_type: 'duration_mismatch',
          error_message: lastShotError,
        });

        log(
          6,
          'Shot Breakdown Agent',
          `Scene #${scene.scene_number}: Percobaan ${attempt} belum lolos: ${lastShotError}`,
          'warn',
          'S6'
        );

        if (attempt < MAX_SHOT_RETRIES) {
          // Standardized duration correction prompt (Section C)
          feedbackPrompt = `The previous shot breakdown has an invalid total duration. Scene duration: ${scene.duration_sec} seconds. Generated shot total: ${durationValidation.total} seconds. Correct ONLY the shot durations so that the total equals exactly ${scene.duration_sec} seconds. Do not change the scene narrative, characters, locations, or dramatic intent.`;
        }
      }
    } catch (err: any) {
      lastShotError = err?.message || 'Error executing Stage 6';
      const s6Duration = Date.now() - s6StartTime;
      const errType = classifyError(err);
      recordTelemetry(projectId, {
        stage: 6,
        stage_code: 'S6',
        scope: 'scene',
        scene_id: sceneId,
        attempt,
        started_at: s6Start,
        completed_at: new Date().toISOString(),
        duration_ms: s6Duration,
        status: attempt < MAX_SHOT_RETRIES ? 'retrying' : 'failed',
        error_type: errType,
        error_message: lastShotError,
      });

      log(
        6,
        'Shot Breakdown Agent',
        `Scene #${scene.scene_number}: Error percobaan ${attempt}: ${lastShotError}`,
        'warn',
        'S6'
      );
    }
  }

  if (!validatedShots) {
    db.updateScene(sceneId, { status: 'shot_breakdown_failed' });
    log(
      6,
      'Shot Breakdown Agent',
      `Scene #${scene.scene_number} gagal shot breakdown setelah ${MAX_SHOT_RETRIES} percobaan: ${lastShotError}.`,
      'error',
      'S6'
    );
    return { success: false, error: lastShotError };
  }

  // Derive beats & cinematic grammar for the scene
  const sceneBeats = deriveBeatsForScene(scene, validatedShots as any);
  db.updateScene(sceneId, { beats: sceneBeats });

  // Save shots to DB with narrative modes and cinematic grammar
  const enhancedShots = validatedShots.map((s: any, sIdx: number) => {
    const assignedBeat = sceneBeats.find(b => b.beat_number === s.beat_number) || sceneBeats[sIdx % sceneBeats.length];
    const mode = (s.narrative_mode || (s.dialogue && s.dialogue.length > 0 ? 'DIALOGUE' : 'ACTION')) as NarrativeMode;
    const grammar = CINEMATIC_GRAMMAR_GUIDELINES[mode] || CINEMATIC_GRAMMAR_GUIDELINES.ACTION;
    return {
      ...s,
      beat_id: assignedBeat?.beat_id || assignedBeat?.id,
      narrative_mode: mode,
      cinematic_grammar: {
        recommendedFraming: grammar.recommendedFraming,
        cameraMovement: grammar.cameraMovement,
        lightingAndMood: grammar.lightingAndMood,
        audioFocus: grammar.audioFocus,
      },
    };
  });

  const savedShots = db.saveShots(sceneId, projectId, enhancedShots);

  // ----------------------------------------------------
  // STAGE 7: Master Frame & Image Prompt Agent (S7, per scene prompt-only)
  // ----------------------------------------------------
  const s7Start = new Date().toISOString();
  const s7StartTime = Date.now();
  log(7, 'Master Frame & Image Prompt', `Scene #${scene.scene_number}: Merancang Master Frame Image Prompt (Target: Nano Banana Pro)...`, 'info', 'S7');
  recordTelemetry(projectId, {
    stage: 7,
    stage_code: 'S7',
    scope: 'scene',
    scene_id: sceneId,
    attempt: 1,
    started_at: s7Start,
    status: 'started',
  });

  try {
    const stage7Result = await runStage7MasterFrameAndImagePrompt({
      scene,
      foundation,
      characters,
      locations,
      objects,
      contextPackage: project.contextPackage || null,
      continuityState: sceneContinuityState,
      language: project.prompt_language,
      model: project.ai_model,
      reasoningConfig: project.reasoning_config,
    });
    enforceStageConsistency(projectId, `S7:${sceneId}`, stage7Result, sceneConsistencyState);
    sceneContinuityState = advanceContinuity(projectId, `S7:${sceneId}`, scene, stage7Result, sceneContinuityState);
    assetIntegrityReport = validateMasterFrameCoverage(assetIntegrityReport, JSON.stringify(stage7Result));
    assertSceneAssetCoverage(assetIntegrityReport);

    db.updateScene(sceneId, {
      master_image_prompt_json: stage7Result.promptJson,
      image_gen_status: 'success',
      image_gen_error: null,
    });

    const s7Duration = Date.now() - s7StartTime;
    recordTelemetry(projectId, {
      stage: 7,
      stage_code: 'S7',
      scope: 'scene',
      scene_id: sceneId,
      attempt: 1,
      started_at: s7Start,
      completed_at: new Date().toISOString(),
      duration_ms: s7Duration,
      status: 'completed',
    });

    log(7, 'Master Frame & Image Prompt', `Scene #${scene.scene_number}: Master Image Prompt berhasil dirumuskan & siap dipakai!`, 'success', 'S7', s7Duration);
  } catch (err: any) {
    const errMsg = err?.message || 'Error generating master frame prompt';
    const errType = classifyError(err);
    const s7Duration = Date.now() - s7StartTime;
    db.updateScene(sceneId, {
      image_gen_status: 'failed',
      image_gen_error: errMsg,
    });
    recordTelemetry(projectId, {
      stage: 7,
      stage_code: 'S7',
      scope: 'scene',
      scene_id: sceneId,
      attempt: 1,
      started_at: s7Start,
      completed_at: new Date().toISOString(),
      duration_ms: s7Duration,
      status: 'failed',
      error_type: errType,
      error_message: errMsg,
    });
    log(7, 'Master Frame & Image Prompt', `Scene #${scene.scene_number}: Error Stage 7: ${errMsg}`, 'warn', 'S7');
  }

  // Reload scene to get updated master frame
  const currentScene = db.getScene(sceneId) || scene;

  // ----------------------------------------------------
  // STAGE 8: Video Prompt Agent (S8, per shot in this scene)
  // ----------------------------------------------------
  log(8, 'Video Prompt Agent', `Scene #${scene.scene_number}: Merumuskan Video Prompt tingkat produksi untuk ${savedShots.length} shot...`, 'info', 'S8');
  
  let successfulShotsCount = 0;
  let failedShotsCount = 0;

  for (let idx = 0; idx < savedShots.length; idx++) {
    const shot = savedShots[idx];
    if (idx > 0) {
      // Pacing delay between shots
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    const s8Start = new Date().toISOString();
    const s8StartTime = Date.now();
    recordTelemetry(projectId, {
      stage: 8,
      stage_code: 'S8',
      scope: 'shot',
      scene_id: sceneId,
      shot_id: shot.id,
      attempt: 1,
      started_at: s8Start,
      status: 'started',
    });

    try {
      const stage8Result = await runStage8VideoPrompt({
        scene: currentScene,
        shot,
        shotIndex: idx,
        totalShotsInScene: savedShots.length,
        masterFrameImageUrl: currentScene.master_frame_image_url,
        foundation,
        characters,
        locations,
        videoModels: project.video_model || ['veo'],
        includeSeedance: !!project.include_seedance_format,
        language: project.prompt_language,
        model: project.ai_model,
        reasoningConfig: project.reasoning_config,
        contextPackage: project.contextPackage || null,
        continuityState: sceneContinuityState,
      });
      enforceStageConsistency(projectId, `S8:${sceneId}:${shot.id}`, stage8Result, sceneConsistencyState);
      sceneContinuityState = advanceContinuity(projectId, `S8:${sceneId}:${shot.id}`, currentScene, stage8Result, sceneContinuityState);
      assetIntegrityReport = validateVideoPromptCoverage(assetIntegrityReport, JSON.stringify(stage8Result));
      assertSceneAssetCoverage(assetIntegrityReport);

      if (shot.id) {
        db.saveVideoPrompts(shot.id, sceneId, projectId, stage8Result.prompts);
      }

      const hasFailed = stage8Result.prompts.some((p) => p.status === 'video_prompt_failed');
      const s8Duration = Date.now() - s8StartTime;

      if (hasFailed) {
        failedShotsCount++;
        const failedPlatforms = stage8Result.prompts
          .filter((p) => p.status === 'video_prompt_failed')
          .map((p) => p.target_platform)
          .join(', ');
        
        recordTelemetry(projectId, {
          stage: 8,
          stage_code: 'S8',
          scope: 'shot',
          scene_id: sceneId,
          shot_id: shot.id,
          attempt: 1,
          started_at: s8Start,
          completed_at: new Date().toISOString(),
          duration_ms: s8Duration,
          status: 'failed',
          error_type: 'schema_validation',
          error_message: `Gagal pada platform ${failedPlatforms}`,
        });

        log(
          8,
          'Video Prompt Agent',
          `Shot #${shot.shot_number}: Gagal pada platform (${failedPlatforms}) setelah 3x retry (ditandai 'video_prompt_failed').`,
          'warn',
          'S8'
        );
      } else {
        successfulShotsCount++;
        recordTelemetry(projectId, {
          stage: 8,
          stage_code: 'S8',
          scope: 'shot',
          scene_id: sceneId,
          shot_id: shot.id,
          attempt: 1,
          started_at: s8Start,
          completed_at: new Date().toISOString(),
          duration_ms: s8Duration,
          status: 'completed',
        });
      }
    } catch (err: any) {
      failedShotsCount++;
      const s8Duration = Date.now() - s8StartTime;
      const errType = classifyError(err);
      recordTelemetry(projectId, {
        stage: 8,
        stage_code: 'S8',
        scope: 'shot',
        scene_id: sceneId,
        shot_id: shot.id,
        attempt: 1,
        started_at: s8Start,
        completed_at: new Date().toISOString(),
        duration_ms: s8Duration,
        status: 'failed',
        error_type: errType,
        error_message: err?.message || 'Error executing Stage 8',
      });
      log(8, 'Video Prompt Agent', `Shot #${shot.shot_number} error: ${err?.message || err}`, 'warn', 'S8');
    }
  }

  enforceStageConsistency(
    projectId,
    `FINAL:${sceneId}`,
    { scene: currentScene, shots: savedShots, videoPrompts: db.getVideoPromptsByScene(sceneId) },
    sceneConsistencyState
  );
  sceneContinuityState = advanceContinuity(projectId, `FINAL:${sceneId}`, currentScene, { scene: currentScene, shots: savedShots }, sceneContinuityState);
  const finalProject = db.getProject(projectId);
  if (finalProject) {
    db.saveProject({
      ...finalProject,
      assetIntegrityReports: [...(finalProject.assetIntegrityReports || []).filter((report) => report.sceneId !== sceneId), assetIntegrityReport],
    });
  }

  // ----------------------------------------------------
  // Full Scene Production Prompt Generation (Phase 17-19)
  // ----------------------------------------------------
  const snapshot = db.getContinuitySnapshot(projectId, scene.scene_number);
  const fullScenePrompt = buildFullScenePrompt(currentScene, savedShots, snapshot);

  // ----------------------------------------------------
  // Continuity Validation & Auto-Correction (Phase 11-13)
  // ----------------------------------------------------
  const continuityResult = validateSceneContinuity(currentScene, savedShots, snapshot);
  let continuityStatus: 'passed' | 'warning' | 'continuity_failed' = 'passed';
  let continuityViolations = continuityResult.violations;

  if (!continuityResult.valid) {
    log(
      8,
      'Continuity Engine',
      `Scene #${scene.scene_number}: Terdeteksi ${continuityViolations.length} inkonsistensi kontinuitas. Menjalankan auto-koreksi prompt...`,
      'warn',
      'S8'
    );

    // Auto-correction on generated shot prompts
    const shotPrompts = db.getVideoPromptsByScene(sceneId);
    let correctedCount = 0;

    for (const vp of shotPrompts) {
      const originalPrompt = vp.timeline_json?.prompt || '';
      if (!originalPrompt) continue;
      const { correctedText, fixesApplied } = applyContinuityCorrectionToPrompt(originalPrompt, continuityViolations, snapshot);
      if (correctedText !== originalPrompt) {
        db.saveSingleVideoPrompt({
          ...vp,
          timeline_json: {
            ...vp.timeline_json,
            prompt: correctedText,
          },
        });
        correctedCount++;
      }
    }

    if (correctedCount > 0) {
      log(
        8,
        'Continuity Engine',
        `Scene #${scene.scene_number}: Berhasil mengkoreksi otomatis ${correctedCount} prompt video untuk mematuhi lock kontinuitas.`,
        'info',
        'S8'
      );
    }

    // Re-evaluate severity after auto-correction
    const hasCritical = continuityViolations.some(v => v.severity === 'critical');
    const hasHigh = continuityViolations.some(v => v.severity === 'high');

    if (hasCritical || (hasHigh && correctedCount === 0)) {
      continuityStatus = 'continuity_failed';
    } else {
      continuityStatus = 'warning';
    }
  } else {
    log(
      8,
      'Continuity Engine',
      `Scene #${scene.scene_number}: Validasi kontinuitas (karakter, kostum, latar, objek) LOLOS 100%.`,
      'success',
      'S8'
    );
  }

  // Scene status evaluation
  let sceneFinalStatus: 'ready' | 'incomplete' | 'continuity_failed' = failedShotsCount > 0 ? 'incomplete' : 'ready';
  if (continuityStatus === 'continuity_failed') {
    sceneFinalStatus = 'continuity_failed';
  }

  db.updateScene(sceneId, {
    status: sceneFinalStatus,
    full_scene_prompt: fullScenePrompt,
    full_scene_prompt_status: 'ready',
    continuity_status: continuityStatus,
    continuity_violations: continuityViolations,
  });

  const finalizationReport = evaluateFinalizationGate(db.getProject(projectId) || project, [
    { sceneId, status: sceneFinalStatus },
  ]);
  const finalProjectState = db.getProject(projectId);
  if (finalProjectState) db.saveProject({ ...finalProjectState, finalizationReport });
  assertFinalizationGate(finalizationReport);

  if (failedShotsCount > 0 || continuityStatus === 'continuity_failed') {
    log(
      8,
      'Video Prompt Agent',
      `Scene #${scene.scene_number}: Status final: '${sceneFinalStatus}'. (${successfulShotsCount} shot berhasil, ${failedShotsCount} shot gagal, kontinuitas: ${continuityStatus}).`,
      'warn',
      'S8'
    );
  } else {
    log(
      8,
      'Video Prompt Agent',
      `Scene #${scene.scene_number}: Seluruh video prompt (${savedShots.length} shot) & Full Scene Prompt siap produksi (status: 'ready')!`,
      'success',
      'S8'
    );
  }

  return { success: sceneFinalStatus === 'ready', shots: savedShots, error: sceneFinalStatus === 'ready' ? undefined : `Scene final status: ${sceneFinalStatus}` };
}

/**
 * Generates all scenes (S6-S8) with controlled worker concurrency (default = 2).
 * Does NOT re-run S1-S5 if foundation is already ready.
 */
export async function generateAllScenes(
  projectId: string,
  concurrency: number = 2,
  onProgress?: (
    stage: number,
    stageName: string,
    message: string,
    level?: 'info' | 'success' | 'warn' | 'error'
  ) => void
): Promise<{ success: boolean; totalScenes: number; readyScenes: number; failedScenes: number }> {
  const project = db.getProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} tidak ditemukan.`);
  }

  // Verify foundation first
  const foundationCheck = verifyProjectFoundation(projectId);
  if (!foundationCheck.ready) {
    const initResult = await runProjectInitialization(projectId, onProgress);
    if (!initResult.success) {
      throw new Error(`Fondasi project (S1-S5) gagal diinisialisasi: ${initResult.error}`);
    }
  }

  const scenes = db.getScenes(projectId);
  if (!scenes || scenes.length === 0) {
    throw new Error('Tidak ada scene yang ditemukan untuk digenerate.');
  }

  const log = (
    stage: number,
    stageName: string,
    message: string,
    level: 'info' | 'success' | 'warn' | 'error' = 'info'
  ) => {
    db.addLog(projectId, { stage, stage_name: stageName, message, level });
    if (onProgress) onProgress(stage, stageName, message, level);
  };

  log(
    6,
    'Scene Generation Pool',
    `Memulai generasi ${scenes.length} scene (Tahap S6–S8) dengan konkurensi ${concurrency} worker...`,
    'info'
  );

  let currentIndex = 0;
  let readyCount = 0;
  let failedCount = 0;

  // Worker worker function with pacing
  async function worker(workerId: number) {
    // Initial small offset to avoid simultaneous burst
    if (workerId > 1) {
      await new Promise((resolve) => setTimeout(resolve, (workerId - 1) * 750));
    }

    while (currentIndex < scenes.length) {
      const idx = currentIndex++;
      const currentScene = scenes[idx];
      if (!currentScene.id) continue;

      log(
        6,
        `Worker #${workerId}`,
        `Memproses Scene #${currentScene.scene_number} (${idx + 1}/${scenes.length})...`,
        'info'
      );

      try {
        const result = await runPipelineForScene(currentScene.id, onProgress);
        if (result.success) {
          readyCount++;
        } else {
          failedCount++;
        }
      } catch (err: any) {
        failedCount++;
        log(
          6,
          `Worker #${workerId}`,
          `Scene #${currentScene.scene_number} error tidak tertangani: ${err?.message || err}`,
          'warn'
        );
      }

      // Small pacing delay between consecutive scenes for the same worker
      if (currentIndex < scenes.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  // Launch workers up to concurrency limit
  const activeWorkers: Promise<void>[] = [];
  const effectiveConcurrency = Math.min(concurrency, scenes.length);
  for (let w = 1; w <= effectiveConcurrency; w++) {
    activeWorkers.push(worker(w));
  }

  await Promise.all(activeWorkers);

  // Update project status based on scene results
  const updatedProject = db.getProject(projectId);
  if (updatedProject) {
    const finalStatus = failedCount === 0 ? 'completed' : 'failed';
    db.saveProject({
      ...updatedProject,
      status: finalStatus,
      current_stage: 8,
      error_message: failedCount > 0 ? `${failedCount} dari ${scenes.length} scene memerlukan perhatian manual.` : null,
    });
  }

  log(
    8,
    'Scene Generation Pool',
    `Generasi seluruh scene selesai. ${readyCount} scene siap, ${failedCount} scene perlu perhatian.`,
    failedCount === 0 ? 'success' : 'warn'
  );

  return {
    success: failedCount === 0,
    totalScenes: scenes.length,
    readyScenes: readyCount,
    failedScenes: failedCount,
  };
}

/**
 * Top-level Orchestrator:
 * 1. Checks foundation status; runs S1-S5 if not ready.
 * 2. Runs S6-S8 for all scenes with controlled concurrency.
 */
export async function runOrchestratedPipeline({
  projectId,
  onProgress,
}: OrchestratorRunOptions): Promise<{ success: boolean; error?: string }> {
  const project = db.getProject(projectId);
  if (!project) {
    throw new Error(`Project with ID ${projectId} not found.`);
  }

  const log = (
    stage: number,
    stageName: string,
    message: string,
    level: 'info' | 'success' | 'warn' | 'error' = 'info'
  ) => {
    db.addLog(projectId, { stage, stage_name: stageName, message, level });
    if (onProgress) {
      onProgress(stage, stageName, message, level);
    }
  };

  try {
    // Step 1: Project Initialization (S1-S5)
    const foundationCheck = verifyProjectFoundation(projectId);
    if (!foundationCheck.ready) {
      log(1, 'Pipeline Orchestrator', 'Fondasi proyek belum diinisialisasi. Menjalankan Tahap S1–S5...', 'info');
      const initResult = await runProjectInitialization(projectId, onProgress);
      if (!initResult.success) {
        return initResult;
      }
    } else {
      log(1, 'Pipeline Orchestrator', 'Fondasi proyek (S1–S5) sudah valid & siap. Melompati inisialisasi ulang.', 'info');
    }

    // Step 2: Scene Generation (S6-S8) with concurrency = 2
    const sceneResult = await generateAllScenes(projectId, 2, onProgress);

    log(
      8,
      'Pipeline Orchestrator',
      `Pipeline selesai! ${sceneResult.readyScenes}/${sceneResult.totalScenes} scene siap untuk produksi.`,
      sceneResult.success ? 'success' : 'warn'
    );

    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || 'Terjadi kesalahan pada pipeline orchestrator.';
    log(
      db.getProject(projectId)?.current_stage || 1,
      'Pipeline Failure',
      `Fatal error: ${errorMsg}`,
      'error'
    );

    db.saveProject({
      ...db.getProject(projectId)!,
      status: 'failed',
      error_message: errorMsg,
    });

    return { success: false, error: errorMsg };
  }
}
