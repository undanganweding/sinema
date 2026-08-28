import fs from 'fs';
import path from 'path';
import { db } from './db';
import { createSceneAssetCoverageReport } from './scene_asset_integrity_engine';
import { generateAllScenes, runPipelineForScene } from './orchestrator';

const SOURCE_PROJECT_ID = 'proj_1787947530575_f89kdp';
const STORE = path.join(process.cwd(), 'data', 'firestore_store.json');
const BACKUP = `${STORE}.r2fixturebak`;
const DIAGNOSTIC_FILE = path.join(process.cwd(), 'r2-s6-diagnostic.jsonl');
const DIAGNOSTIC_TIMEOUT_MS = 20_000;
const RESULT_FILE = path.join(process.cwd(), 'r2-s6-result.json');
const DETERMINISM_FILE = path.join(process.cwd(), 'r2-determinism-result.jsonl');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function cloneGenuineFixture(fixtureProjectId: string): void {
  const source = db.getProject(SOURCE_PROJECT_ID);
  assert(source, `source project ${SOURCE_PROJECT_ID} exists`);
  const sourceScenes = db.getScenes(SOURCE_PROJECT_ID);
  assert(sourceScenes.length === 6, `source has six genuine scenes (${sourceScenes.length})`);

  const now = new Date().toISOString();
  db.saveProject({
    ...source,
    id: fixtureProjectId,
    title: 'R2 genuine six-scene Asset Integrity fixture',
    status: 'draft',
    current_stage: 0,
    foundation_status: 'ready',
    assetIntegrityReports: [],
    continuityState: source.continuityState ? JSON.parse(JSON.stringify(source.continuityState)) : null,
    finalizationReport: undefined,
    created_at: now,
    updated_at: now,
  } as any);

  const foundation = db.getProjectFoundation(SOURCE_PROJECT_ID);
  assert(foundation, 'source foundation exists');
  db.saveProjectFoundation({ ...foundation, project_id: fixtureProjectId } as any);

  db.saveAndMergeCharacters(fixtureProjectId, db.getCharacters(SOURCE_PROJECT_ID).map(({ id, project_id, version, created_at, updated_at, ...character }) => character as any));
  db.saveAndMergeLocations(fixtureProjectId, [
    ...db.getLocations(SOURCE_PROJECT_ID).map(({ id, project_id, version, created_at, updated_at, ...location }) => location as any),
    {
      name: 'Ambang Pintu Kediaman',
      era: 'Abad ke-6 Masehi (Jahiliyah)',
      architecture: 'Ambang pintu kayu kasar pada rumah bata lumpur dengan lantai tanah padat.',
      environment: 'Eksterior domestik, teduh, dan tenang.',
      landscape: 'Menghadap jalur permukiman Makkah yang berbatu dan berpasir.',
      climate: 'Kering dan berdebu dengan udara malam yang sejuk.',
      culture: 'Hunian sederhana masyarakat Quraisy pra-Islam.',
      lighting_style: 'Cahaya alami lembut dari pintu rumah dan cahaya senja.',
      color_palette: ['#C2B280', '#8B4513', '#D2B48C'],
      material: 'Kayu tua, batu bata lumpur, kain tenun kasar, dan tanah padat',
    },
    {
      name: 'Pemandangan Kota Makkah',
      era: 'Abad ke-6 Masehi (Jahiliyah)',
      architecture: 'Permukiman rumah bata lumpur dan batu dengan jalur sempit alami.',
      environment: 'Eksterior terbuka dengan cakrawala gurun.',
      landscape: 'Perbukitan batu dan lembah kering di sekitar Makkah.',
      climate: 'Kering, hangat, dan berangin gurun.',
      culture: 'Lanskap permukiman Makkah pra-Islam.',
      lighting_style: 'Cahaya senja hangat yang memanjang di atas lembah.',
      color_palette: ['#E3C565', '#A0522D', '#D2B48C'],
      material: 'Batu alam, pasir, bata lumpur, dan kayu lapuk',
    },
  ] as any);

  db.saveScenes(fixtureProjectId, sourceScenes.map(({ id, project_id, version, created_at, updated_at, status, pipeline_status, blockers, ...scene }) => ({
    ...scene,
    status: 'draft',
    pipeline_status: 'PENDING',
    blockers: [],
  })) as any);
}

