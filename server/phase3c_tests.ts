import { createResearchPackage, validateResearchPackage } from './grounding_engine';
import { contextPackageFromAcceptedKnowledge, detectClaimConflicts, normalizeClaim, resolveResearchPackage } from './claim_resolution_engine';
import { ClaimRecord, EvidenceRecord, SourceRegistryEntry } from '../src/types';
import { evaluateEntityForEvent } from './grounding_validator';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

const sources: SourceRegistryEntry[] = [
  { sourceId: 'source_a', sourceType: 'HISTORICAL_SOURCE', title: 'Primary record', authority: 'HIGH', verification: 'VERIFIED', relevance: 0.9 },
  { sourceId: 'source_b', sourceType: 'ACADEMIC_SOURCE', title: 'Academic study', authority: 'MEDIUM', verification: 'VERIFIED', relevance: 0.8 },
];

function evidence(id: string, sourceId: string, excerpt: string): EvidenceRecord {
  return { evidenceId: id, sourceId, excerpt, evidenceType: 'DIRECT_QUOTE', extractedAt: new Date().toISOString(), extractionMethod: 'test_fixture' };
}

function claim(id: string, subject: string, predicate: string, object: string, sourceId: string, evidenceId: string, qualifiers?: ClaimRecord['qualifiers']): ClaimRecord {
  return {
    claimId: id, subject, predicate, object, normalizedStatement: `${subject} ${predicate} ${object}`,
    claimType: 'FACT', status: 'SUPPORTED', evidenceIds: [evidenceId], sourceIds: [sourceId], confidence: 'UNKNOWN', confidenceRationale: '', provenance: 'SOURCE_BACKED', qualifiers,
  };
}

function main(): void {
  const equivalentA = normalizeClaim(claim('c1', 'Halimah', 'nursed', 'Muhammad ﷺ', 'source_a', 'e1'));
  const equivalentB = normalizeClaim(claim('c2', 'Halimah', 'foster mother', 'Muhammad', 'source_b', 'e2'));
  assert(equivalentA.identity === equivalentB.identity, 'semantically equivalent claims share stable identity');

  const packageData = createResearchPackage('generic historical event', sources);
  packageData.evidence = [
    evidence('e1', 'source_a', 'Halimah nursed Muhammad.'),
    evidence('e2', 'source_b', 'Halimah became a foster mother through nursing.'),
    evidence('e3', 'source_a', 'Person X died in 1943.'),
    evidence('e4', 'source_b', 'Person X died in 1944.'),
    evidence('e5', 'source_a', 'Person X participated in Event Y.'),
  ];
  packageData.claims = [
    claim('c1', 'Halimah', 'nursed', 'Muhammad ﷺ', 'source_a', 'e1'),
    claim('c2', 'Halimah', 'foster mother', 'Muhammad', 'source_b', 'e2'),
    claim('death_a', 'Person X', 'died', '1943', 'source_a', 'e3'),
    claim('death_b', 'Person X', 'died', '1944', 'source_b', 'e4'),
    claim('participation', 'Person X', 'participated in', 'Event Y', 'source_a', 'e5', { eventYear: 1945 }),
  ];
  assert(validateResearchPackage(packageData).length === 0, 'all source-backed fixture claims have evidence');

  const conflicts = detectClaimConflicts(packageData);
  assert(conflicts.some((conflict) => conflict.conflictType === 'TEMPORAL_CONTRADICTION'), 'generic temporal conflict is detected');
  assert(packageData.claims.length === 5, 'conflict detection does not delete competing claims');

  const resolved = resolveResearchPackage(packageData);
  assert(resolved.researchPackage.claims.length === 5, 'resolution preserves all inspectable claims');
  assert(resolved.researchPackage.conflicts.some((conflict) => conflict.status === 'UNRESOLVED' || conflict.status === 'PREFERRED_CLAIM'), 'resolution status is explicit');
  assert(resolved.acceptedKnowledge.acceptedEntities.some((entity) => entity.name === 'Person X'), 'entities are built from accepted knowledge');
  assert(resolved.acceptedKnowledge.acceptedEvents.some((event) => event.label === 'Event Y'), 'events are built from accepted knowledge');
  assert(resolved.acceptedKnowledge.acceptedRelationships.some((relationship) => relationship.relation === 'PARTICIPATED_IN'), 'relationships are built from accepted knowledge');

  const context = contextPackageFromAcceptedKnowledge(resolved.researchPackage, resolved.acceptedKnowledge);
  assert(context.facts.some((fact) => fact.claimId === 'c1' && fact.evidenceIds?.includes('e1')), 'claim and evidence provenance survives into ContextPackage');
  const person = resolved.acceptedKnowledge.acceptedEntities.find((entity) => entity.name === 'Person X');
  const event = resolved.acceptedKnowledge.acceptedEvents.find((item) => item.label === 'Event Y');
  assert(person && event, 'temporal fixture entity and event exist');
  const temporal = evaluateEntityForEvent(person, event);
  assert(temporal.temporalState === 'DECEASED_BEFORE_EVENT', 'timeline-derived temporal constraint is generic');
  assert(temporal.participation === 'FORBIDDEN_AS_LIVING_PARTICIPANT', 'timeline-derived participation constraint is generic');

  const reconstruction = claim('reconstruction', 'Unknown house', 'has interior', 'exact layout', 'source_a', 'missing');
  reconstruction.evidenceIds = [];
  reconstruction.provenance = 'RECONSTRUCTED';
  reconstruction.claimType = 'RECONSTRUCTION';
  reconstruction.confidence = 'UNKNOWN';
  const reconstructionPackage = createResearchPackage('fictional reconstruction', sources);
  reconstructionPackage.claims = [reconstruction];
  assert(validateResearchPackage(reconstructionPackage).length === 0, 'reconstruction without evidence is not falsely source-backed');

  console.log('PATCH 6.0 PHASE 3C resolution assertions: PASS');
}

main();
