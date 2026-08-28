import {
  AssetCoverageRecord,
  AssetReference,
  AssetCoverageStatus,
  CharacterBible,
  ContextPackage,
  ContinuityState,
  LocationBible,
  ObjectBible,
  Scene,
  SceneAssetCoverageReport,
  SceneAssetRequirement,
  SceneAssetRequirementLevel,
} from '../src/types';

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function matches(candidate: string, target: string, aliases: string[] = []): boolean {
  const value = normalize(candidate);
  return [target, ...aliases].some((item) => {
    const normalizedItem = normalize(item);
    if (normalizedItem === value) return true;
    const variant = normalizedItem.length > value.length ? normalizedItem : value;
    const shorter = normalizedItem.length > value.length ? value : normalizedItem;
    return variant.startsWith(`${shorter} `) && /\b(?:bin|binti|ibn|bint)\b/.test(variant.slice(shorter.length));
  });
}

function canonicalId(prefix: string, id: string | undefined, name: string): string {
  return `${prefix}:${id || normalize(name).replace(/[^a-z0-9]+/g, '-')}`;
}

function isUnknownCanonicalId(value: string | undefined): boolean {
  return !value || value.startsWith('unknown:');
}

function requirement(name: string, assetType: SceneAssetRequirement['assetType'], level: SceneAssetRequirementLevel, canonicalId?: string): SceneAssetRequirement {
  return { name, assetType, level, canonicalId };
}

export function deriveSceneAssetRequirements(scene: Pick<Scene, 'id' | 'character_names' | 'characters_present' | 'location_name' | 'event'>, context?: ContextPackage | null): SceneAssetRequirement[] {
  const characterNames = scene.character_names?.length ? scene.character_names : scene.characters_present || [];
  const requirements = characterNames.map((name) => {
    const entity = context?.entities.find((candidate) => matches(name, candidate.name, candidate.aliases || []));
    return requirement(name, 'CHARACTER', 'REQUIRED', entity ? canonicalId('character', entity.entityId, entity.name) : undefined);
  });
  if (scene.location_name) {
    const location = context?.locations.find((candidate) => matches(scene.location_name, candidate.name));
    requirements.push(requirement(scene.location_name, 'LOCATION', 'REQUIRED', location ? canonicalId('location', location.locationId, location.name) : undefined));
  }
  const objectNames = context?.objects.filter((object) => normalize(scene.event || '').includes(normalize(object.name))).map((object) => object.name) || [];
  requirements.push(...objectNames.map((name) => {
    const object = context?.objects.find((candidate) => normalize(candidate.name) === normalize(name));
    return requirement(name, 'OBJECT', 'REQUIRED', object ? canonicalId('object', object.objectId, object.name) : undefined);
  }));
  return requirements;
}

function findCharacter(name: string, characters: CharacterBible[], continuity?: ContinuityState | null, context?: ContextPackage | null): AssetReference | undefined {
  const continuityCharacter = continuity?.characters.find((character) => matches(name, character.displayName, character.aliases));
  const bibleCharacter = characters.find((character) => matches(name, character.name));
  const groundedEntity = context?.entities.find((entity) => matches(name, entity.name, entity.aliases || []));
  if (!continuityCharacter && !bibleCharacter) return undefined;
  return {
    canonicalAssetId: groundedEntity ? canonicalId('character', groundedEntity.entityId, groundedEntity.name) : !isUnknownCanonicalId(continuityCharacter?.canonicalIdentity) ? continuityCharacter!.canonicalIdentity : canonicalId('character', bibleCharacter?.id, bibleCharacter?.name || continuityCharacter!.displayName),
    assetType: 'CHARACTER',
    name: groundedEntity?.name || continuityCharacter?.displayName || bibleCharacter!.name,
    source: 'CHARACTER_BIBLE',
  };
}

