import {
  ResearchQuery,
  ResearchSearchProvider,
  ResearchStrategy,
  SearchBudget,
  SearchExecution,
  SearchResult,
  SearchResultSet,
  SearchStatus,
  SourceAuthority,
  SourceType,
} from '../src/types';

export const DEFAULT_SEARCH_BUDGET: SearchBudget = {
  maxQueriesPerResearchRun: 8,
  maxResultsPerQuery: 5,
  maxSourcesPerResearchRun: 12,
};

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function canonicalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function normalizeResearchQuery(query: ResearchQuery): ResearchQuery {
  return { ...query, normalizedQuery: `${normalizeQuery(query.query)}|${query.purpose}|${query.sourceTypes.slice().sort().join(',')}` };
}

export class UnavailableSearchProvider implements ResearchSearchProvider {
  providerId = 'search_unavailable';
  providerType = 'WEB' as const;
  capabilities: string[] = [];

  async search(query: ResearchQuery): Promise<SearchResultSet> {
    const startedAt = new Date().toISOString();
    const execution: SearchExecution = {
      searchExecutionId: `search_${query.queryId}_${Date.now()}`,
      queryId: query.queryId,
      providerId: this.providerId,
      startedAt,
      completedAt: new Date().toISOString(),
      status: 'SEARCH_UNAVAILABLE',
      resultCount: 0,
      errorCode: 'SEARCH_BACKEND_UNAVAILABLE',
    };
    return { status: 'SEARCH_UNAVAILABLE', results: [], execution, error: 'No search backend is configured.' };
  }
}

export function assessSearchResult(result: SearchResult, strategy: ResearchStrategy): number {
  const authority = result.authority === 'HIGH' ? 3 : result.authority === 'MEDIUM' ? 2 : result.authority === 'LOW' ? 1 : 0;
  const typeMatch = strategy.sourceTypes.includes(result.sourceType || 'UNKNOWN') ? 2 : 0;
  const relevance = typeof result.relevance === 'number' ? Math.max(0, Math.min(1, result.relevance)) : 0;
  const verified = result.verification === 'VERIFIED' ? 1 : 0;
  return authority + typeMatch + relevance + verified;
}

export function selectSearchResults(results: SearchResult[], strategy: ResearchStrategy, budget: SearchBudget): SearchResult[] {
  const deduplicated = new Map<string, SearchResult>();
  for (const result of results) {
    const key = canonicalizeUrl(result.url);
    const existing = deduplicated.get(key);
    if (!existing || assessSearchResult(result, strategy) > assessSearchResult(existing, strategy)) {
      deduplicated.set(key, { ...result, url: key });
    }
  }
  return Array.from(deduplicated.values())
    .sort((a, b) => assessSearchResult(b, strategy) - assessSearchResult(a, strategy))
    .slice(0, budget.maxSourcesPerResearchRun);
}

export interface SearchRunResult {
  queries: ResearchQuery[];
  results: SearchResult[];
  executions: SearchExecution[];
  status: SearchStatus;
}

export class SearchEngine {
  private readonly providers: ResearchSearchProvider[];
  private readonly budget: SearchBudget;

  constructor(
    providers: ResearchSearchProvider[] = [],
    budget: SearchBudget = DEFAULT_SEARCH_BUDGET,
  ) {
    this.providers = providers.length > 0 ? providers : [new UnavailableSearchProvider()];
    this.budget = budget;
  }

  async searchQueries(queries: ResearchQuery[], strategy: ResearchStrategy): Promise<SearchRunResult> {
    const uniqueQueries = new Map<string, ResearchQuery>();
    for (const query of queries) {
      if (query.status !== 'PLANNED') continue;
      const normalized = normalizeResearchQuery(query);
      const key = `${normalized.normalizedQuery}|${normalized.questionId}`;
      if (!uniqueQueries.has(key)) uniqueQueries.set(key, normalized);
    }
    const selectedQueries = Array.from(uniqueQueries.values()).slice(0, this.budget.maxQueriesPerResearchRun);
    const executions: SearchExecution[] = [];
    const results: SearchResult[] = [];
    const updatedQueries = queries.map((query) => ({ ...query }));
    let sawUnavailable = false;
    let sawFailure = false;
    let sawBlocked = false;
    const budgetExhausted = uniqueQueries.size > selectedQueries.length;
    let sawResult = false;

    for (const query of selectedQueries) {
      const provider = this.providers[0];
      const result = await provider.search(query, strategy, { maxResults: this.budget.maxResultsPerQuery });
      executions.push(result.execution);
      const queryIndex = updatedQueries.findIndex((item) => item.queryId === query.queryId);
      const selectedResults = selectSearchResults(result.results.slice(0, this.budget.maxResultsPerQuery), strategy, this.budget);
      results.push(...selectedResults);
      if (selectedResults.length > 0) sawResult = true;
      if (result.status === 'SEARCH_UNAVAILABLE') sawUnavailable = true;
      if (result.status === 'SEARCH_FAILED' || result.status === 'SEARCH_BLOCKED') sawFailure = true;
      if (result.status === 'SEARCH_BLOCKED') sawBlocked = true;
      if (queryIndex >= 0) {
        updatedQueries[queryIndex] = {
          ...updatedQueries[queryIndex],
          normalizedQuery: query.normalizedQuery,
          searchExecutionId: result.execution.searchExecutionId,
          searchResultIds: selectedResults.map((item) => item.searchResultId),
        };
      }
    }

    const uniqueResultMap = new Map<string, SearchResult>();
    for (const result of results) {
      const key = canonicalizeUrl(result.url);
      const existing = uniqueResultMap.get(key);
      if (!existing || assessSearchResult(result, strategy) > assessSearchResult(existing, strategy)) {
        uniqueResultMap.set(key, result);
      }
    }
    const uniqueResults = Array.from(uniqueResultMap.values()).slice(0, this.budget.maxSourcesPerResearchRun);
    const status: SearchStatus = budgetExhausted
      ? 'SEARCH_BUDGET_EXHAUSTED'
      : sawResult
      ? (sawUnavailable || sawFailure ? 'SEARCH_PARTIAL' : 'SEARCH_AVAILABLE')
      : sawUnavailable ? 'SEARCH_UNAVAILABLE'
        : sawBlocked ? 'SEARCH_BLOCKED'
          : sawFailure ? 'SEARCH_FAILED'
            : 'SEARCH_NO_RESULT';
    const storedResultIds = new Set(uniqueResults.map((result) => result.searchResultId));
    return {
      queries: updatedQueries.map((query) => ({
        ...query,
        searchResultIds: (query.searchResultIds || []).filter((id) => storedResultIds.has(id)),
      })),
      results: uniqueResults,
      executions,
      status,
    };
  }
}

export function sourceTypeForResult(result: SearchResult): SourceType {
  return result.sourceType || 'GENERAL_WEB';
}

export function authorityForResult(result: SearchResult): SourceAuthority {
  return result.authority || 'UNKNOWN';
}
