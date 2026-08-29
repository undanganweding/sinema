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
  ContinuityScope,
  ScenePipelineBlocker,
  SceneAssetCoverageReport,
  FinalizationBlocker,
  ContinuityViolation,
  ContinuitySnapshot,
  NarrativeMode,
} from '../src/types';

export interface GenerationRunContext {
  runId: string;
  projectId: string;
  startedAt: string;
  concurrency?: number;
}

export interface OrchestratorRunOptions {
  projectId: string;
  onProgress?: (
    stage: number,
    stageName: string,
    message: string,
    level?: 'info' | 'success' | 'warn' | 'error'
  ) => void;
  runContext?: GenerationRunContext;
  /** Optional explicit concurrency override. Cascade: sceneConcurrency > runContext.concurrency > SCENE_GENERATION_CONCURRENCY env > 2 */
  sceneConcurrency?: number;
}

// Per-project in-flight init lock. Prevents runProjectInitialization from being
// executed concurrently for the same projectId (e.g. runOrchestratedPipeline
// running init, then generateAllScenes re-entering init while foundation is
// still marked 'initializing'). A duplicate concurrent init burns Gemini quota
// (HTTP 429 RESOURCE_EXHAUSTED) twice as fast and trips the retry/backoff loop
// that surfaces as a frozen pipeline at a later stage.
const initializationInFlight = new Map<string, Promise<{ success: boolean; error?: string }>>();

