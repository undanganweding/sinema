import { Router, Request, Response } from 'express';
import { db } from './db';
import {
  runOrchestratedPipeline,
  runPipelineForScene,
  runProjectInitialization,
  generateAllScenes,
  verifyProjectFoundation,
} from './orchestrator';
import {
  AVAILABLE_MODELS,
  DEFAULT_GEMINI_MODEL,
  resolveGeminiModel,
  checkGeminiOmniCapability,
} from './gemini';
import { runStage7MasterFrameAndImagePrompt } from './stages/stage7_master_frame';
import { runStage8VideoPrompt } from './stages/stage8_video_prompt';
import { assembleCombinedScenePrompt } from './stages/combined_scene_prompt';
import { testLLMConnection, executeLLMRequest, fallbackAuditLogs } from './llm_provider';
import {
  Project,
  Shot,
  PromptLanguage,
  PromptTarget,
  ReasoningConfig,
  SceneTone,
  NarrativeStyleConfig,
} from '../src/types';
import { buildGroundingContextPackage, validateGroundingContext, GROUNDING_VERSION } from './grounding_engine';
import {
  TONE_PRESET_NAMES,
  TONE_PRESET_DICTIONARY,
  DEFAULT_NARRATIVE_STYLE_CONFIG,
  recommendSceneTone,
  resolveSceneTone,
  validateNarrativeStyle,
} from './narrative_tone';
import {
  validateDurationCompatibility,
  convertTimelineForExtendedMode,
  runDurationArchitectureRegressionTests,
  resolveOutputDurationStrict,
  PROMPT_TARGET_SUPPORTED_DURATIONS,
} from './duration_engine';
import {
  runPromptEngineRegressionTests,
} from './cinematic_prompt_engine';
import {
  ACCEPTED_TARGET_INPUTS,
  parsePromptTargetFromRequest,
  parseOptionalRequestedDuration,
  sendPromptError,
} from './http_prompt_contract';
import {
  isStillPromptTarget,
  ALL_PROMPT_TARGETS,
  InvalidPromptTargetError,
  isLegacyPlatformName,
} from './stages/stage8_video_prompt';

export const apiRouter = Router();

// Store active SSE clients by projectId
const sseClients: Record<string, Response[]> = {};

function broadcastSSE(projectId: string, data: any) {
  const clients = sseClients[projectId] || [];
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      // client disconnected
    }
  }
}

// Health check
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Capability check for Gemini Omni
apiRouter.get('/capabilities/omni', async (req: Request, res: Response) => {
  try {
    const hasOmni = await checkGeminiOmniCapability();
    res.json({ hasOmni });
  } catch (err: any) {
    res.json({ hasOmni: false });
  }
});

