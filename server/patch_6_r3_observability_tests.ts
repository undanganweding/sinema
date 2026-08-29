import { db } from './db';
import { createGenerationRunContext, runOrchestratedPipeline } from './orchestrator';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function assertRunIdentity(): Promise<void> {
  const projectId = `r3_run_identity_${Date.now()}`;
  const runContext = createGenerationRunContext(projectId);

  assert(typeof runContext.runId === 'string' && runContext.runId.length > 0, 'runId must be a non-empty string');
  assert(runContext.projectId === projectId, 'projectId must match the run context');

  const event = await db.addLog(projectId, {
    stage: 6,
    stage_name: 'Scene Generation Pool',
    level: 'info',
    message: 'trace event',
    run_id: runContext.runId,
    scope: 'scene',
    stage_code: 'S6',
  } as any);

  assert(event.run_id === runContext.runId, 'log entries must include the run id');

  const telemetry = await db.addTelemetry(projectId, {
    project_id: projectId,
    scene_id: 'scene_1',
    stage: 6,
    stage_code: 'S6',
    scope: 'scene',
    attempt: 1,
    started_at: new Date().toISOString(),
    status: 'started',
    run_id: runContext.runId,
  } as any);

  assert(telemetry.run_id === runContext.runId, 'telemetry must preserve the run id');
}

async function assertRunIsolation(): Promise<void> {
  const projectId = `r3_run_isolation_${Date.now()}`;
  const runA = createGenerationRunContext(projectId);
  const runB = createGenerationRunContext(projectId);

  assert(runA.runId !== runB.runId, 'different runs must receive different run ids');

  await db.addLog(projectId, {
    stage: 1,
    stage_name: 'Run A',
    level: 'info',
    message: 'first run',
    run_id: runA.runId,
  } as any);

  await db.addLog(projectId, {
    stage: 1,
    stage_name: 'Run B',
    level: 'info',
    message: 'second run',
    run_id: runB.runId,
  } as any);

  const logs = await db.getLogs(projectId);
  assert(logs.some((entry) => entry.run_id === runA.runId && entry.message.includes('first run')), 'run A events must be traceable');
  assert(logs.some((entry) => entry.run_id === runB.runId && entry.message.includes('second run')), 'run B events must be traceable');
}

async function main(): Promise<void> {
  await assertRunIdentity();
  await assertRunIsolation();
  console.log('PATCH 6.0-R3 observability assertions: PASS');
}

main().catch((error) => {
  console.error('PATCH 6.0-R3 observability assertions: FAIL');
  console.error(error);
  process.exitCode = 1;
});