function findLocation(name: string, locations: LocationBible[], continuity?: ContinuityState | null, context?: ContextPackage | null): AssetReference | undefined {
  const continuityLocation = continuity && Object.values(continuity.locations).find((location) => matches(name, location.canonicalLocation, location.aliases));
  const bibleLocation = locations.find((location) => matches(name, location.name));
  const groundedLocation = context?.locations.find((location) => matches(name, location.name));
  if (!continuityLocation && !bibleLocation) return undefined;
  return {
    canonicalAssetId: canonicalId('location', bibleLocation?.id || groundedLocation?.locationId, groundedLocation?.name || continuityLocation?.canonicalLocation || bibleLocation?.name || name),
    assetType: 'LOCATION',
    name: groundedLocation?.name || continuityLocation?.canonicalLocation || bibleLocation!.name,
    source: 'LOCATION_BIBLE',
  };
}

function findObject(name: string, objects: ObjectBible[], continuity?: ContinuityState | null, context?: ContextPackage | null): AssetReference | undefined {
  const continuityObject = continuity && Object.values(continuity.objects).find((object) => matches(name, object.canonicalObject));
  const bibleObject = objects.find((object) => matches(name, object.name));
  const groundedObject = context?.objects.find((object) => matches(name, object.name));
  if (!continuityObject && !bibleObject) return undefined;
  return {
    canonicalAssetId: canonicalId('object', bibleObject?.id || groundedObject?.objectId, groundedObject?.name || continuityObject?.canonicalObject || bibleObject?.name || name),
    assetType: 'OBJECT',
    name: groundedObject?.name || continuityObject?.canonicalObject || bibleObject!.name,
    source: 'OBJECT_BIBLE',
  };
}

export function buildAssetCoverage(
  requirements: SceneAssetRequirement[],
  characters: CharacterBible[],
  locations: LocationBible[],
  objects: ObjectBible[],
  continuity?: ContinuityState | null,
  context?: ContextPackage | null,
  sceneId?: string,
): AssetCoverageRecord[] {
  return requirements.map((item) => {
    let asset: AssetReference | undefined;
    if (item.assetType === 'CHARACTER') asset = findCharacter(item.name, characters, continuity, context);
    if (item.assetType === 'LOCATION') asset = findLocation(item.name, locations, continuity, context);
    if (item.assetType === 'OBJECT') asset = findObject(item.name, objects, continuity, context);
    if (!asset) {
      return { requirement: item, status: item.level === 'REQUIRED' ? 'BLOCKED' : item.level === 'UNKNOWN' ? 'UNKNOWN' : 'WARNING' as AssetCoverageStatus, message: `Missing ${item.assetType.toLowerCase()} asset: ${item.name}.`, reason: item.level === 'REQUIRED' ? 'MISSING_REQUIRED_ASSET' : undefined, assetName: item.name, assetType: item.assetType, sceneId };
    }
    if (item.canonicalId && asset.canonicalAssetId !== item.canonicalId) {
      return { requirement: item, asset, status: 'MISMATCH', message: `Canonical asset mismatch for ${item.name}.`, reason: 'CANONICAL_MISMATCH', assetName: item.name, assetType: item.assetType, sceneId };
    }
    return { requirement: item, asset: { ...asset, sceneId }, status: isUnknownCanonicalId(asset.canonicalAssetId) ? 'MISMATCH' : 'PASS', message: `${item.name} is covered by ${asset.canonicalAssetId}.`, reason: isUnknownCanonicalId(asset.canonicalAssetId) ? 'CANONICAL_MISMATCH' : undefined, assetName: item.name, assetType: item.assetType, sceneId };
  });
}

function coverageStatus(records: AssetCoverageRecord[]): AssetCoverageStatus {
  if (records.some((record) => record.status === 'BLOCKED' || record.status === 'MISMATCH')) return 'BLOCKED';
  if (records.some((record) => record.status === 'UNKNOWN')) return 'UNKNOWN';
  if (records.some((record) => record.status === 'WARNING')) return 'WARNING';
  return 'PASS';
}

function promptCoverage(records: AssetCoverageRecord[], prompt: string, phase: 'PROMPT' | 'MASTER_FRAME' | 'VIDEO_PROMPT'): AssetCoverageRecord[] {
  const normalizedPrompt = normalize(prompt);
  return records.map((record) => {
    if (record.status !== 'PASS' || !record.asset) return record;
    if (normalizedPrompt.includes(normalize(record.asset.name)) || normalizedPrompt.includes(normalize(record.requirement.name))) return { ...record, status: 'PASS', message: `${phase} includes ${record.asset.name}.` };
    return { ...record, status: 'BLOCKED', reason: 'PROMPT_OMISSION', message: `${phase} is missing required asset: ${record.asset.name}.` };
  });
}

