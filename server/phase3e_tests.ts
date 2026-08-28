import { createResearchPackage } from './grounding_engine';
import { DirectDocumentRetrievalProvider, executeResearchPackage, ResearchEngine } from './research_engine';
import { canonicalizeUrl, DEFAULT_SEARCH_BUDGET, SearchEngine } from './search_engine';
import { ResearchQuery, ResearchSearchProvider, ResearchStrategy, SearchResultSet } from '../src/types';
import { createServer } from 'node:http';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

const strategy: ResearchStrategy = {
  required: true,
  freshRequired: false,
  researchRequirement: 'RESEARCH_REQUIRED',
  sourceTypes: ['HISTORICAL_SOURCE'],
  summary: 'test',
  providers: ['fixture'],
};

function query(id: string, text = 'Person A historical event'): ResearchQuery {
  return { queryId: id, questionId: `question_${id}`, query: text, purpose: 'historical_event', sourceTypes: ['HISTORICAL_SOURCE'], priority: 'HIGH', status: 'PLANNED' };
}

class FixtureSearchProvider implements ResearchSearchProvider {
  providerId = 'fixture_search';
  providerType = 'WEB' as const;
  capabilities = ['historical'];
  mode: 'success' | 'empty' | 'failed' | 'blocked' = 'success';
  calls: string[] = [];
  url = 'https://example.test/article';

  async search(item: ResearchQuery): Promise<SearchResultSet> {
    this.calls.push(item.queryId);
    const execution = { searchExecutionId: `exec_${item.queryId}`, queryId: item.queryId, providerId: this.providerId, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: this.mode === 'empty' ? 'SEARCH_NO_RESULT' : this.mode === 'failed' ? 'SEARCH_FAILED' : this.mode === 'blocked' ? 'SEARCH_BLOCKED' : 'SEARCH_AVAILABLE', resultCount: this.mode === 'success' ? 2 : 0 } as const;
    if (this.mode !== 'success') return { status: execution.status, results: [], execution, error: `fixture_${this.mode}` };
    return {
      status: 'SEARCH_AVAILABLE',
      execution,
      results: [
        { searchResultId: `${item.queryId}_a`, queryId: item.queryId, providerId: this.providerId, title: 'Historical source A', url: `${this.url}/`, snippet: 'Candidate snippet only.', sourceType: 'HISTORICAL_SOURCE', retrievedAt: new Date().toISOString(), relevance: 0.8, authority: 'HIGH', verification: 'UNVERIFIED', status: 'CANDIDATE' },
        { searchResultId: `${item.queryId}_b`, queryId: item.queryId, providerId: this.providerId, title: 'Historical source A duplicate', url: this.url, snippet: 'Another candidate snippet.', sourceType: 'HISTORICAL_SOURCE', retrievedAt: new Date().toISOString(), relevance: 0.7, authority: 'LOW', verification: 'UNVERIFIED', status: 'CANDIDATE' },
      ],
    };
  }
}

async function main(): Promise<void> {
  assert(canonicalizeUrl('https://example.test/article/') === canonicalizeUrl('https://example.test/article'), 'URL canonicalization removes only insignificant trailing slash');

  const unavailable = await new SearchEngine().searchQueries([query('unavailable')], strategy);
  assert(unavailable.status === 'SEARCH_UNAVAILABLE', 'missing search backend is explicit');
  assert(unavailable.results.length === 0, 'unavailable search creates no results');

  const provider = new FixtureSearchProvider();
  const discovered = await new SearchEngine([provider], { ...DEFAULT_SEARCH_BUDGET, maxQueriesPerResearchRun: 2, maxResultsPerQuery: 5, maxSourcesPerResearchRun: 5 }).searchQueries([query('q1'), query('q1'), query('q2')], strategy);
  assert(provider.calls.length === 2, 'duplicate planned queries execute once');
  assert(discovered.results.length === 1, 'duplicate URLs become one candidate source');
  assert(discovered.results[0].queryId === 'q1' && discovered.results[0].providerId === 'fixture_search', 'search result provenance is preserved');
  assert(discovered.results[0].verification === 'UNVERIFIED', 'search result is not falsely verified');
  assert(discovered.executions.length === 2, 'search execution metadata is preserved');

  const budgetProvider = new FixtureSearchProvider();
  const budget = await new SearchEngine([budgetProvider], { maxQueriesPerResearchRun: 1, maxResultsPerQuery: 1, maxSourcesPerResearchRun: 1 }).searchQueries([query('b1'), query('b2')], strategy);
  assert(budgetProvider.calls.length === 1 && budget.results.length <= 1 && budget.status === 'SEARCH_BUDGET_EXHAUSTED', 'search budget limits queries and results');

  const emptyProvider = new FixtureSearchProvider();
  emptyProvider.mode = 'empty';
  assert((await new SearchEngine([emptyProvider]).searchQueries([query('empty')], strategy)).status === 'SEARCH_NO_RESULT', 'empty backend result is distinct from unavailable');
  const failedProvider = new FixtureSearchProvider();
  failedProvider.mode = 'failed';
  assert((await new SearchEngine([failedProvider]).searchQueries([query('failed')], strategy)).status === 'SEARCH_FAILED', 'search failure is explicit');
  const blockedProvider = new FixtureSearchProvider();
  blockedProvider.mode = 'blocked';
  assert((await new SearchEngine([blockedProvider]).searchQueries([query('blocked')], strategy)).status === 'SEARCH_BLOCKED', 'search access block is explicit');

  const documentServer = createServer((_request, response) => {
    response.setHeader('content-type', 'text/html');
    response.end('<title>Retrieved historical document</title>Person A died in 1943.');
  });
  await new Promise<void>((resolve) => documentServer.listen(0, '127.0.0.1', resolve));
  try {
    const address = documentServer.address();
    assert(address && typeof address === 'object', 'document fixture server started');
    const packageData = createResearchPackage('Historical research', []);
    packageData.queries = [query('handoff')];
    const handoffProvider = new FixtureSearchProvider();
    handoffProvider.url = `http://127.0.0.1:${address.port}/article`;
    const engine = new ResearchEngine([], [new DirectDocumentRetrievalProvider()], [handoffProvider]);
    const executed = await executeResearchPackage(packageData, engine);
    assert(executed.searchResults?.length === 1, 'research package stores candidate search results');
    assert(executed.evidence.length === 1, 'selected search result is handed to canonical document retrieval');
    assert(executed.evidence[0].sourceId === executed.sources.find((source) => source.verification === 'VERIFIED')?.sourceId, 'evidence comes from retrieved source, not search result');
    assert(executed.searchResults?.every((result) => result.status === 'CANDIDATE'), 'search results remain candidate metadata');
  } finally {
    await new Promise<void>((resolve, reject) => documentServer.close((error) => error ? reject(error) : resolve()));
  }

  const optional = createResearchPackage('fictional creative story', []);
  const optionalProvider = new FixtureSearchProvider();
  await executeResearchPackage(optional, new ResearchEngine([], [new DirectDocumentRetrievalProvider()], [optionalProvider]));
  assert(optionalProvider.calls.length === 0, 'optional research does not auto-discover');

  console.log('PATCH 6.0 PHASE 3E search assertions: PASS');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
