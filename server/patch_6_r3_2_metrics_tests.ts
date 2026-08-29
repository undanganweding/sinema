import { db } from './db';
import { createGenerationRunContext, runOrchestratedPipeline } from './orchestrator';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function assertMetricsSummaryIsProduced(): Promise<void> {
  const projectId = `r3_2_metrics_${Date.now()}`;
  const now = new Date().toISOString();

  db.saveProject({
    id: projectId,
    title: 'R3.2 observability fixture',
    raw_script: 'Six scene production path fixture',
    total_duration_target_sec: 60,
    max_scene_shot_duration_sec: 10,
    scene_duration_sec: 10,
    prompt_language: 'en',
    image_model: 'nano_banana_pro',
    video_model: ['veo'],
    include_seedance_format: false,
    created_at: now,
    updated_at: now,
    status: 'draft',
    current_stage: 0,
  } as any);

  db.saveProjectFoundation({
    project_id: projectId,
    genre: 'historical',
    era: 'ancient',
    narrative_beats: { beginning: 'begin' },
    version: 1,
    created_at: now,
    updated_at: now,
  } as any);

  db.saveAndMergeCharacters(projectId, [{ name: 'Known Character', version: 1 } as any]);
  db.saveAndMergeLocations(projectId, [{ name: 'Known Location', version: 1 } as any]);
  db.saveScenes(projectId, Array.from({ length: 6 }, (_, index) => ({
    scene_number: index + 1,
    title: `Scene ${index + 1}`,
    duration_sec: 10,
    story_purpose: 'fixture',
    location_name: `Missing Location ${index + 1}`,
    time_of_day: 'day',
    character_names: ['Known Character'],
    emotional_objective: 'fixture',
    event: 'fixture',
    narrative_function: 'fixture',
    version: 1,
    updated_at: now,
  } as any)));

  const runContext = createGenerationRunContext(projectId, 2);
  const result = await runOrchestratedPipeline({ projectId, runContext });

  assert(result.runId === runContext.runId, 'run id must be carried through Pipeline result');
  const telemetry = db.getTelemetry(projectId);
  const runSummary = telemetry.find((entry) => entry.run_id === runContext.runId && entry.summary_type === 'run');
  const sceneSummary = telemetry.find((entry) => entry.run_id === runContext.runId && entry.summary_type === 'scene');

  assert(runSummary, 'run-level summary telemetry must exist');
  assert(runSummary.summary?.effective_concurrency === 2, `run summary should include effective_concurrency=2, got ${runSummary.summary?.effective_concurrency}`);
  assert(runSummary.summary?.total_scenes === 6, `run summary should include total_scenes=6, got ${runSummary.summary?.total_scenes}`);
  assert(Array.isArray(runSummary.summary?.completion_order), 'run summary should include completion_order array');
  assert(sceneSummary, 'scene-level summary telemetry must exist');
  assert(typeof sceneSummary.summary?.scene_duration_ms === 'number', 'scene summary should include scene_duration_ms');
  assert(['READY', 'BLOCKED', 'FAILED'].includes(String(sceneSummary.summary?.scene_status || '')), 'scene summary should include a final status');
}

async function assertTelemetryFailureIsNonBlocking(): Promise<void> {
  const projectId = `r3_2_nonblocking_${Date.now()}`;
  const now = new Date().toISOString();

  const originalAddTelemetry = db.addTelemetry.bind(db);
  const originalAddLog = db.addLog.bind(db);

  try {
    db.saveProject({
      id: projectId,
      title: 'R3.2 telemetry failure fixture',
      raw_script: 'Six scene production path fixture',
      total_duration_target_sec: 60,
      max_scene_shot_duration_sec: 10,
      scene_duration_sec: 10,
      prompt_language: 'en',
      image_model: 'nano_banana_pro',
      video_model: ['veo'],
      include_seedance_format: false,
      created_at: now,
      updated_at: now,
      status: 'draft',
      current_stage: 0,
    } as any);

    db.saveProjectFoundation({
      project_id: projectId,
      genre: 'historical',
      era: 'ancient',
      narrative_beats: { beginning: 'begin' },
      version: 1,
      created_at: now,
      updated_at: now,
    } as any);

    db.saveAndMergeCharacters(projectId, [{ name: 'Known Character', version: 1 } as any]);
    db.saveAndMergeLocations(projectId, [{ name: 'Known Location', version: 1 } as any]);
    db.saveScenes(projectId, Array.from({ length: 2 }, (_, index) => ({
      scene_number: index + 1,
      title: `Scene ${index + 1}`,
      duration_sec: 10,
      story_purpose: 'fixture',
      location_name: `Missing Location ${index + 1}`,
      time_of_day: 'day',
      character_names: ['Known Character'],
      emotional_objective: 'fixture',
      event: 'fixture',
      narrative_function: 'fixture',
      version: 1,
      updated_at: now,
    } as any)));

    (db as any).addTelemetry = () => { throw new Error('telemetry failure injected'); };
    (db as any).addLog = () => { throw new Error('log failure injected'); };

    const runContext = createGenerationRunContext(projectId, 2);
    const result = await runOrchestratedPipeline({ projectId, runContext });

    assert(result.runId === runContext.runId, 'run still returns the same run id even when telemetry fails');
    assert(db.getProject(projectId)?.status === 'blocked' || db.getProject(projectId)?.status === 'failed' || db.getProject(projectId)?.status === 'completed', 'pipeline must still finish even if telemetry logging fails');
  } finally {
    (db as any).addTelemetry = originalAddTelemetry;
    (db as any).addLog = originalAddLog;
  }
}

async function main(): Promise<void> {
  await assertMetricsSummaryIsProduced();
  await assertTelemetryFailureIsNonBlocking();
  console.log('PATCH 6.0-R3.2 metrics assertions: PASS');
}

main().catch((error) => {
  console.error('PATCH 6.0-R3.2 metrics assertions: FAIL');
  console.error(error);
  process.exitCode = 1;
});
