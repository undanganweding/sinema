import { Project, ContextPackage, SourceRegistryEntry, GroundingValidationResult, GroundingContentCategory, ResearchStrategy, ContentClassificationResult, SourceType, ResearchRequirement, ResearchPackage, ResearchQualityAssessment } from '../src/types';
import { ResearchEngine, buildResearchQueries, planResearchQuestions } from './research_engine';
import { resolveResearchPackage } from './claim_resolution_engine';

export const GROUNDING_VERSION = '1.0';

const defaultSourceTypesByCategory: Record<GroundingContentCategory, SourceType[]> = {
  HISTORICAL: ['HISTORICAL_SOURCE', 'ACADEMIC_SOURCE', 'OFFICIAL_SOURCE', 'GENERAL_WEB'],
  RELIGIOUS: ['QURAN', 'HADITH', 'SIRAH', 'TAFSIR', 'TARIKH', 'ATHAR', 'ACADEMIC_SOURCE'],
  BIOGRAPHICAL: ['HISTORICAL_SOURCE', 'ACADEMIC_SOURCE', 'GENERAL_WEB'],
  PRODUCT: ['PRODUCT_SOURCE', 'MANUFACTURER', 'OFFICIAL_SOURCE'],
  DOCUMENTARY: ['OFFICIAL_SOURCE', 'NEWS', 'ACADEMIC_SOURCE', 'GENERAL_WEB'],
  FICTION: ['GENERAL_WEB', 'UNKNOWN'],
  EDUCATIONAL: ['ACADEMIC_SOURCE', 'DOCUMENTATION', 'OFFICIAL_SOURCE'],
  CREATIVE: ['GENERAL_WEB', 'UNKNOWN'],
  COMMERCIAL: ['PRODUCT_SOURCE', 'MANUFACTURER', 'OFFICIAL_SOURCE', 'GENERAL_WEB'],
  AFFILIATE: ['PRODUCT_SOURCE', 'MANUFACTURER', 'OFFICIAL_SOURCE', 'GENERAL_WEB'],
  TUTORIAL: ['DOCUMENTATION', 'OFFICIAL_SOURCE', 'GENERAL_WEB'],
  CURRENT_EVENT: ['NEWS', 'OFFICIAL_SOURCE', 'GENERAL_WEB'],
  GENERAL_STORY: ['GENERAL_WEB', 'UNKNOWN'],
  HYBRID: ['GENERAL_WEB', 'OFFICIAL_SOURCE', 'ACADEMIC_SOURCE', 'UNKNOWN'],
  UNKNOWN: ['UNKNOWN'],
};

export function classifyContent(rawScript: string): ContentClassificationResult {
  const text = (rawScript || '').toLowerCase();
  const categories: GroundingContentCategory[] = [];

  if (/(nabi|rasul|islam|quran|hadits|sirah|hijrah|makkah|madinah|salawat|prophet|muslim)/i.test(text)) {
    categories.push('RELIGIOUS');
  }

  if (/(biograph|biografi|memoir|autobiograph|life of|riwayat hidup)/i.test(text)) {
    categories.push('BIOGRAPHICAL');
  }

  if (/(wwii|world war|perang dunia|historical|sejarah|royal|empire|period|ancient|medieval|vintage|era)/i.test(text)) {
    categories.push('HISTORICAL');
  }

  if (/(product|brand|review|affiliate|promo|specification|features|price|shop|buy|merek|produk|review)/i.test(text)) {
    categories.push('COMMERCIAL');
  }

  if (/(product page|product specification|official product|produk resmi)/i.test(text)) {
    categories.push('PRODUCT');
  }

  if (/(tutorial|guide|how to|cara|install|setup|version|software|app|documentation|tutorial)/i.test(text)) {
    categories.push('TUTORIAL');
  }

  if (/(news|today|current|breaking|latest|recent|berita|terbaru|update)/i.test(text)) {
    categories.push('CURRENT_EVENT');
  }

  if (/(documentary|documenter|educational|edukasi|learning|study)/i.test(text)) {
    categories.push('DOCUMENTARY');
  }

  if (/(fiction|fantasy|sci-fi|sci fi|novel|story|kisah|cerita|naskah)/i.test(text)) {
    categories.push('FICTION');
  }

  if (/(creative brief|creative story|original world|cerita orisinal|kreatif)/i.test(text)) {
    categories.push('CREATIVE');
  }

  if (categories.length === 0) {
    categories.push('GENERAL_STORY');
  }

  const unique = Array.from(new Set(categories));
  const primaryCategory = unique[0] || 'GENERAL_STORY';

  return {
    categories: unique,
    primaryCategory,
    researchRequired: unique.some((c) => c !== 'FICTION' && c !== 'GENERAL_STORY'),
    summary: `${unique.join(', ')} content detected.`,
  };
}

