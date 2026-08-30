/**
 * S5 -> S6 asset name contract regression tests.
 *
 * Root cause covered here: Stage 5 emitted paraphrased character/location names
 * ("Sang Putri", "Tengah Danau") while the Character/Location Bible held the
 * canonical ones ("Putri Nelayan", "Danau Berkabut (Fajar)"). The S6 asset
 * integrity gate resolves scene assets by name, so EVERY scene was marked
 * BLOCKED at the end of an otherwise successful S1-S5 run.
 */
import {
  canonicalizeSceneAssetNames,
  resolveCanonicalAssetName,
  validateSceneAssetNames,
  DetectedScene,
} from './stages/stage5_scene_breakdown';
import { createSceneAssetCoverageReport } from './scene_asset_integrity_engine';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

const CHARACTER_ROSTER = ['Sang Nelayan', 'Putri Nelayan'];
const LOCATION_ROSTER = ['Danau Berkabut (Fajar)', 'Tepian Danau (Senja)'];

function scene(overrides: Partial<DetectedScene>): DetectedScene {
  return {
    scene_number: 1,
    title: 'INT. TEST',
    duration_sec: 10,
    story_purpose: 'test',
    location_name: 'Danau Berkabut (Fajar)',
    time_of_day: 'DAWN',
    character_names: ['Sang Nelayan'],
    emotional_objective: 'test',
    event: 'test',
    narrative_function: 'test',
    ...overrides,
  } as DetectedScene;
}

const characters = CHARACTER_ROSTER.map((name, index) => ({
  id: `char_${index}`,
  project_id: 'p',
  name,
  age: 'adult',
  gender: 'n/a',
  physical_appearance: 'x',
  face_identity_locked: true,
  hair: 'x',
  beard: 'None',
  clothing: ['x'],
  accessories: [],
  personality: 'x',
  voice_character: 'x',
  movement_style: 'x',
  version: 1,
  updated_at: '',
})) as any;

const locations = LOCATION_ROSTER.map((name, index) => ({
  id: `loc_${index}`,
  project_id: 'p',
  name,
  era: 'x',
  architecture: 'x',
  environment: 'x',
  landscape: 'x',
  climate: 'x',
  culture: 'x',
  lighting_style: 'x',
  color_palette: [],
  material: 'x',
  version: 1,
  updated_at: '',
})) as any;

function main(): void {
  let passed = 0;
  const run = (name: string, fn: () => void) => {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  };

  console.log('S5 ASSET NAME CONTRACT TESTS');

  run('exact canonical name resolves to itself', () => {
    assert(resolveCanonicalAssetName('Sang Nelayan', CHARACTER_ROSTER) === 'Sang Nelayan', 'exact match');
  });

  run('parenthetical qualifier tolerated (Danau Berkabut -> canonical)', () => {
    assert(
      resolveCanonicalAssetName('Danau Berkabut', LOCATION_ROSTER) === 'Danau Berkabut (Fajar)',
      'qualifier-tolerant containment'
    );
  });

  run('honorific paraphrase resolves (Sang Putri -> Putri Nelayan)', () => {
    assert(
      resolveCanonicalAssetName('Sang Putri', CHARACTER_ROSTER) === 'Putri Nelayan',
      'stopword-stripped token similarity'
    );
  });

  run('genuinely absent asset stays unresolved', () => {
    assert(resolveCanonicalAssetName('Tengah Danau', LOCATION_ROSTER) === null, 'no false positive');
    assert(resolveCanonicalAssetName('Kapten Kapal', CHARACTER_ROSTER) === null, 'no false positive');
  });

  run('empty roster never resolves (single-key/legacy compatibility)', () => {
    assert(resolveCanonicalAssetName('Sang Nelayan', []) === null, 'empty roster');
    const scenes = [scene({ location_name: 'Whatever', character_names: ['Nobody'] })];
    assert(canonicalizeSceneAssetNames(scenes, [], []) === scenes, 'no roster leaves scenes untouched');
    assert(validateSceneAssetNames(scenes, [], [], 'id').valid, 'no roster means no violation');
  });

  run('canonicalization rewrites paraphrases in place', () => {
    const [result] = canonicalizeSceneAssetNames(
      [scene({ location_name: 'Danau Berkabut', character_names: ['Sang Nelayan', 'Sang Putri'] })],
      CHARACTER_ROSTER,
      LOCATION_ROSTER
    );
    assert(result.location_name === 'Danau Berkabut (Fajar)', 'location canonicalized');
    assert(
      JSON.stringify(result.character_names) === JSON.stringify(['Sang Nelayan', 'Putri Nelayan']),
      `characters canonicalized, got ${JSON.stringify(result.character_names)}`
    );
  });

  run('canonicalization dedupes collapsed aliases', () => {
    const [result] = canonicalizeSceneAssetNames(
      [scene({ character_names: ['Putri Nelayan', 'Sang Putri'] })],
      CHARACTER_ROSTER,
      LOCATION_ROSTER
    );
    assert(result.character_names!.length === 1, 'duplicate alias collapsed');
  });

  run('validation flags unresolvable references', () => {
    const result = validateSceneAssetNames(
      [scene({ scene_number: 2, location_name: 'Tengah Danau', character_names: ['Sang Nelayan'] })],
      CHARACTER_ROSTER,
      LOCATION_ROSTER,
      'id'
    );
    assert(!result.valid, 'invalid');
    assert(result.violations.length === 1 && result.violations[0].assetType === 'LOCATION', 'one location violation');
    assert(Boolean(result.correctivePrompt?.includes('Danau Berkabut (Fajar)')), 'corrective prompt lists roster');
  });

  run('validation passes canonicalized scenes', () => {
    const scenes = canonicalizeSceneAssetNames(
      [scene({ location_name: 'Danau Berkabut', character_names: ['Sang Nelayan', 'Sang Putri'] })],
      CHARACTER_ROSTER,
      LOCATION_ROSTER
    );
    assert(validateSceneAssetNames(scenes, CHARACTER_ROSTER, LOCATION_ROSTER, 'id').valid, 'valid after canonicalization');
  });

  run('REGRESSION: canonicalized scene passes the S6 asset integrity gate', () => {
    const raw = scene({ id: 'scene_1', location_name: 'Danau Berkabut', character_names: ['Sang Nelayan', 'Sang Putri'] } as any);
    const blockedReport = createSceneAssetCoverageReport(raw as any, characters, locations, [], null, null);
    assert(blockedReport.status === 'BLOCKED', 'paraphrased names reproduce the original BLOCKED bug');

    const [fixed] = canonicalizeSceneAssetNames([raw], CHARACTER_ROSTER, LOCATION_ROSTER);
    const okReport = createSceneAssetCoverageReport({ ...(fixed as any), id: 'scene_1' }, characters, locations, [], null, null);
    assert(
      okReport.status === 'PASS',
      `canonicalized scene must pass S6 gate, got ${okReport.status}: ${JSON.stringify(okReport.characters.concat(okReport.locations).filter((r) => r.status !== 'PASS'))}`
    );
  });

  console.log(`\nTOTAL=${passed} PASSED=${passed} FAILED=0`);
}

main();
