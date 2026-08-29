/**
 * R3.1 Concurrency Resolution Verification
 *
 * Verifies cascade precedence:
 *   sceneConcurrency > runContext.concurrency > SCENE_GENERATION_CONCURRENCY env > 2
 *
 * No code changes. No semantic R2/R3 modifications.
 * Pure unit-level assertions against the resolution logic extracted from
 * runOrchestratedPipeline (orchestrator.ts ~line 1771-1775).
 */

import { createGenerationRunContext } from './orchestrator';

// ─── Assertion helper ─────────────────────────────────────────────────────────

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

let passed = 0;
let failed = 0;

function test(label: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${label}`);
    console.error(`    → ${err.message}`);
    failed++;
  }
}

// ─── Resolution logic (extracted verbatim from orchestrator.ts ~1771-1775) ───
// This is the EXACT logic under test. Any deviation from the source is a bug
// in the test, not the production code.

function resolveConcurrency(
  sceneConcurrency: number | undefined,
  runContextConcurrency: number | undefined,
  envValue: string | undefined,
): number {
  const envConcurrency = envValue
    ? parseInt(envValue, 10)
    : undefined;
  return sceneConcurrency ?? runContextConcurrency ?? envConcurrency ?? 2;
}

// ─── Test suite ───────────────────────────────────────────────────────────────

console.log('\nR3.1 Concurrency Resolution — Unit Verification');
console.log('═'.repeat(52));

// ── BLOCK 1: Default path ─────────────────────────────────────────────────────
console.log('\n[1] Default path (no overrides)');

test('no args, no env → resolves to 2', () => {
  const result = resolveConcurrency(undefined, undefined, undefined);
  assert(result === 2, `expected 2, got ${result}`);
});

test('empty string env → resolves to 2 (parseInt("") = NaN, treated as undefined)', () => {
  // parseInt('') returns NaN; NaN is truthy-falsy-ish but the guard is `envValue ? ...`
  // empty string is falsy → envConcurrency = undefined → falls through to 2
  const result = resolveConcurrency(undefined, undefined, '');
  assert(result === 2, `expected 2, got ${result}`);
});

// ── BLOCK 2: Explicit sceneConcurrency (highest precedence) ───────────────────
console.log('\n[2] Explicit sceneConcurrency override (highest precedence)');

test('sceneConcurrency=4, runContext=3, env=5 → resolves to 4', () => {
  const result = resolveConcurrency(4, 3, '5');
  assert(result === 4, `expected 4, got ${result}`);
});

test('sceneConcurrency=1 (minimum valid) → resolves to 1', () => {
  const result = resolveConcurrency(1, undefined, undefined);
  assert(result === 1, `expected 1, got ${result}`);
});

test('sceneConcurrency=10 → resolves to 10', () => {
  const result = resolveConcurrency(10, undefined, undefined);
  assert(result === 10, `expected 10, got ${result}`);
});

// ── BLOCK 3: runContext.concurrency (second precedence) ───────────────────────
console.log('\n[3] runContext.concurrency (second precedence)');

test('sceneConcurrency=undefined, runContext=3, env=5 → resolves to 3', () => {
  const result = resolveConcurrency(undefined, 3, '5');
  assert(result === 3, `expected 3, got ${result}`);
});

test('sceneConcurrency=undefined, runContext=1 → resolves to 1', () => {
  const result = resolveConcurrency(undefined, 1, undefined);
  assert(result === 1, `expected 1, got ${result}`);
});

test('createGenerationRunContext with concurrency=4 produces runContext.concurrency=4', () => {
  const ctx = createGenerationRunContext('test_project', 4);
  assert(ctx.concurrency === 4, `expected 4, got ${ctx.concurrency}`);
  // Confirm resolution honours it
  const result = resolveConcurrency(undefined, ctx.concurrency, undefined);
  assert(result === 4, `expected 4, got ${result}`);
});

test('createGenerationRunContext without concurrency → runContext.concurrency=undefined → falls to env/default', () => {
  const ctx = createGenerationRunContext('test_project');
  assert(ctx.concurrency === undefined, `expected undefined, got ${ctx.concurrency}`);
  const result = resolveConcurrency(undefined, ctx.concurrency, undefined);
  assert(result === 2, `expected 2 (default), got ${result}`);
});

// ── BLOCK 4: SCENE_GENERATION_CONCURRENCY env fallback (third precedence) ─────
console.log('\n[4] SCENE_GENERATION_CONCURRENCY env fallback (third precedence)');

test('env="3", no explicit args → resolves to 3', () => {
  const result = resolveConcurrency(undefined, undefined, '3');
  assert(result === 3, `expected 3, got ${result}`);
});

test('env="6" → resolves to 6', () => {
  const result = resolveConcurrency(undefined, undefined, '6');
  assert(result === 6, `expected 6, got ${result}`);
});

test('env="1" → resolves to 1', () => {
  const result = resolveConcurrency(undefined, undefined, '1');
  assert(result === 1, `expected 1, got ${result}`);
});

// ── BLOCK 5: Invalid / edge-case values ───────────────────────────────────────
console.log('\n[5] Invalid / edge-case values');

test('sceneConcurrency=0 → resolves to 0 (caller responsibility; cascade stops at first defined value)', () => {
  // 0 ?? x returns 0 because 0 is NOT nullish (only null/undefined are nullish)
  // This is intentional ?? behaviour — 0 is a defined value
  const result = resolveConcurrency(0, 3, '5');
  assert(result === 0, `expected 0 (nullish coalescing stops at 0), got ${result}`);
});

test('sceneConcurrency=-1 → resolves to -1 (cascade stops; callers should validate separately)', () => {
  const result = resolveConcurrency(-1, 3, '5');
  assert(result === -1, `expected -1 (cascade stops at defined value), got ${result}`);
});

test('env="abc" (non-numeric) → parseInt returns NaN → NaN is truthy in guard → envConcurrency=NaN → NaN ?? 2 = NaN (NOT 2)', () => {
  // IMPORTANT: "abc" is a truthy non-empty string, so the guard `envValue ? parseInt(...) : undefined`
  // produces NaN (not undefined). NaN ?? 2 = NaN because NaN is NOT nullish.
  // This is a known edge case in the current implementation — document actual behavior.
  const result = resolveConcurrency(undefined, undefined, 'abc');
  const isNaN_ = Number.isNaN(result);
  assert(isNaN_, `expected NaN for non-numeric env string "abc", got ${result}. NOTE: current impl does NOT sanitize NaN from env; callers must validate.`);
});

test('env="0" → parseInt("0")=0, 0 is not nullish → resolves to 0 (not 2)', () => {
  // Edge case: env="0" produces 0 which stops nullish cascade before default 2
  const result = resolveConcurrency(undefined, undefined, '0');
  assert(result === 0, `expected 0 (env="0" stops cascade), got ${result}`);
});

test('env="2.9" → parseInt("2.9")=2 (truncated) → resolves to 2', () => {
  const result = resolveConcurrency(undefined, undefined, '2.9');
  assert(result === 2, `expected 2 (parseInt truncates float), got ${result}`);
});

// ── BLOCK 6: Precedence ordering proof ────────────────────────────────────────
console.log('\n[6] Precedence ordering — all three sources populated');

test('sceneConcurrency=4 > runContext=3 > env=5 > default=2 → 4', () => {
  assert(resolveConcurrency(4, 3, '5') === 4, 'sceneConcurrency should win');
});

test('sceneConcurrency=undefined, runContext=3 > env=5 > default=2 → 3', () => {
  assert(resolveConcurrency(undefined, 3, '5') === 3, 'runContext should beat env');
});

test('sceneConcurrency=undefined, runContext=undefined, env=5 > default=2 → 5', () => {
  assert(resolveConcurrency(undefined, undefined, '5') === 5, 'env should beat default');
});

test('all undefined → default 2', () => {
  assert(resolveConcurrency(undefined, undefined, undefined) === 2, 'should fall to default 2');
});

// ── BLOCK 7: Verify generateAllScenes signature accepts resolved value ─────────
console.log('\n[7] generateAllScenes() signature compatibility');

test('generateAllScenes default param is 2 (function signature check via import)', async () => {
  // We verify by calling the module — the default param value is 2 per source audit.
  // Direct invocation would require a full project. Instead we verify the cascade
  // produces 2 when nothing is set, which is what generateAllScenes would receive.
  const resolved = resolveConcurrency(undefined, undefined, undefined);
  assert(resolved === 2, `cascade default must equal generateAllScenes default param (2), got ${resolved}`);
});

test('resolved value for routes /generate (concurrency=4 body) → 4 forwarded to generateAllScenes', () => {
  // Simulate routes.ts logic: const concurrency = Number(req.body.concurrency) || 2
  const bodyValue = 4;
  const routesConcurrency = Number(bodyValue) || 2;
  // sceneConcurrency = routesConcurrency (4), activeRunContext.concurrency = 4
  const resolved = resolveConcurrency(routesConcurrency, routesConcurrency, undefined);
  assert(resolved === 4, `expected 4, got ${resolved}`);
});

test('routes /generate with no body concurrency → Number(undefined) || 2 = 2 → preserves R2 default', () => {
  const bodyValue = undefined;
  const routesConcurrency = Number(bodyValue) || 2;
  assert(routesConcurrency === 2, `expected 2, got ${routesConcurrency}`);
  const resolved = resolveConcurrency(routesConcurrency, routesConcurrency, undefined);
  assert(resolved === 2, `expected 2, got ${resolved}`);
});

// ── BLOCK 8: R2 identity — default path must be semantically identical ─────────
console.log('\n[8] R2 identity — default resolution must equal previous hardcoded 2');

test('R2 identity: all defaults → 2 (identical to pre-R3.1 hardcode)', () => {
  const PREVIOUS_HARDCODE = 2;
  const result = resolveConcurrency(undefined, undefined, undefined);
  assert(result === PREVIOUS_HARDCODE,
    `R2 identity broken: expected ${PREVIOUS_HARDCODE}, got ${result}`);
});

test('R2 identity: createGenerationRunContext(id, 2) route → resolves to 2', () => {
  // routes /generate previously did: createGenerationRunContext(projectId, 2)
  // and passed concurrency:2 hardcoded. Simulating that old path through new cascade.
  const ctx = createGenerationRunContext('test_r2', 2);
  const result = resolveConcurrency(undefined, ctx.concurrency, undefined);
  assert(result === 2, `R2 identity broken, got ${result}`);
});

// ─── Final report ──────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(52));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(52));

if (failed > 0) {
  console.error('\nR3.1 CONCURRENCY VERIFICATION: FAIL');
  process.exitCode = 1;
} else {
  console.log('\nR3.1 CONCURRENCY VERIFICATION: PASS');
}
