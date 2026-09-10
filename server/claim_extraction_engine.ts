import {
  ClaimRecord,
  ClaimExtractionMode,
  ClaimExtractionStatus,
  EvidenceRecord,
  ResearchPackage,
} from '../src/types';

export const CLAIM_EXTRACTION_VERSION = '1.0';

export interface ClaimExtractionResult {
  researchPackage: ResearchPackage;
  extractedClaims: ClaimRecord[];
  rejectedEvidenceIds: string[];
}

interface CandidateClaim {
  subject: string;
  predicate: string;
  object: string;
  claimType: ClaimRecord['claimType'];
  qualifiers?: ClaimRecord['qualifiers'];
  mode: ClaimExtractionMode;
  status: ClaimExtractionStatus;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalized(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function idForEvidence(evidence: EvidenceRecord): string {
  return `${evidence.evidenceId}_${CLAIM_EXTRACTION_VERSION}`;
}

function claimId(evidence: EvidenceRecord, candidate: CandidateClaim): string {
  return `claim_${idForEvidence(evidence)}_${normalized(candidate.subject)}_${normalized(candidate.predicate)}_${normalized(candidate.object)}`
    .replace(/[^a-z0-9_]+/g, '_');
}

function sourceBacked(evidence: EvidenceRecord, sourceVerification: string | undefined): boolean {
  return evidence.evidenceType !== 'AI_KNOWLEDGE' && sourceVerification === 'VERIFIED';
}

// Pre-compiled regex patterns to avoid recompiling RegExp objects on every candidatesFromExcerpt execution
const REGEX_YEAR = '(\\d{4})';
const REGEX_ENTITY = '([A-Z][A-Za-zÀ-ÿ]*(?:\\s+[A-Z][A-Za-zÀ-ÿ-]*)*)';

const PATTERN_DEATH = new RegExp(`${REGEX_ENTITY}\\s+(?:died|dies|death was)\\s+in\\s+${REGEX_YEAR}`, 'i');
const PATTERN_BEFORE = new RegExp(`${REGEX_ENTITY}\\s+(?:died|was killed|passed away)\\s+before\\s+([^.!?]+)`, 'i');
const PATTERN_EVENT_DATE = new RegExp(`([^.!?]+?)\\s+(?:occurred|happened|took place)\\s+in\\s+${REGEX_YEAR}`, 'i');
const PATTERN_NEGATIVE_PARTICIPATION = new RegExp(`${REGEX_ENTITY}\\s+did\\s+not\\s+participate\\s+in\\s+([^.!?]+)`, 'i');
const PATTERN_PARTICIPATION = new RegExp(`${REGEX_ENTITY}\\s+participated\\s+in\\s+([^.!?]+)`, 'i');
const PATTERN_PARENT = new RegExp(`${REGEX_ENTITY}\\s+was\\s+the\\s+parent\\s+of\\s+${REGEX_ENTITY}`, 'i');
const PATTERN_SPECIFICATION = new RegExp(`${REGEX_ENTITY}\\s+(?:has|with)\\s+([^.!?=]+?)\\s*(?:=|is)\\s*([^.!?]+)`, 'i');
const PATTERN_VERSION_FEATURE = new RegExp(`${REGEX_ENTITY}\\s+version\\s+([\\w.-]+)\\s+(?:supports|includes)\\s+([^.!?]+)`, 'i');
const PATTERN_OCCURRED_AT = new RegExp(`${REGEX_ENTITY}\\s+(?:occurred|happened)\\s+at\\s+([^.!?]+)`, 'i');

function candidatesFromExcerpt(excerpt: string): CandidateClaim[] {
  const candidates: CandidateClaim[] = [];
  const add = (candidate: CandidateClaim) => candidates.push(candidate);

  const death = PATTERN_DEATH.exec(excerpt);
  if (death) add({ subject: death[1], predicate: 'DIED', object: death[2], claimType: 'FACT', mode: 'DIRECT', status: 'SUPPORTED' });

  const before = PATTERN_BEFORE.exec(excerpt);
  if (before) add({ subject: before[1], predicate: 'DIED_BEFORE', object: before[2].trim(), claimType: 'TEMPORAL', mode: 'DIRECT', status: 'SUPPORTED' });

  const eventDate = PATTERN_EVENT_DATE.exec(excerpt);
  if (eventDate) add({ subject: eventDate[1].trim(), predicate: 'OCCURRED_IN', object: eventDate[2], claimType: 'EVENT', mode: 'DIRECT', status: 'SUPPORTED' });

  const negativeParticipation = PATTERN_NEGATIVE_PARTICIPATION.exec(excerpt);
  if (negativeParticipation) add({ subject: negativeParticipation[1], predicate: 'DID_NOT_PARTICIPATE_IN', object: negativeParticipation[2].trim(), claimType: 'NEGATION', mode: 'DIRECT', status: 'SUPPORTED' });

  const participation = PATTERN_PARTICIPATION.exec(excerpt);
  if (participation) add({ subject: participation[1], predicate: 'PARTICIPATED_IN', object: participation[2].trim(), claimType: 'RELATIONSHIP', mode: 'DIRECT', status: 'SUPPORTED' });

  const parent = PATTERN_PARENT.exec(excerpt);
  if (parent) add({ subject: parent[1], predicate: 'PARENT_OF', object: parent[2], claimType: 'RELATIONSHIP', mode: 'DIRECT', status: 'SUPPORTED' });

  const specification = PATTERN_SPECIFICATION.exec(excerpt);
  if (specification) add({ subject: specification[1], predicate: specification[2].trim(), object: specification[3].trim(), claimType: 'ATTRIBUTE', mode: 'DIRECT', status: 'SUPPORTED' });

  const versionFeature = PATTERN_VERSION_FEATURE.exec(excerpt);
  if (versionFeature) add({ subject: versionFeature[1], predicate: 'SUPPORTS_FEATURE', object: versionFeature[3].trim(), claimType: 'ATTRIBUTE', qualifiers: { version: versionFeature[2] }, mode: 'DIRECT', status: 'SUPPORTED' });

  const occurredAt = PATTERN_OCCURRED_AT.exec(excerpt);
  if (occurredAt) add({ subject: occurredAt[1], predicate: 'OCCURRED_AT', object: occurredAt[2].trim(), claimType: 'LOCATION', mode: 'DIRECT', status: 'SUPPORTED' });

  return candidates;
}

function evidenceSupportsCandidate(evidence: EvidenceRecord, candidate: CandidateClaim): boolean {
  const text = normalized(evidence.excerpt);
  const subject = normalized(candidate.subject);
  const object = normalized(candidate.object);
  if (!text.includes(subject) || !text.includes(object)) return false;
  if (candidate.predicate === 'DID_NOT_PARTICIPATE_IN') return text.includes('did not participate');
  if (candidate.predicate === 'DIED_BEFORE') return text.includes('before');
  return true;
}

function extractEvidenceClaims(
  researchPackage: ResearchPackage,
  evidence: EvidenceRecord,
  sourceMap?: Map<string, ResearchPackage['sources'][number]>
): { claims: ClaimRecord[]; rejected: boolean } {
  // Use Map O(1) lookup when available to avoid O(S) array scan
  const source = sourceMap ? sourceMap.get(evidence.sourceId) : researchPackage.sources.find((item) => item.sourceId === evidence.sourceId);
  const isAi = evidence.evidenceType === 'AI_KNOWLEDGE';
  const eligible = evidence.excerpt.trim().length > 0 && evidence.evidenceType !== 'UNAVAILABLE' && evidence.evidenceType !== 'METADATA';
  if (!eligible) return { claims: [], rejected: true };
  const candidates = candidatesFromExcerpt(evidence.excerpt);
  if (candidates.length === 0) return { claims: [], rejected: false };
  const queryIds = evidence.queryId ? [evidence.queryId] : [];
  const claims = candidates.filter((candidate) => evidenceSupportsCandidate(evidence, candidate)).map((candidate) => {
    const backed = sourceBacked(evidence, source?.verification);
    return {
      claimId: claimId(evidence, candidate),
      subject: candidate.subject,
      predicate: candidate.predicate,
      object: candidate.object,
      normalizedStatement: `${candidate.subject} ${candidate.predicate} ${candidate.object}`,
      claimType: candidate.claimType,
      status: isAi ? 'UNVERIFIED' : backed ? candidate.status : 'UNVERIFIED',
      evidenceIds: [evidence.evidenceId],
      sourceIds: backed ? [evidence.sourceId] : [],
      confidence: backed ? 'LOW' : 'UNVERIFIED',
      confidenceRationale: isAi ? 'Derived from AI knowledge evidence; no external verification.' : backed ? 'Direct excerpt match from verified evidence.' : 'Source is not verified; claim remains unverified.',
      provenance: isAi ? 'AI_KNOWLEDGE' : backed ? 'SOURCE_BACKED' : 'UNKNOWN',
      qualifiers: candidate.qualifiers,
      extractionMode: candidate.mode,
      extractionStatus: candidate.status,
      extractionMethod: 'deterministic_excerpt_patterns',
      extractionVersion: CLAIM_EXTRACTION_VERSION,
      extractedAt: new Date().toISOString(),
      queryIds,
    } as ClaimRecord;
  });
  return { claims, rejected: false };
}

export function extractClaimsFromEvidence(input: ResearchPackage): ClaimExtractionResult {
  // Pre-build O(1) Map for source lookups across evidence items to avoid O(E * S) nested iterations
  const sourceMap = new Map(input.sources.map((s) => [s.sourceId, s]));
  const existingKeys = new Set(input.claims.map((claim) => `${claim.evidenceIds.slice().sort().join('|')}_${claim.extractionVersion || 'legacy'}_${normalized(claim.subject)}_${normalized(claim.predicate)}_${normalized(claim.object)}`));
  const extractedClaims: ClaimRecord[] = [];
  const rejectedEvidenceIds: string[] = [];
  for (const evidence of input.evidence) {
    const result = extractEvidenceClaims(input, evidence, sourceMap);
    if (result.rejected) rejectedEvidenceIds.push(evidence.evidenceId);
    for (const claim of result.claims) {
      const key = `${claim.evidenceIds.slice().sort().join('|')}_${claim.extractionVersion}_${normalized(claim.subject)}_${normalized(claim.predicate)}_${normalized(claim.object)}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      extractedClaims.push(claim);
    }
  }
  return { researchPackage: { ...input, claims: [...input.claims, ...extractedClaims] }, extractedClaims, rejectedEvidenceIds };
}
