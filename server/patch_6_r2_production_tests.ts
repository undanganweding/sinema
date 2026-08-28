import fs from 'fs';
import path from 'path';
import { createApp } from './app';
import { db } from './db';
import { resolveCurrentSceneStatus } from './orchestrator';

const PORT = 3136;
const BASE = `http://127.0.0.1:${PORT}`;
const STORE = path.join(process.cwd(), 'data', 'firestore_store.json');
const BACKUP = `${STORE}.r2productionbak`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function seedProject(): string {
  const projectId = `r2_production_${Date.now()}`;
  const now = new Date().toISOString();
  db.saveProject({
    id: projectId, title: 'R2 production path', raw_script: 'Six scene production path fixture',
    total_duration_target_sec: 60, max_scene_shot_duration_sec: 10, scene_duration_sec: 10,
    prompt_language: 'en', image_model: 'nano_banana_pro', video_model: ['veo'], include_seedance_format: false,
    created_at: now, updated_at: now, status: 'draft', current_stage: 0,
  } as any);
  db.saveProjectFoundation({
    project_id: projectId, genre: 'historical', era: 'ancient', narrative_beats: { beginning: 'begin' },
    version: 1, created_at: now, updated_at: now,
  } as any);
  db.saveAndMergeCharacters(projectId, [{ name: 'Known Character', version: 1 } as any]);
  db.saveAndMergeLocations(projectId, [{ name: 'Known Location', version: 1 } as any]);
  db.saveScenes(projectId, Array.from({ length: 6 }, (_, index) => ({
    scene_number: index + 1, title: `Scene ${index + 1}`, duration_sec: 10, story_purpose: 'fixture',
    location_name: `Missing Location ${index + 1}`, time_of_day: 'day', character_names: ['Known Character'],
    emotional_objective: 'fixture', event: 'fixture', narrative_function: 'fixture', version: 1, updated_at: now,
  } as any)));
  return projectId;
}

async function main(): Promise<void> {
  if (fs.existsSync(STORE)) fs.copyFileSync(STORE, BACKUP);
  const server = createApp().listen(PORT, '127.0.0.1');
  try {
    const projectId = seedProject();
    const start = await fetch(`${BASE}/api/projects/${projectId}/generate-scenes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concurrency: 2 }) });
    assert(start.status === 200, `route starts generation (HTTP ${start.status})`);

    let project: any;
    let fullData: any;
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      fullData = await (await fetch(`${BASE}/api/projects/${projectId}`)).json();
      project = fullData.project || fullData;
      if (project.status === 'blocked' || project.status === 'failed' || project.status === 'completed') break;
    }

    const scenes = Array.isArray(fullData.scenes) ? fullData.scenes : Object.values(project.scenes || {});
    assert(scenes.length === 6, `all six scenes remain in the queue (${scenes.length})`);
    assert(scenes.every((scene) => scene.pipeline_status === 'BLOCKED'), 'known Asset Integrity blockers return structured BLOCKED results');
    assert(scenes.every((scene) => scene.status === 'blocked'), 'blocked scenes are persisted independently');
    assert(project.status === 'blocked', `aggregate project status is blocked (${project.status})`);
    assert(project.finalizationReport?.status === 'BLOCKED', 'aggregate finalization is blocked');
    assert(resolveCurrentSceneStatus([{ code: 'CONTINUITY_BLOCKED', severity: 'BLOCKING', message: 'fixture', stage: 'FINAL' }], false) === 'BLOCKED', 'known blocker result is canonical BLOCKED');
    assert(resolveCurrentSceneStatus([], true) === 'FAILED', 'unexpected failure result is canonical FAILED');
    assert(!JSON.stringify(project.logs || {}).includes('error tidak tertangani'), 'known blockers do not become unhandled errors');

    console.log('PATCH 6.0-R2 production-path assertions: PASS');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (fs.existsSync(BACKUP)) {
      fs.copyFileSync(BACKUP, STORE);
      fs.unlinkSync(BACKUP);
    }
  }
}

main().catch((error) => {
  console.error('R2 PRODUCTION TEST FAILED:', error);
  if (fs.existsSync(BACKUP)) {
    fs.copyFileSync(BACKUP, STORE);
    fs.unlinkSync(BACKUP);
  }
  process.exitCode = 1;
});