import { createGroundingState, evaluateStageOutput } from './consistency_engine';
import { ContextPackage, ConflictRecord } from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

const context: ContextPackage = {
  version: '1.0',
  contentType: ['HISTORICAL'],
  primaryCategory: 'HISTORICAL',
  researchRequired: true,
  researchSummary: 'fixture',
  sources: [],
  timeline: [{ eventId: 'event_a', label: 'Event A', dateContext: '1943' }, { eventId: 'event_b', label: 'Event B', dateContext: '1945' }],
  events: [
    { eventId: 'event_a', label: 'Event A', startYear: 1943 },
    { eventId: 'event_b', label: 'Event B', startYear: 1945, locationId: 'location_a' },
  ],
  entities: [
    { entityId: 'entity_a', name: 'A', type: 'person', description: 'identity alpha', status: 'DECEASED', deathYear: 1943, sourceIds: ['source_a'] },
    { entityId: 'entity_b', name: 'B', type: 'person', description: 'identity beta', status: 'ALIVE', sourceIds: ['source_a'] },
  ],
  relationships: [{ relationshipId: 'relationship_parent', fromEntity: 'A', toEntity: 'B', relation: 'parent', sourceIds: ['source_a'] }],
  locations: [
    { locationId: 'location_a', name: 'Location A', constraints: ['accepted location'], sourceIds: ['source_a'] },
    { locationId: 'location_b', name: 'Location B', sourceIds: ['source_b'] },
  ],
  objects: [{ objectId: 'object_x', name: 'Product X', description: 'Product X has 16GB', sourceIds: ['source_a'] }],
  facts: [],
  constraints: ['Preserve accepted chronology', 'Preserve accepted identity'],
  unknowns: ['Event A exact date is UNKNOWN'],
  reconstructionRules: ['visualized interior is cinematic reconstruction'],
  groundingStatus: 'complete',
};

function main(): void {
  const unresolved: ConflictRecord = { conflictId: 'conflict_1', claimIds: ['claim_a'], evidenceIds: [], conflictType: 'timeline', severity: 'CRITICAL', status: 'UNRESOLVED' };
  const state = createGroundingState(context, [unresolved]);

  assert(evaluateStageOutput('S1', { event: 'Event B happened in 1945' }, state).status === 'WARNING', 'valid chronology remains allowed while unknown-date warning is preserved');
  assert(evaluateStageOutput('S2', { entityName: 'A', eventName: 'Event B', participation: 'participates' }, state).status === 'BLOCKED', 'deceased-before-event is blocking');
  assert(evaluateStageOutput('S3', 'Event A happened after Event B', state).status === 'BLOCKED', 'event ordering conflict is detected');
  assert(evaluateStageOutput('S4', { entities: [{ name: 'A', identity: 'identity gamma' }] }, state).status === 'BLOCKED', 'entity identity conflict is detected');
  assert(evaluateStageOutput('S5', { relationships: [{ fromEntity: 'B', toEntity: 'A', relation: 'parent' }] }, state).status === 'BLOCKED', 'relationship reversal is detected');
  assert(evaluateStageOutput('S6', { event: 'Event B', location: 'Location B' }, state).status === 'BLOCKED', 'event location conflict is detected');
  assert(evaluateStageOutput('S7', { objectName: 'Product X', attribute: '8GB' }, state).status === 'BLOCKED', 'object attribute conflict is detected');
  const unknownDate = evaluateStageOutput('S1', { event: 'Event A', date: '1943' }, state);
  assert(unknownDate.status === 'WARNING', 'unknown date is warning, not accepted fact');
  assert(evaluateStageOutput('S4', { reconstruction: 'visualized interior' }, state).status === 'WARNING', 'reconstruction remains non-factual');
  const unresolvedReport = evaluateStageOutput('S5', { scene: 'preserve context' }, state);
  assert(unresolvedReport.warnings.some((warning) => warning.includes('conflict_1')), 'unresolved conflict is preserved');
  const stage1Report = evaluateStageOutput('S1', { constraints: 'preserve accepted chronology' }, state);
  const stage8Report = evaluateStageOutput('S8', { constraints: 'preserve accepted chronology' }, state);
  assert(stage1Report.checkedConstraints.length === stage8Report.checkedConstraints.length, 'constraints propagate through all stages');
  assert(evaluateStageOutput('FINAL', { entityName: 'A', eventName: 'Event B', participation: 'living participant' }, state).status === 'BLOCKED', 'final validation detects a Stage 8 violation');
  assert(evaluateStageOutput('S1', { legacy: '5.5-R1 output' }, createGroundingState({ ...context, entities: [], events: [], relationships: [], locations: [], objects: [], facts: [], constraints: [], unknowns: [], reconstructionRules: [], groundingStatus: 'idle' })).status !== 'BLOCKED', 'legacy project has no blocking grounding constraints');

  console.log('PATCH 6.0 PHASE 5 consistency assertions: PASS');
}

main();
