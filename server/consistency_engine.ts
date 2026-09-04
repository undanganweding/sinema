import {
  ContextPackage,
  GroundingState,
  ConflictRecord,
  StageConsistencyReport,
  StageConsistencyViolation,
} from '../src/types';

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createGroundingState(contextPackage: ContextPackage, unresolvedConflicts: ConflictRecord[] = []): GroundingState {
  const context = clone(contextPackage);
  return Object.freeze({
    contextPackage: context,
    facts: Object.freeze(clone(context.facts)),
    entities: Object.freeze(clone(context.entities)),
    events: Object.freeze(clone(context.events || [])),
    relationships: Object.freeze(clone(context.relationships)),
    locations: Object.freeze(clone(context.locations)),
    objects: Object.freeze(clone(context.objects)),
    timeline: Object.freeze(clone(context.timeline)),
    constraints: Object.freeze(clone(context.constraints)),
    unresolvedConflicts: Object.freeze(clone(unresolvedConflicts)),
    reconstructionBoundaries: Object.freeze(clone(context.reconstructionRules)),
  });
}

function textAndFields(value: unknown, key = ''): { text: string; fields: Record<string, string[]> } {
  const fields: Record<string, string[]> = {};
  const chunks: string[] = [];
  const add = (field: string, text: string) => {
    chunks.push(text);
    (fields[field] ||= []).push(text);
  };
  const visit = (item: unknown, currentKey: string): void => {
    if (typeof item === 'string') {
      add(currentKey, item);
      return;
    }
    if (typeof item === 'number' || typeof item === 'boolean') {
      add(currentKey, String(item));
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((entry) => visit(entry, currentKey));
      return;
    }
    if (item && typeof item === 'object') {
      Object.entries(item).forEach(([childKey, childValue]) => visit(childValue, childKey));
    }
  };
  visit(value, key);
  return { text: normalize(chunks.join(' ')), fields };
}

function records(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap((item) => records(item));
  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).flatMap((item) => records(item))];
}

function includesName(text: string, name: string): boolean {
  return text.includes(normalize(name));
}

function addViolation(
  violations: StageConsistencyViolation[],
  code: string,
  severity: 'BLOCKING' | 'WARNING',
  message: string,
  sourceIds: string[] = [],
  constraintId?: string,
): void {
  if (violations.some((item) => item.code === code && item.message === message)) return;
  violations.push({ code, severity, message, sourceIds, constraintId });
}

function years(value: string): number[] {
  return Array.from(value.matchAll(/\b(1[0-9]{3}|20[0-9]{2}|21[0-9]{2})\b/g)).map((match) => Number(match[1]));
}

