import fs from 'node:fs';
import path from 'node:path';
import { db } from './db';
import { runProjectInitialization } from './orchestrator';
import { createResearchPackage, validateResearchPackage } from './grounding_engine';
import { ResearchEngine } from './research_engine';
import { contextPackageFromAcceptedKnowledge, resolveResearchPackage } from './claim_resolution_engine';
import { buildGroundingConstraints, evaluateEntityForEvent } from './grounding_validator';
import {
  ClaimRecord,
  EvidenceRecord,
  Project,
  ResearchRetrievalProvider,
  ResearchRetrievalResult,
  ResearchQuery,
  ResearchSearchProvider,
  SearchResultSet,
  SourceRegistryEntry,
} from '../src/types';

const STORE = path.join(process.cwd(), 'data', 'firestore_store.json');
const BACKUP = `${STORE}.phase3cbak`;
const STOP_AFTER_STAGE_1 = 'PHASE3C_INTEGRATION_STOP_AFTER_STAGE_1';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function source(id: string, authority: SourceRegistryEntry['authority'] = 'HIGH'): SourceRegistryEntry {
  return {
    sourceId: id,
    sourceType: 'HISTORICAL_SOURCE',
    title: `Fixture source ${id}`,
    url: `https://fixture.invalid/${id}`,
    retrievedAt: new Date().toISOString(),
    authority,
    verification: 'VERIFIED',
    relevance: 0.8,
  };
}

function evidence(id: string, sourceId: string, excerpt: string): EvidenceRecord {
  return {
    evidenceId: id,
    sourceId,
    excerpt,
    evidenceType: 'DIRECT_QUOTE',
    extractedAt: new Date().toISOString(),
    extractionMethod: 'integration_fixture',
  };
}

function claim(id: string, subject: string, predicate: string, object: string, sourceId: string, evidenceId: string, qualifiers?: ClaimRecord['qualifiers']): ClaimRecord {
  return {
    claimId: id,
    subject,
    predicate,
    object,
    normalizedStatement: `${subject} ${predicate} ${object}`,
    claimType: 'FACT',
    status: 'SUPPORTED',
    evidenceIds: evidenceId ? [evidenceId] : [],
    sourceIds: sourceId ? [sourceId] : [],
    confidence: 'UNKNOWN',
    confidenceRationale: '',
    provenance: 'SOURCE_BACKED',
    qualifiers,
  };
}

class ControlledRetrievalProvider implements ResearchRetrievalProvider {
  providerId = 'phase3c_controlled_retrieval';
  providerType = 'DOCUMENT' as const;
  capabilities = ['historical_source', 'academic_source', 'product_source'];
  calls: string[] = [];
  mode: 'success' | 'no_result' | 'source_unavailable' | 'network_failure' = 'success';

  async retrieve(query: ResearchQuery): Promise<ResearchRetrievalResult> {
    this.calls.push(query.queryId);
    if (this.mode === 'no_result') return { status: 'NO_RESULT', error: 'Controlled no-result fixture.' };
    if (this.mode === 'source_unavailable') return { status: 'SOURCE_UNAVAILABLE', error: 'Controlled unavailable fixture.' };
    if (this.mode === 'network_failure') return { status: 'NETWORK_FAILURE', error: 'Controlled network failure fixture.' };
    const retrievedSource = { ...source('source_a'), url: query.query };
    const retrievedEvidence = evidence(`${query.queryId}_evidence`, retrievedSource.sourceId, 'Person A died before Event B.');
    retrievedEvidence.queryId = query.queryId;
    return {
      status: 'EXECUTED',
      source: retrievedSource,
      evidence: [retrievedEvidence],
    };
  }
}

class ControlledSearchProvider implements ResearchSearchProvider {
  providerId = 'phase3c_controlled_search';
  providerType = 'WEB' as const;
  capabilities = ['historical_source'];
  calls: string[] = [];

