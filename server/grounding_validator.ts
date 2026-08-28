import { ContextPackage, GroundingConstraint, GroundingConstraintSeverity, GroundingEnforcementPlan, GroundingValidationResult, GroundingEntity, GroundingEntityEvaluation, GroundingEvent } from '../src/types';

export const ENFORCEMENT_VERSION = '1.0';

export class GroundingGenerationError extends Error {
  constructor(public readonly validation: GroundingValidationResult, public readonly stage: string) {
    super(`Grounding validation failed in ${stage}: ${validation.conflicts.join('; ')}`);
    this.name = 'GroundingGenerationError';
  }

  toJSON(): object {
    return { stage: this.stage, action: 'BLOCKED', validation: this.validation };
  }
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function eventForContext(context: ContextPackage): GroundingEvent {
  return context.events?.[0] || {
    eventId: context.timeline[0]?.eventId || 'event_current',
    label: context.timeline[0]?.label || 'current event',
    sourceIds: context.timeline[0]?.sourceIds || [],
  };
}

function entityMatches(entity: GroundingEntity, candidate: string): boolean {
  const candidateName = normalized(candidate);
  return [entity.name, ...(entity.aliases || [])].some((name) => normalized(name) === candidateName);
}

export function evaluateEntityForEvent(entity: GroundingEntity, event: GroundingEvent): GroundingEntityEvaluation {
  const eventStart = event.startYear ?? event.endYear;
  const eventEnd = event.endYear ?? event.startYear;
  const entityStart = entity.timelineBounds?.startYear ?? entity.birthYear;
  const entityEnd = entity.timelineBounds?.endYear ?? entity.deathYear;
  const temporalState = entity.status === 'DECEASED' && eventStart !== undefined
    ? 'DECEASED_BEFORE_EVENT'
    : entity.status === 'NOT_YET_BORN' && eventEnd !== undefined
      ? 'NOT_YET_BORN'
      : eventStart === undefined || eventEnd === undefined
        ? 'UNKNOWN'
        : entityStart !== undefined && eventEnd < entityStart
          ? 'NOT_YET_BORN'
          : entityEnd !== undefined && eventStart > entityEnd
            ? 'DECEASED_BEFORE_EVENT'
            : 'VALID';
  const explicitlyExcluded = event.excludedEntityIds?.includes(entity.entityId) || entity.status === 'OUT_OF_CONTEXT';
  const listedParticipant = event.participantEntityIds?.includes(entity.entityId);
  const possibleParticipant = event.possibleParticipantEntityIds?.includes(entity.entityId);
  const participation = explicitlyExcluded || temporalState === 'DECEASED_BEFORE_EVENT' || temporalState === 'NOT_YET_BORN'
    ? temporalState === 'VALID' ? 'OUT_OF_CONTEXT' : 'FORBIDDEN_AS_LIVING_PARTICIPANT'
    : listedParticipant ? 'KNOWN_PARTICIPANT'
      : possibleParticipant ? 'POSSIBLE_PARTICIPANT'
        : 'NOT_ESTABLISHED';
  const valid = temporalState === 'VALID' && participation !== 'FORBIDDEN_AS_LIVING_PARTICIPANT' && participation !== 'OUT_OF_CONTEXT';
  return {
    entityId: entity.entityId,
    entityName: entity.name,
    eventId: event.eventId,
    temporalState,
    participation,
    valid,
    reason: valid
      ? `${entity.name} is ${participation.toLowerCase()} for ${event.label}.`
      : `${entity.name} is ${temporalState === 'DECEASED_BEFORE_EVENT' ? 'deceased before' : temporalState === 'NOT_YET_BORN' ? 'not yet born for' : 'out of context for'} ${event.label}.`,
    sourceIds: Array.from(new Set([...(entity.sourceIds || []), ...(event.sourceIds || [])])),
  };
}

export function buildGroundingConstraints(context: ContextPackage): GroundingEnforcementPlan {
  const constraints: GroundingConstraint[] = [];
  const blockedEntities: string[] = [];
  const allowedCinematicReconstruction: string[] = [];

  context.entities.forEach((entity) => {
    const evaluation = evaluateEntityForEvent(entity, eventForContext(context));
    if (!evaluation.valid && evaluation.participation === 'FORBIDDEN_AS_LIVING_PARTICIPANT') {
      constraints.push({
        id: `constraint_${entity.entityId}`,
        scope: 'entity',
        target: entity.name,
        description: evaluation.reason,
        severity: 'HARD_CONSTRAINT',
        action: 'BLOCK',
        sourceIds: entity.sourceIds || [],
      });
      blockedEntities.push(entity.name);
    }

    if (evaluation.temporalState === 'UNKNOWN' || evaluation.participation === 'NOT_ESTABLISHED') {
      constraints.push({
        id: `info_${entity.entityId}`,
        scope: 'entity',
        target: entity.name,
        description: `${entity.name} is unknown; use generic cinematic framing unless verified.`,
        severity: 'INFORMATIONAL',
        action: 'ALLOW',
        sourceIds: entity.sourceIds || [],
      });
    }
  });

  (context.locations || []).forEach((location) => {
    (location.constraints || []).forEach((description, index) => {
      constraints.push({
        id: `location_${location.locationId}_${index}`,
        scope: 'location',
        target: location.name,
        description,
        severity: 'HARD_CONSTRAINT',
        action: 'BLOCK',
        sourceIds: location.sourceIds || [],
      });
    });
  });

  (context.objects || []).forEach((object) => {
    (object.constraints || []).forEach((description, index) => {
      constraints.push({
        id: `object_${object.objectId}_${index}`,
        scope: 'object',
        target: object.name,
        description,
        severity: 'HARD_CONSTRAINT',
        action: 'BLOCK',
        sourceIds: object.sourceIds || [],
      });
    });
  });

  (context.relationships || []).forEach((relationship) => {
    constraints.push({
      id: `relationship_${relationship.relationshipId}`,
      scope: 'relationship',
      target: `${relationship.fromEntity}->${relationship.toEntity}`,
      description: `Preserve the grounded relationship: ${relationship.relation}.`,
      severity: 'SOFT_CONSTRAINT',
      action: 'WARN',
      sourceIds: relationship.sourceIds || [],
    });
  });

  [...(context.culturalContext || []), ...(context.productContext || []), ...(context.technicalContext || [])].forEach((description, index) => {
    constraints.push({
      id: `context_${index}`,
      scope: 'event',
      target: 'grounding_context',
      description,
      severity: 'SOFT_CONSTRAINT',
      action: 'WARN',
      sourceIds: [],
    });
  });

  (context.reconstructionRules || []).forEach((rule, index) => {
    allowedCinematicReconstruction.push(rule);
    constraints.push({
      id: `reconstruction_${index}`,
      scope: 'event',
      target: 'reconstruction',
      description: rule,
      severity: 'SOFT_CONSTRAINT',
      action: 'ALLOW',
      sourceIds: [],
    });
  });

  return { constraints, blockedEntities, allowedCinematicReconstruction };
}

export function evaluateEntityStateForEvent(entity: GroundingEntity, eventLabel: string): { valid: boolean; reason: string; severity: GroundingConstraintSeverity } {
  const status = entity.status || 'UNKNOWN';

  if (status === 'DECEASED') {
    return {
      valid: false,
      reason: `${entity.name} is deceased and may not appear as a living participant in ${eventLabel}.`,
      severity: 'HARD_CONSTRAINT',
    };
  }

  if (status === 'NOT_YET_BORN') {
    return {
      valid: false,
      reason: `${entity.name} is not yet born for ${eventLabel}.`,
      severity: 'HARD_CONSTRAINT',
    };
  }

  if (status === 'OUT_OF_CONTEXT') {
    return {
      valid: false,
      reason: `${entity.name} is out of context for ${eventLabel}.`,
      severity: 'HARD_CONSTRAINT',
    };
  }

  if (status === 'UNKNOWN') {
    return {
      valid: true,
      reason: `${entity.name} remains unknown in context; generative framing should avoid certainty.`,
      severity: 'INFORMATIONAL',
    };
  }

  return {
    valid: true,
    reason: `${entity.name} is allowed in the current event context.`,
    severity: 'INFORMATIONAL',
  };
}

export function applyGroundingValidation(context: ContextPackage, candidates: string[]): GroundingValidationResult {
  const blockedEntities: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const conflicts: string[] = [];
  const unresolvedItems: string[] = [];
  const sourceGaps: string[] = [];

  const enforcement = buildGroundingConstraints(context);
  const event = eventForContext(context);
  for (const candidate of candidates) {
    const entity = context.entities.find((entry) => entityMatches(entry, candidate));
    if (!entity) continue;
    const evaluation = evaluateEntityForEvent(entity, event);
    if (!evaluation.valid) {
      blockedEntities.push(entity.name);
      conflicts.push(`${entity.name} violates a ${evaluation.temporalState === 'UNKNOWN' ? 'contextual' : 'temporal'} constraint.`);
      errors.push(`${entity.name} is blocked for ${event.label}.`);
    }
  }
  if (context.researchRequired && context.sources.length === 0) {
    sourceGaps.push('Grounding requires source-backed context but no sources were discovered.');
    warnings.push('Research is incomplete; non-factual reconstruction may be needed.');
  }

  if (blockedEntities.length > 0) {
    warnings.push('Temporal or contextual blockers were found in the grounded entity set.');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    blockedEntities,
    conflicts,
    unresolvedItems,
    sourceGaps,
    issues: enforcement.constraints.map((constraint) => ({
      code: constraint.id,
      severity: constraint.severity === 'HARD_CONSTRAINT' ? 'CRITICAL' : constraint.severity === 'SOFT_CONSTRAINT' ? 'WARNING' : 'INFO',
      message: constraint.description,
      entityName: constraint.target,
      sourceIds: constraint.sourceIds,
      action: constraint.action === 'BLOCK' ? 'BLOCKED' : constraint.action === 'REGENERATE' ? 'REGENERATED' : constraint.action === 'WARN' ? 'FLAGGED' : 'ALLOWED',
    })),
  };
}

export function buildGroundingPromptContext(context: ContextPackage | null | undefined): string {
  if (!context) return 'No grounding context available.';
  const plan = buildGroundingConstraints(context);
  return JSON.stringify({
    version: context.version,
    event: eventForContext(context),
    constraints: plan.constraints,
    locations: context.locations,
    objects: context.objects,
    culturalContext: context.culturalContext,
    technicalContext: context.technicalContext,
  }, null, 2);
}
