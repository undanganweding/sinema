/**
 * Regression tests: reasoning_config.api_key must NEVER reach Firestore.
 *
 * Root cause (fixed): sanitizeProjectForStorage() previously set
 *   reasoning_config.api_key = undefined
 * which left the property present with an undefined value — invalid for
 * Firestore (Cannot use "undefined" as a Firestore value).
 *
 * Invariants under test:
 *  A. A project containing reasoning_config.api_key can be saved.
 *  B. The sanitized persistence payload contains NO reasoning_config.api_key
 *     property (not even undefined).
 *  C. No undefined value exists anywhere in the persisted project document.
 *  D. All other reasoning_config fields remain intact after sanitization.
 *  E. The ephemeral in-memory API key is re-attached on read, so the API
 *     response can still provide the key in-process.
 *  F. Local JSON fallback remains compatible (no api_key persisted to disk,
 *     and no undefined values in the JSON payload).
 */
import fs from 'fs';
import path from 'path';
import { db, sanitizeProjectForStorage, sanitizeForFirestore } from './db';

const STORE = path.join(process.cwd(), 'data', 'firestore_store.json');
const BACKUP = `${STORE}.apikeysanitizebak`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

/** Deep-walk a JSON-safe object; fail if any property value is undefined. */
function findUndefinedValue(node: unknown, trail = '$'): string | null {
  if (node === undefined) return trail;
  if (node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const hit = findUndefinedValue(node[i], `${trail}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    const hit = findUndefinedValue(v, `${trail}.${k}`);
    if (hit) return hit;
  }
  return null;
}

/** Deep-walk; return the trail of the first key named api_key, or null. */
function findApiKeyProperty(node: unknown, trail = '$'): string | null {
  if (node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const hit = findApiKeyProperty(node[i], `${trail}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === 'api_key') return `${trail}.${k}`;
    const hit = findApiKeyProperty(v, `${trail}.${k}`);
    if (hit) return hit;
  }
  return null;
}

function makeProject(projectId: string) {
  const now = new Date().toISOString();
  return {
    id: projectId,
    title: 'API key sanitization fixture',
    raw_script: 'Sanitization regression fixture script.',
    total_duration_target_sec: 60,
    max_scene_shot_duration_sec: 10,
    scene_duration_sec: 10,
    allow_final_scene_override: false,
    prompt_language: 'id' as const,
    ai_model: 'gemini-3.7-flash',
    reasoning_config: {
      provider_type: 'custom_openai',
      provider_name: 'Custom Provider',
      base_url: 'https://custom.invalid/v1',
      model_id: 'qwen/qwen-2.5-72b-instruct:free',
      display_name: 'Custom Qwen',
      api_key: 'sk-ephemeral-secret-value-12345',
    },
    image_model: 'nano_banana_pro',
    video_model: ['veo'],
    include_seedance_format: false,
    created_at: now,
    updated_at: now,
    status: 'draft',
    current_stage: 0,
    error_message: null,
    retry_count: 0,
  } as any;
}

