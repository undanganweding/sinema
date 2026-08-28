import {
  ClaimRecord,
  EvidenceRecord,
  GroundingContentCategory,
  ResearchPackage,
  ResearchPriority,
  ResearchQuery,
  ResearchQueryStatus,
  ResearchQuestion,
  ResearchQuestionType,
  ResearchRetrievalOptions,
  ResearchRetrievalProvider,
  ResearchRetrievalProviderType,
  ResearchRetrievalResult,
  SourceRegistryEntry,
  SourceType,
  SourceAuthority,
  SourceVerification,
  SearchBudget,
  SearchExecution,
  SearchResult,
  SearchStatus,
} from '../src/types';
import { DEFAULT_SEARCH_BUDGET, SearchEngine } from './search_engine';

export interface ResearchSourceCandidate {
  sourceType: SourceType;
  title: string;
  author?: string;
  publisher?: string;
  reference?: string;
  url?: string;
  relevance?: number;
  usedFor?: string[];
  sourceNotes?: string;
  authority?: SourceAuthority;
  verification?: SourceVerification;
}

export interface ResearchProvider {
  name: string;
  supportsFreshResearch: boolean;
  discover(rawScript: string, categories: GroundingContentCategory[], sourceTypes: SourceType[]): ResearchSourceCandidate[];
}

function queryUrl(query: string): string | null {
  const match = query.match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[),.;]+$/, '') : null;
}