export function buildResearchStrategy(rawScript: string): ResearchStrategy {
  const classification = classifyContent(rawScript);
  const sourceTypes: SourceType[] = Array.from(
    new Set(
      classification.categories.flatMap((category) => defaultSourceTypesByCategory[category] || ['GENERAL_WEB']) as SourceType[]
    )
  ) as SourceType[];

  const freshRequired = classification.categories.some((cat) =>
    ['CURRENT_EVENT', 'COMMERCIAL', 'AFFILIATE', 'PRODUCT', 'TUTORIAL'].includes(cat)
  );
  const researchRequirement: ResearchRequirement = classification.categories.includes('CURRENT_EVENT')
    ? 'RESEARCH_REQUIRED'
    : classification.categories.some((category) => ['HISTORICAL', 'RELIGIOUS', 'BIOGRAPHICAL', 'PRODUCT', 'AFFILIATE', 'TUTORIAL'].includes(category))
      ? 'RESEARCH_RECOMMENDED'
      : classification.categories.includes('FICTION') || classification.categories.includes('CREATIVE')
        ? 'RESEARCH_OPTIONAL'
        : 'RESEARCH_NOT_REQUIRED';

  return {
    required: researchRequirement === 'RESEARCH_REQUIRED' || researchRequirement === 'RESEARCH_RECOMMENDED',
    freshRequired,
    researchRequirement,
    sourceTypes,
    summary: `Research strategy for ${classification.primaryCategory}.`,
    providers: ['web_research_provider', 'existing_ai_knowledge_provider', 'user_provided_sources'],
  };
}

export function createSourceRegistry(entries: Partial<SourceRegistryEntry>[]): SourceRegistryEntry[] {
  return entries.map((entry, index) => ({
    sourceId: entry.sourceId || `source_${Date.now()}_${index}`,
    sourceType: entry.sourceType || 'UNKNOWN',
    title: entry.title || 'Untitled Source',
    author: entry.author,
    publisher: entry.publisher,
    publicationDate: entry.publicationDate,
    reference: entry.reference,
    url: entry.url,
    retrievedAt: entry.retrievedAt || new Date().toISOString(),
    relevance: entry.relevance ?? 0.5,
    usedFor: entry.usedFor || [],
    sourceNotes: entry.sourceNotes,
    authority: entry.authority || 'UNKNOWN',
    verification: entry.verification || (entry.url?.startsWith('internal:') ? 'UNVERIFIED' : 'UNAVAILABLE'),
  }));
}

export function createResearchPackage(rawScript: string, sources: SourceRegistryEntry[] = []): ResearchPackage {
  const classification = classifyContent(rawScript);
  const researchStrategy = buildResearchStrategy(rawScript);
  const qualityAssessment: ResearchQualityAssessment = {
    sourceCount: sources.length,
    evidenceCount: 0,
    backedClaimCount: 0,
    unsupportedClaimCount: 0,
    conflictCount: 0,
    unresolvedCount: 0,
    overallStatus: sources.length > 0 ? 'WEAK' : 'INSUFFICIENT',
  };
  return {
    classification,
    researchRequirement: researchStrategy.researchRequirement || 'RESEARCH_NOT_REQUIRED',
    researchStrategy,
    researchQuestions: planResearchQuestions(rawScript),
    queries: buildResearchQueries(planResearchQuestions(rawScript), researchStrategy.sourceTypes),
    sources,
    evidence: [],
    claims: [],
    entities: [],
    events: [],
    relationships: [],
    conflicts: [],
    unresolvedQuestions: [],
    qualityAssessment,
  };
}

export function validateResearchPackage(researchPackage: ResearchPackage): string[] {
  const errors: string[] = [];
  const sourceIds = new Set(researchPackage.sources.map((source) => source.sourceId));
  const evidenceIds = new Set(researchPackage.evidence.map((evidence) => evidence.evidenceId));
  for (const claim of researchPackage.claims) {
    if (claim.provenance === 'SOURCE_BACKED' || claim.provenance === 'MULTI_SOURCE_BACKED') {
      if (claim.evidenceIds.length === 0) errors.push(`Claim ${claim.claimId} is source-backed but has no evidence.`);
      if (claim.sourceIds.some((sourceId) => !sourceIds.has(sourceId))) errors.push(`Claim ${claim.claimId} references an unknown source.`);
      if (claim.evidenceIds.some((evidenceId) => !evidenceIds.has(evidenceId))) errors.push(`Claim ${claim.claimId} references unknown evidence.`);
    }
    if (claim.provenance === 'AI_KNOWLEDGE' && claim.sourceIds.length > 0) errors.push(`Claim ${claim.claimId} cannot attribute AI knowledge directly to sources.`);
  }
  return errors;
}

