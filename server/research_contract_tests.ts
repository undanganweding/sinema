import {
  buildGroundingContextPackage,
  buildResearchStrategy,
  createResearchPackage,
  createSourceRegistry,
  validateResearchPackage,
} from './grounding_engine';
import {
  ClaimRecord,
  ConflictRecord,
  EvidenceRecord,
  ResearchPackage,
  SourceRegistryEntry,
} from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function source(id: string, verification: SourceRegistryEntry['verification'] = 'VERIFIED'): SourceRegistryEntry {
  return {
    sourceId: id,
    sourceType: 'ACADEMIC_SOURCE',
    title: `Source ${id}`,
    relevance: 0.8,
    authority: 'HIGH',
    verification,
  };
}

function claim(overrides: Partial<ClaimRecord> = {}): ClaimRecord {
  return {
    claimId: 'claim_1',
    subject: 'Halimah',
    predicate: 'nursed',
    object: 'Muhammad',
    normalizedStatement: 'Halimah nursed Muhammad',
    claimType: 'FACT',
    status: 'SUPPORTED',
    evidenceIds: [],
    sourceIds: [],
    confidence: 'UNKNOWN',
    confidenceRationale: 'Not evaluated',
    provenance: 'UNKNOWN',
    ...overrides,
  };
}

function packageWith(overrides: Partial<ResearchPackage> = {}): ResearchPackage {
  const base = createResearchPackage('historical research story', [source('source_1')]);
  return { ...base, ...overrides };
}

function runContractTests(): void {
  const evidence: EvidenceRecord = {
    evidenceId: 'evidence_1',
    sourceId: 'source_1',
    excerpt: 'Halimah nursed Muhammad during his infancy.',
    sourceLocator: { chapter: 'Biography', page: 12 },
    evidenceType: 'DIRECT_QUOTE',
    extractedAt: new Date().toISOString(),
    extractionMethod: 'manual_test_fixture',
  };

  const backed = packageWith({
    evidence: [evidence],
    claims: [claim({ provenance: 'SOURCE_BACKED', evidenceIds: ['evidence_1'], sourceIds: ['source_1'], confidence: 'HIGH' })],
  });
  assert(validateResearchPackage(backed).length === 0, 'source-backed claim with evidence is valid');

  const missingEvidence = packageWith({
    claims: [claim({ provenance: 'SOURCE_BACKED', sourceIds: ['source_1'] })],
  });
  assert(validateResearchPackage(missingEvidence).some((error) => error.includes('no evidence')), 'source-backed claim requires evidence');

  const aiClaim = packageWith({
    claims: [claim({ provenance: 'AI_KNOWLEDGE', evidenceIds: [], sourceIds: [] })],
  });
  assert(validateResearchPackage(aiClaim).length === 0, 'AI knowledge remains distinguishable from source-backed evidence');
  const aiLaundered = packageWith({
    claims: [claim({ provenance: 'AI_KNOWLEDGE', sourceIds: ['source_1'] })],
  });
  assert(validateResearchPackage(aiLaundered).some((error) => error.includes('AI knowledge')), 'AI knowledge cannot be source-laundered');

  const unknownClaim = claim({ claimType: 'UNKNOWN', status: 'NOT_ESTABLISHED', confidence: 'UNKNOWN', provenance: 'UNKNOWN' });
  assert(validateResearchPackage(packageWith({ claims: [unknownClaim] })).length === 0, 'unknown is not treated as false');

  const competingClaims = [
    claim({ claimId: 'claim_a', object: 'Muhammad', normalizedStatement: 'Halimah nursed Muhammad', provenance: 'SOURCE_BACKED', evidenceIds: ['evidence_1'], sourceIds: ['source_1'] }),
    claim({ claimId: 'claim_b', object: 'another child', normalizedStatement: 'Halimah nursed another child', provenance: 'SOURCE_BACKED', evidenceIds: ['evidence_2'], sourceIds: ['source_2'] }),
  ];
  const conflict: ConflictRecord = {
    conflictId: 'conflict_1',
    claimIds: ['claim_a', 'claim_b'],
    evidenceIds: ['evidence_1', 'evidence_2'],
    conflictType: 'MATERIAL_CLAIM_DIFFERENCE',
    severity: 'WARNING',
    status: 'UNRESOLVED',
  };
  const competing = packageWith({
    sources: [source('source_1'), source('source_2')],
    evidence: [evidence, { ...evidence, evidenceId: 'evidence_2', sourceId: 'source_2' }],
    claims: competingClaims,
    conflicts: [conflict],
  });
  assert(competing.claims.length === 2 && competing.conflicts.length === 1, 'conflicting claims coexist without deletion');
  assert(competing.conflicts[0].status === 'UNRESOLVED', 'conflict resolution remains explicit');

  const legacyContext = buildGroundingContextPackage('legacy historical project');
  assert(Array.isArray(legacyContext.sources) && Array.isArray(legacyContext.entities), 'legacy ContextPackage remains valid');
  assert(legacyContext.sources.every((entry) => entry.verification !== undefined), 'legacy synthetic sources are marked for verification');

  const strategy = buildResearchStrategy('A tutorial for a product specification and current version');
  assert(strategy.researchRequirement !== undefined && strategy.freshRequired, 'research strategy exposes additive requirement policy');
}

runContractTests();
console.log('PATCH 6.0 PHASE 3A research contracts: PASS');