  async search(query: ResearchQuery): Promise<SearchResultSet> {
    this.calls.push(query.queryId);
    return {
      status: 'SEARCH_AVAILABLE',
      execution: {
        searchExecutionId: `search_${query.queryId}`,
        queryId: query.queryId,
        providerId: this.providerId,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        status: 'SEARCH_AVAILABLE',
        resultCount: 1,
      },
      results: [{
        searchResultId: `${query.queryId}_result`,
        queryId: query.queryId,
        providerId: this.providerId,
        title: 'Controlled source candidate',
        url: `https://fixture.invalid/${query.queryId}`,
        snippet: 'Candidate metadata only.',
        sourceType: 'HISTORICAL_SOURCE',
        retrievedAt: new Date().toISOString(),
        relevance: 0.8,
        authority: 'HIGH',
        verification: 'UNVERIFIED',
        status: 'CANDIDATE',
      }],
    };
  }
}

function project(id: string, rawScript: string, researchPackage?: ReturnType<typeof createResearchPackage>): Project {
  return {
    id,
    title: id,
    raw_script: rawScript,
    total_duration_target_sec: 10,
    max_scene_shot_duration_sec: 10,
    scene_duration_sec: 10,
    duration_mode: 'fixed',
    fixed_scene_duration: 10,
    prompt_language: 'en',
    image_model: 'nano_banana_pro',
    video_model: ['veo'],
    include_seedance_format: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'draft',
    current_stage: 0,
    retry_count: 0,
    researchPackage,
  };
}

function stopStage1Capture(captured: { context: Project['contextPackage'] | null }): typeof import('./stages/stage1_story_understanding').runStage1StoryUnderstanding {
  return async (input) => {
    captured.context = (input as typeof input & { contextPackage?: Project['contextPackage'] | null }).contextPackage || null;
    throw new Error(STOP_AFTER_STAGE_1);
  };
}

async function runInitializationFixture(
  fixtureProject: Project,
  provider: ControlledRetrievalProvider,
  searchProvider?: ControlledSearchProvider,
): Promise<{ project: Project; context: Project['contextPackage']; calls: string[]; searchCalls: string[] }> {
  const captured: { context: Project['contextPackage'] | null } = { context: null };
  await db.saveProject(fixtureProject);
  const result = await runProjectInitialization(fixtureProject.id, undefined, {
    researchEngine: new ResearchEngine([], [provider], searchProvider ? [searchProvider] : []),
    stage1Runner: stopStage1Capture(captured),
  });
  assert(result.success === false && result.error?.includes(STOP_AFTER_STAGE_1), 'integration reaches the real Stage 1 boundary');
  const reloaded = await db.getProject(fixtureProject.id);
  assert(reloaded, 'project reloads from existing persistence');
  return { project: reloaded, context: captured.context, calls: provider.calls, searchCalls: searchProvider?.calls || [] };
}