function verifyAssetIntegrity(fixtureProjectId: string): void {
  const project = db.getProject(fixtureProjectId);
  assert(project, 'fixture project exists');
  const scenes = db.getScenes(fixtureProjectId);
  const reports = scenes.map((scene) => createSceneAssetCoverageReport(
    scene,
    db.getCharacters(fixtureProjectId),
    db.getLocations(fixtureProjectId),
    db.getObjects(fixtureProjectId),
    project.contextPackage || null,
    null,
  ));
  assert(reports.length === 6, `fixture contains six scenes (${reports.length})`);
  assert(reports.every((report) => report.status === 'PASS'), `Asset Integrity preflight is 6/6 PASS (${reports.filter((report) => report.status === 'PASS').length}/6)`);
  console.log(`FIXTURE PREFLIGHT: 6/6 PASS; project=${fixtureProjectId}`);
}

async function diagnoseScene(scene: ReturnType<typeof db.getScenes>[number]): Promise<void> {
  let lastProgress: Record<string, unknown> = { phase: 'before-runPipelineForScene' };
  const progress = (stage: number, stageName: string, message: string, level?: string) => {
    lastProgress = { phase: 'progress', stage, stageName, message, level };
  };
  const run = runPipelineForScene(scene.id!, progress, null);
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`DIAGNOSTIC_TIMEOUT after ${DIAGNOSTIC_TIMEOUT_MS}ms; lastProgress=${JSON.stringify(lastProgress)}`)), DIAGNOSTIC_TIMEOUT_MS);
  });
  try {
    const result = await Promise.race([run, timeout]);
    console.log(`SCENE ${scene.scene_number} S6 DIAGNOSTIC: ${JSON.stringify({ sceneId: scene.id, sceneNumber: scene.scene_number, status: result.status, error: result.error, blockers: result.blockers, lastProgress })}`);
  } catch (error) {
    console.log(`SCENE ${scene.scene_number} S6 DIAGNOSTIC: ${JSON.stringify({ sceneId: scene.id, sceneNumber: scene.scene_number, status: 'DIAGNOSTIC_TIMEOUT_OR_EXCEPTION', error: error instanceof Error ? error.message : String(error), lastProgress })}`);
  }
}

function normalizeContinuityState(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeContinuityState);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !['createdAt', 'updatedAt', 'created_at', 'updated_at', 'timestamp', 'id', 'project_id'].includes(key))
    .map(([key, entry]) => [key, normalizeContinuityState(entry)]));
}