function stripMarkup(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceAuthority(sourceType: SourceType): SourceAuthority {
  if (['OFFICIAL_SOURCE', 'MANUFACTURER', 'QURAN', 'HADITH', 'DOCUMENTATION'].includes(sourceType)) return 'HIGH';
  if (['ACADEMIC_SOURCE', 'SIRAH', 'TAFSIR', 'TARIKH', 'NEWS', 'PRODUCT_SOURCE'].includes(sourceType)) return 'MEDIUM';
  return 'UNKNOWN';
}

export class DirectDocumentRetrievalProvider implements ResearchRetrievalProvider {
  providerId = 'direct_document_retrieval';
  providerType: ResearchRetrievalProviderType = 'DOCUMENT';
  capabilities = ['direct_url_fetch', 'html_text_extraction'];

  async retrieve(query: ResearchQuery, options: ResearchRetrievalOptions = {}): Promise<ResearchRetrievalResult> {
    const url = queryUrl(query.query);
    if (!url) return { status: 'NO_RESULT', error: 'No directly retrievable URL was present in the query.' };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/html,text/plain' } });
      if (!response.ok) return { status: 'SOURCE_UNAVAILABLE', error: `HTTP ${response.status}` };
      const raw = await response.text();
      const content = stripMarkup(raw);
      if (!content) return { status: 'INSUFFICIENT_EVIDENCE', error: 'Retrieved source contained no usable text.' };
      const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? stripMarkup(titleMatch[1]) : url;
      const excerpt = content.slice(0, options.maxExcerptLength ?? 1200);
      const sourceId = `retrieved_${Buffer.from(url).toString('base64url').slice(0, 40)}`;
      const source: SourceRegistryEntry = {
        sourceId,
        sourceType: query.sourceTypes[0] || 'GENERAL_WEB',
        title,
        url,
        retrievedAt: new Date().toISOString(),
        relevance: 0.5,
        authority: sourceAuthority(query.sourceTypes[0] || 'GENERAL_WEB'),
        verification: 'VERIFIED',
        usedFor: [query.purpose],
        sourceNotes: 'Verified by direct retrieval; excerpt retained as evidence.',
      };
      const evidence: EvidenceRecord = {
        evidenceId: `${query.queryId}_${sourceId}_evidence`,
        sourceId,
        queryId: query.queryId,
        excerpt,
        sourceLocator: { documentLocation: 'retrieved document; exact section unavailable' },
        evidenceType: 'PARAPHRASE',
        extractedAt: new Date().toISOString(),
        extractionMethod: 'direct_document_text_extraction',
        notes: 'Exact page/section locator was unavailable; no locator was fabricated.',
      };
      return { status: 'EXECUTED', source, evidence: [evidence] };
    } catch (error: any) {
      return {
        status: error?.name === 'AbortError' ? 'NETWORK_FAILURE' : 'SOURCE_UNAVAILABLE',
        error: error?.message || 'Document retrieval failed.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class WebResearchProvider implements ResearchProvider {
  name = 'web_research_provider';
  supportsFreshResearch = true;

  discover(rawScript: string, categories: GroundingContentCategory[], sourceTypes: SourceType[]): ResearchSourceCandidate[] {
    return [];
  }
}

export class AIKnowledgeProvider implements ResearchProvider {
  name = 'existing_ai_knowledge_provider';
  supportsFreshResearch = false;

  discover(rawScript: string, categories: GroundingContentCategory[], sourceTypes: SourceType[]): ResearchSourceCandidate[] {
    return [
      {
        sourceType: 'UNKNOWN',
        title: 'AI knowledge base contextual synthesis',
        author: 'AI model knowledge context',
        reference: 'Project narrative synthesis',
        relevance: 0.6,
        usedFor: ['story_context'],
        verification: 'UNVERIFIED',
        sourceNotes: 'AI knowledge only; not independently retrieved and must not be treated as source-backed evidence.',
      },
    ];
  }
}

export class UserSourceProvider implements ResearchProvider {
  name = 'user_provided_sources';
  supportsFreshResearch = true;

  discover(rawScript: string, categories: GroundingContentCategory[], sourceTypes: SourceType[]): ResearchSourceCandidate[] {
    return [];
  }
}

export class ResearchEngine {
  providers: ResearchProvider[];
  retrievalProviders: ResearchRetrievalProvider[];
  searchEngine: SearchEngine;

  constructor(
    providers: ResearchProvider[] = [],
    retrievalProviders: ResearchRetrievalProvider[] = [],
    searchProviders: import('../src/types').ResearchSearchProvider[] = [],
    searchBudget: SearchBudget = DEFAULT_SEARCH_BUDGET,
  ) {
    this.providers = providers.length > 0 ? providers : [
      new WebResearchProvider(),
      new AIKnowledgeProvider(),
      new UserSourceProvider(),
    ];
    this.retrievalProviders = retrievalProviders.length > 0 ? retrievalProviders : [new DirectDocumentRetrievalProvider()];
    this.searchEngine = new SearchEngine(searchProviders, searchBudget);
  }

  discoverSources(rawScript: string, categories: GroundingContentCategory[], sourceTypes: SourceType[]): SourceRegistryEntry[] {
    const merged: SourceRegistryEntry[] = [];
    const seen = new Set<string>();

    this.providers.forEach((provider) => {
      const results = provider.discover(rawScript, categories, sourceTypes);
      results.forEach((candidate, index) => {
        const id = `${provider.name}_${candidate.title}_${index}`;
        if (seen.has(id)) return;
        seen.add(id);
        merged.push({
          sourceId: id,
          sourceType: candidate.sourceType,
          title: candidate.title,
          author: candidate.author,
          publisher: candidate.publisher,
          reference: candidate.reference,
          url: candidate.url,
          retrievedAt: new Date().toISOString(),
          relevance: candidate.relevance ?? 0.5,
          usedFor: candidate.usedFor || [],
          sourceNotes: candidate.sourceNotes,
          authority: candidate.authority || 'UNKNOWN',
          verification: candidate.verification || (candidate.url?.startsWith('internal:') ? 'UNVERIFIED' : 'UNAVAILABLE'),
        });
      });
    });

    return merged;
  }

  async retrieve(query: ResearchQuery, options?: ResearchRetrievalOptions): Promise<ResearchRetrievalResult> {
    const provider = this.retrievalProviders.find((candidate) =>
      query.sourceTypes.some((sourceType) => candidate.capabilities.includes(sourceType.toLowerCase()))
    ) || this.retrievalProviders[0];
    if (!provider) return { status: 'SOURCE_UNAVAILABLE', error: 'No retrieval provider is configured.' };
    return provider.retrieve(query, options);
  }

  async discover(queries: ResearchQuery[], strategy: import('../src/types').ResearchStrategy): Promise<{ queries: ResearchQuery[]; results: SearchResult[]; executions: SearchExecution[]; status: SearchStatus }> {
    return this.searchEngine.searchQueries(queries, strategy);
  }
}

const questionForCategory: Partial<Record<GroundingContentCategory, { type: ResearchQuestionType; question: string }>> = {
  HISTORICAL: { type: 'EVENT', question: 'What source-backed events, dates, and historical context are relevant?' },
  RELIGIOUS: { type: 'SOURCE_VERIFICATION', question: 'Which primary or scholarly sources establish the relevant religious claims?' },
  BIOGRAPHICAL: { type: 'ENTITY', question: 'Which biographical entities and timeline facts are established by sources?' },
  PRODUCT: { type: 'PRODUCT', question: 'Which official product identity and specifications are source-backed?' },
  AFFILIATE: { type: 'PRODUCT', question: 'Which product claims are supported by manufacturer or official sources?' },
  TUTORIAL: { type: 'SOFTWARE', question: 'Which software, device, version, and documented features are verified?' },
  DOCUMENTARY: { type: 'GENERAL_CONTEXT', question: 'Which factual context is supported by authoritative sources?' },
  FICTION: { type: 'SOURCE_VERIFICATION', question: 'Which user-provided canon or supplied references define this fictional world?' },
};

export function planResearchQuestions(rawScript: string): ResearchQuestion[] {
  const classification = new Set<GroundingContentCategory>();
  const text = rawScript.toLowerCase();
  if (/(historical|sejarah|wwii|world war|ancient|medieval)/i.test(text)) classification.add('HISTORICAL');
  if (/(religious|islam|quran|hadith|sirah|nabi|rasul)/i.test(text)) classification.add('RELIGIOUS');
  if (/(product|produk|specification|manufacturer|affiliate)/i.test(text)) classification.add('PRODUCT');
  if (/(tutorial|software|version|documentation|install)/i.test(text)) classification.add('TUTORIAL');
  if (/(fiction|fantasy|novel|cerita|story)/i.test(text)) classification.add('FICTION');
  if (classification.size === 0) classification.add('GENERAL_STORY');
  return Array.from(classification).map((category, index) => {
    const definition = questionForCategory[category] || { type: 'GENERAL_CONTEXT' as ResearchQuestionType, question: 'What general context is relevant and source-backed?' };
    return {
      questionId: `question_${index + 1}`,
      type: definition.type,
      question: `${definition.question} User context: ${rawScript.slice(0, 500)}`,
      priority: category === 'CURRENT_EVENT' || category === 'PRODUCT' ? 'HIGH' : 'MEDIUM',
      required: category !== 'FICTION' && category !== 'GENERAL_STORY',
    };
  });
}

export function buildResearchQueries(questions: ResearchQuestion[], sourceTypes: SourceType[]): ResearchQuery[] {
  return questions.map((question) => ({
    queryId: `query_${question.questionId}`,
    questionId: question.questionId,
    query: question.question,
    purpose: question.type.toLowerCase(),
    sourceTypes,
    priority: question.priority,
    status: 'PLANNED',
  }));
}

export async function executeResearchPackage(
  researchPackage: ResearchPackage,
  engine = new ResearchEngine(),
  options?: ResearchRetrievalOptions
): Promise<ResearchPackage> {
  const queries = researchPackage.queries.length > 0
    ? researchPackage.queries
    : buildResearchQueries(researchPackage.researchQuestions, researchPackage.researchStrategy.sourceTypes);
  const nextQueries = [...queries];
  const sources = [...researchPackage.sources];
  const evidence = [...researchPackage.evidence];
  let searchResults = researchPackage.searchResults ? [...researchPackage.searchResults] : [];
  let searchExecutions = researchPackage.searchExecutions ? [...researchPackage.searchExecutions] : [];
  let searchStatus = researchPackage.searchStatus;

  const hasPlannedQueries = nextQueries.some((query) => query.status === 'PLANNED');
  if (!hasPlannedQueries && (researchPackage.searchResults || researchPackage.evidence.length > 0 || researchPackage.sources.length > 0)) {
    return { ...researchPackage, queries: nextQueries };
  }

  if (researchPackage.researchRequirement === 'RESEARCH_REQUIRED' || researchPackage.researchRequirement === 'RESEARCH_RECOMMENDED') {
    const discovery = await engine.discover(nextQueries, researchPackage.researchStrategy);
    for (const query of discovery.queries) {
      const index = nextQueries.findIndex((candidate) => candidate.queryId === query.queryId);
      if (index >= 0) nextQueries[index] = query;
    }
    searchResults = Array.from(new Map([...searchResults, ...discovery.results].map((result) => [result.searchResultId, result])).values());
    searchExecutions = [...searchExecutions, ...discovery.executions];
    searchStatus = discovery.status;
  }

  const resultByQuery = new Map<string, SearchResult[]>();
  for (const result of searchResults) {
    const existing = resultByQuery.get(result.queryId) || [];
    existing.push(result);
    resultByQuery.set(result.queryId, existing);
  }
  const retrievedUrls = new Set(sources.filter((source) => source.verification === 'VERIFIED' && source.url).map((source) => source.url));

  for (const query of nextQueries) {
    if (query.status !== 'PLANNED') continue;
    const candidates = resultByQuery.get(query.queryId) || [];
    const urls = candidates.map((candidate) => candidate.url).filter((url) => !retrievedUrls.has(url));
    const retrievalQueries = urls.length > 0 ? urls.map((url) => ({ ...query, query: url })) : [query];
    let lastResult: ResearchRetrievalResult = { status: 'NO_RESULT' };
    for (const retrievalQuery of retrievalQueries) {
      lastResult = await engine.retrieve(retrievalQuery, options);
      if (lastResult.source?.url) retrievedUrls.add(lastResult.source.url);
      if (lastResult.source) sources.push(lastResult.source);
      if (lastResult.evidence) evidence.push(...lastResult.evidence);
    }
    const result = lastResult;
    const queryIndex = nextQueries.findIndex((candidate) => candidate.queryId === query.queryId);
    const querySources = candidates.length > 0
      ? sources.filter((source) => source.url && candidates.some((candidate) => candidate.url === source.url))
      : (result.source ? [result.source] : []);
    const queryEvidence = candidates.length > 0
      ? evidence.filter((item) => querySources.some((source) => source.sourceId === item.sourceId))
      : (result.evidence || []);
    const sourceIds = querySources.map((item) => item.sourceId);
    const evidenceIds = queryEvidence.map((item) => item.evidenceId);
    nextQueries[queryIndex] = {
      ...query,
      status: (querySources.length > 0 && queryEvidence.length > 0) ? 'EXECUTED' : result.status === 'NO_RESULT' ? 'NO_RESULT' : result.status === 'INSUFFICIENT_EVIDENCE' ? 'PARTIAL' : 'FAILED',
      sourceIds,
      evidenceIds,
    };
  }

  const uniqueSources = Array.from(new Map(sources.map((source) => [source.sourceId, source])).values());
  const uniqueEvidence = Array.from(new Map(evidence.map((item) => [item.evidenceId, item])).values());
  return {
    ...researchPackage,
    queries: nextQueries,
    sources: uniqueSources,
    evidence: uniqueEvidence,
    searchResults,
    searchExecutions,
    searchStatus,
    qualityAssessment: {
      ...researchPackage.qualityAssessment,
      sourceCount: uniqueSources.length,
      evidenceCount: uniqueEvidence.length,
      overallStatus: uniqueEvidence.length > 0 ? 'ADEQUATE' : 'INSUFFICIENT',
    },
  };
}
