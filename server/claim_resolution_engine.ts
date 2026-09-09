import { createHash } from 'node:crypto';
import {
  AcceptedKnowledge,
  ClaimRecord,
  ConflictRecord,
  ContextPackage,
  FactConfidence,
  GroundingEntity,
  GroundingEvent,
  GroundingRelationship,
  ResearchPackage,
  TemporalRelation,
} from '../src/types';

const GROUNDING_VERSION = '1.0';

export interface NormalizedClaim {
  claim: ClaimRecord;
  subject: string;
  predicate: string;
  object: string;
  qualifiers: Record<string, string | number | boolean>;
  identity: string;
}

export interface ResolutionResult {
  researchPackage: ResearchPackage;
  acceptedKnowledge: AcceptedKnowledge;
  contextPackage: ContextPackage;
}

function validateResearchPackageForResolution(researchPackage: ResearchPackage): string[] {
  const sourceIds = new Set(researchPackage.sources.map((source) => source.sourceId));
  const evidenceIds = new Set(researchPackage.evidence.map((evidence) => evidence.evidenceId));
  // O(1) lookup map replacing linear .find() in claim evidence validation loop
  const evidenceById = new Map(researchPackage.evidence.map((e) => [e.evidenceId, e]));
  const errors: string[] = [];
  for (const claim of researchPackage.claims) {
    if (claim.provenance === 'SOURCE_BACKED' || claim.provenance === 'MULTI_SOURCE_BACKED') {
      if (claim.evidenceIds.length === 0) errors.push(`Claim ${claim.claimId} is source-backed but has no evidence.`);
      if (claim.sourceIds.some((sourceId) => !sourceIds.has(sourceId))) errors.push(`Claim ${claim.claimId} references an unknown source.`);
      if (claim.evidenceIds.some((evidenceId) => !evidenceIds.has(evidenceId))) errors.push(`Claim ${claim.claimId} references unknown evidence.`);
      if (claim.evidenceIds.some((evidenceId) => {
        const item = evidenceById.get(evidenceId);
        return item && !claim.sourceIds.includes(item.sourceId);
      })) errors.push(`Claim ${claim.claimId} references evidence outside its source provenance.`);
    }
    if (claim.provenance === 'AI_KNOWLEDGE' && claim.sourceIds.length > 0) errors.push(`Claim ${claim.claimId} cannot attribute AI knowledge directly to sources.`);
  }
  return errors;
}

const predicateAliases: Record<string, string> = {
  nursed: 'NURSED',
  nursing: 'NURSED',
  'foster mother': 'NURSED',
  'foster parent': 'NURSED',
  'fostered by': 'NURSED',
  died: 'DIED',
  death: 'DIED',
  born: 'BORN',
  participated: 'PARTICIPATED_IN',
  'participated in': 'PARTICIPATED_IN',
  occurred: 'OCCURRED_AT',
  happened: 'OCCURRED_AT',
  before: 'BEFORE',
  after: 'AFTER',
  during: 'DURING',
  overlaps: 'OVERLAPS',
};