// Test connection endpoint for reasoning model providers
apiRouter.post('/test-llm-connection', async (req: Request, res: Response) => {
  try {
    const { provider_type, provider_name, base_url, model_id, api_key, display_name } = req.body;
    if (!model_id) {
      return res.status(400).json({ success: false, message: 'Model ID wajib diisi.' });
    }
    const result = await testLLMConnection({
      provider_type: provider_type || 'google',
      provider_name: provider_name || 'Provider',
      base_url,
      model_id,
      api_key,
      display_name,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Gagal memproses pengujian koneksi.' });
  }
});

// List available Google Gemini models
apiRouter.get('/models', (req: Request, res: Response) => {
  res.json({
    models: AVAILABLE_MODELS,
    defaultModel: DEFAULT_GEMINI_MODEL,
  });
});

// List available Tone Presets & Definitions
apiRouter.get('/tone-presets', (_req: Request, res: Response) => {
  res.json({
    presets: TONE_PRESET_NAMES,
    dictionary: TONE_PRESET_DICTIONARY,
  });
});

// List all projects
apiRouter.get('/projects', (req: Request, res: Response) => {
  try {
    const list = db.listProjects();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create new project
apiRouter.post('/projects', (req: Request, res: Response) => {
  try {
    const {
      title,
      raw_script,
      total_duration_target_sec,
      max_scene_shot_duration_sec,
      scene_duration_sec,
      allow_final_scene_override,
      prompt_language,
      ai_model,
      reasoning_config,
      image_model,
      video_model,
      include_seedance_format,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Judul project wajib diisi.' });
    }
    if (!raw_script || !raw_script.trim()) {
      return res.status(400).json({ error: 'Naskah/Storyboard mentah wajib diisi.' });
    }

    const durationTarget = Number(total_duration_target_sec) || 120; // default 2m = 120s
    let maxScene: number | null = null;
    const rawSceneDur = scene_duration_sec !== undefined ? scene_duration_sec : max_scene_shot_duration_sec;
    if (rawSceneDur !== null && rawSceneDur !== undefined && rawSceneDur !== 'auto') {
      maxScene = Math.min(30, Math.max(5, Number(rawSceneDur)));
    }

    const language: PromptLanguage = prompt_language === 'en' ? 'en' : 'id';
    
    let effectiveReasoningConfig: ReasoningConfig | undefined = reasoning_config;
    let selectedModel = ai_model || 'gemini-3.7-flash';

    if (effectiveReasoningConfig) {
      if (effectiveReasoningConfig.provider_type === 'google') {
        selectedModel = resolveGeminiModel(effectiveReasoningConfig.model_id || ai_model);
        effectiveReasoningConfig.model_id = selectedModel;
      } else {
        selectedModel = effectiveReasoningConfig.model_id || 'qwen/qwen-2.5-72b-instruct:free';
      }
    } else if (ai_model) {
      selectedModel = resolveGeminiModel(ai_model);
      effectiveReasoningConfig = {
        provider_type: 'google',
        provider_name: 'Google Gemini',
        model_id: selectedModel,
        display_name: selectedModel,
      };
    }

    const validatedVideoModels: ('veo' | 'gemini_omni')[] = Array.isArray(video_model) && video_model.length > 0
      ? video_model.filter((m: string) => m === 'veo' || m === 'gemini_omni')
      : ['veo'];

    const defaultModelPrefs = req.body.reasoning_model_preferences || {
      mode: 'fixed',
      primary_model: {
        provider: effectiveReasoningConfig?.provider_type || 'google',
        model_id: selectedModel,
        display_name: selectedModel,
      },
      fallback_policy: 'smart',
      fallback_pool: [
        { provider: 'google', model_id: 'gemini-3.7-flash', priority: 1, display_name: 'Gemini 3.7 Flash' },
        { provider: 'google', model_id: 'gemini-3.6-flash', priority: 2, display_name: 'Gemini 3.6 Flash' },
        { provider: 'google', model_id: 'gemini-3.1-pro-preview', priority: 3, display_name: 'Gemini 3.1 Pro Preview' },
      ],
      force_model: false,
    };

    const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const groundingContext = buildGroundingContextPackage(raw_script.trim());
    const newProject: Project = {
      id,
      title: title.trim(),
      raw_script: raw_script.trim(),
      total_duration_target_sec: durationTarget,
      max_scene_shot_duration_sec: maxScene,
      scene_duration_sec: maxScene,
      allow_final_scene_override: Boolean(allow_final_scene_override),
      prompt_language: language,
      ai_model: selectedModel,
      reasoning_config: effectiveReasoningConfig,
      reasoning_model_preferences: defaultModelPrefs,
      image_model: 'nano_banana_pro',
      video_model: validatedVideoModels,
      include_seedance_format: Boolean(include_seedance_format),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'draft',
      current_stage: 0,
      error_message: null,
      retry_count: 0,
      groundingVersion: GROUNDING_VERSION,
      contextPackage: groundingContext,
      sourceRegistry: groundingContext.sources,
      validationResult: validateGroundingContext(groundingContext),
      groundingStatus: groundingContext.groundingStatus,
    };

    const saved = db.saveProject(newProject);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update project settings
apiRouter.patch('/projects/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const project = db.getProject(id);
    if (!project) {
      return res.status(404).json({ error: 'Project tidak ditemukan.' });
    }

    const {
      ai_model,
      title,
      raw_script,
      total_duration_target_sec,
      max_scene_shot_duration_sec,
      prompt_language,
      video_model,
      include_seedance_format,
      reasoning_config,
      reasoning_model_preferences,
    } = req.body;

    const updated: Project = {
      ...project,
      ...(title && { title: title.trim() }),
      ...(raw_script && { raw_script: raw_script.trim() }),
      ...(total_duration_target_sec && { total_duration_target_sec: Number(total_duration_target_sec) }),
      ...(max_scene_shot_duration_sec !== undefined && {
        max_scene_shot_duration_sec:
          max_scene_shot_duration_sec === null || max_scene_shot_duration_sec === 'auto'
            ? null
            : Math.min(30, Math.max(5, Number(max_scene_shot_duration_sec))),
      }),
      ...(prompt_language && { prompt_language: prompt_language === 'en' ? 'en' : 'id' }),
      ...(ai_model && { ai_model: resolveGeminiModel(ai_model) }),
      ...(reasoning_config && { reasoning_config }),
      ...(reasoning_model_preferences && { reasoning_model_preferences }),
      ...(video_model && { video_model }),
      ...(include_seedance_format !== undefined && { include_seedance_format: Boolean(include_seedance_format) }),
      updated_at: new Date().toISOString(),
    };

    const saved = db.saveProject(updated);
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get fallback audit logs for project
apiRouter.get('/projects/:id/fallback-logs', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const logs = fallbackAuditLogs.filter(l => !l.entity_id || l.entity_id === id);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single project full data
apiRouter.get('/projects/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const fullData = db.getFullProjectData(id);
    if (!fullData) {
      return res.status(404).json({ error: 'Project tidak ditemukan.' });
    }
    const logs = db.getLogs(id);
    res.json({ ...fullData, logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete project
apiRouter.delete('/projects/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const success = db.deleteProject(id);
    if (!success) {
      return res.status(404).json({ error: 'Project tidak ditemukan.' });
    }
    res.json({ success: true, message: 'Project berhasil dihapus.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Check Project Foundation Status (S1-S5)
apiRouter.get('/projects/:id/foundation-status', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const status = verifyProjectFoundation(id);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Run Project Initialization (S1-S5 ONLY)
apiRouter.post('/projects/:id/initialize-foundation', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const project = db.getProject(id);
    if (!project) {
      return res.status(404).json({ error: 'Project tidak ditemukan.' });
    }

    res.json({
      status: 'started',
      message: 'Inisialisasi fondasi proyek (S1–S5) dimulai.',
      projectId: id,
    });

    runProjectInitialization(id, (stage, stageName, message, level) => {
      broadcastSSE(id, {
        type: 'progress',
        stage,
        stageName,
        message,
        level,
        timestamp: new Date().toISOString(),
      });
    }).then((result) => {
      broadcastSSE(id, {
        type: 'finished',
        success: result.success,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generate All Scenes (S6-S8 ONLY with concurrency)
apiRouter.post('/projects/:id/generate-scenes', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const project = db.getProject(id);
    if (!project) {
      return res.status(404).json({ error: 'Project tidak ditemukan.' });
    }

    const concurrency = Number(req.body.concurrency) || 2;

    res.json({
      status: 'started',
      message: `Generasi seluruh scene (S6–S8) dimulai dengan konkurensi ${concurrency}.`,
      projectId: id,
    });

    generateAllScenes(id, concurrency, (stage, stageName, message, level) => {
      broadcastSSE(id, {
        type: 'progress',
        stage,
        stageName,
        message,
        level,
        timestamp: new Date().toISOString(),
      });
    }).then((result) => {
      broadcastSSE(id, {
        type: 'finished',
        success: result.success,
        readyScenes: result.readyScenes,
        totalScenes: result.totalScenes,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Project Telemetry
apiRouter.get('/projects/:id/telemetry', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const telemetry = db.getTelemetry(id);
    res.json({ telemetry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger Orchestrated Pipeline Generation (Stages 1-8)
apiRouter.post('/projects/:id/generate', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const project = db.getProject(id);
    if (!project) {
      return res.status(404).json({ error: 'Project tidak ditemukan.' });
    }

    res.json({
      status: 'started',
      message: 'Orchestrator pipeline dimulai.',
      projectId: id,
    });

    runOrchestratedPipeline({
      projectId: id,
      onProgress: (stage, stageName, message, level) => {
        broadcastSSE(id, {
          type: 'progress',
          stage,
          stageName,
          message,
          level,
          timestamp: new Date().toISOString(),
        });
      },
    }).then((result) => {
      broadcastSSE(id, {
        type: 'finished',
        success: result.success,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Single Scene Pipeline Generation (Stages 6, 7, 8)
apiRouter.post('/scenes/:id/run-pipeline', async (req: Request, res: Response) => {
  try {
    const sceneId = req.params.id;
    const scene = db.getScene(sceneId);
    if (!scene) {
      return res.status(404).json({ error: 'Scene tidak ditemukan.' });
    }

    const result = await runPipelineForScene(sceneId);
    const updatedFullData = db.getFullProjectData(scene.project_id);
    res.json({ success: result.success, error: result.error, project: updatedFullData });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Regenerate Master Image Prompt for Scene (Prompt-Only, Stage 7 Text Generation)
//
// PATCH 5.5-R1 FASE 4: the still targets own their duration. The endpoint
// accepts only `banana_master_frame` / `banana_image` (default:
// banana_master_frame) and an optional requestedDuration that must satisfy the
// target contract ([10]). `scene.duration_sec` is NOT used as the contract
// duration: a 30s scene asking for a 30s still gets 422, not a silent 10s.
apiRouter.post('/scenes/:id/regenerate-prompt', async (req: Request, res: Response) => {
  let promptTarget: PromptTarget;
  let requestedDuration: number | undefined;
  try {
    promptTarget = parsePromptTargetFromRequest(
      req.body?.target ?? req.body?.platform ?? 'banana_master_frame'
    );
    if (!isStillPromptTarget(promptTarget)) {
      // A video target has no meaning for a scene master frame.
      throw new InvalidPromptTargetError(promptTarget);
    }
    requestedDuration = parseOptionalRequestedDuration(
      req.body?.requestedDuration ?? req.body?.duration_sec
    );
  } catch (err: any) {
    return sendPromptError(res, err, 'Target prompt tidak valid.');
  }

  try {
    const sceneId = req.params.id;
    const scene = db.getScene(sceneId);
    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene tidak ditemukan.', code: 'SCENE_NOT_FOUND' });
    }

    const projectId = scene.project_id;
    const project = db.getProject(projectId);
    const foundation = db.getProjectFoundation(projectId);
    const characters = db.getCharacters(projectId);
    const locations = db.getLocations(projectId);
    const objects = db.getObjects(projectId);

    // Duration + contract gates live inside Stage 7 and throw before returning,
    // so nothing below this call runs for an invalid prompt.
    const stage7Result = await runStage7MasterFrameAndImagePrompt({
      scene,
      foundation,
      characters,
      locations,
      objects,
      language: project?.prompt_language || 'id',
      model: project?.ai_model,
      requestedDuration,
    });

    // --- PERSIST only after both banana contracts validated ---
    const updatedScene = db.updateScene(sceneId, {
      master_image_prompt: stage7Result.compiledPromptText,
      master_image_prompt_json: stage7Result.promptJson,
      image_gen_status: 'success',
      image_gen_error: null,
    });

    res.json({
      success: true,
      target: promptTarget,
      resolved_duration_sec: stage7Result.resolvedDurationSec,
      scene: updatedScene,
      compiledPromptText: stage7Result.compiledPromptText,
      masterFramePromptText: stage7Result.masterFramePromptText,
    });
  } catch (err: any) {
    return sendPromptError(res, err, 'Gagal meregenerate master image prompt untuk scene ini.');
  }
});

// PATCH 5.5-R1 FASE 4: discoverable prompt target contract.
apiRouter.get('/prompt-targets', (_req: Request, res: Response) => {
  res.json({
    targets: ALL_PROMPT_TARGETS,
    supportedDurations: PROMPT_TARGET_SUPPORTED_DURATIONS,
    acceptedInputs: ACCEPTED_TARGET_INPUTS,
  });
});

// Test Prompt Engine Regression Suite
apiRouter.get('/test-prompt-engine', (req: Request, res: Response) => {
  try {
    const results = runPromptEngineRegressionTests();
    const allPassed = results.every((r) => r.passed);
    res.json({
      success: allPassed,
      allPassed,
      totalTests: results.length,
      passedTests: results.filter((r) => r.passed).length,
      results,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Scene (e.g. manual master_frame_image_url attach/remove)
apiRouter.put('/scenes/:id', (req: Request, res: Response) => {
  try {
    const sceneId = req.params.id;
    const { master_frame_image_url } = req.body;
    const updated = db.updateScene(sceneId, { master_frame_image_url });
    res.json({ success: true, scene: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Shot (e.g. manual shot_image_url attach/remove)
apiRouter.put('/shots/:id', (req: Request, res: Response) => {
  try {
    const shotId = req.params.id;
    const { shot_image_url } = req.body;
    const updated = db.updateShot(shotId, { shot_image_url });
    res.json({ success: true, shot: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Combined Prompt per Scene (derived assembly, not new Gemini call)
apiRouter.get('/scenes/:id/combined-prompt', (req: Request, res: Response) => {
  try {
    const sceneId = req.params.id;
    const platform = (req.query.platform as 'veo' | 'gemini_omni' | 'seedance') || 'veo';
    const result = assembleCombinedScenePrompt(sceneId, platform);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Scene
apiRouter.put('/scenes/:id', (req: Request, res: Response) => {
  try {
    const sceneId = req.params.id;
    const updated = db.updateScene(sceneId, req.body);
    if (!updated) return res.status(404).json({ error: 'Scene tidak ditemukan.' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Shot
apiRouter.put('/shots/:id', (req: Request, res: Response) => {
  try {
    const shotId = req.params.id;
    const updated = db.updateShot(shotId, req.body);
    if (!updated) return res.status(404).json({ error: 'Shot tidak ditemukan.' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Video Prompt
apiRouter.put('/video-prompts/:id', (req: Request, res: Response) => {
  try {
    const vpId = req.params.id;
    const updated = db.saveSingleVideoPrompt({ ...req.body, id: vpId });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Regenerate / Retry Prompt for a single Shot & explicit PromptTarget
//
// PATCH 5.5-R1 FASE 4 — endpoint contract:
//   request -> parse target (400 INVALID_PROMPT_TARGET on anything unknown)
//           -> strict duration resolver (422 PROMPT_DURATION_CONTRACT_FAILED)
//           -> adapter -> validateProductionPromptContract
//              (422 PROMPT_CONTRACT_VALIDATION_FAILED)
//           -> ONLY THEN persist
// There is no fallback target and no duration coercion on this path.
apiRouter.post('/shots/:id/regenerate-prompt', async (req: Request, res: Response) => {
  // --- GATE 1: explicit target validation, before any generation or write ---
  let promptTarget: PromptTarget;
  let requestedDuration: number | undefined;
  try {
    // `target` is the 5.5 field; `platform` is the legacy field still sent by
    // the current UI and translated 1:1 (veo|gemini_omni|seedance, banana*).
    promptTarget = parsePromptTargetFromRequest(req.body?.target ?? req.body?.platform);
    requestedDuration = parseOptionalRequestedDuration(
      req.body?.requestedDuration ?? req.body?.duration_sec
    );
  } catch (err: any) {
    return sendPromptError(res, err, 'Target prompt tidak valid.');
  }

  try {
    const shotId = req.params.id;

    const shot = db.getShot(shotId);
    if (!shot) {
      return res.status(404).json({ success: false, error: 'Shot tidak ditemukan.', code: 'SHOT_NOT_FOUND' });
    }

    const scene = db.getScene(shot.scene_id);
    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene tidak ditemukan.', code: 'SCENE_NOT_FOUND' });
    }

    const projectId = shot.project_id;
    const project = db.getProject(projectId);
    const foundation = db.getProjectFoundation(projectId);
    const characters = db.getCharacters(projectId);
    const locations = db.getLocations(projectId);
    const allSceneShots = db.getShotsByScene(shot.scene_id);

    const shotIndex = allSceneShots.findIndex((s) => s.id === shotId);

    // --- GATE 2 + 3: strict duration + contract validation happen inside
    // Stage 8. Any failure throws BEFORE we reach the persistence block below,
    // so an invalid prompt can never be written. ---
    const stage8Result = await runStage8VideoPrompt({
      scene,
      shot,
      shotIndex: shotIndex >= 0 ? shotIndex : Math.max(0, shot.shot_number - 1),
      totalShotsInScene: allSceneShots.length || 1,
      masterFrameImageUrl: scene.master_frame_image_url,
      foundation,
      characters,
      locations,
      videoModels: project?.video_model || ['veo'],
      includeSeedance: !!project?.include_seedance_format,
      language: project?.prompt_language || 'id',
      model: project?.ai_model,
      reasoningConfig: project?.reasoning_config,
      target: promptTarget,
      requestedDuration,
    });

    // --- PERSIST (still targets): banana_* produce an image prompt, not a
    // VideoPrompt row, so they never pollute the video_prompts table. ---
    if (isStillPromptTarget(promptTarget)) {
      const still = stage8Result.stills.find((s) => s.target === promptTarget);
      if (!still) {
        // Defensive: Stage 8 must return a still for a still target.
        return res.status(500).json({
          success: false,
          error: `STILL_PROMPT_MISSING: Stage 8 tidak menghasilkan prompt untuk target "${promptTarget}".`,
          code: 'STILL_PROMPT_MISSING',
        });
      }

      const updatedShot = db.updateShot(shotId, { master_image_prompt: still.prompt_text });
      return res.json({
        success: true,
        target: promptTarget,
        resolved_duration_sec: still.resolved_duration_sec,
        shot: updatedShot,
        master_image_prompt: still.prompt_text,
        stills: stage8Result.stills,
        prompts: db.getVideoPromptsByShot(shotId),
      });
    }

    // --- PERSIST (video targets) ---
    //
    // FASE 5 FIX: the existing-row match MUST be keyed on the canonical
    // `prompt_target`, not on `target_platform`. Both `seedance_10` and
    // `seedance_30` map to the legacy column value `'seedance'`, so matching on
    // the column alone made the 30s prompt overwrite the 10s row (and vice
    // versa) — one shot could never hold both. `target_platform` remains the
    // legacy compatibility column; it is just no longer the identity key.
    const existingPrompts = db.getVideoPromptsByShot(shotId);
    const savedPrompts: any[] = [];
    const shotUpdates: Partial<Shot> = {};

    for (const newPrompt of stage8Result.prompts) {
      const existingMatch = existingPrompts.find((p) =>
        p.prompt_target
          ? p.prompt_target === newPrompt.prompt_target
          : // Legacy row with no prompt_target: only claim it when the column is
            // unambiguous. `seedance` is ambiguous (10s vs 30s), so a legacy
            // seedance row is left alone and a new explicit row is created.
            p.target_platform === newPrompt.target_platform && p.target_platform !== 'seedance'
      );
      if (existingMatch) {
        const updated = db.saveSingleVideoPrompt({
          ...existingMatch,
          ...newPrompt,
          id: existingMatch.id,
        });
        savedPrompts.push(updated);
      } else {
        const created = db.saveSingleVideoPrompt({
          ...newPrompt,
          shot_id: shotId,
          scene_id: shot.scene_id,
          project_id: projectId,
          version: 1,
        } as any);
        savedPrompts.push(created);
      }

      if (newPrompt.target_platform === 'seedance') {
        shotUpdates.seedance_prompt = newPrompt.timeline_json?.shot_breakdown || newPrompt.timeline_json?.prompt;
      } else if (newPrompt.target_platform === 'veo') {
        shotUpdates.video_prompt = newPrompt.timeline_json?.prompt;
      }
    }

    if (Object.keys(shotUpdates).length > 0) {
      db.updateShot(shotId, shotUpdates);
    }

    const finalShot = db.getShot(shotId);

    res.json({
      success: true,
      target: promptTarget,
      resolved_duration_sec: stage8Result.prompts[0]?.timeline_json?.resolved_duration_sec,
      shot: finalShot,
      prompts: savedPrompts,
    });
  } catch (err: any) {
    // Class-based mapping: 400 invalid target, 422 duration/contract failure,
    // 500 otherwise. Always JSON. Nothing was persisted on these paths.
    return sendPromptError(res, err, 'Gagal meregenerate video prompt untuk shot ini.');
  }
});

// --- Story Architecture Endpoints ---
apiRouter.get('/projects/:id/story-architecture', (req: Request, res: Response) => {
  try {
    const arch = db.getStoryArchitecture(req.params.id);
    if (!arch) {
      return res.status(404).json({ error: 'Story architecture tidak ditemukan.' });
    }
    res.json(arch);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/projects/:id/story-architecture', (req: Request, res: Response) => {
  try {
    const saved = db.saveStoryArchitecture({
      ...req.body,
      project_id: req.params.id,
    });
    res.json({ success: true, story_architecture: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Continuity Engine Endpoints ---
apiRouter.get('/projects/:id/continuity-states', (req: Request, res: Response) => {
  try {
    const states = db.getCharacterContinuityStates(req.params.id);
    res.json(states);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/projects/:id/continuity-states', (req: Request, res: Response) => {
  try {
    const saved = db.saveCharacterContinuityStates(req.params.id, req.body.states || []);
    res.json({ success: true, states: saved });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/projects/:id/continuity-snapshot/:sceneNumber', (req: Request, res: Response) => {
  try {
    const sceneNum = parseInt(req.params.sceneNumber, 10);
    const snap = db.getContinuitySnapshot(req.params.id, sceneNum);
    res.json(snap || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/projects/:id/costume-transition', (req: Request, res: Response) => {
  try {
    const { character_name, transition } = req.body;
    if (!character_name || !transition) {
      return res.status(400).json({ error: 'character_name dan transition data wajib diisi.' });
    }
    const updatedStates = db.recordApprovedCostumeTransition(req.params.id, character_name, transition);
    res.json({ success: true, states: updatedStates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/projects/:id/validate-duration', (req: Request, res: Response) => {
  try {
    const { projectDuration, timelineSceneDuration, model, durationMode, selectedExtendedDuration } = req.body;
    const validation = validateDurationCompatibility(
      projectDuration || 60,
      timelineSceneDuration || 10,
      model || 'veo',
      durationMode || 'match_scene',
      selectedExtendedDuration || 30
    );
    res.json(validation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/projects/:id/convert-timeline', (req: Request, res: Response) => {
  try {
    const { targetDuration } = req.body;
    const project = db.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Proyek tidak ditemukan.' });
    }
    const scenes = db.getScenes(req.params.id);
    const convertedScenes = convertTimelineForExtendedMode(scenes, targetDuration || 30);
    
    db.saveScenes(req.params.id, convertedScenes);
    
    const updatedProj = {
      ...project,
      durationMode: 'extended' as const,
      selectedExtendedDuration: targetDuration || 30,
      timelineSceneDuration: targetDuration || 30,
      scene_duration_sec: targetDuration || 30,
    };
    db.saveProject(updatedProj);

    res.json({ success: true, scenes: convertedScenes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/regression-tests/duration', (req: Request, res: Response) => {
  try {
    const results = runDurationArchitectureRegressionTests();
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/regression-tests/prompt', (req: Request, res: Response) => {
  try {
    const results = runPromptEngineRegressionTests();
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SSE Live Stream for pipeline updates
apiRouter.get('/projects/:id/stream', (req: Request, res: Response) => {
  const id = req.params.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  if (!sseClients[id]) {
    sseClients[id] = [];
  }
  sseClients[id].push(res);

  // Send current state
  const logs = db.getLogs(id);
  const project = db.getProject(id);
  res.write(`data: ${JSON.stringify({ type: 'init', project, logs })}\n\n`);

  req.on('close', () => {
    sseClients[id] = (sseClients[id] || []).filter((c) => c !== res);
  });
});