function completionOrder(projectId: string): number[] {
  return db.getLogs(projectId)
    .filter((log) => log.stage_code === 'S6' && log.level === 'success')
    .map((log) => log.message.match(/Scene #(\d+): Validasi/)?.[1])
    .filter((sceneNumber): sceneNumber is string => Boolean(sceneNumber))
    .map(Number);
}

async function runDeterminismRun(label: string, projectId: string): Promise<{ order: number[]; continuity: unknown; s6: Set<number> }> {
  cloneGenuineFixture(projectId);
  verifyAssetIntegrity(projectId);
  const originalSetTimeout = globalThis.setTimeout;
  let pacingTimerCount = 0;
  if (label === 'RUN B') {
    globalThis.setTimeout = ((callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
      if (delay === 750) return originalSetTimeout(callback, 0, ...args);
      if (delay === 500) {
        pacingTimerCount += 1;
        return originalSetTimeout(callback, pacingTimerCount % 2 === 1 ? 1200 : 0, ...args);
      }
      return originalSetTimeout(callback, delay, ...args);
    }) as typeof globalThis.setTimeout;
  }
  try {
    await generateAllScenes(projectId, 2);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
  const order = completionOrder(projectId);
  const s6 = new Set(order);
  const continuity = normalizeContinuityState(db.getProject(projectId)?.continuityState || null);
  const record = { label, projectId, completionOrder: order, s6Completed: s6.size, continuity };
  fs.appendFileSync(DETERMINISM_FILE, `${JSON.stringify(record)}\n`);
  console.log(`${label}: ${JSON.stringify(record)}`);
  return { order, continuity, s6 };
}

async function main(): Promise<void> {
  if (fs.existsSync(STORE)) fs.copyFileSync(STORE, BACKUP);
  try {
    const fixtureProjectId = `r2_fixture_${Date.now()}`;
    if (process.argv.includes('--determinism')) {
      fs.rmSync(DETERMINISM_FILE, { force: true });
      const runA = await runDeterminismRun('RUN A', `${fixtureProjectId}_a`);
      const runB = await runDeterminismRun('RUN B', `${fixtureProjectId}_b`);
      assert(runA.s6.size === 6, `Run A completed S6 for six scenes (${runA.s6.size}/6)`);
      assert(runB.s6.size === 6, `Run B completed S6 for six scenes (${runB.s6.size}/6)`);
      assert(runA.order.length === 6 && runB.order.length === 6, 'both runs recorded six completion events');
      assert(JSON.stringify(runA.order) !== JSON.stringify(runB.order), `completion order differs (A=${runA.order.join(',')}; B=${runB.order.join(',')})`);
      assert(JSON.stringify(runA.continuity) === JSON.stringify(runB.continuity), 'normalized aggregate continuity states are structurally identical');
      console.log('DETERMINISM: PASS');
      fs.appendFileSync(DETERMINISM_FILE, `${JSON.stringify({ verdict: 'PASS' })}\n`);
      return;
    }
    cloneGenuineFixture(fixtureProjectId);
    verifyAssetIntegrity(fixtureProjectId);
    if (process.argv.includes('--diagnose')) {
      fs.rmSync(DIAGNOSTIC_FILE, { force: true });
      const requestedScene = Number(process.argv.find((argument) => argument.startsWith('--scene='))?.split('=')[1]);
      const scenesToDiagnose = Number.isInteger(requestedScene)
        ? db.getScenes(fixtureProjectId).filter((scene) => scene.scene_number === requestedScene)
        : db.getScenes(fixtureProjectId);
      assert(scenesToDiagnose.length > 0, `requested diagnostic scene exists (${requestedScene})`);
      for (const scene of scenesToDiagnose) {
        await diagnoseScene(scene);
      }
      return;
    }
    if (process.env.RUN_S6 === '1' || process.argv.includes('--s6')) {
      const result = await generateAllScenes(fixtureProjectId, 2);
      const sceneStatuses = db.getScenes(fixtureProjectId).map((scene) => ({
        scene: scene.scene_number,
        status: scene.status,
        pipeline: scene.pipeline_status,
        blockers: scene.blockers,
      }));
      const s6Logs = db.getLogs(fixtureProjectId)
        .filter((log) => log.stage_code === 'S6')
        .map((log) => ({ level: log.level, message: log.message }));
      const completedS6Scenes = new Set(
        db.getLogs(fixtureProjectId)
          .filter((log) => log.stage_code === 'S6' && log.level === 'success' && /Scene #(\d+): Validasi/.test(log.message))
          .map((log) => log.message.match(/Scene #(\d+):/)?.[1])
          .filter((sceneNumber): sceneNumber is string => Boolean(sceneNumber)),
      );
      fs.writeFileSync(RESULT_FILE, JSON.stringify({ result, sceneStatuses, s6Logs }, null, 2));
      console.log(`FIXTURE S6 RESULT: ${JSON.stringify({ result, sceneStatuses, s6Logs })}`);
      assert(result.totalScenes === 6, `S6 total scenes is six (${result.totalScenes})`);
      assert(completedS6Scenes.size === 6, `all six scenes completed Stage 6 (${completedS6Scenes.size}/6)`);
      console.log('FIXTURE S6: 6/6 Stage 6 completed with concurrency=2');
    }
  } finally {
    if (fs.existsSync(BACKUP)) {
      fs.copyFileSync(BACKUP, STORE);
      fs.unlinkSync(BACKUP);
    }
  }
}

main().catch((error) => {
  console.error('R2 FIXTURE ENGINEERING FAILED:', error);
  if (fs.existsSync(BACKUP)) {
    fs.copyFileSync(BACKUP, STORE);
    fs.unlinkSync(BACKUP);
  }
  process.exitCode = 1;
});