import { createResearchPackage, validateResearchPackage } from './grounding_engine';
import { extractClaimsFromEvidence } from './claim_extraction_engine';
import { EvidenceRecord, SourceRegistryEntry } from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function source(id: string, verification: SourceRegistryEntry['verification'] = 'VERIFIED'): SourceRegistryEntry {
  return { sourceId: id, sourceType: 'ACADEMIC_SOURCE', title: id, url: `https://fixture.invalid/${id}`, authority: 'HIGH', verification, relevance: 0.9 };
}

function evidence(id: string, sourceId: string, excerpt: string, evidenceType: EvidenceRecord['evidenceType'] = 'DIRECT_QUOTE', queryId?: string): EvidenceRecord {
  return { evidenceId: id, sourceId, excerpt, evidenceType, queryId, extractedAt: new Date().toISOString(), extractionMethod: 'phase3d_fixture' };
}

function main(): void {
  const packageData = createResearchPackage('universal evidence extraction', [source('a'), source('b'), source('ai', 'UNVERIFIED')]);
  packageData.evidence = [
    evidence('death', 'a', 'Person A died in 1943.'),
    evidence('before', 'a', 'Person A died before Event B.'),
    evidence('negative', 'a', 'Person A did not participate in Event B.'),
    evidence('parent', 'a', 'Person A was the parent of Person B.'),
    evidence('event', 'a', 'Event B occurred in 1945.'),
    evidence('product100', 'a', 'Model X has RAM = 16GB.'),
    evidence('software', 'a', 'Software X version 2 supports Feature Y.'),
    evidence('ai', 'ai', 'Person Z died in 1900.', 'AI_KNOWLEDGE'),
    evidence('metadata', 'a', '', 'METADATA'),
    evidence('unsupported', 'a', 'Person A died in 1943.'),
  ];
  const first = extractClaimsFromEvidence(packageData);
  const second = extractClaimsFromEvidence(first.researchPackage);
  assert(first.extractedClaims.some((claim) => claim.subject === 'Person A' && claim.predicate === 'DIED' && claim.object === '1943'), 'direct factual extraction works');
  assert(first.extractedClaims.some((claim) => claim.predicate === 'DIED_BEFORE' && claim.object === 'Event B'), 'temporal extraction preserves relative ordering');
  assert(first.extractedClaims.some((claim) => claim.predicate === 'DID_NOT_PARTICIPATE_IN'), 'negation is preserved');
  assert(first.extractedClaims.some((claim) => claim.predicate === 'PARENT_OF'), 'relationship extraction works');
  assert(first.extractedClaims.some((claim) => claim.claimType === 'EVENT' && claim.object === '1945'), 'event date extraction works');
  assert(first.extractedClaims.some((claim) => claim.claimType === 'ATTRIBUTE' && claim.subject === 'Model X'), 'product attribute extraction works');
  assert(first.extractedClaims.some((claim) => claim.qualifiers?.version === '2'), 'software version is preserved');
  const aiClaim = first.extractedClaims.find((claim) => claim.evidenceIds.includes('ai'));
  assert(aiClaim?.provenance === 'AI_KNOWLEDGE' && aiClaim.confidence === 'UNVERIFIED', 'AI knowledge remains unverified');
  assert(first.extractedClaims.every((claim) => claim.evidenceIds.length > 0), 'all extracted claims are evidence-bound');
  assert(first.extractedClaims.every((claim) => claim.sourceIds.includes('a') || claim.provenance === 'AI_KNOWLEDGE'), 'source provenance is preserved');
  assert(second.researchPackage.claims.length === first.researchPackage.claims.length, 'extraction is idempotent');
  assert(first.rejectedEvidenceIds.includes('metadata'), 'ineligible evidence is rejected');
  assert(validateResearchPackage(first.researchPackage).length === 0, 'extracted package satisfies claim provenance validation');
  assert(!first.researchPackage.claims.some((claim) => claim.object === 'Place B'), 'unsupported facts are not invented');
  console.log('PATCH 6.0 PHASE 3D extraction assertions: PASS');
}

main();
