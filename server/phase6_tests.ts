import {
  buildContinuityPromptContext,
  createContinuityState,
  updateContinuityState,
} from './continuity_engine';
import { ContextPackage } from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

const context: ContextPackage = {
  version: '1.0', contentType: ['HISTORICAL'], primaryCategory: 'HISTORICAL', researchRequired: true,
  researchSummary: 'fixture', sources: [], timeline: [],
  events: [
    { eventId: 'a', label: 'Event A', startYear: 1943 },
    { eventId: 'b', label: 'Event B', startYear: 1945 },
  ],
  entities: [{ entityId: 'abdullah', name: 'Abdullah bin Abdul Muthalib', aliases: ['Abdullah ibn Abd al-Muttalib', 'Abdullah'], type: 'person', status: 'DECEASED', deathYear: 1943, sourceIds: ['source_a'] }],
  relationships: [], locations: [], objects: [], facts: [], constraints: ['Preserve accepted identity'], unknowns: [], reconstructionRules: ['white robe is visual reconstruction'], groundingStatus: 'complete',
};

const character = (name: string, clothing: string[] = []) => ({ name, age: 'adult', gender: 'male', physical_appearance: 'period appearance', face_identity_locked: true, hair: 'dark hair', beard: 'short beard', clothing, accessories: [], personality: 'calm', voice_character: 'low', movement_style: 'measured' });

function scene(id: string, number: number, location: string, event: string, names = ['Abdullah']) {
  return { id, scene_number: number, location_name: location, event, character_names: names };
}

function main(): void {
  const identityState = createContinuityState(context, [character('Abdullah bin Abdul Muthalib', ['white robe']) as any]);
  const aliasIdentity = identityState.characters[0].canonicalIdentity;
  const aliasState = createContinuityState(context, [character('Abdullah', ['white robe']) as any]);
  assert(aliasIdentity === aliasState.characters[0].canonicalIdentity, 'supported aliases resolve to one canonical identity');
  const separateState = createContinuityState(context, [character('Abdullah') as any, character('Abu Talib') as any]);
  assert(separateState.characters[0].canonicalIdentity !== separateState.characters[1].canonicalIdentity, 'similar names remain separate entities');

  let state = createContinuityState(undefined, [character('Abdullah', ['white robe']) as any]);
  let result = updateContinuityState(state, scene('s1', 1, 'Makkah', 'A peaceful beginning'), 'Abdullah wears white robe');
  state = result.state;
  result = updateContinuityState(state, scene('s2', 2, 'Makkah', 'A quiet continuation'), 'Abdullah wears white robe');
  assert(result.issues.length === 0, 'unchanged clothing and location pass');
  state = result.state;
  result = updateContinuityState(state, scene('s3', 3, 'Makkah', 'A later scene'), 'Abdullah wears black modern suit');
  assert(result.issues.some((issue) => issue.code === 'CLOTHING_DRIFT' && issue.severity === 'WARNING'), 'clothing contradiction is warning');

  state = createContinuityState(undefined, [character('Abdullah') as any]);
  state = updateContinuityState(state, scene('m1', 1, 'Makkah', 'Start'), 'Abdullah').state;
  assert(updateContinuityState(state, scene('m2', 2, 'Taif', 'Travel'), 'Abdullah').issues.some((issue) => issue.code === 'LOCATION_CHANGE_WITHOUT_TRANSITION'), 'location change without transition conflicts');
  assert(updateContinuityState(state, scene('m2', 2, 'Taif', 'Travel'), 'Abdullah', 'LOCATION_CHANGE').issues.length === 0, 'explicit location transition passes');

  state = createContinuityState(undefined, [], [], [{ name: 'Product X', description: 'historical object', category: 'prop' } as any]);
  state = updateContinuityState(state, scene('o1', 1, 'Makkah', 'Object introduced'), { objectName: 'Product X', owner: 'Character A' }).state;
  state = updateContinuityState(state, scene('o2', 2, 'Makkah', 'Object continues'), { objectName: 'Product X', owner: 'Character A' }).state;
  assert(updateContinuityState(state, scene('o3', 3, 'Makkah', 'Object transferred'), { objectName: 'Product X', owner: 'Character B' }).issues.some((issue) => issue.code === 'OBJECT_POSSESSION_CONFLICT'), 'object possession contradiction is detected');

  let temporal = createContinuityState(context, [character('Abdullah') as any]);
  temporal = updateContinuityState(temporal, scene('t1', 1, 'Makkah', 'Event A'), 'Event A').state;
  assert(updateContinuityState(temporal, scene('t2', 2, 'Makkah', 'Event B'), 'Event B').issues.length === 0, 'accepted event order passes');
  const reverse = createContinuityState(context, []);
  const reverseFirst = updateContinuityState(reverse, scene('t2', 2, 'Makkah', 'Event B'), 'Event B').state;
  assert(updateContinuityState(reverseFirst, scene('t1', 1, 'Makkah', 'Event A'), 'Event A').issues.some((issue) => issue.code === 'TEMPORAL_ORDER_CONFLICT'), 'reversed event order is blocked');
  assert(updateContinuityState(temporal, scene('t3', 3, 'Makkah', 'Event B'), 'Abdullah participates in Event B in 1945').issues.some((issue) => issue.code === 'DECEASED_CHARACTER_ACTIVE'), 'deceased character is blocked after death');

  const reconstruction = createContinuityState(context, [character('Abdullah') as any]);
  const reconstructed = updateContinuityState(reconstruction, scene('r1', 1, 'Makkah', 'Visualized interior'), 'Abdullah wears white robe').state;
  assert(JSON.stringify(reconstructed.visualState).includes('white robe'), 'visual reconstruction is retained as visual state');
  assert(reconstructed.characters[0].clothing.length === 0, 'unknown clothing is not promoted to character fact');

  const unresolved = createContinuityState(context, []);
  unresolved.unresolvedIssues = [{ code: 'UNRESOLVED_CONFLICT', severity: 'WARNING', message: 'conflict preserved' }];
  const unresolvedNext = updateContinuityState(unresolved, scene('u1', 1, 'Makkah', 'Unresolved'), 'neutral').state;
  assert(unresolvedNext.unresolvedIssues.some((issue) => issue.code === 'UNRESOLVED_CONFLICT'), 'unresolved conflict is preserved');

  const idempotent = createContinuityState(undefined, [character('A') as any]);
  const once = updateContinuityState(idempotent, scene('same', 1, 'Makkah', 'Same'), 'A').state;
  const twice = updateContinuityState(once, scene('same', 1, 'Makkah', 'Same'), 'A').state;
  assert(twice.scenes.length === 1, 'continuity update is idempotent');
  assert(buildContinuityPromptContext(twice).includes('characters'), 'prompt context includes continuity state');
  assert(updateContinuityState(createContinuityState(null), scene('legacy', 1, 'Makkah', 'Legacy'), 'legacy').issues.length === 0, 'empty context preserves legacy behavior');

  console.log('PATCH 6.0 PHASE 6 continuity assertions: PASS');
}

main();