function canonical(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function canonicalPredicate(value: string): string {
  const normalized = canonical(value);
  return predicateAliases[normalized] || normalized.toUpperCase().replace(/\s+/g, '_');
}

function stableIdentity(subject: string, predicate: string, object: string, qualifiers: Record<string, string | number | boolean>): string {
  const qualifierText = Object.keys(qualifiers).sort().map((key) => `${key}=${String(qualifiers[key])}`).join('|');
  return createHash('sha256').update(`${subject}|${predicate}|${object}|${qualifierText}`).digest('hex').slice(0, 24);
}

export function normalizeClaim(claim: ClaimRecord): NormalizedClaim {
  const subject = canonical(claim.subject);
  const predicate = canonicalPredicate(claim.predicate);
  const object = canonical(claim.object);
  const qualifiers = Object.fromEntries(Object.entries(claim.qualifiers || {}).filter(([, value]) => value !== undefined)) as Record<string, string | number | boolean>;
  const identity = stableIdentity(subject, predicate, object, qualifiers);
  return { claim: { ...claim, claimIdentity: identity }, subject, predicate, object, qualifiers, identity };
}

// Fast claim evidence quality evaluation using O(1) Map lookups instead of linear searches.
function claimEvidenceQuality(
  claim: ClaimRecord,
  researchPackage: ResearchPackage,
  evidenceById?: Map<string, unknown>,
  sourcesById?: Map<string, { authority?: string }>
): number {
  const evMap = evidenceById || new Map(researchPackage.evidence.map((item) => [item.evidenceId, item]));
  const srcMap = sourcesById || new Map(researchPackage.sources.map((source) => [source.sourceId, source]));

  let validEvidenceCount = 0;
  for (const id of claim.evidenceIds) {
    if (evMap.has(id)) validEvidenceCount += 1;
  }

  let highCount = 0;
  let mediumCount = 0;
  for (const id of claim.sourceIds) {
    const authority = srcMap.get(id)?.authority || 'UNKNOWN';
    if (authority === 'HIGH') highCount += 1;
    else if (authority === 'MEDIUM') mediumCount += 1;
  }

  return validEvidenceCount * 2 + highCount * 2 + mediumCount;
}

function claimConflictType(a: NormalizedClaim, b: NormalizedClaim): ConflictRecord['conflictType'] | null {
  if (a.subject !== b.subject) return null;
  if (a.predicate === b.predicate && a.object !== b.object) {
    return ['DIED', 'BORN', 'BEFORE', 'AFTER', 'DURING', 'OVERLAPS'].includes(a.predicate) || /date|year|time|chronolog/.test(a.predicate)
      ? 'TEMPORAL_CONTRADICTION'
      : 'DIRECT_CONTRADICTION';
  }
  if (a.predicate === 'PARTICIPATED_IN' && b.predicate === 'DIED' && a.qualifiers.eventId && b.qualifiers.eventId && a.qualifiers.eventId === b.qualifiers.eventId) return 'ENTITY_CONTRADICTION';
  if (a.predicate === 'PARTICIPATED_IN' && b.predicate === 'DIED' && a.object === b.qualifiers.eventId) return 'TEMPORAL_CONTRADICTION';
  return null;
}

// Group claims by subject to optimize detectClaimConflicts from O(N^2) to O(sum S_i^2) where S_i is per-subject claim count.
export function detectClaimConflicts(researchPackage: ResearchPackage): ConflictRecord[] {
  const normalized = researchPackage.claims.map(normalizeClaim);
  const bySubject = new Map<string, NormalizedClaim[]>();
  for (const claim of normalized) {
    let list = bySubject.get(claim.subject);
    if (!list) {
      list = [];
      bySubject.set(claim.subject, list);
    }
    list.push(claim);
  }

  const conflicts: ConflictRecord[] = [];
  for (const group of bySubject.values()) {
    for (let index = 0; index < group.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < group.length; otherIndex += 1) {
        const first = group[index];
        const second = group[otherIndex];
        const conflictType = claimConflictType(first, second);
        if (!conflictType) continue;
        conflicts.push({
          conflictId: `conflict_${first.identity}_${second.identity}`,
          claimIds: [first.claim.claimId, second.claim.claimId],
          evidenceIds: Array.from(new Set([...first.claim.evidenceIds, ...second.claim.evidenceIds])),
          conflictType,
          severity: 'WARNING',
          status: 'UNRESOLVED',
        });
      }
    }
  }
  return conflicts;
}

export function resolveClaimConflicts(researchPackage: ResearchPackage, conflicts: ConflictRecord[]): ConflictRecord[] {
  // Pre-index claims, evidence, and sources to avoid linear array scans for every conflict.
  const claimsById = new Map(researchPackage.claims.map((claim) => [claim.claimId, claim]));
  const evidenceById = new Map(researchPackage.evidence.map((e) => [e.evidenceId, e]));
  const sourcesById = new Map(researchPackage.sources.map((s) => [s.sourceId, s]));

  return conflicts.map((conflict) => {
    const candidates = conflict.claimIds
      .map((claimId) => claimsById.get(claimId))
      .filter((claim): claim is ClaimRecord => Boolean(claim));
    if (candidates.length !== 2) return conflict;
    const scores = candidates.map((claim) => claimEvidenceQuality(claim, researchPackage, evidenceById, sourcesById));
    if (scores[0] === scores[1]) {
      return { ...conflict, status: 'UNRESOLVED', resolution: 'UNRESOLVED', resolutionRationale: 'Competing claims have no defensible evidence-quality advantage.' };
    }
    const winner = scores[0] > scores[1] ? candidates[0] : candidates[1];
    return {
      ...conflict,
      status: 'PREFERRED_CLAIM',
      resolution: `PREFER_CLAIM_${winner.claimId}`,
      resolutionRationale: 'Preferred using linked evidence count and source authority; competing claim remains preserved.',
    };
  });
}

function confidenceForClaim(
  claim: ClaimRecord,
  researchPackage: ResearchPackage,
  conflicted: boolean,
  evidenceById?: Map<string, unknown>,
  sourcesById?: Map<string, { authority?: string }>
): FactConfidence {
  if (conflicted) return 'UNKNOWN';
  if (claim.evidenceIds.length === 0) return claim.provenance === 'AI_KNOWLEDGE' ? 'UNVERIFIED' : 'UNKNOWN';
  const quality = claimEvidenceQuality(claim, researchPackage, evidenceById, sourcesById);
  if (quality >= 6) return 'HIGH';
  if (quality >= 3) return 'MEDIUM';
  return 'LOW';
}