async function main(): Promise<void> {
  if (fs.existsSync(STORE)) fs.copyFileSync(STORE, BACKUP);
  try {
    const provider = new ControlledRetrievalProvider();
    const searchProvider = new ControlledSearchProvider();
    const research = createResearchPackage('Historical event research for Person A and Event B', [source('source_a')]);
    research.queries = [{
      queryId: 'query_event', questionId: 'question_event', query: 'controlled event evidence', purpose: 'timeline',
      sourceTypes: ['HISTORICAL_SOURCE'], priority: 'HIGH', status: 'PLANNED',
    }];
    research.evidence = [evidence('evidence_death', 'source_a', 'Person A died in 1943.')];
    research.claims = [
      claim('death', 'Person A', 'died', '1943', 'source_a', 'evidence_death'),
      claim('participation', 'Person A', 'participated in', 'Event B', 'source_a', 'query_event_evidence', { eventYear: 1945 }),
    ];
    const result = await runInitializationFixture(project('phase3c_trace', 'Historical event in 1945', research), provider, searchProvider);
    assert(result.calls.length === 1, 'production executes the planned query once');
    assert(result.searchCalls.length === 1, 'production executes search discovery once');
    assert(result.project.researchPackage?.searchResults?.some((item) => item.queryId === 'query_event'), 'production search result is persisted');
    assert(result.project.researchPackage?.queries[0].status === 'EXECUTED', 'production query status is persisted');
    assert(result.project.researchPackage?.evidence.some((item) => item.queryId === 'query_event'), 'production evidence is persisted');
    assert(result.project.researchPackage?.claims.some((item) => item.extractionVersion === '1.0' && item.evidenceIds.includes('query_event_evidence')), 'production evidence is converted into an extracted claim');
    assert(result.project.contextPackage?.facts.some((fact) => fact.claimId === 'death'), 'resolved fact is persisted');
    assert(result.project.contextPackage?.events?.some((event) => event.label === 'Event B'), 'resolved event is persisted');
    assert(JSON.stringify(result.context) === JSON.stringify(result.project.contextPackage), 'Stage 1 received the same post-resolution context that was persisted');
    assert(result.context?.timeline.length && result.context.timeline.length > 0, 'timeline reaches Stage 1');
    assert(result.context?.constraints.some((item) => item.includes('Person A')), 'grounding constraints reach Stage 1');
    const person = result.context?.entities.find((entity) => entity.name === 'Person A');
    const event = result.context?.events?.find((item) => item.label === 'Event B');
    assert(person && event, 'trace contains entity and event');
    const temporal = evaluateEntityForEvent(person, event);
    assert(temporal.temporalState === 'DECEASED_BEFORE_EVENT' && temporal.participation === 'FORBIDDEN_AS_LIVING_PARTICIPANT', 'generic temporal enforcement completes the trace');
    assert(buildGroundingConstraints(result.context!).constraints.some((item) => item.target === 'Person A'), 'constraint is derived from resolved context');

    const product = createResearchPackage('Product specification research', [source('product_a'), source('product_b')]);
    product.evidence = [evidence('product_e1', 'product_a', 'Product X specification is 100.'), evidence('product_e2', 'product_b', 'Product X specification is 120.')];
    product.claims = [claim('product_100', 'Product X', 'specification', '100', 'product_a', 'product_e1'), claim('product_120', 'Product X', 'specification', '120', 'product_b', 'product_e2')];
    const productResolution = resolveResearchPackage(product);
    assert(productResolution.researchPackage.conflicts.some((item) => item.conflictType === 'DIRECT_CONTRADICTION'), 'product conflict is detected generically');
    assert(productResolution.researchPackage.conflicts.every((item) => item.status === 'PREFERRED_CLAIM' || item.status === 'UNRESOLVED'), 'product conflict resolution is explicit');
    assert(productResolution.researchPackage.claims.length === 2, 'product competing claims remain preserved');

    const multi = createResearchPackage('Multi-source historical support', [source('multi_a'), source('multi_b')]);
    multi.evidence = [evidence('multi_e1', 'multi_a', 'Claim C.'), evidence('multi_e2', 'multi_b', 'Claim C.')];
    multi.claims = [claim('multi_claim', 'Person C', 'participated in', 'Event C', 'multi_a', 'multi_e1')];
    multi.claims[0].evidenceIds.push('multi_e2');
    multi.claims[0].sourceIds.push('multi_b');
    assert(validateResearchPackage(multi).length === 0, 'multi-source claim remains valid');
    assert(resolveResearchPackage(multi).acceptedKnowledge.acceptedClaims[0].evidenceIds.length === 2, 'both evidence paths survive');

    const invalid = createResearchPackage('Historical invalid claim', [source('invalid')]);
    invalid.claims = [claim('invalid_claim', 'Person', 'did', 'thing', 'invalid', '')];
    invalid.claims[0].evidenceIds = [];
    const invalidResolution = resolveResearchPackage(invalid);
    assert(invalidResolution.acceptedKnowledge.acceptedClaims.length === 0, 'missing-evidence source-backed claim is rejected from accepted knowledge');

    const ai = createResearchPackage('AI knowledge only', [source('elsewhere')]);
    ai.claims = [{ ...claim('ai_claim', 'Person', 'did', 'thing', '', ''), provenance: 'AI_KNOWLEDGE', status: 'UNVERIFIED', confidence: 'UNVERIFIED' }];
    assert(resolveResearchPackage(ai).acceptedKnowledge.acceptedClaims[0]?.provenance === 'AI_KNOWLEDGE', 'AI claim remains unverified and separate');

    const unresolved = createResearchPackage('Equal conflicting evidence', [source('equal_a', 'MEDIUM'), source('equal_b', 'MEDIUM')]);
    unresolved.evidence = [evidence('equal_e1', 'equal_a', 'Value A'), evidence('equal_e2', 'equal_b', 'Value B')];
    unresolved.claims = [claim('equal_a', 'Entity', 'value', 'A', 'equal_a', 'equal_e1'), claim('equal_b', 'Entity', 'value', 'B', 'equal_b', 'equal_e2')];
    const unresolvedResolution = resolveResearchPackage(unresolved);
    assert(unresolvedResolution.researchPackage.conflicts[0].status === 'UNRESOLVED', 'equal conflict remains unresolved');
    assert(unresolvedResolution.researchPackage.claims.length === 2, 'unresolved claims remain visible');

    const reconstruction = createResearchPackage('Historical reconstruction', [source('fact_source')]);
    reconstruction.evidence = [evidence('place_evidence', 'fact_source', 'Event occurred at Place X.')];
    reconstruction.claims = [claim('place_fact', 'Event', 'occurred at', 'Place X', 'fact_source', 'place_evidence'), { ...claim('room_reconstruction', 'Place X', 'has interior', 'exact room layout', '', ''), claimType: 'RECONSTRUCTION', provenance: 'RECONSTRUCTED', status: 'UNVERIFIED', confidence: 'UNKNOWN', sourceIds: [], evidenceIds: [] }];
    const reconstructionResolution = resolveResearchPackage(reconstruction);
    assert(reconstructionResolution.acceptedKnowledge.acceptedClaims.some((item) => item.claimType === 'RECONSTRUCTION'), 'reconstruction remains distinct from supported fact');
    assert(reconstructionResolution.contextPackage.facts.some((item) => item.provenance === 'SOURCE_FACT'), 'supported fact is preserved');

    const failureModes: ControlledRetrievalProvider['mode'][] = ['no_result', 'source_unavailable', 'network_failure'];
    for (const mode of failureModes) {
      const failureProvider = new ControlledRetrievalProvider();
      failureProvider.mode = mode;
      const failureResearch = createResearchPackage('Historical retrieval failure', [source('failure_source')]);
      failureResearch.queries = [{ queryId: `query_${mode}`, questionId: 'q', query: 'failure', purpose: 'test', sourceTypes: ['HISTORICAL_SOURCE'], priority: 'HIGH', status: 'PLANNED' }];
      const failure = await runInitializationFixture(project(`phase3c_${mode}`, 'Historical failure case', failureResearch), failureProvider);
      assert(failure.project.researchPackage?.evidence.length === 0, `${mode} creates no fabricated evidence`);
      assert(failure.project.researchPackage?.queries[0].status === (mode === 'no_result' ? 'NO_RESULT' : 'FAILED'), `${mode} remains explicit`);
    }

    const optionalProvider = new ControlledRetrievalProvider();
    const optional = await runInitializationFixture(project('phase3c_optional', 'A fictional creative story', createResearchPackage('A fictional creative story')), optionalProvider);
    assert(optional.calls.length === 0, 'optional research does not execute automatically');

    const legacyProvider = new ControlledRetrievalProvider();
    const legacy = await runInitializationFixture(project('phase3c_legacy', 'A legacy story without a research package'), legacyProvider);
    assert(legacy.project && !legacy.calls.length, 'legacy project remains loadable without forced retrieval');
    assert(legacy.project.contextPackage?.sources.every((item) => item.verification === 'UNVERIFIED' || item.verification === 'UNAVAILABLE'), 'legacy synthetic sources are not upgraded');

    console.log('PATCH 6.0 PHASE 3C FINAL INTEGRATION assertions: PASS');
  } finally {
    if (fs.existsSync(BACKUP)) {
      fs.copyFileSync(BACKUP, STORE);
      fs.unlinkSync(BACKUP);
    } else if (fs.existsSync(STORE)) {
      fs.unlinkSync(STORE);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