export function buildGroundingContextPackage(rawScript: string): ContextPackage {
  const classification = classifyContent(rawScript);
  const strategy = buildResearchStrategy(rawScript);
  const researchEngine = new ResearchEngine();
  const discoveredSources = researchEngine.discoverSources(rawScript, classification.categories, strategy.sourceTypes);
  const sourceRegistry = discoveredSources.length > 0 ? discoveredSources : createSourceRegistry([
    {
      sourceId: 'source_default_1',
      sourceType: classification.primaryCategory === 'RELIGIOUS' ? 'SIRAH' : 'GENERAL_WEB',
      title: 'Initial grounding context',
      relevance: 0.6,
      usedFor: ['classification', 'context'],
      sourceNotes: 'Initial project-level context placeholder created before targeted research is performed.',
    },
  ]);

  return {
    version: GROUNDING_VERSION,
    contentType: classification.categories,
    primaryCategory: classification.primaryCategory,
    researchRequired: strategy.required,
    researchSummary: `${strategy.summary} ${classification.summary}`,
    sources: sourceRegistry,
    timeline: [
      {
        eventId: 'event_1',
        label: 'Story context identified',
        sourceIds: sourceRegistry.length > 0 ? [sourceRegistry[0].sourceId] : [],
        notes: 'Timeline created from raw script and classification step.',
      },
    ],
    entities: [],
    relationships: [],
    locations: [],
    objects: [],
    facts: [],
    constraints: ['Ground first. Create second.', 'Do not invent facts as source-backed information.'],
    unknowns: ['Entities, events, and temporal bounds require source-backed extraction before creative expansion.'],
    reconstructionRules: ['Creative reconstruction allowed only when not contradictory to grounded facts.'],
    productContext: [],
    culturalContext: [],
    technicalContext: [],
    groundingStatus: strategy.required ? 'partial' : 'idle',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function validateGroundingContext(packageData: ContextPackage): GroundingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const blockedEntities: string[] = [];
  const conflicts: string[] = [];
  const unresolvedItems: string[] = [];
  const sourceGaps: string[] = [];

  if (!packageData || !Array.isArray(packageData.sources)) {
    return {
      valid: false,
      warnings,
      errors: ['Missing context package or source registry.'],
      blockedEntities,
      conflicts,
      unresolvedItems,
      sourceGaps,
    };
  }

  if (packageData.researchRequired && packageData.sources.length === 0) {
    sourceGaps.push('No sources captured for required research.');
    errors.push('Grounding requires source-backed context for this content type.');
  }

  if (packageData.groundingStatus === 'partial') {
    warnings.push('Grounding is incomplete; research may be unavailable or partial.');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    blockedEntities,
    conflicts,
    unresolvedItems,
    sourceGaps,
    issues: [],
  };
}

export function ensureGroundingForProject(project: Project): Project {
  const nextProject = { ...project };
  if (!nextProject.groundingVersion) {
    nextProject.groundingVersion = GROUNDING_VERSION;
  }
  if (!nextProject.contextPackage) {
    nextProject.contextPackage = buildGroundingContextPackage(nextProject.raw_script || '');
  }
  if (!nextProject.groundingStatus) {
    nextProject.groundingStatus = nextProject.contextPackage.groundingStatus;
  }
  if (!nextProject.sourceRegistry) {
    nextProject.sourceRegistry = nextProject.contextPackage.sources;
  }
  if (!nextProject.researchPackage) {
    nextProject.researchPackage = createResearchPackage(nextProject.raw_script || '', nextProject.sourceRegistry || []);
  }
  if (nextProject.researchPackage && (nextProject.researchPackage.claims.length > 0 || nextProject.researchPackage.evidence.length > 0)) {
    const resolved = resolveResearchPackage(nextProject.researchPackage);
    nextProject.researchPackage = resolved.researchPackage;
    nextProject.contextPackage = resolved.contextPackage;
    nextProject.sourceRegistry = resolved.researchPackage.sources;
  }
  if (!nextProject.validationResult) {
    nextProject.validationResult = validateGroundingContext(nextProject.contextPackage);
  }
  return nextProject;
}