export function createGenerationRunContext(projectId: string, concurrency?: number): GenerationRunContext {
  return {
    runId: `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    projectId,
    startedAt: new Date().toISOString(),
    concurrency,
  };
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

async function enforceStageConsistency(projectId: string, stage: string, output: unknown, state: ReturnType<typeof createGroundingState> | null): Promise<void> {
  if (!state) return;
  const report = evaluateStageOutput(stage, output, state);
  const project = await db.getProject(projectId);
  if (project) {
    await db.saveProject({
      ...project,
      consistencyReports: [...(project.consistencyReports || []), report],
    });
  }
  assertStageConsistency(report);
}

async function advanceContinuity(projectId: string, stage: string, scene: { id?: string; scene_number?: number; location_name?: string; character_names?: string[]; event?: string; era?: string; continuity_scope?: ContinuityScope }, output: unknown, state: ReturnType<typeof createContinuityState> | null, scope: ContinuityScope = 'within-scene', persist = true): Promise<ReturnType<typeof createContinuityState> | null> {
  if (!state) return null;
  const result = updateContinuityState(state, scene, output, undefined, scope);
  const project = await db.getProject(projectId);
  if (persist && project) await db.saveProject({ ...project, continuityState: result.state });
  const blocking = result.issues.find((issue) => issue.severity === 'BLOCKING');
  if (blocking) throw new Error(`CONTINUITY_BLOCKED ${stage}: ${blocking.message}`);
  return result.state;
}

export interface ScenePipelineResult {
  status: 'READY' | 'BLOCKED' | 'FAILED';
  success: boolean;
  sceneId: string;
  shots?: Shot[];
  blockers?: ScenePipelineBlocker[];
  continuityState?: ReturnType<typeof createContinuityState> | null;
  assetIntegrityReport?: SceneAssetCoverageReport;
  error?: string;
}

function knownBlocker(error: unknown, stage: string): ScenePipelineBlocker | null {
  const message = error instanceof Error ? error.message : String(error || '');
  const match = message.match(/^(CONTINUITY_BLOCKED|ASSET_INTEGRITY_BLOCKED|FINALIZATION_BLOCKED|CONSISTENCY_BLOCKED)\s*(.*)$/s);
  if (!match) return null;
  let payload: any = undefined;
  try { payload = match[2] ? JSON.parse(match[2]) : undefined; } catch { /* preserve the message when no JSON payload exists */ }
  const detail = payload?.blockerDetails?.[0]
    || payload?.blockers?.[0]
    || [...(payload?.characters || []), ...(payload?.locations || []), ...(payload?.objects || []), ...(payload?.videoPromptCoverage || [])].find((item) => item.status === 'BLOCKED' || item.status === 'MISMATCH');
  return {
    code: detail?.code || detail?.reason || match[1],
    severity: 'BLOCKING',
    message: detail?.message || message,
    stage,
    assetName: detail?.assetName,
    assetType: detail?.assetType,
  };
}

function isRetryableSceneError(error: unknown, classification: ErrorClassification): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return classification === 'schema_validation'
    || classification === 'network'
    || classification === 'rate_limit'
    || classification === 'quota_exceeded'
    || message.includes('empty response')
    || message.includes('empty output');
}

async function persistBlockedScene(sceneId: string, blocker: ScenePipelineBlocker): Promise<void> {
  await db.updateScene(sceneId, { status: 'blocked', pipeline_status: 'BLOCKED', blockers: [blocker] });
}

async function beginSceneExecution(sceneId: string): Promise<void> {
  await db.updateScene(sceneId, { status: 'processing', pipeline_status: undefined, blockers: [] });
}

async function persistReadyScene(sceneId: string, continuityStatus: 'passed' | 'warning' | 'continuity_failed', continuityViolations: ContinuityViolation[]): Promise<void> {
  await db.updateScene(sceneId, {
    status: continuityStatus === 'continuity_failed' ? 'blocked' : 'ready',
    pipeline_status: continuityStatus === 'continuity_failed' ? 'BLOCKED' : 'READY',
    blockers: continuityStatus === 'continuity_failed'
      ? continuityViolations.map((violation) => ({ code: 'CONTINUITY_BLOCKED', severity: 'BLOCKING', message: violation.message, stage: 'FINAL' }))
      : [],
  });
}

export function resolveCurrentSceneStatus(
  blockers: ScenePipelineBlocker[],
  failed: boolean
): ScenePipelineResult['status'] {
  if (blockers.length > 0) return 'BLOCKED';
  if (failed) return 'FAILED';
  return 'READY';
}

/**
 * Verifies if Project Foundation (S1-S5) is complete and valid.
 */
export async function verifyProjectFoundation(projectId: string): Promise<FoundationVerificationResult> {
  const missing: string[] = [];
  const foundation = await db.getProjectFoundation(projectId);
  const characters = await db.getCharacters(projectId);
  const locations = await db.getLocations(projectId);
  const scenes = await db.getScenes(projectId);

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
  const project = await db.getProject(projectId);
  if (project) {
    const newStatus = isReady ? 'ready' : missing.length === 5 ? 'not_initialized' : 'incomplete';
    if (project.foundation_status !== newStatus) {
      await db.saveProject({
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
async function safeAddLog(projectId: string, payload: Parameters<typeof db.addLog>[1]): Promise<void> {
  try {
    await db.addLog(projectId, payload);
  } catch {
    // Observability failure must never impact pipeline execution.
  }
}

async function safeAddTelemetry(projectId: string, payload: Parameters<typeof db.addTelemetry>[1]): Promise<StageExecutionTelemetry | null> {
  try {
    return await db.addTelemetry(projectId, payload);
  } catch {
    // Observability failure must never impact pipeline execution.
    return null;
  }
}

async function recordTelemetry(
  projectId: string,
  telemetry: {
    stage?: number;
    stage_code?: StageCode;
    scope?: StageScope;
    scene_id?: string;
    shot_id?: string;
    attempt?: number;
    started_at?: string;
    completed_at?: string;
    duration_ms?: number;
    status?: 'started' | 'completed' | 'failed' | 'retrying' | 'blocked';
    error_type?: ErrorClassification;
    error_message?: string;
    run_id?: string;
    summary_type?: 'run' | 'scene' | 'stage';
    summary?: Record<string, any>;
  },
  runContext?: GenerationRunContext
): Promise<StageExecutionTelemetry> {
  const payload = {
    project_id: projectId,
    run_id: runContext?.runId ?? telemetry.run_id,
    ...telemetry,
  };
  return (await safeAddTelemetry(projectId, payload)) || ({ ...payload, project_id: projectId } as StageExecutionTelemetry);
}

async function safePersistRunSummary(
  projectId: string,
  runId: string | undefined,
  summary: Record<string, any>
): Promise<void> {
  try {
    await recordTelemetry(projectId, {
      stage: 0,
      stage_code: 'S1',
      scope: 'project',
      started_at: new Date().toISOString(),
      status: 'completed',
      summary_type: 'run',
      summary,
      run_id: runId,
    });
  } catch {
    // Observability must remain non-blocking.
  }
}

async function safePersistSceneSummary(
  projectId: string,
  runId: string | undefined,
  sceneId: string,
  sceneNumber: number,
  startedAtMs: number,
  finalStatus: ScenePipelineResult['status'],
  result: Partial<ScenePipelineResult> & { sceneId: string }
): Promise<void> {
  try {
    const completedAt = Date.now();
    const sceneDurationMs = Math.max(0, completedAt - startedAtMs);
    await recordTelemetry(projectId, {
      stage: 8,
      stage_code: 'S8',
      scope: 'scene',
      scene_id: sceneId,
      started_at: new Date(startedAtMs).toISOString(),
      completed_at: new Date(completedAt).toISOString(),
      duration_ms: sceneDurationMs,
      status: finalStatus === 'READY' ? 'completed' : finalStatus === 'BLOCKED' ? 'blocked' : 'failed',
      summary_type: 'scene',
      summary: {
        scene_id: sceneId,
        scene_number: sceneNumber,
        scene_status: finalStatus,
        success: result.success,
        ready: finalStatus === 'READY',
        blocked: finalStatus === 'BLOCKED',
        failed: finalStatus === 'FAILED',
        blockers: result.blockers?.length ?? 0,
        scene_duration_ms: sceneDurationMs,
        error: result.error,
      },
      run_id: runId,
    }, { runId } as GenerationRunContext);
  } catch {
    // Observability must remain non-blocking.
  }
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
  // Concurrency-safe: a duplicate concurrent init (e.g. runOrchestratedPipeline
  // running init, then generateAllScenes re-entering while foundation is still
  // 'initializing') burns Gemini quota twice as fast and trips the 429
  // RESOURCE_EXHAUSTED retry/backoff loop that surfaces as a frozen pipeline.
  const existing = initializationInFlight.get(projectId);
  if (existing) {
    console.log(`[init] JOIN in-flight initialization project=${projectId}`);
    return existing;
  }
  const promise = runProjectInitializationImpl(projectId, onProgress, dependencies).finally(() => {
    initializationInFlight.delete(projectId);
  });
  initializationInFlight.set(projectId, promise);
  return promise;
}

async function runProjectInitializationImpl(
  projectId: string,
  onProgress?: (
    stage: number,
    stageName: string,
    message: string,
    level?: 'info' | 'success' | 'warn' | 'error'
  ) => void,
  dependencies: ProjectInitializationDependencies = {}
): Promise<{ success: boolean; error?: string }> {
  const project = await db.getProject(projectId);
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
    safeAddLog(projectId, {
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
    await db.saveProject({
      ...groundedProject,
      status: 'processing',
      foundation_status: 'initializing',
      current_stage: 1,
      error_message: null,
    });

    const activeModel = project.reasoning_config?.display_name || project.ai_model || 'gemini-3.7-flash';

    if (groundedProject.contextPackage) {
      const groundingValidation = validateGroundingContext(groundedProject.contextPackage);
      await db.saveProject({
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
    if (continuityState) await db.saveProject({ ...groundedProject, continuityState });

    // ==========================================
    // RESUME GUARD: skip stages whose outputs already persist
    // ==========================================
    // A re-entrant init (foundation not fully 'ready') must RESUME from the
    // last completed stage instead of re-running Stage 1. Re-running S1-S5 from
    // scratch burns Gemini free-tier quota (20 req/day/model) and trips the 429
    // backoff loop that surfaces as a frozen pipeline. Each stage is skipped
    // when its persisted output already exists in the DB. Stage-local in-memory
    // vars are then rebuilt from the DB so downstream stages keep working.
    const [existingFoundation, resumeCharacters, resumeLocations, resumeObjects, resumeScenes] = await Promise.all([
      db.getProjectFoundation(projectId),
      db.getCharacters(projectId),
      db.getLocations(projectId),
      db.getObjects(projectId),
      db.getScenes(projectId),
    ]);
    const resumeFoundation = existingFoundation && existingFoundation.genre && existingFoundation.era ? existingFoundation : null;
    const resumeNarrativeBeats = resumeFoundation?.narrative_beats?.beginning ? resumeFoundation.narrative_beats : null;
    const haveS1 = Boolean(resumeFoundation);
    const haveS2 = resumeCharacters.length > 0;
    const haveS3 = resumeLocations.length > 0;
    const haveS4 = Boolean(resumeNarrativeBeats);
    const haveS5 = resumeScenes.length > 0;

    if (haveS5) {
      // Foundation fully materialized; nothing to re-run. Keep it ready so the
      // orchestrator does NOT trigger another init chain.
      await db.saveProject({
        ...(await db.getProject(projectId))!,
        foundation_status: 'ready',
        status: 'processing',
        error_message: null,
      });
      log(
        5,
        'Scene Breakdown & Duration',
        `Fondasi (S1-S5) sudah lengkap (${resumeScenes.length} scene). Melewati inisialisasi ulang.`,
        'success',
        'S5'
      );
      return { success: true };
    }

    // ==========================================
    // STAGE 1: Story Understanding Agent (S1)
    // ==========================================
    let foundationData: ProjectFoundation;
    if (haveS1) {
      // S1 already persisted: reuse it, skip the LLM call.
      foundationData = resumeFoundation!;
      log(
        1,
        'Story Understanding',
        `Fondasi S1 sudah tersimpan (genre "${foundationData.genre}"). Melewati Stage 1.`,
        'warn',
        'S1'
      );
    } else {
      const s1Start = new Date().toISOString();
      const s1StartTime = Date.now();
      console.log(`[stage1] START stage=S1 project=${projectId} model=${activeModel} ts=${s1Start}`);
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
        await enforceStageConsistency(projectId, 'S1', stage1Result, consistencyState);
        continuityState = await advanceContinuity(projectId, 'S1', { id: `project_${projectId}`, scene_number: 1, event: 'Stage 1', character_names: stage1Result.main_characters }, stage1Result, continuityState);
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
        console.log(`[stage1] COMPLETE stage=S1 project=${projectId} elapsedMs=${s1Duration} genre=${stage1Result.genre} ts=${new Date().toISOString()}`);
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
        console.error(`[stage1] COMPLETE stage=S1 project=${projectId} elapsedMs=${s1Duration} status=failed errorType=${errType} error="${err.message}" ts=${new Date().toISOString()}`);
        throw err;
      }

      foundationData = {
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

      await db.saveProjectFoundation(foundationData);
      log(
        1,
        'Story Understanding',
        `Selesai. Genre: "${stage1Result.genre}", Era: "${stage1Result.era}", Terdeteksi ${(stage1Result.main_characters || []).length} karakter utama. Tersimpan di collection 'project_foundation'.`,
        'success',
        'S1',
        Date.now() - s1StartTime
      );
    }

    // ==========================================
    // STAGE 2: Character Detection Agent (S2)
    // ==========================================
    await db.saveProject({ ...(await db.getProject(projectId))!, current_stage: 2 });
    let savedCharacters = resumeCharacters;
    if (haveS2) {
      log(
        2,
        'Character Detection',
        `Character Bible sudah tersimpan (${savedCharacters.length} karakter). Melewati Stage 2.`,
        'warn',
        'S2'
      );
    } else {
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

      try {
        const stage2Result = await runStage2CharacterDetection({
          rawScript: project.raw_script,
          foundation: foundationData,
          contextPackage: project.contextPackage || null,
          language: project.prompt_language,
          model: project.ai_model,
          reasoningConfig: project.reasoning_config,
        });
        await enforceStageConsistency(projectId, 'S2', stage2Result, consistencyState);
        continuityState = await advanceContinuity(projectId, 'S2', { id: `project_${projectId}`, scene_number: 2, event: 'Stage 2', character_names: stage2Result.map((character) => character.name) }, stage2Result, continuityState);
        savedCharacters = await db.saveAndMergeCharacters(projectId, stage2Result);
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
    }

    // ==========================================
    // STAGE 3: Location & Object Detection Agent (S3)
    // ==========================================
    await db.saveProject({ ...(await db.getProject(projectId))!, current_stage: 3 });
    let savedLocations = resumeLocations;
    let savedObjects = resumeObjects;
    if (haveS3) {
      log(
        3,
        'Location & Object Detection',
        `Location & Object Bible sudah tersimpan (${savedLocations.length} lokasi, ${savedObjects.length} objek). Melewati Stage 3.`,
        'warn',
        'S3'
      );
    } else {
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

      try {
        const stage3Result = await runStage3LocationObjectDetection({
          rawScript: project.raw_script,
          foundation: foundationData,
          contextPackage: project.contextPackage || null,
          language: project.prompt_language,
          model: project.ai_model,
          reasoningConfig: project.reasoning_config,
        });
        await enforceStageConsistency(projectId, 'S3', stage3Result, consistencyState);
        continuityState = await advanceContinuity(projectId, 'S3', { id: `project_${projectId}`, scene_number: 3, event: 'Stage 3' }, stage3Result, continuityState);
        savedLocations = await db.saveAndMergeLocations(projectId, stage3Result.locations);
        savedObjects = await db.saveAndMergeObjects(projectId, stage3Result.objects);
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
    }

    // ==========================================
    // STAGE 4: Narrative Structure Agent (S4)
    // ==========================================
    await db.saveProject({ ...(await db.getProject(projectId))!, current_stage: 4 });
    let narrativeBeats: typeof resumeNarrativeBeats;
    if (haveS4) {
      narrativeBeats = resumeNarrativeBeats;
      log(
        4,
        'Narrative Structure',
        'Narrative Beats (S4) sudah tersimpan. Melewati Stage 4.',
        'warn',
        'S4'
      );
    } else {
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
        await enforceStageConsistency(projectId, 'S4', narrativeBeats, consistencyState);
        continuityState = await advanceContinuity(projectId, 'S4', { id: `project_${projectId}`, scene_number: 4, event: 'Stage 4' }, narrativeBeats, continuityState);

        await db.saveProjectFoundation({
          ...foundationData,
          narrative_beats: narrativeBeats,
        });

        // Generate & save Cinematic Story Architecture (Cold Open, Acts/Babak, Sequences)
        const storyArch = synthesizeStoryArchitectureForLegacyProject(
          project,
          { ...foundationData, narrative_beats: narrativeBeats },
          []
        );
        await db.saveStoryArchitecture(storyArch);

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
    }

    // ==========================================
    // STAGE 5: Scene Breakdown & Duration Allocation Agent (S5)
    // ==========================================
    await db.saveProject({ ...(await db.getProject(projectId))!, current_stage: 5 });
    
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
        await enforceStageConsistency(projectId, 'S5', scenesAttempt, consistencyState);
        continuityState = await advanceContinuity(projectId, 'S5', { id: `project_${projectId}`, scene_number: 5, event: 'Stage 5' }, scenesAttempt, continuityState);

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

      await db.saveProject({
        ...(await db.getProject(projectId))!,
        status: 'failed',
        foundation_status: 'failed',
        error_message: finalErrorMsg,
        retry_count: attempt,
        duration_validation_passed: false,
      });

      return { success: false, error: finalErrorMsg };
    }

    // Save scenes to collection 'scenes'
    const savedScenes = await db.saveScenes(projectId, validatedScenes);

    // Initialize & Save Continuity Snapshot for each scene
    const charStates = await db.getCharacterContinuityStates(projectId);
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
      await db.saveContinuitySnapshot(projectId, sc.scene_number, snap);
      await db.updateScene(sc.id!, {
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
    await db.saveStoryArchitecture(fullStoryArch);

    // Update project foundation status to READY
    await db.saveProject({
      ...(await db.getProject(projectId))!,
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
      (await db.getProject(projectId))?.current_stage || 1,
      'Project Initialization',
      `Fatal error: ${errorMsg}`,
      'error'
    );

    await db.saveProject({
      ...(await db.getProject(projectId))!,
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
  ) => void,
  continuitySeed?: ReturnType<typeof createContinuityState> | null,
  runContext?: GenerationRunContext
): Promise<ScenePipelineResult> {
  const scene = await db.getScene(sceneId);
  if (!scene) {
    throw new Error(`Scene ${sceneId} tidak ditemukan.`);
  }

  const projectId = scene.project_id;
  const project = await db.getProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} tidak ditemukan.`);
  }

  const sceneStartedAtMs = Date.now();
  const sceneConsistencyState = project.contextPackage
    ? createGroundingState(
        project.contextPackage,
        (project.researchPackage?.conflicts || []).filter((conflict) => conflict.status === 'UNRESOLVED')
      )
    : null;

  // Verification Guard: Check if Foundation (S1-S5) is ready
  const foundationCheck = await verifyProjectFoundation(projectId);
  if (!foundationCheck.ready) {
    const initResult = await runProjectInitialization(projectId, logFn);
    if (!initResult.success) {
      throw new Error(`Fondasi project (S1-S5) belum siap dan gagal diinisialisasi: ${initResult.error}`);
    }
  }

  const refreshedProject = (await db.getProject(projectId)) || project;
  let sceneContinuityState = continuitySeed || refreshedProject.continuityState || (refreshedProject.contextPackage ? createContinuityState(refreshedProject.contextPackage) : null);

  const foundation = await db.getProjectFoundation(projectId);
  const characters = await db.getCharacters(projectId);
  const locations = await db.getLocations(projectId);
  const objects = await db.getObjects(projectId);
  let assetIntegrityReport = createSceneAssetCoverageReport(
    scene,
    characters,
    locations,
    objects,
    project.contextPackage || null,
    sceneContinuityState
  );
  const log = (
    stage: number,
    stageName: string,
    message: string,
    level: 'info' | 'success' | 'warn' | 'error' = 'info',
    stageCode?: StageCode,
    durationMs?: number,
    errorType?: ErrorClassification
  ) => {
    safeAddLog(projectId, {
      stage,
      stage_name: stageName,
      stage_code: stageCode || (`S${stage}` as StageCode),
      scope: 'scene',
      message,
      level,
      duration_ms: durationMs,
      error_type: errorType,
      run_id: runContext?.runId,
    });
    if (logFn) logFn(stage, stageName, message, level);
  };

  try {
    assertSceneAssetCoverage(assetIntegrityReport);
  } catch (error) {
    const blocker = knownBlocker(error, 'S6');
    const result: ScenePipelineResult = blocker
      ? { sceneId, status: 'BLOCKED', success: false, blockers: [blocker], assetIntegrityReport, continuityState: sceneContinuityState }
      : { sceneId, status: 'FAILED', success: false, error: error instanceof Error ? error.message : String(error), assetIntegrityReport, continuityState: sceneContinuityState };
    if (blocker) {
      await persistBlockedScene(sceneId, blocker);
    } else {
      await db.updateScene(sceneId, { status: 'failed', pipeline_status: 'FAILED', blockers: [] });
    }
    await safePersistSceneSummary(projectId, runContext?.runId, sceneId, scene.scene_number, sceneStartedAtMs, result.status, result);
    return result;
  }

  await beginSceneExecution(sceneId);

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
      run_id: runContext?.runId,
    }, runContext);

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
      await enforceStageConsistency(projectId, `S6:${sceneId}`, shotsAttempt, sceneConsistencyState);
      sceneContinuityState = await advanceContinuity(projectId, `S6:${sceneId}`, scene, shotsAttempt, sceneContinuityState, scene.continuity_scope || 'scene-boundary', false);
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
          run_id: runContext?.runId,
        }, runContext);

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
          run_id: runContext?.runId,
        }, runContext);

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
      const blocker = knownBlocker(err, `S6:${sceneId}`);
      const retryable = isRetryableSceneError(err, errType);
      recordTelemetry(projectId, {
        stage: 6,
        stage_code: 'S6',
        scope: 'scene',
        scene_id: sceneId,
        attempt,
        started_at: s6Start,
        completed_at: new Date().toISOString(),
        duration_ms: s6Duration,
        status: blocker ? 'blocked' : retryable && attempt < MAX_SHOT_RETRIES ? 'retrying' : 'failed',
        error_type: errType,
        error_message: lastShotError,
        run_id: runContext?.runId,
      }, runContext);

      log(
        6,
        'Shot Breakdown Agent',
        `Scene #${scene.scene_number}: Error percobaan ${attempt}: ${lastShotError}`,
        'warn',
        'S6'
      );
      if (blocker) {
        await persistBlockedScene(sceneId, blocker);
        const result: ScenePipelineResult = { sceneId, status: 'BLOCKED', success: false, blockers: [blocker], assetIntegrityReport, continuityState: sceneContinuityState };
        await safePersistSceneSummary(projectId, runContext?.runId, sceneId, scene.scene_number, sceneStartedAtMs, result.status, result);
        return result;
      }
      if (!retryable) {
        await db.updateScene(sceneId, { status: 'failed', pipeline_status: 'FAILED', blockers: [] });
        const result: ScenePipelineResult = { sceneId, status: 'FAILED', success: false, error: lastShotError, assetIntegrityReport, continuityState: sceneContinuityState };
        await safePersistSceneSummary(projectId, runContext?.runId, sceneId, scene.scene_number, sceneStartedAtMs, result.status, result);
        return result;
      }
    }
  }

  if (!validatedShots) {
    await db.updateScene(sceneId, { status: 'shot_breakdown_failed' });
    log(
      6,
      'Shot Breakdown Agent',
      `Scene #${scene.scene_number} gagal shot breakdown setelah ${MAX_SHOT_RETRIES} percobaan: ${lastShotError}.`,
      'error',
      'S6'
    );
    const result: ScenePipelineResult = { sceneId, status: 'FAILED', success: false, error: lastShotError, assetIntegrityReport, continuityState: sceneContinuityState };
    await safePersistSceneSummary(projectId, runContext?.runId, sceneId, scene.scene_number, sceneStartedAtMs, result.status, result);
    return result;
  }

  // Derive beats & cinematic grammar for the scene
  const sceneBeats = deriveBeatsForScene(scene, validatedShots as any);
  await db.updateScene(sceneId, { beats: sceneBeats });

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

  const savedShots = await db.saveShots(sceneId, projectId, enhancedShots);

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
    run_id: runContext?.runId,
  }, runContext);

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
    await enforceStageConsistency(projectId, `S7:${sceneId}`, stage7Result, sceneConsistencyState);
    sceneContinuityState = await advanceContinuity(projectId, `S7:${sceneId}`, scene, stage7Result, sceneContinuityState, 'within-scene', false);
    assetIntegrityReport = validateMasterFrameCoverage(assetIntegrityReport, JSON.stringify(stage7Result));
    assertSceneAssetCoverage(assetIntegrityReport);

    await db.updateScene(sceneId, {
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
      run_id: runContext?.runId,
    }, runContext);

    log(7, 'Master Frame & Image Prompt', `Scene #${scene.scene_number}: Master Image Prompt berhasil dirumuskan & siap dipakai!`, 'success', 'S7', s7Duration);
  } catch (err: any) {
    const errMsg = err?.message || 'Error generating master frame prompt';
    const errType = classifyError(err);
    const blocker = knownBlocker(err, `S7:${sceneId}`);
    if (blocker) {
      await persistBlockedScene(sceneId, blocker);
      const result: ScenePipelineResult = { sceneId, status: 'BLOCKED', success: false, blockers: [blocker], assetIntegrityReport, continuityState: sceneContinuityState };
      await safePersistSceneSummary(projectId, runContext?.runId, sceneId, scene.scene_number, sceneStartedAtMs, result.status, result);
      return result;
    }
    const s7Duration = Date.now() - s7StartTime;
    await db.updateScene(sceneId, {
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
      run_id: runContext?.runId,
    }, runContext);
    log(7, 'Master Frame & Image Prompt', `Scene #${scene.scene_number}: Error Stage 7: ${errMsg}`, 'warn', 'S7');
  }

  // Reload scene to get updated master frame
  const currentScene = (await db.getScene(sceneId)) || scene;

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
      run_id: runContext?.runId,
    }, runContext);

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
      await enforceStageConsistency(projectId, `S8:${sceneId}:${shot.id}`, stage8Result, sceneConsistencyState);
      sceneContinuityState = await advanceContinuity(projectId, `S8:${sceneId}:${shot.id}`, currentScene, stage8Result, sceneContinuityState, 'within-scene', false);
      assetIntegrityReport = validateVideoPromptCoverage(assetIntegrityReport, JSON.stringify(stage8Result));
      assertSceneAssetCoverage(assetIntegrityReport);

      if (shot.id) {
        await db.saveVideoPrompts(shot.id, sceneId, projectId, stage8Result.prompts);
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
          run_id: runContext?.runId,
        }, runContext);

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
          run_id: runContext?.runId,
        }, runContext);
      }
    } catch (err: any) {
      failedShotsCount++;
      const s8Duration = Date.now() - s8StartTime;
      const errType = classifyError(err);
      const blocker = knownBlocker(err, `S8:${sceneId}:${shot.id}`);
      if (blocker) {
        await persistBlockedScene(sceneId, blocker);
        const result: ScenePipelineResult = { sceneId, status: 'BLOCKED', success: false, blockers: [blocker], assetIntegrityReport, continuityState: sceneContinuityState };
        await safePersistSceneSummary(projectId, runContext?.runId, sceneId, scene.scene_number, sceneStartedAtMs, result.status, result);
        return result;
      }
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
        run_id: runContext?.runId,
      }, runContext);
      log(8, 'Video Prompt Agent', `Shot #${shot.shot_number} error: ${err?.message || err}`, 'warn', 'S8');
    }
  }

  try {
    await enforceStageConsistency(
      projectId,
      `FINAL:${sceneId}`,
      { scene: currentScene, shots: savedShots, videoPrompts: await db.getVideoPromptsByScene(sceneId) },
      sceneConsistencyState
    );
    sceneContinuityState = await advanceContinuity(projectId, `FINAL:${sceneId}`, currentScene, { scene: currentScene, shots: savedShots }, sceneContinuityState, 'within-scene', false);
  } catch (error) {
    const blocker = knownBlocker(error, `FINAL:${sceneId}`);
    if (blocker) {
      await persistBlockedScene(sceneId, blocker);
      return { sceneId, status: 'BLOCKED', success: false, blockers: [blocker], assetIntegrityReport, continuityState: sceneContinuityState };
    }
    await db.updateScene(sceneId, { status: 'failed', pipeline_status: 'FAILED', blockers: [] });
    return { sceneId, status: 'FAILED', success: false, error: error instanceof Error ? error.message : String(error), assetIntegrityReport, continuityState: sceneContinuityState };
  }

  // ----------------------------------------------------
  // Full Scene Production Prompt Generation (Phase 17-19)
  // ----------------------------------------------------
  const snapshot = await db.getContinuitySnapshot(projectId, scene.scene_number);
  const fullScenePrompt = buildFullScenePrompt(currentScene, savedShots, snapshot);

  // ----------------------------------------------------
  // Continuity Validation & Auto-Correction (Phase 11-13)
  // ----------------------------------------------------
  // Pass the runtime sceneContinuityState so S8 validates the mutable scene-to-scene state
  // advanced by S6 (advanceContinuity), not only the static S5 baseline snapshot.
  const continuityResult = validateSceneContinuity(currentScene, savedShots, snapshot, sceneContinuityState);
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
    const shotPrompts = await db.getVideoPromptsByScene(sceneId);
    let correctedCount = 0;

    for (const vp of shotPrompts) {
      const originalPrompt = vp.timeline_json?.prompt || '';
      if (!originalPrompt) continue;
      const { correctedText, fixesApplied } = applyContinuityCorrectionToPrompt(originalPrompt, continuityViolations, snapshot);
      if (correctedText !== originalPrompt) {
        await db.saveSingleVideoPrompt({
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

  await db.updateScene(sceneId, {
    status: sceneFinalStatus,
    full_scene_prompt: fullScenePrompt,
    full_scene_prompt_status: 'ready',
    continuity_status: continuityStatus,
    continuity_violations: continuityViolations,
  });
  await persistReadyScene(sceneId, continuityStatus, continuityViolations);

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

  const currentBlockers: ScenePipelineBlocker[] = continuityStatus === 'continuity_failed'
    ? continuityViolations.map((violation) => ({ code: 'CONTINUITY_BLOCKED', severity: 'BLOCKING', message: violation.message, stage: 'FINAL' }))
    : [];
  const currentStatus = resolveCurrentSceneStatus(currentBlockers, failedShotsCount > 0);
  const result: ScenePipelineResult = { sceneId, status: currentStatus, success: currentStatus === 'READY', blockers: currentBlockers, shots: savedShots, assetIntegrityReport, continuityState: sceneContinuityState, error: currentStatus === 'READY' ? undefined : `Scene final status: ${currentStatus}` };
  await safePersistSceneSummary(projectId, runContext?.runId, sceneId, scene.scene_number, sceneStartedAtMs, currentStatus, result);
  return result;
}

function mergeContinuityResults(
  base: ReturnType<typeof createContinuityState> | null,
  results: ScenePipelineResult[]
): ReturnType<typeof createContinuityState> | null {
  if (!base) return null;
  const merged = JSON.parse(JSON.stringify(base)) as ReturnType<typeof createContinuityState>;
  const sceneMap = new Map(merged.scenes.map((scene) => [scene.sceneId, scene]));
  for (const result of results.slice().sort((left, right) => left.sceneId.localeCompare(right.sceneId))) {
    for (const scene of result.continuityState?.scenes || []) sceneMap.set(scene.sceneId, scene);
  }
  merged.scenes = Array.from(sceneMap.values()).sort((left, right) => (left.sceneNumber ?? Number.MAX_SAFE_INTEGER) - (right.sceneNumber ?? Number.MAX_SAFE_INTEGER) || left.sceneId.localeCompare(right.sceneId));
  merged.activeEvents = Array.from(new Set(results.flatMap((result) => result.continuityState?.activeEvents || []))).sort((left, right) => left.localeCompare(right));
  merged.unresolvedIssues = Array.from(new Map(results.flatMap((result) => result.continuityState?.unresolvedIssues || []).map((issue) => [`${issue.sceneId || ''}:${issue.code}`, issue])).values()).sort((left, right) => `${left.sceneId || ''}:${left.code}`.localeCompare(`${right.sceneId || ''}:${right.code}`));
  return merged;
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
  ) => void,
  runContext?: GenerationRunContext
): Promise<{ success: boolean; totalScenes: number; readyScenes: number; failedScenes: number }> {
  const project = await db.getProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} tidak ditemukan.`);
  }

  // Verify foundation first
  const foundationCheck = await verifyProjectFoundation(projectId);
  if (!foundationCheck.ready) {
    const initResult = await runProjectInitialization(projectId, onProgress);
    if (!initResult.success) {
      throw new Error(`Fondasi project (S1-S5) gagal diinisialisasi: ${initResult.error}`);
    }
  }

  const scenes = (await db.getScenes(projectId)).slice().sort((left, right) => left.scene_number - right.scene_number || (left.id || '').localeCompare(right.id || ''));
  if (!scenes || scenes.length === 0) {
    throw new Error('Tidak ada scene yang ditemukan untuk digenerate.');
  }

  const log = (
    stage: number,
    stageName: string,
    message: string,
    level: 'info' | 'success' | 'warn' | 'error' = 'info'
  ) => {
    safeAddLog(projectId, { stage, stage_name: stageName, message, level, run_id: runContext?.runId });
    if (onProgress) onProgress(stage, stageName, message, level);
  };

  log(
    6,
    'Scene Generation Pool',
    `Memulai generasi ${scenes.length} scene (Tahap S6–S8) dengan konkurensi ${concurrency} worker...`,
    'info'
  );

  let currentIndex = 0;
  const workerResults: ScenePipelineResult[] = [];
  const completionOrder: string[] = [];
  const continuitySeed = project.continuityState || (project.contextPackage ? createContinuityState(project.contextPackage) : null);

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
        const result = await runPipelineForScene(currentScene.id, onProgress, continuitySeed ? JSON.parse(JSON.stringify(continuitySeed)) : null, runContext);
        workerResults.push(result);
        completionOrder.push(result.sceneId);
      } catch (err: any) {
        const failedResult: ScenePipelineResult = { sceneId: currentScene.id, status: 'FAILED', success: false, error: err?.message || String(err) };
        workerResults.push(failedResult);
        await db.updateScene(currentScene.id, { status: 'failed', pipeline_status: 'FAILED', blockers: [] });
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

  const orderedResults = workerResults.slice().sort((left, right) => {
    const leftScene = scenes.find((scene) => scene.id === left.sceneId);
    const rightScene = scenes.find((scene) => scene.id === right.sceneId);
    return (leftScene?.scene_number ?? Number.MAX_SAFE_INTEGER) - (rightScene?.scene_number ?? Number.MAX_SAFE_INTEGER) || left.sceneId.localeCompare(right.sceneId);
  });
  const reports = orderedResults.map((result) => result.assetIntegrityReport).filter((report): report is SceneAssetCoverageReport => Boolean(report));
  const updatedProject = await db.getProject(projectId);
  if (updatedProject) {
    const assetReports = [...(updatedProject.assetIntegrityReports || []).filter((report) => !reports.some((item) => item.sceneId === report.sceneId)), ...reports];
    const continuityState = mergeContinuityResults(continuitySeed, orderedResults);
      const aggregateProject = { ...updatedProject, continuityState, assetIntegrityReports: assetReports };
      const finalizationReport = evaluateFinalizationGate(aggregateProject, await Promise.all(scenes.map(async (scene) => {
        const current = await db.getScene(scene.id!);
        return { sceneId: scene.id, status: current?.pipeline_status || (current?.status === 'ready' ? 'READY' : current?.status) };
      })));
    const sceneBlockers: FinalizationBlocker[] = orderedResults.flatMap((result) => (result.blockers || []).map((blocker) => ({ code: blocker.code, layer: blocker.stage, message: blocker.message, sceneId: result.sceneId })));
    finalizationReport.blockerDetails = [...(finalizationReport.blockerDetails || []), ...sceneBlockers];
    finalizationReport.blockers = Array.from(new Set([...finalizationReport.blockers, ...sceneBlockers.map((blocker) => blocker.message)]));
    const hasFailed = orderedResults.some((result) => result.status === 'FAILED');
    const finalStatus = hasFailed ? 'failed' : finalizationReport.status === 'BLOCKED' ? 'blocked' : 'completed';
    await db.saveProject({
      ...aggregateProject,
      status: finalStatus,
      current_stage: 8,
      finalizationReport,
      error_message: hasFailed || finalizationReport.status === 'BLOCKED' ? `${orderedResults.filter((result) => result.status !== 'READY').length} dari ${scenes.length} scene memerlukan perhatian manual.` : null,
    });
  }

  const readyCount = orderedResults.filter((result) => result.status === 'READY').length;
  const blockedCount = orderedResults.filter((result) => result.status === 'BLOCKED').length;
  const failedCount = orderedResults.filter((result) => result.status === 'FAILED').length;

  const stageSummaries = await Promise.all(['S6', 'S7', 'S8'].map(async (stageCode) => {
    const stageEntries = (await db.getTelemetry(projectId)).filter((entry) => entry.run_id === runContext?.runId && entry.stage_code === stageCode && typeof entry.duration_ms === 'number');
    const totalMs = stageEntries.reduce((sum, entry) => sum + (entry.duration_ms || 0), 0);
    return { stage_code: stageCode, count: stageEntries.length, total_ms: totalMs, average_ms: stageEntries.length ? totalMs / stageEntries.length : 0 };
  }));

  await safePersistRunSummary(projectId, runContext?.runId, {
    run_id: runContext?.runId,
    effective_concurrency: effectiveConcurrency,
    total_scenes: scenes.length,
    ready_scenes: readyCount,
    blocked_scenes: blockedCount,
    failed_scenes: failedCount,
    completion_order: completionOrder,
    started_at: runContext?.startedAt || new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: Date.now() - (runContext ? new Date(runContext.startedAt).getTime() : Date.now()),
    stage_timings: Object.fromEntries(stageSummaries.map((summary) => [summary.stage_code, summary])),
  });

  log(
    8,
    'Scene Generation Pool',
    `Generasi seluruh scene selesai. ${readyCount} scene siap, ${failedCount} scene perlu perhatian.`,
    failedCount === 0 ? 'success' : 'warn'
  );

  return {
    success: orderedResults.every((result) => result.status === 'READY'),
    totalScenes: scenes.length,
    readyScenes: readyCount,
    failedScenes: failedCount,
  };
}

async function safePersistRunSummaryAtOrchestrator(
  projectId: string,
  runId: string | undefined,
  startedAt: string,
  effectiveConcurrency: number,
  scenesCount: number,
  readyScenes: number,
  blockedScenes: number,
  failedScenes: number,
  completionOrder: string[]
): Promise<void> {
  try {
    const durationMs = Date.now() - new Date(startedAt).getTime();
    const stageSummaries = await Promise.all(['S6', 'S7', 'S8'].map(async (stageCode) => {
      const stageEntries = (await db.getTelemetry(projectId)).filter((entry) => entry.run_id === runId && entry.stage_code === stageCode && typeof entry.duration_ms === 'number');
      const totalMs = stageEntries.reduce((sum, entry) => sum + (entry.duration_ms || 0), 0);
      return { stage_code: stageCode, count: stageEntries.length, total_ms: totalMs, average_ms: stageEntries.length ? totalMs / stageEntries.length : 0 };
    }));

    await recordTelemetry(projectId, {
      stage: 8,
      stage_code: 'S8',
      scope: 'project',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
      status: 'completed',
      summary_type: 'run',
      summary: {
        run_id: runId,
        effective_concurrency: effectiveConcurrency,
        total_scenes: scenesCount,
        ready_scenes: readyScenes,
        blocked_scenes: blockedScenes,
        failed_scenes: failedScenes,
        completion_order: completionOrder,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        stage_timings: Object.fromEntries(stageSummaries.map((summary) => [summary.stage_code, summary])),
      },
      run_id: runId,
    }, { runId } as GenerationRunContext);
  } catch {
    // Observability must remain non-blocking.
  }
}

/**
 * Top-level Orchestrator:
 * 1. Checks foundation status; runs S1-S5 if not ready.
 * 2. Runs S6-S8 for all scenes with controlled concurrency.
 */
export async function runOrchestratedPipeline({
  projectId,
  onProgress,
  runContext,
  sceneConcurrency,
}: OrchestratorRunOptions): Promise<{ success: boolean; error?: string; runId?: string }> {
  const project = await db.getProject(projectId);
  if (!project) {
    throw new Error(`Project with ID ${projectId} not found.`);
  }

  const activeRunContext = runContext ?? createGenerationRunContext(projectId, 2);
  const log = (
    stage: number,
    stageName: string,
    message: string,
    level: 'info' | 'success' | 'warn' | 'error' = 'info'
  ) => {
    safeAddLog(projectId, { stage, stage_name: stageName, message, level, run_id: activeRunContext.runId });
    if (onProgress) {
      onProgress(stage, stageName, message, level);
    }
  };

  try {
    const runStartedAt = new Date().toISOString();
    const completionOrder: string[] = [];
    await db.saveProject({
      ...(await db.getProject(projectId))!,
      active_run_id: activeRunContext.runId,
      latest_run_id: activeRunContext.runId,
      status: 'processing',
      current_stage: 1,
    });
    // Step 1: Project Initialization (S1-S5)
    const foundationCheck = await verifyProjectFoundation(projectId);
    if (!foundationCheck.ready) {
      log(1, 'Pipeline Orchestrator', 'Fondasi proyek belum diinisialisasi. Menjalankan Tahap S1–S5...', 'info');
      const initResult = await runProjectInitialization(projectId, onProgress);
      if (!initResult.success) {
        return initResult;
      }
    } else {
      log(1, 'Pipeline Orchestrator', 'Fondasi proyek (S1–S5) sudah valid & siap. Melompati inisialisasi ulang.', 'info');
    }

    // Step 2: Scene Generation (S6-S8) with configurable concurrency
    // Cascade: sceneConcurrency arg > runContext.concurrency > SCENE_GENERATION_CONCURRENCY env > default 2
    const envConcurrency = process.env.SCENE_GENERATION_CONCURRENCY
      ? parseInt(process.env.SCENE_GENERATION_CONCURRENCY, 10)
      : undefined;
    const resolvedConcurrency = sceneConcurrency ?? activeRunContext.concurrency ?? envConcurrency ?? 2;
    const sceneResult = await generateAllScenes(projectId, resolvedConcurrency, onProgress, activeRunContext);
    const blockedScenes = sceneResult.totalScenes - sceneResult.readyScenes - sceneResult.failedScenes;
    await safePersistRunSummaryAtOrchestrator(
      projectId,
      activeRunContext.runId,
      runStartedAt,
      resolvedConcurrency,
      sceneResult.totalScenes,
      sceneResult.readyScenes,
      blockedScenes,
      sceneResult.failedScenes,
      completionOrder
    );

    log(
      8,
      'Pipeline Orchestrator',
      `Pipeline selesai! ${sceneResult.readyScenes}/${sceneResult.totalScenes} scene siap untuk produksi.`,
      sceneResult.success ? 'success' : 'warn'
    );

    return {
      success: sceneResult.success,
      error: sceneResult.success ? undefined : `Pipeline aggregate status: ${sceneResult.failedScenes} scene(s) require attention.`,
      runId: activeRunContext.runId,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Terjadi kesalahan pada pipeline orchestrator.';
    log(
      (await db.getProject(projectId))?.current_stage || 1,
      'Pipeline Failure',
      `Fatal error: ${errorMsg}`,
      'error'
    );

    await db.saveProject({
      ...(await db.getProject(projectId))!,
      status: 'failed',
      error_message: errorMsg,
      active_run_id: activeRunContext.runId,
      latest_run_id: activeRunContext.runId,
    });

    return { success: false, error: errorMsg, runId: activeRunContext.runId };
  }
}