function extractEntity(name: string, type: string, claim: ClaimRecord): GroundingEntity {
  return { entityId: `entity_${canonical(name).replace(/ /g, '_')}`, name, type, status: 'UNKNOWN', sourceIds: claim.sourceIds, constraints: [], };
}

function yearFrom(value: string): number | undefined {
  const match = value.match(/\b(\d{3,4})\b/);
  return match ? Number(match[1]) : undefined;
}

function buildAcceptedKnowledge(researchPackage: ResearchPackage, conflicts: ConflictRecord[]): AcceptedKnowledge {
  const unresolved = new Set(conflicts.filter((conflict) => conflict.status === 'UNRESOLVED').flatMap((conflict) => conflict.claimIds));
  const preferredLosers = new Set(conflicts
    .filter((conflict) => conflict.status === 'PREFERRED_CLAIM')
    .flatMap((conflict) => conflict.claimIds.filter((claimId) => conflict.resolution !== `PREFER_CLAIM_${claimId}`)));
  const sourceIds = new Set(researchPackage.sources.map((source) => source.sourceId));
  const evidenceById = new Map(researchPackage.evidence.map((evidence) => [evidence.evidenceId, evidence]));
  const usableClaims = researchPackage.claims.filter((claim) =>
    claim.status !== 'UNSUPPORTED' && claim.status !== 'NOT_ESTABLISHED' && claim.provenance !== 'UNKNOWN' &&
    !((claim.provenance === 'SOURCE_BACKED' || claim.provenance === 'MULTI_SOURCE_BACKED') &&
      (claim.evidenceIds.length === 0 || claim.sourceIds.some((sourceId) => !sourceIds.has(sourceId)) ||
        claim.evidenceIds.some((evidenceId) => !evidenceById.has(evidenceId) || !claim.sourceIds.includes(evidenceById.get(evidenceId)!.sourceId)))) &&
    !(claim.provenance === 'AI_KNOWLEDGE' && claim.sourceIds.length > 0)
  );
  const sourcesById = new Map(researchPackage.sources.map((s) => [s.sourceId, s]));
  const acceptedClaims = usableClaims.filter((claim) => !unresolved.has(claim.claimId) && !preferredLosers.has(claim.claimId)).map((claim) => ({
    ...claim,
    confidence: confidenceForClaim(claim, researchPackage, unresolved.has(claim.claimId), evidenceById, sourcesById),
    confidenceRationale: unresolved.has(claim.claimId) ? 'Conflicting claims remain unresolved.' : claim.evidenceIds.length > 0 ? 'Derived from linked evidence and source metadata.' : 'No evidence-backed certainty established.',
  }));
  const entities = new Map<string, GroundingEntity>();
  const relationships: GroundingRelationship[] = [];
  const events: GroundingEvent[] = [];
  const timelineFacts: AcceptedKnowledge['timelineFacts'] = [];
  for (const claim of acceptedClaims) {
    const subject = extractEntity(claim.subject, 'OTHER', claim);
    entities.set(subject.entityId, subject);
    if (claim.object && !['DIED', 'BORN'].includes(canonicalPredicate(claim.predicate))) {
      const object = extractEntity(claim.object, 'OTHER', claim);
      entities.set(object.entityId, object);
    }
    const predicate = canonicalPredicate(claim.predicate);
    if (predicate === 'PARTICIPATED_IN' || predicate === 'OCCURRED_AT') {
      const eventId = `event_${canonical(claim.object).replace(/ /g, '_')}`;
      const eventYear = typeof claim.qualifiers?.eventYear === 'number' ? claim.qualifiers.eventYear : yearFrom(claim.object);
      events.push({ eventId, label: claim.object, participantEntityIds: predicate === 'PARTICIPATED_IN' ? [subject.entityId] : [], sourceIds: claim.sourceIds, sourceClaimIds: [claim.claimId], confidence: claim.confidence, status: claim.status });
      if (eventYear !== undefined) {
        events[events.length - 1].startYear = eventYear;
        events[events.length - 1].endYear = eventYear;
      }
    }
    if (predicate === 'BEFORE' || predicate === 'AFTER' || predicate === 'DURING' || predicate === 'OVERLAPS') {
      timelineFacts.push({ subject: claim.subject, relation: predicate as TemporalRelation, object: claim.object, claimIds: [claim.claimId], sourceIds: claim.sourceIds });
    }
    if (predicate === 'DIED' || predicate === 'BORN') {
      timelineFacts.push({ subject: claim.subject, relation: 'UNKNOWN', object: `${predicate} ${claim.object}`, claimIds: [claim.claimId], sourceIds: claim.sourceIds });
    }
    relationships.push({ relationshipId: `relationship_${claim.claimId}`, fromEntity: subject.entityId, toEntity: `entity_${canonical(claim.object).replace(/ /g, '_')}`, relation: predicate, sourceIds: claim.sourceIds, claimIds: [claim.claimId] });
  }
  for (const claim of acceptedClaims) {
    const subjectId = `entity_${canonical(claim.subject).replace(/ /g, '_')}`;
    const entity = entities.get(subjectId);
    if (!entity) continue;
    const predicate = canonicalPredicate(claim.predicate);
    const year = yearFrom(claim.object);
    if (predicate === 'DIED' && year !== undefined) entity.deathYear = year;
    if (predicate === 'BORN' && year !== undefined) entity.birthYear = year;
  }
  return {
    acceptedClaims,
    acceptedEntities: Array.from(entities.values()),
    acceptedEvents: events,
    acceptedRelationships: relationships,
    timelineFacts,
    unresolvedConflicts: conflicts.filter((conflict) => conflict.status === 'UNRESOLVED'),
    reconstructionBoundaries: ['Unsupported visual details remain reconstruction or UNKNOWN and are not source-backed facts.'],
  };
}

