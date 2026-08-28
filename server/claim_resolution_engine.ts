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
  const errors: string[] = [];
  for (const claim of researchPackage.claims) {
    if (claim.provenance === 'SOURCE_BACKED' || claim.provenance === 'MULTI_SOURCE_BACKED') {
      if (claim.evidenceIds.length === 0) errors.push(`Claim ${claim.claimId} is source-backed but has no evidence.`);
      if (claim.sourceIds.some((sourceId) => !sourceIds.has(sourceId))) errors.push(`Claim ${claim.claimId} references an unknown source.`);
      if (claim.evidenceIds.some((evidenceId) => !evidenceIds.has(evidenceId))) errors.push(`Claim ${claim.claimId} references unknown evidence.`);
      if (claim.evidenceIds.some((evidenceId) => {
        const item = researchPackage.evidence.find((evidence) => evidence.evidenceId === evidenceId);
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

function claimEvidenceQuality(claim: ClaimRecord, researchPackage: ResearchPackage): number {
  const evidence = claim.evidenceIds.map((id) => researchPackage.evidence.find((item) => item.evidenceId === id)).filter(Boolean);
  const authorities = claim.sourceIds.map((id) => researchPackage.sources.find((source) => source.sourceId === id)?.authority || 'UNKNOWN');
  return evidence.length * 2 + authorities.filter((authority) => authority === 'HIGH').length * 2 + authorities.filter((authority) => authority === 'MEDIUM').length;
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

export function detectClaimConflicts(researchPackage: ResearchPackage): ConflictRecord[] {
  const normalized = researchPackage.claims.map(normalizeClaim);
  const conflicts: ConflictRecord[] = [];
  for (let index = 0; index < normalized.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < normalized.length; otherIndex += 1) {
      const first = normalized[index];
      const second = normalized[otherIndex];
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
  return conflicts;
}

export function resolveClaimConflicts(researchPackage: ResearchPackage, conflicts: ConflictRecord[]): ConflictRecord[] {
  return conflicts.map((conflict) => {
    const candidates = conflict.claimIds
      .map((claimId) => researchPackage.claims.find((claim) => claim.claimId === claimId))
      .filter((claim): claim is ClaimRecord => Boolean(claim));
    if (candidates.length !== 2) return conflict;
    const scores = candidates.map((claim) => claimEvidenceQuality(claim, researchPackage));
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

function confidenceForClaim(claim: ClaimRecord, researchPackage: ResearchPackage, conflicted: boolean): FactConfidence {
  if (conflicted) return 'UNKNOWN';
  if (claim.evidenceIds.length === 0) return claim.provenance === 'AI_KNOWLEDGE' ? 'UNVERIFIED' : 'UNKNOWN';
  const quality = claimEvidenceQuality(claim, researchPackage);
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
  const acceptedClaims = usableClaims.filter((claim) => !unresolved.has(claim.claimId) && !preferredLosers.has(claim.claimId)).map((claim) => ({
    ...claim,
    confidence: confidenceForClaim(claim, researchPackage, unresolved.has(claim.claimId)),
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
  const timeline = knowledge.timelineFacts.map((fact, index) => ({ eventId: `timeline_${index}`, label: `${fact.subject} ${fact.relation} ${fact.object}`, sourceIds: fact.sourceIds, claimIds: fact.claimIds, evidenceIds: knowledge.acceptedClaims.filter((claim) => fact.claimIds.includes(claim.claimId)).flatMap((claim) => claim.evidenceIds), notes: 'Derived from accepted claim.' }));
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
