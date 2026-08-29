/**
 * TEMPORARY DIRECT-FIRESTORE DIAGNOSTIC.
 *
 * Purpose: Run this inside the production runtime (same env/credentials/project
 * as the live API) to identify the EXACT operation that throws `5 NOT_FOUND`,
 * and to distinguish:
 *   A. database does not exist
 *   B. wrong credential / wrong project
 *   C. permission denied
 *   D. document absent
 *   E. query / index error
 *   F. code bug
 *
 * It NEVER logs secrets. Only projectId, databaseId (safe), collection names,
 * document id, Firestore error code/message/details.
 *
 * Usage (in the deployed function or locally with production env vars):
 *   npx tsx server/firestore_diagnostic.ts
 */

import { getFirestore, getDatabaseId, isFirestoreConfigured } from './firebase_admin';

const PROJECT_ID = 'nupress-bc617';
const TARGET_ID = 'proj_1788034549542_pyjbu5';

function safeErr(err: any): string {
  const code = err?.code ?? err?.status ?? err?.grpcStatusCode ?? 'n/a';
  const detail = err?.details ? ` details=${JSON.stringify(err.details)}` : '';
  return `code=${code} message="${err?.message ?? String(err)}"${detail}`;
}

async function probe(label: string, fn: () => Promise<any>): Promise<void> {
  try {
    const result = await fn();
    const count = Array.isArray(result) ? ` (${result.length} items)` : '';
    console.log(`[OK]   ${label}${count}`);
  } catch (err: any) {
    console.log(`[FAIL] ${label} -> ${safeErr(err)}`);
  }
}

async function main(): Promise<void> {
  console.log('=== FIRESTORE DIAGNOSTIC ===');
  console.log(`configured=${isFirestoreConfigured()}`);
  console.log(`projectId=${PROJECT_ID}`);
  console.log(`databaseId=${getDatabaseId()}`);

  const fsdb = getFirestore();

  // 1) Document existence read (doc absent must NOT throw; it returns exists=false).
  await probe('projects/{id} get', () => fsdb.collection('projects').doc(TARGET_ID).get());
  // 2) Project Foundation doc read.
  await probe('project_foundation/{id} get', () => fsdb.collection('project_foundation').doc(TARGET_ID).get());
  // 3) Simple equality query on a single field (no composite index needed).
  await probe('characters where(project_id==)', () =>
    fsdb.collection('characters').where('project_id', '==', TARGET_ID).get()
  );
  await probe('locations where(project_id==)', () =>
    fsdb.collection('locations').where('project_id', '==', TARGET_ID).get()
  );
  await probe('objects where(project_id==)', () =>
    fsdb.collection('objects').where('project_id', '==', TARGET_ID).get()
  );
  await probe('video_prompts where(project_id==)', () =>
    fsdb.collection('video_prompts').where('project_id', '==', TARGET_ID).get()
  );
  // 4) Equality + orderBy (REQUIRES composite index; missing index -> FAILED_PRECONDITION, not NOT_FOUND).
  await probe('scenes where(project_id==).orderBy(scene_number)', () =>
    fsdb.collection('scenes').where('project_id', '==', TARGET_ID).orderBy('scene_number', 'asc').get()
  );
  await probe('shots where(project_id==).orderBy(shot_number)', () =>
    fsdb.collection('shots').where('project_id', '==', TARGET_ID).orderBy('shot_number', 'asc').get()
  );
  // 5) Logs / telemetry subcollection reads (orderBy only, no equality filter).
  await probe('logs orderBy(timestamp)', () =>
    fsdb.collection(`projects/${TARGET_ID}/logs`).orderBy('timestamp', 'asc').get()
  );
  await probe('telemetry orderBy(started_at)', () =>
    fsdb.collection(`projects/${TARGET_ID}/telemetry`).orderBy('started_at', 'asc').get()
  );
  // 6) Story architecture / continuity docs.
  await probe('story_architectures/{id} get', () =>
    fsdb.collection('story_architectures').doc(TARGET_ID).get()
  );
  await probe('continuity_states/{id} get', () =>
    fsdb.collection('continuity_states').doc(TARGET_ID).get()
  );
}

main().then(() => {
  console.log('=== DIAGNOSTIC DONE ===');
  process.exit(0);
}).catch((err) => {
  console.error('Diagnostic bootstrap failed:', safeErr(err));
  process.exit(1);
});