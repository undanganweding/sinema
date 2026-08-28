/**
 * PATCH 5.5-R1 FASE 5 — runtime DoD regression harness.
 *
 * Run with: npm run test:fase5
 *
 * There is no unit-test framework in this repo (no vitest/jest/jsdom in
 * package.json), so instead of introducing one this drives the REAL express app
 * over REAL HTTP against the REAL file-backed store, then reads the result back
 * through the frontend's own accessor (src/lib/prompt_targets.getPersistedPrompt)
 * to prove the UI contract end to end.
 *
 * data/firestore_store.json is backed up before the run and restored in a
 * `finally` block, so the harness leaves no residue.
 */
import fs from 'fs';
import path from 'path';
import { createApp } from './server/app';
import { db } from './server/db';
import { getPersistedPrompt, PROMPT_EMPTY_MESSAGE, resolveRowTarget } from './src/lib/prompt_targets';
import { PromptTarget, Shot, VideoPrompt } from './src/types';

const PORT = 3123;
const BASE = `http://127.0.0.1:${PORT}`;
const STORE = path.join(process.cwd(), 'data', 'firestore_store.json');
const BACKUP = `${STORE}.e2ebak`;

const results: { id: string; ok: boolean; detail: string }[] = [];
function check(id: string, ok: boolean, detail: string) {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} :: ${detail}`);
}

async function post(url: string, body: unknown) {
  const res = await fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function seed() {
  const projectId = `proj_e2e_${Date.now()}`;
  db.saveProject({
    id: projectId,
    title: 'E2E Fase 5',
    // raw_script is required by db.getStoryArchitecture -> deriveStoryArchitecture,
    // which slices it; GET /api/projects/:id 500s without it.
    raw_script:
      'Fajar di Wadi. Zayd memimpin kafilah menuruni lembah sempit, berhenti di titik tersempit, lalu menatap punggung bukit timur tempat seorang pengintai telah mengawasi sejak cahaya pertama.',
    total_duration_target_sec: 60,
    max_scene_shot_duration_sec: 20,
    scene_duration_sec: 20,
    video_model: ['veo', 'gemini_omni'],
    include_seedance_format: true,
    prompt_language: 'id',
    status: 'draft',
    current_stage: 0,
    retry_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any);

  db.saveProjectFoundation({
    project_id: projectId,
    era: '7th century Arabian Peninsula',
    visual_style: 'Panavision 35mm anamorphic historical realism',
    color_palette: 'sun-bleached ochre, deep indigo shadow',
    lighting_style: 'hard directional dawn light with volumetric dust',
    camera_language: 'deliberate dolly and steady tracking, no handheld shake',
    historical_accuracy_notes: 'No modern textiles, no modern objects, period-accurate leather and linen.',
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any);

  db.saveAndMergeCharacters(projectId, [
    {
      name: 'Zayd',
      role: 'protagonist',
      physical_description:
        'Lean man in his early thirties, weathered olive skin, close-cropped black beard, deep-set brown eyes, a thin scar above the left brow.',
      costume: 'undyed linen tunic, dark indigo cloak, worn leather sandals and a coiled camel-hair belt',
      personality: 'watchful, disciplined, slow to speak',
      version: 1,
    } as any,
  ]);

  db.saveAndMergeLocations(projectId, [
    {
      name: 'Wadi Crossing',
      architectural_style: 'no architecture, natural sandstone ravine with wind-carved terraces',
      environment: 'dry riverbed, scattered acacia, fine drifting sand, distant basalt ridge',
      description: 'A narrow wadi that opens onto an ochre plain, deep shadow on the eastern wall at dawn.',
      version: 1,
    } as any,
  ]);

  const [scene] = db.saveScenes(projectId, [
    {
      scene_number: 1,
      title: 'Dawn Crossing',
      duration_sec: 20,
      story_purpose: 'Establish Zayd as a cautious guide and plant the watching scout.',
      location_name: 'Wadi Crossing',
      time_of_day: 'Dawn',
      character_names: ['Zayd'],
      emotional_objective: 'quiet dread beneath outward calm',
      event:
        'Zayd leads the caravan down into the wadi, halts at the narrow point, and scans the eastern ridge where a scout has been watching since first light.',
      narrative_function: 'inciting setup',
    } as any,
  ]);

  const sceneId = scene.id!;
  const shots = db.saveShots(sceneId, projectId, [
    {
      shot_number: 1,
      start_time_sec: 0,
      end_time_sec: 10,
      duration_sec: 10,
      event_detail:
        'Zayd halts at the narrow point of the wadi, raises an open hand to stop the caravan, and turns his head slowly toward the eastern ridge.',
      character_action:
        'Zayd tightens his grip on the lead rope, plants his forward foot, and lifts his chin to track movement on the ridge line.',
      camera_note: 'Slow dolly-in from a low three-quarter angle, settling on Zayd at chest height.',
      dialogue: [{ character_name: 'Zayd', line: 'Berhenti di sini. Jangan bergerak.' }],
      emotion: 'contained alarm',
      audio_note: 'Wind across sand, camel breath, distant loose gravel shifting on the ridge.',
      version: 1,
    } as any,
    {
      shot_number: 2,
      start_time_sec: 10,
      end_time_sec: 20,
      duration_sec: 10,
      event_detail:
        'The caravan waits in the shadow of the eastern wall while dust settles around the standing animals.',
      character_action: 'Zayd holds position, eyes fixed on the ridge, breathing shallow and steady.',
      camera_note: 'Static wide, caravan small against the sandstone wall.',
      dialogue: [],
      emotion: 'suspended tension',
      audio_note: 'Low wind, settling sand.',
      version: 1,
    } as any,
  ]);

  return { projectId, sceneId, shotA: shots[0], shotB: shots[1] };
}

async function main() {
  // --- store isolation -----------------------------------------------------
  if (fs.existsSync(STORE)) fs.copyFileSync(STORE, BACKUP);

  const app = createApp();
  const server = app.listen(PORT, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));

  try {
    const { projectId, shotA, shotB } = seed();
    const shotAId = shotA.id!;

    // ---------------------------------------------------------------- DoD 1
    // Every button sends the exact target and the server echoes that target.
    const videoTargets: PromptTarget[] = ['veo', 'omni', 'seedance_10', 'seedance_30'];
    const bodies = new Map<PromptTarget, string>();

    // Sequence matters: Veo -> Omni -> Seedance 30 is the specific regression.
    const sequence: PromptTarget[] = ['veo', 'omni', 'seedance_30', 'seedance_10'];
    for (const target of sequence) {
      const { status, json } = await post(`/api/shots/${shotAId}/regenerate-prompt`, { target });
      check(
        `DOD1-${target}`,
        status === 200 && json?.success === true && json?.target === target,
        `HTTP ${status}, echoed target=${json?.target}, resolved=${json?.resolved_duration_sec}s`
      );

      if (target === 'seedance_30') {
        // Row count after Veo -> Omni -> Seedance 30: three coexisting rows.
        const rows: VideoPrompt[] = db.getVideoPromptsByShot(shotAId);
        const targets = rows.map((r) => resolveRowTarget(r)).sort();
        check(
          'DOD5-three-rows-coexist',
          rows.length === 3 && JSON.stringify(targets) === JSON.stringify(['omni', 'seedance_30', 'veo']),
          `${rows.length} rows -> [${targets.join(', ')}]`
        );
      }
    }

    // Mixed seedance_10 + seedance_30 must coexist (the target_platform bug).
    const afterAll: VideoPrompt[] = db.getVideoPromptsByShot(shotAId);
    const afterTargets = afterAll.map((r) => resolveRowTarget(r)).sort();
    check(
      'DOD5-mixed-seedance-coexist',
      afterAll.length === 4 &&
        JSON.stringify(afterTargets) === JSON.stringify(['omni', 'seedance_10', 'seedance_30', 'veo']),
      `${afterAll.length} rows -> [${afterTargets.join(', ')}]`
    );
    check(
      'DOD5-distinct-ids',
      new Set(afterAll.map((r) => r.id)).size === afterAll.length,
      `ids: ${afterAll.map((r) => r.id).join(' | ')}`
    );

    // ---------------------------------------------------------------- DoD 4
    // The four video targets hold DISTINCT bodies, read via the frontend path.
    const freshShotA = db.getShot(shotAId)!;
    for (const target of videoTargets) {
      const cell = getPersistedPrompt(freshShotA, target, afterAll);
      check(
        `DOD4-ready-${target}`,
        cell.state === 'ready' && cell.hasPrompt,
        `state=${cell.state} len=${cell.text.length} resolved=${cell.resolvedDurationSec}s`
      );
      bodies.set(target, cell.text);
    }
    check(
      'DOD4-distinct-bodies',
      new Set(bodies.values()).size === videoTargets.length,
      `${new Set(bodies.values()).size}/${videoTargets.length} unique bodies`
    );
    check(
      'DOD4-seedance-durations',
      getPersistedPrompt(freshShotA, 'seedance_10', afterAll).resolvedDurationSec === 10 &&
        getPersistedPrompt(freshShotA, 'seedance_30', afterAll).resolvedDurationSec === 30,
      `10s row=${getPersistedPrompt(freshShotA, 'seedance_10', afterAll).resolvedDurationSec}, ` +
        `30s row=${getPersistedPrompt(freshShotA, 'seedance_30', afterAll).resolvedDurationSec}`
    );

    // banana_image is a STILL target: shot.master_image_prompt, no video row.
    const still = await post(`/api/shots/${shotAId}/regenerate-prompt`, { target: 'banana_image' });
    check(
      'DOD1-banana_image',
      still.status === 200 && still.json?.target === 'banana_image',
      `HTTP ${still.status}, echoed target=${still.json?.target}`
    );
    check(
      'DOD4-banana_image-no-video-row',
      db.getVideoPromptsByShot(shotAId).length === 4,
      `video row count still ${db.getVideoPromptsByShot(shotAId).length}`
    );
    const stillCell = getPersistedPrompt(db.getShot(shotAId)!, 'banana_image', db.getVideoPromptsByShot(shotAId));
    check(
      'DOD4-banana_image-ready',
      stillCell.state === 'ready' && stillCell.hasPrompt && stillCell.text !== bodies.get('veo'),
      `state=${stillCell.state} len=${stillCell.text.length}`
    );

    // ---------------------------------------------------------------- DoD 2
    // Survives "refresh": re-read through the SAME shape the UI consumes
    // (GET /api/projects/:id -> video_prompts keyed by SHOT id).
    const full: any = await (await fetch(`${BASE}/api/projects/${projectId}`)).json();
    const promptsByShot: Record<string, VideoPrompt[]> = full?.video_prompts || {};
    check(
      'DOD2-keyed-by-shot-id',
      Array.isArray(promptsByShot[shotAId]) && promptsByShot[shotAId].length === 4,
      `top-level keys=[${Object.keys(full || {}).join(',')}] err=${full?.error} prompt keys=[${Object.keys(promptsByShot).join(',')}] ` +
        `video_prompts["${shotAId}"] -> ${promptsByShot[shotAId]?.length} rows`
    );
    const flat = Object.values(promptsByShot).flat();
    let refreshOk = true;
    const refreshShotA = (Object.values(full.shots || {}).flat() as Shot[]).find((s) => s.id === shotAId)!;
    for (const target of videoTargets) {
      const cell = getPersistedPrompt(refreshShotA, target, flat);
      if (cell.text !== bodies.get(target)) refreshOk = false;
    }
    check('DOD2-identical-after-refresh', refreshOk, 'all four bodies match pre-refresh text');

    // ---------------------------------------------------------------- DoD 3
    // A shot with NO prompt shows PROMPT_EMPTY_MESSAGE, never another target's.
    let emptyOk = true;
    const emptyDetails: string[] = [];
    for (const target of [...videoTargets, 'banana_image' as PromptTarget]) {
      const cell = getPersistedPrompt(db.getShot(shotB.id!)!, target, flat);
      const leaked = [...bodies.values()].includes(cell.text);
      if (cell.state !== 'idle' || cell.hasPrompt || cell.text !== PROMPT_EMPTY_MESSAGE || leaked) {
        emptyOk = false;
        emptyDetails.push(`${target}: state=${cell.state} leaked=${leaked}`);
      }
    }
    check(
      'DOD3-empty-shot-honest-idle',
      emptyOk,
      emptyOk ? `all 5 targets -> idle / "${PROMPT_EMPTY_MESSAGE}"` : emptyDetails.join('; ')
    );

    // -------------------------------------------------------- legacy branch
    // A pre-existing `seedance` row with NO prompt_target must gain a SIBLING,
    // not be overwritten (the existingMatch legacy predicate in routes.ts).
    const legacyShotId = shotB.id!;
    const legacyRow = db.saveSingleVideoPrompt({
      id: `vprompt_legacy_${legacyShotId}`,
      shot_id: legacyShotId,
      scene_id: shotB.scene_id,
      project_id: projectId,
      target_platform: 'seedance',
      status: 'ready',
      timeline_json: { shot_breakdown: 'LEGACY-SEEDANCE-BODY-DO-NOT-OVERWRITE' },
      version: 1,
    } as any);

    const legacyGen = await post(`/api/shots/${legacyShotId}/regenerate-prompt`, { target: 'seedance_30' });
    const legacyAfter = db.getVideoPromptsByShot(legacyShotId);
    const survivor = legacyAfter.find((r) => r.id === legacyRow.id);
    check(
      'LEGACY-row-preserved',
      legacyGen.status === 200 &&
        legacyAfter.length === 2 &&
        survivor?.timeline_json?.shot_breakdown === 'LEGACY-SEEDANCE-BODY-DO-NOT-OVERWRITE',
      `HTTP ${legacyGen.status}, rows=${legacyAfter.length}, legacy body intact=${
        survivor?.timeline_json?.shot_breakdown === 'LEGACY-SEEDANCE-BODY-DO-NOT-OVERWRITE'
      }`
    );

    // A legacy veo row (unambiguous column) IS claimed rather than duplicated.
    const legacyVeo = db.saveSingleVideoPrompt({
      id: `vprompt_legacyveo_${legacyShotId}`,
      shot_id: legacyShotId,
      scene_id: shotB.scene_id,
      project_id: projectId,
      target_platform: 'veo',
      status: 'ready',
      timeline_json: { prompt: 'LEGACY-VEO-BODY-SHOULD-BE-REPLACED' },
      version: 1,
    } as any);
    const veoGen = await post(`/api/shots/${legacyShotId}/regenerate-prompt`, { target: 'veo' });
    const claimed = db.getVideoPromptsByShot(legacyShotId).find((r) => r.id === legacyVeo.id);
    check(
      'LEGACY-unambiguous-row-claimed',
      veoGen.status === 200 &&
        db.getVideoPromptsByShot(legacyShotId).length === 3 &&
        claimed?.prompt_target === 'veo' &&
        claimed?.timeline_json?.prompt !== 'LEGACY-VEO-BODY-SHOULD-BE-REPLACED',
      `HTTP ${veoGen.status}, rows=${db.getVideoPromptsByShot(legacyShotId).length}, claimed target=${claimed?.prompt_target}`
    );

    // ------------------------------------------------------- error contract
    const legacyAlias = await post(`/api/shots/${shotAId}/regenerate-prompt`, { target: 'seedance' });
    check(
      'CONTRACT-legacy-alias-still-accepted',
      legacyAlias.status === 200 && legacyAlias.json?.target === 'seedance_10',
      `HTTP ${legacyAlias.status}, target=${legacyAlias.json?.target} (LEGACY_PLATFORM_TARGET intact)`
    );
    const bogus = await post(`/api/shots/${shotAId}/regenerate-prompt`, { target: 'not_a_target' });
    check(
      'CONTRACT-invalid-target-400',
      bogus.status === 400 && bogus.json?.code === 'INVALID_PROMPT_TARGET',
      `HTTP ${bogus.status}, code=${bogus.json?.code}`
    );
    const badDur = await post(`/api/shots/${shotAId}/regenerate-prompt`, {
      target: 'seedance_10',
      requestedDuration: 30,
    });
    check(
      'CONTRACT-duration-mismatch-422',
      badDur.status === 422 && badDur.json?.code === 'PROMPT_DURATION_CONTRACT_FAILED',
      `HTTP ${badDur.status}, code=${badDur.json?.code}`
    );
  } finally {
    server.close();
    if (fs.existsSync(BACKUP)) {
      fs.copyFileSync(BACKUP, STORE);
      fs.unlinkSync(BACKUP);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nTOTAL=${results.length} PASSED=${results.length - failed.length} FAILED=${failed.length}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('E2E CRASH:', err);
  if (fs.existsSync(BACKUP)) {
    fs.copyFileSync(BACKUP, STORE);
    fs.unlinkSync(BACKUP);
  }
  process.exit(2);
});

