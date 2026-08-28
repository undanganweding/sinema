import { createSceneAssetCoverageReport, validateVideoPromptCoverage } from './scene_asset_integrity_engine';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`ASSERTION FAILED: ${message}`); }

const bible = {
  characters: [
    { id: 'abdul-muthalib', name: 'Abdul Muthalib' },
    { id: 'aminah', name: 'Aminah binti Wahb' },
    { id: 'halimah', name: "Halimah as-Sa'diyah" },
  ],
  locations: [
    { id: 'abdul-home', name: 'Kediaman Abdul Muthalib' },
    { id: 'aminah-home', name: 'Kediaman Aminah' },
  ],
} as any;
const context = {
  entities: [{ entityId: 'aminah', name: 'Aminah binti Wahb', aliases: ['Aminah'], type: 'person' }],
  locations: [], objects: [],
} as any;
const continuity = {
  version: '1.0', characters: [{ canonicalIdentity: 'unknown:aminah binti wahb', displayName: 'Aminah binti Wahb', aliases: ['Aminah'], attributes: [], clothing: [], accessories: [], relationships: [], possessions: [], provenance: [] }],
  characterIdentities: {}, locations: {}, activeEvents: [], relationships: [], objects: {}, scenes: [], visualState: {}, continuityConstraints: [], unresolvedIssues: [],
} as any;

function report(character_names: string[], location_name: string) {
  return createSceneAssetCoverageReport({ id: location_name, scene_number: 1, character_names, location_name, event: '' } as any, bible.characters, bible.locations, [], context, continuity);
}

async function runWithTwoWorkers(scenes: string[][]): Promise<ReturnType<typeof report>[]> {
  let nextIndex = 0;
  const results: ReturnType<typeof report>[] = [];
  async function worker(): Promise<void> {
    while (nextIndex < scenes.length) {
      const index = nextIndex++;
      const [name, location] = scenes[index];
      results[index] = report([name], location);
    }
  }
  await Promise.all([worker(), worker()]);
  return results;
}

async function main(): Promise<void> {
  const english = validateVideoPromptCoverage(report([], 'Kediaman Abdul Muthalib'), 'Generate a Master Frame with high cinematic quality, strict authentic visual continuity, slow controlled camera movement and atmospheric lighting.');
  assert(english.phantomAssets?.length === 0, 'English prose has no phantom assets');
  const indonesian = validateVideoPromptCoverage(report([], 'Kediaman Abdul Muthalib'), 'Pastikan pencahayaan konsisten, kamera bergerak perlahan, suasana malam tetap natural dan sinematik.');
  assert(indonesian.phantomAssets?.length === 0, 'Indonesian prose has no phantom assets');

  const character = report(['Abdul Muthalib'], 'Kediaman Abdul Muthalib');
  assert(character.characters[0].status === 'PASS' && validateVideoPromptCoverage(character, 'Abdul Muthalib stands inside Kediaman Abdul Muthalib.').phantomAssets?.length === 0, 'real character has explicit coverage');
  const location = report([], 'Kediaman Abdul Muthalib');
  assert(location.locations[0].status === 'PASS', 'real location has explicit coverage');

  const missing = report(["Perempuan Bani Sa'ad"], 'Jalanan Makkah');
  assert(missing.status === 'BLOCKED' && missing.characters[0].reason === 'MISSING_REQUIRED_ASSET' && missing.locations[0].assetName === 'Jalanan Makkah', 'missing multi-word assets remain actionable blockers');

  const alias = report(['Aminah'], 'Kediaman Aminah');
  assert(alias.characters[0].status === 'PASS' && alias.characters[0].asset?.canonicalAssetId === 'character:aminah', 'alias resolves to one canonical asset');
  const migrated = report(['Aminah binti Wahb'], 'Kediaman Aminah');
  assert(migrated.characters[0].asset?.canonicalAssetId !== 'unknown:aminah binti wahb', 'unknown continuity ID migrates to canonical Bible/context ID');

  const undeclared = validateVideoPromptCoverage(character, 'A merchant named Khalid enters the scene.');
  assert(undeclared.phantomAssets?.length === 1 && undeclared.videoPromptCoverage?.some((item) => item.reason === 'UNDECLARED_ASSET' && item.assetName === 'Khalid'), 'explicit undeclared entity is blocked');

  const productionScenes = [
    ['Abdul Muthalib', 'Kediaman Abdul Muthalib'], ['Aminah', 'Kediaman Aminah'], ["Perempuan Bani Sa'ad", 'Jalanan Makkah'],
    ['Aminah', 'Depan Rumah Aminah'], ['Aminah', "Depan Rumah Aminah"], ["Halimah as-Sa'diyah", 'Gurun Makkah'],
  ];
  const results = await runWithTwoWorkers(productionScenes);
  const lexical = results.flatMap((item) => validateVideoPromptCoverage(item, 'Generate Master High Strict Authentic Slow Controlled Atmospheric Natural Camera Night Cinematic Ensure Image Deep Continuous Lock Synchronized Strictly.').phantomAssets || []);
  assert(lexical.length === 0, 'production prose vocabulary never becomes phantom assets');
  assert(new Set(results.flatMap((item) => item.characters.flatMap((record) => record.asset?.canonicalAssetId || []))).size <= 3, 'two-worker resolution remains deterministic without duplicate IDs');
  console.log('PATCH 6.0-R1 asset resolution assertions: PASS');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
