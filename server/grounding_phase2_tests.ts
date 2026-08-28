import { buildGroundingContextPackage, classifyContent } from './grounding_engine';
import { applyGroundingValidation, buildGroundingConstraints, buildGroundingPromptContext, evaluateEntityForEvent } from './grounding_validator';
import { ContextPackage, GroundingEntity, GroundingEvent, Scene } from '../src/types';
import { serializeMasterSceneData } from './cinematic_prompt_engine';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function contextFor(event: GroundingEvent, entities: GroundingEntity[], category: ContextPackage['primaryCategory'] = 'HISTORICAL'): ContextPackage {
  return {
    version: '1.0',
    contentType: [category!],
    primaryCategory: category,
    researchRequired: category !== 'FICTION',
    researchSummary: 'test fixture',
    sources: [{ sourceId: 'source_test', sourceType: 'ACADEMIC_SOURCE', title: 'Test source' }],
    timeline: [{ eventId: event.eventId, label: event.label, sourceIds: ['source_test'] }],
    events: [event],
    entities,
    relationships: [],
    locations: [],
    objects: [],
    facts: [],
    constraints: ['Ground first. Create second.'],
    unknowns: [],
    reconstructionRules: ['Reconstruction must not contradict grounded facts.'],
    groundingStatus: 'complete',
  };
}

function runTemporalTests(): void {
  const event: GroundingEvent = {
    eventId: 'halimah-infant-care',
    label: 'infancy of Muhammad',
    startYear: 571,
    endYear: 576,
    participantEntityIds: ['muhammad', 'halimah'],
  };
  const context = contextFor(event, [
    { entityId: 'muhammad', name: 'Muhammad', type: 'person', birthYear: 570, deathYear: 632, sourceIds: ['source_test'] },
    { entityId: 'halimah', name: 'Halimah', type: 'person', birthYear: 540, deathYear: 650, sourceIds: ['source_test'] },
    { entityId: 'abdullah', name: 'Abdullah ibn Abdul-Muttalib', type: 'person', deathYear: 570, sourceIds: ['source_test'] },
  ], 'RELIGIOUS');
  const abdullah = evaluateEntityForEvent(context.entities[2], event);
  assert(abdullah.temporalState === 'DECEASED_BEFORE_EVENT', 'Halimah canary computes deceased-before-event generically');
  assert(abdullah.participation === 'FORBIDDEN_AS_LIVING_PARTICIPANT', 'Halimah canary forbids living participation');
  const stage2Validation = applyGroundingValidation(context, ['Muhammad', 'Abdullah ibn Abdul-Muttalib']);
  assert(stage2Validation.blockedEntities.includes('Abdullah ibn Abdul-Muttalib'), 'Stage 2 blocked entity does not survive validation');
  assert(stage2Validation.issues?.some((issue) => issue.action === 'BLOCKED'), 'blocked result is traceable');

  const unborn = evaluateEntityForEvent(
    { entityId: 'future', name: 'Person B', type: 'person', birthYear: 600, sourceIds: ['source_test'] },
    { eventId: 'earlier', label: 'earlier event', startYear: 590, endYear: 595 }
  );
  assert(unborn.temporalState === 'NOT_YET_BORN', 'birth bounds produce not-yet-born state');
}

function runCategoryTests(): void {
  const fixtures = [
    ['WWII scenario in 1944 with an unverified modern device', 'HISTORICAL'],
    ['A Javanese historical event in Central Java with local cultural context', 'HISTORICAL'],
    ['A fictional world with invented chronology and technology', 'FICTION'],
    ['Affiliate review for a product with manufacturer specifications and price', 'COMMERCIAL'],
    ['Tutorial for software version 4.2 and its documented features', 'TUTORIAL'],
  ] as const;
  for (const [script, category] of fixtures) {
    const result = classifyContent(script);
    assert(result.categories.includes(category), `${category} classification is detected`);
  }
}

function runStageContextTests(): void {
  const context = contextFor(
    { eventId: 'event', label: 'grounded event', startYear: 1944, endYear: 1944 },
    [{ entityId: 'person', name: 'Person A', type: 'person', birthYear: 1900, deathYear: 1980, sourceIds: ['source_test'] }]
  );
  context.locations.push({ locationId: 'location', name: 'Location', period: '1944', constraints: ['Use the grounded period and geography.'] });
  context.objects.push({ objectId: 'object', name: 'Object', constraints: ['Object must be source-compatible.'] });
  context.culturalContext = ['Preserve grounded cultural context.'];
  const promptContext = buildGroundingPromptContext(context);
  for (const stage of ['STAGE_3', 'STAGE_4', 'STAGE_5', 'STAGE_6', 'STAGE_7', 'STAGE_8']) {
    assert(promptContext.includes('grounded event'), `${stage} grounding context is serializable`);
  }
  assert(buildGroundingConstraints(context).constraints.length > 0, 'dynamic constraints are generated');
  assert(buildGroundingConstraints(context).constraints.some((constraint) => constraint.scope === 'location'), 'location constraints are generated dynamically');
  assert(buildGroundingConstraints(context).constraints.some((constraint) => constraint.scope === 'object'), 'object constraints are generated dynamically');

  const scene: Scene = {
    project_id: 'test', scene_number: 1, title: 'Grounded scene', duration_sec: 10,
    story_purpose: 'test', location_name: 'Location', time_of_day: 'DAY', character_names: ['Person A'],
    emotional_objective: 'test', event: 'grounded event', narrative_function: 'test',
    version: 1, updated_at: new Date().toISOString(),
  };
  const serialized = serializeMasterSceneData(scene, [], null, [], [], [], 'banana', 'cinematic', 'Test', 10, context);
  assert(serialized.story_context.includes('GROUNDING CONSTRAINTS'), 'Stage 7 and Stage 8 shared serializer receives grounding');
}

function main(): void {
  runTemporalTests();
  runCategoryTests();
  runStageContextTests();
  const generic = buildGroundingContextPackage('A fictional story with an invented timeline.');
  assert(generic.entities.length === 0, 'generic engine does not inject case-specific historical entities');
  console.log('PATCH 6.0 PHASE 2 grounding assertions: PASS');
}

main();