export function validateAssetCoverage(report: SceneAssetCoverageReport): SceneAssetCoverageReport {
  const records = [...report.characters, ...report.locations, ...report.objects];
  return { ...report, status: coverageStatus(records) };
}

export function validatePromptCoverage(report: SceneAssetCoverageReport, prompt: string): SceneAssetCoverageReport {
  const records = promptCoverage([...report.characters, ...report.locations, ...report.objects], prompt, 'PROMPT');
  return { ...report, promptCoverage: records, status: coverageStatus(records) };
}

export function validateMasterFrameCoverage(report: SceneAssetCoverageReport, prompt: string): SceneAssetCoverageReport {
  const records = promptCoverage([...report.characters, ...report.locations, ...report.objects], prompt, 'MASTER_FRAME');
  return { ...report, masterFrameCoverage: records, status: coverageStatus(records) };
}

export function validateVideoPromptCoverage(report: SceneAssetCoverageReport, prompt: string): SceneAssetCoverageReport {
  const records = promptCoverage([...report.characters, ...report.locations, ...report.objects], prompt, 'VIDEO_PROMPT');
  const allowedNames = records.filter((record) => record.asset).flatMap((record) => [record.requirement.name, record.asset!.name]);
  const explicitIntroductions = Array.from(prompt.matchAll(/\b(?:a|an|one)\s+(?:merchant|character|man|woman|person)\s+(?:named|called)\s+([A-Z][A-Za-z'’-]*(?:\s+[A-Z][A-Za-z'’-]*)*)\b|\b(?:merchant|character|person)\s+(?:named|called|bernama)\s+([A-Z][A-Za-z'’-]*(?:\s+[A-Z][A-Za-z'’-]*)*)\b/g)).map((match) => match[1] || match[2]);
  const phantomAssets = Array.from(new Set(explicitIntroductions.filter((candidate) => !allowedNames.some((allowed) => matches(candidate, allowed)))));
  const phantomRecords: AssetCoverageRecord[] = phantomAssets.map((name) => ({
    requirement: { name, assetType: 'CHARACTER', level: 'REQUIRED' },
    status: 'BLOCKED',
    reason: 'UNDECLARED_ASSET',
    assetName: name,
    assetType: 'CHARACTER',
    sceneId: report.sceneId,
    message: `VIDEO_PROMPT introduces undeclared asset: ${name}.`,
  }));
  return { ...report, videoPromptCoverage: [...records, ...phantomRecords], phantomAssets, status: phantomAssets.length > 0 ? 'BLOCKED' : coverageStatus(records) };
}

export function createSceneAssetCoverageReport(
  scene: Pick<Scene, 'id' | 'scene_number' | 'character_names' | 'characters_present' | 'location_name' | 'event'>,
  characters: CharacterBible[],
  locations: LocationBible[],
  objects: ObjectBible[],
  context?: ContextPackage | null,
  continuity?: ContinuityState | null,
): SceneAssetCoverageReport {
  const requirements = deriveSceneAssetRequirements(scene, context);
  const records = buildAssetCoverage(requirements, characters, locations, objects, continuity, context, scene.id);
  return validateAssetCoverage({
    sceneId: scene.id,
    sceneNumber: scene.scene_number,
    status: 'PASS',
    characters: records.filter((record) => record.requirement.assetType === 'CHARACTER'),
    locations: records.filter((record) => record.requirement.assetType === 'LOCATION'),
    objects: records.filter((record) => record.requirement.assetType === 'OBJECT'),
    phantomAssets: [],
  });
}

export function assertSceneAssetCoverage(report: SceneAssetCoverageReport): void {
  if (report.status === 'BLOCKED' || report.promptCoverage?.some((record) => record.status === 'BLOCKED') || report.masterFrameCoverage?.some((record) => record.status === 'BLOCKED') || report.videoPromptCoverage?.some((record) => record.status === 'BLOCKED')) {
    throw new Error(`ASSET_INTEGRITY_BLOCKED ${JSON.stringify(report)}`);
  }
}
