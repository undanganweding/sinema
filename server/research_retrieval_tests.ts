import { createResearchPackage, validateResearchPackage } from './grounding_engine';
import { DirectDocumentRetrievalProvider, executeResearchPackage, ResearchEngine } from './research_engine';
import { ClaimRecord, EvidenceRecord, ResearchRetrievalProvider, ResearchRetrievalResult, SourceRegistryEntry } from '../src/types';
import { createServer } from 'node:http';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function source(id: string): SourceRegistryEntry {
  return {
    sourceId: id,
    sourceType: 'ACADEMIC_SOURCE',
    title: `Retrieved source ${id}`,
    url: `https://example.test/${id}`,
    retrievedAt: new Date().toISOString(),
    authority: 'HIGH',
    verification: 'VERIFIED',
    relevance: 0.8,
  };
}

class FixtureRetrievalProvider implements ResearchRetrievalProvider {
  providerId = 'fixture_retrieval';
  providerType = 'DOCUMENT' as const;
  capabilities = ['academic_source'];
  mode: 'success' | 'no_result' | 'failure' = 'success';
  calls: string[] = [];

  async retrieve(query: Parameters<ResearchRetrievalProvider['retrieve']>[0]): Promise<ResearchRetrievalResult> {
    this.calls.push(query.queryId);
    if (this.mode === 'no_result') return { status: 'NO_RESULT', error: 'Fixture found no result.' };
    if (this.mode === 'failure') return { status: 'NETWORK_FAILURE', error: 'Fixture network failure.' };
    const retrievedSource = source('source_fixture');
    const evidence: EvidenceRecord = {
      evidenceId: `${query.queryId}_evidence`,
      sourceId: retrievedSource.sourceId,
      queryId: query.queryId,
      excerpt: 'Halimah nursed Muhammad during his infancy.',
      evidenceType: 'DIRECT_QUOTE',
      extractedAt: new Date().toISOString(),
      extractionMethod: 'fixture_retrieval',
    };
    return { status: 'EXECUTED', source: retrievedSource, evidence: [evidence] };
  }
}

async function main(): Promise<void> {
  const provider = new FixtureRetrievalProvider();
  const engine = new ResearchEngine([], [provider]);
  const initial = createResearchPackage('Historical religious research about Halimah and Muhammad', []);
  const completed = await executeResearchPackage(initial, engine);
  assert(provider.calls.length > 0, 'research query is executed');
  assert(completed.queries[0].status === 'EXECUTED', 'executed query status is preserved');
  assert(completed.queries[0].sourceIds?.includes('source_fixture'), 'query links to retrieved source');
  assert(completed.queries[0].evidenceIds?.length === 1, 'query links to evidence');
  assert(completed.sources.some((item) => item.verification === 'VERIFIED'), 'retrieved source is verified after usable retrieval');
  assert(completed.evidence[0].sourceId === completed.sources[0].sourceId, 'evidence links to source');

  const noResultProvider = new FixtureRetrievalProvider();
  noResultProvider.mode = 'no_result';
  const noResult = await executeResearchPackage(createResearchPackage('Historical research', []), new ResearchEngine([], [noResultProvider]));
  assert(noResult.queries[0].status === 'NO_RESULT', 'no-result query status is preserved');
  assert(noResult.evidence.length === 0, 'no-result retrieval creates no evidence');
  const unsupportedClaim: ClaimRecord = {
    claimId: 'unsupported', subject: 'Person', predicate: 'did', object: 'thing', normalizedStatement: 'Person did thing',
    claimType: 'FACT', status: 'UNVERIFIED', evidenceIds: [], sourceIds: [], confidence: 'UNVERIFIED',
    confidenceRationale: 'No retrieval result', provenance: 'UNKNOWN',
  };
  noResult.claims.push(unsupportedClaim);
  assert(!noResult.claims.some((claim) => claim.provenance === 'SOURCE_BACKED'), 'no-result cannot create source-backed claim');

  const failedProvider = new FixtureRetrievalProvider();
  failedProvider.mode = 'failure';
  const failed = await executeResearchPackage(createResearchPackage('Current event research', []), new ResearchEngine([], [failedProvider]));
  assert(failed.queries[0].status === 'FAILED', 'technical retrieval failure is explicit');

  const multiple = createResearchPackage('Historical research', [source('source_a'), source('source_b')]);
  const multipleEvidence: EvidenceRecord[] = [
    { evidenceId: 'e_a', sourceId: 'source_a', excerpt: 'Claim A', evidenceType: 'DIRECT_QUOTE', extractedAt: new Date().toISOString(), extractionMethod: 'test' },
    { evidenceId: 'e_b', sourceId: 'source_b', excerpt: 'Claim A', evidenceType: 'PARAPHRASE', extractedAt: new Date().toISOString(), extractionMethod: 'test' },
  ];
  multiple.evidence = multipleEvidence;
  multiple.claims = [{
    claimId: 'claim_multi', subject: 'Halimah', predicate: 'nursed', object: 'Muhammad', normalizedStatement: 'Halimah nursed Muhammad',
    claimType: 'FACT', status: 'SUPPORTED', evidenceIds: ['e_a', 'e_b'], sourceIds: ['source_a', 'source_b'], confidence: 'HIGH',
    confidenceRationale: 'Two independent supporting records', provenance: 'MULTI_SOURCE_BACKED',
  }];
  assert(validateResearchPackage(multiple).length === 0, 'multiple supporting sources remain valid and linked');

  const direct = await new DirectDocumentRetrievalProvider().retrieve({
    queryId: 'no-url', questionId: 'q', query: 'find evidence without a URL', purpose: 'test', sourceTypes: ['GENERAL_WEB'], priority: 'LOW', status: 'PLANNED',
  });
  assert(direct.status === 'NO_RESULT' && !direct.source, 'unsupported search does not fabricate a citation');

  const localServer = createServer((_request, response) => {
    response.setHeader('content-type', 'text/html');
    response.end('<html><head><title>Local Evidence</title></head><body>Halimah nursed Muhammad during his infancy.</body></html>');
  });
  await new Promise<void>((resolve) => localServer.listen(0, '127.0.0.1', resolve));
  try {
    const address = localServer.address();
    assert(address && typeof address === 'object', 'local retrieval test server started');
    const actualFetch = await new DirectDocumentRetrievalProvider().retrieve({
      queryId: 'direct-fetch', questionId: 'q', query: `http://127.0.0.1:${address.port}/evidence`, purpose: 'historical_fact',
      sourceTypes: ['SIRAH'], priority: 'HIGH', status: 'PLANNED',
    });
    assert(actualFetch.status === 'EXECUTED', 'built-in retrieval provider fetches a document');
    assert(actualFetch.source?.verification === 'VERIFIED', 'usable fetched source is verified');
    assert(actualFetch.evidence?.[0].sourceId === actualFetch.source?.sourceId, 'built-in evidence links to fetched source');
    assert(actualFetch.evidence?.[0].queryId === 'direct-fetch', 'built-in evidence links to query');
  } finally {
    await new Promise<void>((resolve, reject) => localServer.close((error) => error ? reject(error) : resolve()));
  }

  console.log('PATCH 6.0 PHASE 3B retrieval assertions: PASS');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
