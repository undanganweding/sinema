import {
  createSceneAssetCoverageReport,
  deriveSceneAssetRequirements,
  validateMasterFrameCoverage,
  validatePromptCoverage,
  validateVideoPromptCoverage,
} from './scene_asset_integrity_engine';
import { ContextPackage, ContinuityState } from '../src/types';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`ASSERTION FAILED: ${message}`); }

const scene = { id: 'scene_1', scene_number: 1, character_names: ['Aminah'], location_name: 'Rumah Aminah', event: 'Aminah cares for Bayi' } as any;
const characters = [{ id: 'aminah', project_id: 'p', name: 'Aminah', age: 'adult', gender: 'female', physical_appearance: 'period', physical_description: 'period', face_identity_locked: true, hair: 'dark', beard: 'None', clothing: ['white robe'], accessories: [], personality: 'kind', voice_character: 'soft', movement_style: 'calm', version: 1, updated_at: '' }] as any;
const locations = [{ id: 'home', project_id: 'p', name: 'Rumah Aminah', era: 'historical', architecture: 'home', environment: 'interior', landscape: 'city', climate: 'dry', culture: 'period', lighting_style: 'warm', color_palette: [], material: 'stone', version: 1, updated_at: '' }] as any;
const objects = [{ id: 'baby', project_id: 'p', name: 'Bayi', category: 'prop', description: 'infant', continuity_notes: '', version: 1, updated_at: '' }] as any;
const continuity = { version: '1.0', characters: [{ canonicalIdentity: 'character:aminah', displayName: 'Aminah', aliases: ['Aminah binti Wahb'], attributes: [], clothing: [], accessories: [], relationships: [], possessions: [], provenance: [] }], characterIdentities: { aminah: 'character:aminah' }, locations: {}, activeEvents: [], relationships: [], objects: {}, scenes: [], visualState: {}, continuityConstraints: [], unresolvedIssues: [] } as ContinuityState;
const context = { entities: [{ entityId: 'aminah', name: 'Aminah binti Wahb', aliases: ['Aminah'], type: 'person' }], locations: [], objects: [] } as any as ContextPackage;
const contextWithObject = { ...context, objects: [{ objectId: 'baby', name: 'Bayi' }] } as any as ContextPackage;

function main(): void {
  const report = createSceneAssetCoverageReport(scene, characters, locations, objects, contextWithObject, continuity);
  assert(report.status === 'PASS' && report.characters[0].status === 'PASS' && report.locations[0].status === 'PASS', 'character and location coverage pass');
  assert(deriveSceneAssetRequirements({ ...scene, character_names: [] }, context).some((item) => item.assetType === 'LOCATION'), 'establishing shot requires only location');
  assert(createSceneAssetCoverageReport(scene, [], locations, objects, context, null).status === 'BLOCKED', 'missing character blocks');
  assert(createSceneAssetCoverageReport(scene, characters, [], objects, context, continuity).status === 'BLOCKED', 'missing location blocks');
  assert(createSceneAssetCoverageReport({ ...scene, character_names: ['Aminah', 'Abdul Muthalib'] }, characters, locations, objects, context, continuity).status === 'BLOCKED', 'missing second character blocks');
  assert(createSceneAssetCoverageReport(scene, characters, locations, [], contextWithObject, continuity).status === 'BLOCKED', 'missing required object blocks');
  const prompt = 'Aminah stands inside Rumah Aminah beside Bayi.';
  assert(validatePromptCoverage(report, prompt).status === 'PASS', 'canary scene prompt covers all assets');
  assert(validateMasterFrameCoverage(report, 'The house with Bayi').status === 'BLOCKED', 'master frame omission blocks');
  assert(validateVideoPromptCoverage(report, 'Aminah in Rumah Aminah with Bayi').status === 'PASS', 'video prompt covers all assets');
  assert(validateVideoPromptCoverage(report, 'Aminah in Rumah Aminah with Abdul Muthalib').status === 'BLOCKED', 'phantom character is blocked by missing required object coverage');
  const optional = { ...report, objects: [{ ...report.objects[0], requirement: { ...report.objects[0].requirement, level: 'OPTIONAL' }, status: 'WARNING' as const }] };
  assert(optional.status === 'PASS' || optional.status === 'WARNING', 'optional asset is not blocked');
  const reconstruction = { ...report, locations: [{ ...report.locations[0], asset: { ...report.locations[0].asset!, source: 'RECONSTRUCTION' as const }, status: 'RECONSTRUCTION' as const }] };
  assert(reconstruction.locations[0].asset?.source === 'RECONSTRUCTION', 'reconstructed asset remains reconstruction');
  const unknown = createSceneAssetCoverageReport({ ...scene, location_name: 'Unknown location' }, characters, [], objects, context, continuity);
  assert(unknown.locations[0].status === 'BLOCKED', 'required unknown location is not silently passed');
  const second = createSceneAssetCoverageReport(scene, characters, locations, objects, contextWithObject, continuity);
  assert(JSON.stringify(report) === JSON.stringify(second), 'coverage validation is idempotent');
  assert(continuity.characters[0].canonicalIdentity === 'character:aminah', 'Phase 6 identity is preserved');
  console.log('PATCH 6.0 PHASE 7 asset integrity assertions: PASS');
}
main();