async function main(): Promise<void> {
  // Back up the local JSON store so the test does not destroy local data.
  if (fs.existsSync(STORE)) fs.copyFileSync(STORE, BACKUP);

  const projectId = `apikey_sanitize_${Date.now()}`;
  const original = makeProject(projectId);

  // Directly assert sanitizeProjectForStorage (the exact payload passed to Firestore set()).
  const sanitized = sanitizeProjectForStorage(original);
  const sanitizedApiKeyTrail = findApiKeyProperty(sanitized);
  assert(sanitizedApiKeyTrail === null, `sanitizeProjectForStorage output has NO api_key property (found at ${sanitizedApiKeyTrail})`);
  const sanitizedUndefinedTrail = findUndefinedValue(sanitized);
  assert(sanitizedUndefinedTrail === null, `sanitizeProjectForStorage output has NO undefined value (found at ${sanitizedUndefinedTrail})`);
  assert(sanitized.reasoning_config?.provider_type === 'custom_openai', 'sanitized reasoning_config.provider_type preserved');
  assert(!('api_key' in (sanitized.reasoning_config || {})), 'api_key key is completely absent from sanitized reasoning_config');

  // A: project with api_key can be saved (JSON fallback path).
  const saved = await db.saveProject(original);
  assert(saved, 'saveProject returns the saved project');

  // E: ephemeral key is re-attached on the returned object.
  assert(
    saved.reasoning_config?.api_key === 'sk-ephemeral-secret-value-12345',
    'ephemeral api_key is re-attached on the saved/read object'
  );

  // B + C + F: inspect what was actually persisted to disk.
  const persisted = JSON.parse(fs.readFileSync(STORE, 'utf-8'));
  const doc = persisted.projects?.[projectId];
  assert(doc, 'project document exists in persisted JSON store');

  const apiKeyTrail = findApiKeyProperty(doc);
  assert(apiKeyTrail === null, `persisted document contains NO api_key property anywhere (found at ${apiKeyTrail})`);

  const undefinedTrail = findUndefinedValue(doc);
  assert(undefinedTrail === null, `persisted document contains NO undefined value (found at ${undefinedTrail})`);

  // D: all other reasoning_config fields survive sanitization.
  assert(doc.reasoning_config?.provider_type === 'custom_openai', 'reasoning_config.provider_type preserved');
  assert(doc.reasoning_config?.provider_name === 'Custom Provider', 'reasoning_config.provider_name preserved');
  assert(doc.reasoning_config?.base_url === 'https://custom.invalid/v1', 'reasoning_config.base_url preserved');
  assert(doc.reasoning_config?.model_id === 'qwen/qwen-2.5-72b-instruct:free', 'reasoning_config.model_id preserved');
  assert(doc.reasoning_config?.display_name === 'Custom Qwen', 'reasoning_config.display_name preserved');
  assert(
    !('api_key' in (doc.reasoning_config || {})),
    'reasoning_config object does not even contain an api_key key'
  );

  // E (cont): reading the project back re-attaches the ephemeral key in-process.
  const readBack = await db.getProject(projectId);
  assert(
    readBack?.reasoning_config?.api_key === 'sk-ephemeral-secret-value-12345',
    'getProject re-attaches the ephemeral api_key in-process'
  );

  // JSON store on disk must still contain no api_key even after read-back.
  const persistedAfterRead = JSON.parse(fs.readFileSync(STORE, 'utf-8'));
  const docAfterRead = persistedAfterRead.projects?.[projectId];
  const apiKeyTrailAfterRead = findApiKeyProperty(docAfterRead);
  assert(apiKeyTrailAfterRead === null, 'no api_key property appears on disk after getProject');
  const undefinedTrailAfterRead = findUndefinedValue(docAfterRead);
  assert(undefinedTrailAfterRead === null, 'no undefined value on disk after getProject');

  // Also exercise updateProject (second persistence path).
  const updated = await db.updateProject(projectId, (p) => {
    p.title = 'Updated title';
    p.reasoning_config = {
      ...p.reasoning_config,
      api_key: 'sk-second-ephemeral-value',
    } as any;
    return p;
  });
  assert(updated, 'updateProject returns the updated project');
  const persistedAfterUpdate = JSON.parse(fs.readFileSync(STORE, 'utf-8'));
  const docAfterUpdate = persistedAfterUpdate.projects?.[projectId];
  const apiKeyTrailAfterUpdate = findApiKeyProperty(docAfterUpdate);
  assert(apiKeyTrailAfterUpdate === null, 'no api_key property on disk after updateProject');
  const undefinedTrailAfterUpdate = findUndefinedValue(docAfterUpdate);
  assert(undefinedTrailAfterUpdate === null, 'no undefined value on disk after updateProject');
  assert(docAfterUpdate.title === 'Updated title', 'updateProject applied the update');

  console.log('PASS: api_key sanitization invariants hold on the JSON fallback path.');
  console.log('A. project with api_key saved successfully.');
  console.log('B. persisted payload has no reasoning_config.api_key property.');
  console.log('C. no undefined value in persisted document.');
  console.log('D. other reasoning_config fields intact.');
  console.log('E. ephemeral api_key re-attached in-process on save/read/update.');
  console.log('F. local JSON fallback compatible (no api_key on disk).');
}

main().catch((err) => {
  console.error('FAIL:', err?.message || err);
  process.exitCode = 1;
});
