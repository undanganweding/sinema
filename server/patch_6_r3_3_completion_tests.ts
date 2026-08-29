/**
 * PATCH 6.0-R3.3 — Completion State Integrity Tests
 *
 * Uses the same tsx-compatible inline assertion pattern as R2/R3.1/R3.2 suites.
 *
 * Tests:
 *  A. blocked_scenes calculation is always >= 0 and sums correctly
 *  B. Completion ordering: persistence before finished event (structural source check)
 *  C. Finished SSE payload carries required fields (structural source check)
 *  D. Run ID isolation in frontend (structural source check)
 *  E. SSE disconnect: persisted state readable independently
 *  F. Telemetry non-blocking wrappers exist
 *  G. R3.2 blocked count formula correction confirmed
 */

import * as fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import * as pathMod from 'path';
import { createGenerationRunContext } from './orchestrator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathMod.dirname(__filename);

// ─── Assertion helper ─────────────────────────────────────────────────────────
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${name}\n    ${err?.message}`);
    failed++;
  }
}

const ORCHESTRATOR = pathMod.join(__dirname, 'orchestrator.ts');
const ROUTES = pathMod.join(__dirname, 'routes.ts');
const APP = pathMod.join(__dirname, '../src/App.tsx');

const orchestratorSrc = fs.readFileSync(ORCHESTRATOR, 'utf-8');
const routesSrc = fs.readFileSync(ROUTES, 'utf-8');
const appSrc = fs.readFileSync(APP, 'utf-8');

// ─── Helper: compute blocked using R3.3 formula ───────────────────────────────
function computeBlocked(total: number, ready: number, failed: number): number {
  return total - ready - failed;
}

// ─── Run tests ────────────────────────────────────────────────────────────────
const allTests: Promise<void>[] = [];

console.log('\nPATCH 6.0-R3.3 Completion State Integrity');
console.log('══════════════════════════════════════════════\n');

// ── A. blocked_scenes calculation ────────────────────────────────────────────
console.log('[A] blocked_scenes calculation');

const cases = [
  { total: 6, ready: 6, failed: 0, expected: 0, label: '6 READY → blocked=0' },
  { total: 6, ready: 4, failed: 0, expected: 2, label: '4 READY + 2 BLOCKED → blocked=2' },
  { total: 6, ready: 5, failed: 1, expected: 0, label: '5 READY + 1 FAILED → blocked=0' },
  { total: 6, ready: 3, failed: 1, expected: 2, label: '3 READY + 2 BLOCKED + 1 FAILED → blocked=2' },
  { total: 6, ready: 0, failed: 0, expected: 6, label: '0 READY 0 FAILED (historic -6 bug) → blocked=6' },
  { total: 5, ready: 0, failed: 5, expected: 0, label: '5 FAILED → blocked=0' },
  { total: 1, ready: 1, failed: 0, expected: 0, label: '1 READY → blocked=0' },
];

for (const tc of cases) {
  allTests.push(test(tc.label, () => {
    const blocked = computeBlocked(tc.total, tc.ready, tc.failed);
    assert(blocked === tc.expected, `expected blocked=${tc.expected}, got ${blocked}`);
    assert(blocked >= 0, `blocked must be >= 0, got ${blocked}`);
    assert(tc.ready + blocked + tc.failed === tc.total,
      `ready(${tc.ready}) + blocked(${blocked}) + failed(${tc.failed}) must equal total(${tc.total})`);
  }));
}

// ── B. Completion ordering (structural) ──────────────────────────────────────
console.log('\n[B] Completion ordering');

allTests.push(test('finished SSE lives inside .then() of pipeline call in routes.ts', () => {
  const thenIdx = routesSrc.indexOf('.then((result) => {');
  const finishedIdx = routesSrc.indexOf("type: 'finished'");
  assert(thenIdx !== -1, '.then block must exist in routes.ts');
  assert(finishedIdx !== -1, "type: 'finished' must exist in routes.ts");
  assert(finishedIdx > thenIdx, "finished event must appear after .then( block — fires only after pipeline resolves");
}));

allTests.push(test('runOrchestratedPipeline calls db.saveProject before return statement', () => {
  const fnStart = orchestratorSrc.indexOf('export async function runOrchestratedPipeline(');
  assert(fnStart !== -1, 'runOrchestratedPipeline must exist');
  const fnBody = orchestratorSrc.slice(fnStart);
  const saveIdx = fnBody.indexOf('db.saveProject(');
  const returnIdx = fnBody.indexOf('return {');
  assert(saveIdx !== -1, 'db.saveProject must be called inside runOrchestratedPipeline');
  assert(saveIdx < returnIdx, 'db.saveProject must appear before the return statement');
}));

allTests.push(test('generateAllScenes calls db.saveProject before returning readyCount', () => {
  const fnStart = orchestratorSrc.indexOf('export async function generateAllScenes(');
  assert(fnStart !== -1, 'generateAllScenes must exist');
  const fnBody = orchestratorSrc.slice(fnStart);
  const saveIdx = fnBody.indexOf('db.saveProject(');
  // The final return carries readyScenes/failedScenes — look for that specific shape
  const returnIdx = fnBody.indexOf('readyScenes: readyCount');
  assert(saveIdx !== -1, 'db.saveProject must be called inside generateAllScenes');
  assert(returnIdx !== -1, 'readyScenes: readyCount must exist in generateAllScenes return');
  assert(saveIdx < returnIdx, 'db.saveProject must precede the return statement in generateAllScenes');
}));

// ── C. Finished SSE payload fields ───────────────────────────────────────────
console.log('\n[C] SSE finished event payload');

allTests.push(test('/generate finished event includes runId field', () => {
  const generateBlock = routesSrc.slice(
    routesSrc.indexOf("'/projects/:id/generate'"),
    routesSrc.indexOf("'/projects/:id/stream'")
  );
  assert(generateBlock.includes("runId:"), '/generate finished event must carry runId');
  assert(generateBlock.includes("type: 'finished'"), '/generate finished event must have type finished');
  assert(generateBlock.includes("success:"), '/generate finished event must carry success');
}));

allTests.push(test('/generate-scenes finished event includes runId field', () => {
  const scenesBlock = routesSrc.slice(
    routesSrc.indexOf("'/projects/:id/generate-scenes'"),
    routesSrc.indexOf("'/projects/:id/telemetry'")
  );
  assert(scenesBlock.includes("runId:"), '/generate-scenes finished event must carry runId');
  assert(scenesBlock.includes("type: 'finished'"), '/generate-scenes finished event must have type finished');
}));

allTests.push(test('/initialize-foundation finished event has success field', () => {
  const initBlock = routesSrc.slice(
    routesSrc.indexOf("'/projects/:id/initialize-foundation'"),
    routesSrc.indexOf("'/projects/:id/generate-scenes'")
  );
  assert(initBlock.includes("type: 'finished'"), '/initialize-foundation finished event must have type finished');
  assert(initBlock.includes("success:"), '/initialize-foundation finished event must carry success');
}));

// ── D. Run ID isolation in frontend ──────────────────────────────────────────
console.log('\n[D] Run ID isolation (frontend)');

allTests.push(test('App.tsx declares activeRunId state', () => {
  assert(appSrc.includes('activeRunId'), 'App.tsx must declare activeRunId');
  assert(appSrc.includes('setActiveRunId'), 'App.tsx must have setActiveRunId setter');
}));

allTests.push(test('App.tsx guards finished handler with run ID check', () => {
  assert(appSrc.includes('data.runId === activeRunId'),
    'App.tsx must guard finished event handler with data.runId === activeRunId');
}));

allTests.push(test('App.tsx sets activeRunId from progress events', () => {
  assert(appSrc.includes('setActiveRunId(data.runId)'),
    'App.tsx must update activeRunId when progress event carries runId');
}));

allTests.push(test('App.tsx sets activeRunId from init event', () => {
  assert(appSrc.includes('setActiveRunId(data.project.latest_run_id)'),
    'App.tsx must set activeRunId from init event project.latest_run_id');
}));

// ── E. SSE disconnect safety ──────────────────────────────────────────────────
console.log('\n[E] SSE disconnect safety');

allTests.push(test('GET /projects/:id exists for independent state recovery', () => {
  assert(routesSrc.includes("apiRouter.get('/projects/:id'"),
    'GET /projects/:id must exist for state recovery after SSE disconnect');
}));

allTests.push(test('SSE /stream sends init event with current persisted project state', () => {
  const streamBlock = routesSrc.slice(routesSrc.indexOf("'/projects/:id/stream'"));
  assert(streamBlock.includes("type: 'init'"), 'stream must send init event');
  assert(streamBlock.includes('db.getLogs(id)'), 'stream init must include persisted logs');
  assert(streamBlock.includes('db.getProject(id)'), 'stream init must include persisted project');
}));

// ── F. Telemetry non-blocking wrappers ───────────────────────────────────────
console.log('\n[F] Telemetry non-blocking wrappers');

allTests.push(test('safeAddLog wraps db.addLog in try/catch', () => {
  const fnStart = orchestratorSrc.indexOf('function safeAddLog(');
  assert(fnStart !== -1, 'safeAddLog must exist');
  const fnBody = orchestratorSrc.slice(fnStart, fnStart + 300);
  assert(fnBody.includes('try {'), 'safeAddLog must have try block');
  assert(fnBody.includes('} catch {'), 'safeAddLog must have catch block');
}));

allTests.push(test('safeAddTelemetry wraps db.addTelemetry in try/catch', () => {
  const fnStart = orchestratorSrc.indexOf('function safeAddTelemetry(');
  assert(fnStart !== -1, 'safeAddTelemetry must exist');
  const fnBody = orchestratorSrc.slice(fnStart, fnStart + 300);
  assert(fnBody.includes('try {'), 'safeAddTelemetry must have try block');
  assert(fnBody.includes('} catch {'), 'safeAddTelemetry must have catch block');
}));

allTests.push(test('safePersistRunSummary wraps telemetry in try/catch', () => {
  const fnStart = orchestratorSrc.indexOf('function safePersistRunSummary(');
  assert(fnStart !== -1, 'safePersistRunSummary must exist');
  const fnBody = orchestratorSrc.slice(fnStart, fnStart + 600);
  assert(fnBody.includes('try {'), 'safePersistRunSummary must have try block');
  assert(fnBody.includes('} catch {'), 'safePersistRunSummary must have catch block');
}));

allTests.push(test('safePersistRunSummaryAtOrchestrator is non-blocking', () => {
  const fnStart = orchestratorSrc.indexOf('function safePersistRunSummaryAtOrchestrator(');
  assert(fnStart !== -1, 'safePersistRunSummaryAtOrchestrator must exist');
  // Capture the full function body by finding the closing brace after the try/catch
  const fnBody = orchestratorSrc.slice(fnStart, fnStart + 2200);
  assert(fnBody.includes('try {'), 'must have try block');
  assert(fnBody.includes('} catch {') || fnBody.includes('} catch{'), 'must have catch block');
  assert(fnBody.includes('// Observability must remain non-blocking'), 'must have non-blocking comment');
}));

// ── G. R3.2 blocked count formula correction ─────────────────────────────────
console.log('\n[G] R3.2 blocked count formula correction');

allTests.push(test('old broken formula is removed from orchestrator.ts', () => {
  const oldFormula = 'sceneResult.failedScenes - (sceneResult.totalScenes - sceneResult.readyScenes - sceneResult.failedScenes)';
  assert(!orchestratorSrc.includes(oldFormula), 'old broken blocked count formula must be removed');
}));

allTests.push(test('new correct formula (total - ready - failed) is present', () => {
  const newFormula = 'sceneResult.totalScenes - sceneResult.readyScenes - sceneResult.failedScenes';
  assert(orchestratorSrc.includes(newFormula), 'new correct blocked count formula must be present');
}));

allTests.push(test('createGenerationRunContext produces valid run_id', () => {
  const ctx = createGenerationRunContext('proj_test', 2);
  assert(typeof ctx.runId === 'string', 'runId must be a string');
  assert(ctx.runId.startsWith('run_'), 'runId must start with run_');
  assert(ctx.projectId === 'proj_test', 'projectId must match');
  assert(ctx.concurrency === 2, 'concurrency must match');
  assert(typeof ctx.startedAt === 'string', 'startedAt must be a string');
}));

// ── Report ────────────────────────────────────────────────────────────────────
Promise.all(allTests).then(() => {
  console.log('\n══════════════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════════');
  if (failed > 0) {
    console.log('\nPATCH 6.0-R3.3 COMPLETION TESTS: FAIL');
    process.exit(1);
  } else {
    console.log('\nPATCH 6.0-R3.3 COMPLETION TESTS: PASS');
  }
});