export function contextPackageFromAcceptedKnowledge(researchPackage: ResearchPackage, knowledge: AcceptedKnowledge): ContextPackage {
  const facts = knowledge.acceptedClaims.map((claim) => ({
    factId: claim.claimId,
    description: claim.normalizedStatement,
    provenance: claim.provenance === 'SOURCE_BACKED' || claim.provenance === 'MULTI_SOURCE_BACKED' ? 'SOURCE_FACT' as const : claim.provenance === 'RECONSTRUCTED' ? 'CINEMATIC_RECONSTRUCTION' as const : 'UNKNOWN' as const,
    sourceIds: claim.sourceIds,
    confidence: claim.confidence === 'HIGH' ? 'High' as const : claim.confidence === 'MEDIUM' ? 'Medium' as const : claim.confidence === 'LOW' ? 'Low' as const : undefined,
    claimId: claim.claimId,
    evidenceIds: claim.evidenceIds,
  }));
  // Pre-index accepted claim evidence IDs for O(1) timeline evidence lookup instead of O(acceptedClaims) filter per fact
  const claimEvidenceMap = new Map(knowledge.acceptedClaims.map((claim) => [claim.claimId, claim.evidenceIds]));
  const timeline = knowledge.timelineFacts.map((fact, index) => ({
    eventId: `timeline_${index}`,
    label: `${fact.subject} ${fact.relation} ${fact.object}`,
    sourceIds: fact.sourceIds,
    claimIds: fact.claimIds,
    evidenceIds: fact.claimIds.flatMap((claimId) => claimEvidenceMap.get(claimId) || []),
    notes: 'Derived from accepted claim.',
  }));
  const context: ContextPackage = {
    version: GROUNDING_VERSION,
    contentType: researchPackage.classification.categories,
    primaryCategory: researchPackage.classification.primaryCategory,
    researchRequired: researchPackage.researchRequirement === 'RESEARCH_REQUIRED' || researchPackage.researchRequirement === 'RESEARCH_RECOMMENDED',
    researchSummary: 'Context derived from resolved research knowledge.',
    sources: researchPackage.sources,
    timeline,
    events: knowledge.acceptedEvents,
    entities: knowledge.acceptedEntities,
    relationships: knowledge.acceptedRelationships,
    locations: [],
    objects: [],
    facts,
    constraints: knowledge.acceptedClaims.map((claim) => `Preserve accepted claim: ${claim.normalizedStatement}`),
    unknowns: researchPackage.unresolvedQuestions.map((question) => question.reason),
    reconstructionRules: knowledge.reconstructionBoundaries,
    groundingStatus: knowledge.unresolvedConflicts.length > 0 ? 'partial' : 'complete',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return context;
}

export function resolveResearchPackage(input: ResearchPackage): ResolutionResult {
  const researchPackage = { ...input, claims: input.claims.map((claim) => normalizeClaim(claim).claim) };
  const validationErrors = validateResearchPackageForResolution(researchPackage);
  const detectedConflicts = detectClaimConflicts(researchPackage);
  const conflicts = resolveClaimConflicts(researchPackage, detectedConflicts);
  const acceptedKnowledge = buildAcceptedKnowledge(researchPackage, conflicts);
  const contextPackage = contextPackageFromAcceptedKnowledge(researchPackage, acceptedKnowledge);
  return {
    researchPackage: { ...researchPackage, conflicts: [...researchPackage.conflicts, ...conflicts] },
    acceptedKnowledge,
    contextPackage: validationErrors.length > 0 ? { ...contextPackage, groundingStatus: 'partial', unknowns: [...contextPackage.unknowns, ...validationErrors] } : contextPackage,
  };
}