export function evaluateStageOutput(stage: string, output: unknown, state: GroundingState): StageConsistencyReport {
  const flattened = textAndFields(output);
  const text = flattened.text;
  const outputRecords = records(output);
  const violations: StageConsistencyViolation[] = [];
  const warnings: string[] = [];
  const checkedConstraints = state.constraints.map((_constraint, index) => `context_constraint_${index}`);

  for (const conflict of state.unresolvedConflicts) {
    warnings.push(`Unresolved conflict preserved: ${conflict.conflictId}.`);
  }

  const entityByName = new Map<string, (typeof state.entities)[number]>();
  state.entities.forEach((entity) => {
    entityByName.set(normalize(entity.name), entity);
    (entity.aliases || []).forEach((alias) => entityByName.set(normalize(alias), entity));
  });

  for (const entity of state.entities) {
    const entityPresent = includesName(text, entity.name) || (entity.aliases || []).some((alias) => includesName(text, alias));
    if (!entityPresent) continue;
    const event = state.events.find((candidate) => includesName(text, candidate.label));
    if (event && entity.deathYear !== undefined && event.startYear !== undefined && entity.deathYear < event.startYear && /participat|attend|present|alive|living|ikut|hadir/.test(text)) {
      addViolation(violations, 'DECEASED_BEFORE_EVENT', 'BLOCKING', `${entity.name} is used as a living participant after death in ${event.label}.`, entity.sourceIds || []);
    }
    if (entity.status === 'NOT_YET_BORN' && /participat|attend|present|alive|living|ikut|hadir/.test(text)) {
      addViolation(violations, 'NOT_YET_BORN_PARTICIPANT', 'BLOCKING', `${entity.name} is used as a living participant before birth.` , entity.sourceIds || []);
    }
    if (entity.status === 'OUT_OF_CONTEXT' && /participat|attend|present|alive|living|ikut|hadir/.test(text)) {
      addViolation(violations, 'FORBIDDEN_ENTITY', 'BLOCKING', `${entity.name} is forbidden in the grounded context.`, entity.sourceIds || []);
    }
  }

  for (const record of outputRecords) {
    const name = typeof record.name === 'string' ? record.name : typeof record.entityName === 'string' ? record.entityName : undefined;
    const identity = typeof record.identity === 'string' ? record.identity : undefined;
    const acceptedEntity = name ? state.entities.find((entity) => normalize(entity.name) === normalize(name) || (entity.aliases || []).some((alias) => normalize(alias) === normalize(name))) : undefined;
    if (acceptedEntity && identity && acceptedEntity.description && normalize(identity) !== normalize(acceptedEntity.description) && !normalize(identity).includes(normalize(acceptedEntity.description))) {
      addViolation(violations, 'ENTITY_IDENTITY_CONFLICT', 'BLOCKING', `Output changes the accepted identity of ${acceptedEntity.name}.`, acceptedEntity.sourceIds || [], acceptedEntity.entityId);
    }
    const entityName = typeof record.entityName === 'string' ? record.entityName : typeof record.subject === 'string' ? record.subject : undefined;
    const eventName = typeof record.eventName === 'string' ? record.eventName : typeof record.event === 'string' ? record.event : undefined;
    if (entityName && eventName && /participat|attend|present|alive|living|ikut|hadir/i.test(JSON.stringify(record))) {
      const entity = state.entities.find((candidate) => normalize(candidate.name) === normalize(entityName));
      const event = state.events.find((candidate) => normalize(candidate.label) === normalize(eventName));
      if (entity?.deathYear !== undefined && event?.startYear !== undefined && entity.deathYear < event.startYear) {
        addViolation(violations, 'DECEASED_BEFORE_EVENT', 'BLOCKING', `${entity.name} is used as a living participant after death in ${event.label}.`, entity.sourceIds || []);
      }
    }
  }

  for (const event of state.events) {
    if (!includesName(text, event.label)) continue;
    const eventYears = [event.startYear, event.endYear].filter((year): year is number => year !== undefined);
    const nearbyYears = years(text);
    if (eventYears.length > 0 && /date|year|tahun|tanggal|occurred|terjadi/.test(text) && nearbyYears.some((year) => !eventYears.includes(year))) {
      addViolation(violations, 'INVALID_EVENT_DATE', 'BLOCKING', `Output assigns an unsupported date to ${event.label}.`, event.sourceIds || []);
    }
    if (event.locationId) {
      const location = state.locations.find((candidate) => candidate.locationId === event.locationId);
      const otherLocation = state.locations.find((candidate) => candidate.locationId !== event.locationId && includesName(text, candidate.name));
      if (location && otherLocation) {
        addViolation(violations, 'EVENT_LOCATION_CONFLICT', 'BLOCKING', `${event.label} is placed at ${otherLocation.name}, but accepted context places it at ${location.name}.`, event.sourceIds || []);
      }
    }
  }

  // Performance optimization: Pre-filter events present in text to avoid O(N^2) string inclusion checks across all state events.
  const presentEvents = state.events.filter((event) => includesName(text, event.label));
  for (const first of presentEvents) {
    for (const second of presentEvents) {
      if (first === second) continue;
      const firstYear = first.startYear ?? first.endYear;
      const secondYear = second.startYear ?? second.endYear;
      if (firstYear === undefined || secondYear === undefined || firstYear === secondYear) continue;
      const before = new RegExp(`${escapeRegExp(normalize(first.label))}.*\\b(before|sebelum)\\b.*${escapeRegExp(normalize(second.label))}`).test(text);
      const after = new RegExp(`${escapeRegExp(normalize(first.label))}.*\\b(after|sesudah)\\b.*${escapeRegExp(normalize(second.label))}`).test(text);
      if ((before && firstYear > secondYear) || (after && firstYear < secondYear)) {
        addViolation(violations, 'EVENT_ORDER_CONFLICT', 'BLOCKING', `Output reverses the accepted order of ${first.label} and ${second.label}.`, [...(first.sourceIds || []), ...(second.sourceIds || [])]);
      }
    }
  }

  for (const relationship of state.relationships) {
    const from = normalize(relationship.fromEntity);
    const to = normalize(relationship.toEntity);
    const forward = text.includes(`${from} ${normalize(relationship.relation)} ${to}`) || text.includes(`${from} is the ${normalize(relationship.relation)} of ${to}`);
    const reverse = text.includes(`${to} ${normalize(relationship.relation)} ${from}`) || text.includes(`${to} is the ${normalize(relationship.relation)} of ${from}`);
    if (reverse && !forward) {
      addViolation(violations, 'RELATIONSHIP_CONFLICT', 'BLOCKING', `Output reverses accepted relationship ${relationship.fromEntity} ${relationship.relation} ${relationship.toEntity}.`, relationship.sourceIds || [], relationship.relationshipId);
    }
    for (const record of outputRecords) {
      if (normalize(String(record.fromEntity || '')) === to && normalize(String(record.toEntity || '')) === from && normalize(String(record.relation || '')) === normalize(relationship.relation)) {
        addViolation(violations, 'RELATIONSHIP_CONFLICT', 'BLOCKING', `Output reverses accepted relationship ${relationship.fromEntity} ${relationship.relation} ${relationship.toEntity}.`, relationship.sourceIds || [], relationship.relationshipId);
      }
    }
  }

  for (const object of state.objects) {
    if (!includesName(text, object.name) || !object.description) continue;
    const acceptedAttributes = object.description.match(/\b\d+(?:\.\d+)?\s*(?:gb|tb|mb|mhz|ghz|version|v\d+)\b/gi) || [];
    const outputAttributes = text.match(/\b\d+(?:\.\d+)?\s*(?:gb|tb|mb|mhz|ghz|version|v\d+)\b/gi) || [];
    if (acceptedAttributes.length > 0 && outputAttributes.length > 0 && outputAttributes.some((value) => !acceptedAttributes.some((accepted) => normalize(accepted) === normalize(value)))) {
      addViolation(violations, 'OBJECT_ATTRIBUTE_CONFLICT', 'BLOCKING', `Output changes an accepted attribute of ${object.name}.`, object.sourceIds || [], object.objectId);
    }
    for (const record of outputRecords) {
      const recordName = String(record.objectName || record.object || record.name || '');
      if (normalize(recordName) === normalize(object.name) && object.description && /\b\d+(?:\.\d+)?\s*(?:gb|tb|mb|mhz|ghz|version|v\d+)\b/i.test(JSON.stringify(record))) {
        const accepted = object.description.match(/\b\d+(?:\.\d+)?\s*(?:gb|tb|mb|mhz|ghz|version|v\d+)\b/i) || [];
        const generated = JSON.stringify(record).match(/\b\d+(?:\.\d+)?\s*(?:gb|tb|mb|mhz|ghz|version|v\d+)\b/i) || [];
        if (accepted[0] && generated[0] && normalize(accepted[0]) !== normalize(generated[0])) addViolation(violations, 'OBJECT_ATTRIBUTE_CONFLICT', 'BLOCKING', `Output changes an accepted attribute of ${object.name}.`, object.sourceIds || [], object.objectId);
      }
    }
  }

  const explicitNames = Object.values(flattened.fields).flat().filter((value) => value.length > 1);
  for (const candidate of explicitNames) {
    if (/^(name|character_name|subject|fromEntity|toEntity|location|location_name|object)$/i.test(candidate)) continue;
    const looksLikeEntity = /entity|character|person|subject|participant/i.test(candidate);
    if (looksLikeEntity && !entityByName.has(normalize(candidate))) {
      warnings.push(`Entity '${candidate}' is not established by accepted knowledge.`);
    }
  }

  if (state.contextPackage.unknowns.some((item) => /date|year|tanggal|exact/i.test(item)) && years(text).length > 0) {
    warnings.push('Output supplies a date where accepted context marks the date as unknown; it is not treated as verified.');
  }

  const status = violations.some((item) => item.severity === 'BLOCKING')
    ? 'BLOCKED'
    : violations.length > 0
      ? 'CONFLICT'
      : warnings.length > 0
        ? 'WARNING'
        : 'PASS';
  return { stage, status, violations, warnings: Array.from(new Set(warnings)), checkedConstraints };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function assertStageConsistency(report: StageConsistencyReport): void {
  if (report.status === 'BLOCKED') {
    throw new Error(`CONSISTENCY_BLOCKED ${JSON.stringify(report)}`);
  }
}
