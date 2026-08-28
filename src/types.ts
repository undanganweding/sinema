export type PromptLanguage = 'id' | 'en';
export type VideoPlatform = 'veo' | 'gemini_omni' | 'seedance';
export type ContinuityStatus = 'PASS' | 'CONFLICT' | 'UNSPECIFIED' | 'FILTERED';
export type EntityState = 'clean' | 'dirty' | 'stale' | 'superseded' | 'failed';
export type HistoricalSourceType = 'Quran' | 'Hadith' | 'Sirah' | 'Historical Record' | 'Scholarly Reference';

export type GroundingContentCategory =
  | 'HISTORICAL'
  | 'RELIGIOUS'
  | 'BIOGRAPHICAL'
  | 'PRODUCT'
  | 'DOCUMENTARY'
  | 'FICTION'
  | 'EDUCATIONAL'
  | 'CREATIVE'
  | 'COMMERCIAL'
  | 'AFFILIATE'
  | 'TUTORIAL'
  | 'CURRENT_EVENT'
  | 'GENERAL_STORY'
  | 'HYBRID'
  | 'UNKNOWN';

export type ResearchRequirement =
  | 'RESEARCH_REQUIRED'
  | 'RESEARCH_RECOMMENDED'
  | 'RESEARCH_OPTIONAL'
  | 'RESEARCH_NOT_REQUIRED';

export type ResearchQuestionType =
  | 'ENTITY'
  | 'EVENT'
  | 'CHRONOLOGY'
  | 'RELATIONSHIP'
  | 'LOCATION'
  | 'OBJECT'
  | 'PRODUCT'
  | 'SPECIFICATION'
  | 'SOFTWARE'
  | 'SOURCE_VERIFICATION'
  | 'GENERAL_CONTEXT';

export type ResearchPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type ResearchQueryStatus = 'PLANNED' | 'EXECUTED' | 'FAILED' | 'NO_RESULT' | 'PARTIAL';
export type ResearchRetrievalProviderType = 'WEB' | 'DOCUMENT' | 'USER_SOURCE' | 'PROJECT_SOURCE' | 'API' | 'AI_KNOWLEDGE';
export type ResearchRetrievalStatus = 'EXECUTED' | 'NO_RESULT' | 'SOURCE_UNAVAILABLE' | 'NETWORK_FAILURE' | 'PARSER_FAILURE' | 'INSUFFICIENT_EVIDENCE' | 'UNVERIFIED';
export type SearchStatus = 'SEARCH_AVAILABLE' | 'SEARCH_UNAVAILABLE' | 'SEARCH_NO_RESULT' | 'SEARCH_FAILED' | 'SEARCH_BLOCKED' | 'SEARCH_PARTIAL' | 'SEARCH_BUDGET_EXHAUSTED';
export type SearchResultStatus = 'CANDIDATE' | 'DUPLICATE' | 'FILTERED' | 'UNAVAILABLE';
export type SearchProviderType = 'WEB' | 'API' | 'PROJECT_SOURCE' | 'USER_SOURCE';
export type EvidenceType = 'DIRECT_QUOTE' | 'PARAPHRASE' | 'STRUCTURED_DATA' | 'METADATA' | 'USER_PROVIDED' | 'AI_KNOWLEDGE' | 'UNAVAILABLE';
export type ClaimExtractionMode = 'DIRECT' | 'INFERRED' | 'AMBIGUOUS';
export type ClaimExtractionStatus = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'AMBIGUOUS' | 'UNSUPPORTED' | 'REJECTED';
export type ClaimKind = 'CLAIM' | 'FACT' | 'ASSUMPTION' | 'INFERENCE' | 'RECONSTRUCTION' | 'UNKNOWN' | 'DIRECT_FACT' | 'RELATIONSHIP' | 'EVENT' | 'TEMPORAL' | 'LOCATION' | 'ATTRIBUTE' | 'IDENTITY' | 'NEGATION' | 'QUANTITATIVE' | 'CAUSAL';
export type ClaimStatus = 'SUPPORTED' | 'UNSUPPORTED' | 'UNVERIFIED' | 'CONFLICTED' | 'NOT_ESTABLISHED';
export type ClaimProvenance = 'SOURCE_BACKED' | 'MULTI_SOURCE_BACKED' | 'USER_PROVIDED' | 'AI_KNOWLEDGE' | 'INFERRED' | 'RECONSTRUCTED' | 'UNKNOWN';
export type FactConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED' | 'UNKNOWN';
export type SourceAuthority = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type SourceVerification = 'VERIFIED' | 'UNVERIFIED' | 'UNAVAILABLE';
export type ConflictStatus = 'UNRESOLVED' | 'RESOLVED' | 'PREFERRED_CLAIM';
export type TemporalRelation = 'BEFORE' | 'AFTER' | 'DURING' | 'OVERLAPS' | 'UNKNOWN';
export type UnresolvedQuestionStatus = 'NO_EVIDENCE' | 'CONFLICTING_EVIDENCE' | 'UNAVAILABLE_SOURCE' | 'INSUFFICIENT_SOURCE';
export type ResearchQualityStatus = 'STRONG' | 'ADEQUATE' | 'WEAK' | 'INSUFFICIENT';

export type ProvenanceType = 'SOURCE_FACT' | 'SOURCE_CONTEXT' | 'CINEMATIC_RECONSTRUCTION' | 'UNKNOWN';
export type GroundingSeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'UNKNOWN';
export type GroundingConstraintSeverity = 'HARD_CONSTRAINT' | 'SOFT_CONSTRAINT' | 'INFORMATIONAL';
export type GroundingStatus = 'idle' | 'partial' | 'complete' | 'research_unavailable';
export type SourceType =
  | 'QURAN'
  | 'HADITH'
  | 'SIRAH'
  | 'TAFSIR'
  | 'TARIKH'
  | 'ATHAR'
  | 'HISTORICAL_SOURCE'
  | 'ACADEMIC_SOURCE'
  | 'OFFICIAL_SOURCE'
  | 'NEWS'
  | 'PRODUCT_SOURCE'
  | 'MANUFACTURER'
  | 'DOCUMENTATION'
  | 'HIKAYAT'
  | 'FOLKLORE'
  | 'ORAL_TRADITION'
  | 'MODERN_RETELLING'
  | 'GENERAL_WEB'
  | 'UNKNOWN';

export interface SourceRegistryEntry {
  sourceId: string;
  sourceType: SourceType;
  title: string;
  author?: string;
  publisher?: string;
  publicationDate?: string;
  reference?: string;
  url?: string;
  retrievedAt?: string;
  relevance?: number;
  usedFor?: string[];
  sourceNotes?: string;
  authority?: SourceAuthority;
  verification?: SourceVerification;
}

export interface ResearchQuestion {
  questionId: string;
  type: ResearchQuestionType;
  question: string;
  priority: ResearchPriority;
  required: boolean;
  relatedEntityId?: string;
}

export interface ResearchQuery {
  queryId: string;
  questionId: string;
  query: string;
  purpose: string;
  sourceTypes: SourceType[];
  priority: ResearchPriority;
  status: ResearchQueryStatus;
  sourceIds?: string[];
  evidenceIds?: string[];
  normalizedQuery?: string;
  searchExecutionId?: string;
  searchResultIds?: string[];
}

export interface SearchResult {
  searchResultId: string;
  queryId: string;
  providerId: string;
  title: string;
  url: string;
  snippet?: string;
  domain?: string;
  sourceType?: SourceType;
  publisher?: string;
  author?: string;
  publishedAt?: string;
  retrievedAt: string;
  relevance?: number;
  authority?: SourceAuthority;
  verification: SourceVerification;
  status: SearchResultStatus;
}

export interface SearchExecution {
  searchExecutionId: string;
  queryId: string;
  providerId: string;
  startedAt: string;
  completedAt?: string;
  status: SearchStatus;
  resultCount: number;
  errorCode?: string;
}

export interface SearchBudget {
  maxQueriesPerResearchRun: number;
  maxResultsPerQuery: number;
  maxSourcesPerResearchRun: number;
}

export interface SearchResultSet {
  status: SearchStatus;
  results: SearchResult[];
  execution: SearchExecution;
  error?: string;
}

export interface ResearchSearchProvider {
  providerId: string;
  providerType: SearchProviderType;
  capabilities: string[];
  search(query: ResearchQuery, strategy: ResearchStrategy, options?: { maxResults?: number }): Promise<SearchResultSet>;
}

export interface ResearchRetrievalOptions {
  timeoutMs?: number;
  maxExcerptLength?: number;
}

export interface ResearchRetrievalResult {
  status: ResearchRetrievalStatus;
  source?: SourceRegistryEntry;
  evidence?: EvidenceRecord[];
  error?: string;
}

export interface ResearchRetrievalProvider {
  providerId: string;
  providerType: ResearchRetrievalProviderType;
  capabilities: string[];
  retrieve(query: ResearchQuery, options?: ResearchRetrievalOptions): Promise<ResearchRetrievalResult>;
}

export interface EvidenceSourceLocator {
  page?: string | number;
  chapter?: string;
  section?: string;
  paragraph?: string | number;
  timestamp?: string;
  heading?: string;
  urlFragment?: string;
  documentLocation?: string;
}

export interface EvidenceRecord {
  evidenceId: string;
  sourceId: string;
  queryId?: string;
  excerpt: string;
  sourceLocator?: EvidenceSourceLocator;
  evidenceType: EvidenceType;
  extractedAt: string;
  extractionMethod: string;
  notes?: string;
}

export interface ClaimRecord {
  claimId: string;
  subject: string;
  predicate: string;
  object: string;
  normalizedStatement: string;
  claimType: ClaimKind;
  status: ClaimStatus;
  evidenceIds: string[];
  sourceIds: string[];
  confidence: FactConfidence;
  confidenceRationale: string;
  provenance: ClaimProvenance;
  qualifiers?: Record<string, string | number | boolean | undefined>;
  claimIdentity?: string;
  extractionMode?: ClaimExtractionMode;
  extractionStatus?: ClaimExtractionStatus;
  extractionMethod?: string;
  extractionVersion?: string;
  extractedAt?: string;
  queryIds?: string[];
}

export interface ConflictRecord {
  conflictId: string;
  claimIds: string[];
  evidenceIds: string[];
  conflictType: string;
  severity: GroundingSeverity;
  status: ConflictStatus;
  resolution?: string;
  resolutionRationale?: string;
}

export interface AcceptedKnowledge {
  acceptedClaims: ClaimRecord[];
  acceptedEntities: GroundingEntity[];
  acceptedEvents: GroundingEvent[];
  acceptedRelationships: GroundingRelationship[];
  timelineFacts: {
    subject: string;
    relation: TemporalRelation;
    object: string;
    claimIds: string[];
    sourceIds: string[];
  }[];
  unresolvedConflicts: ConflictRecord[];
  reconstructionBoundaries: string[];
}

export interface UnresolvedQuestion {
  questionId: string;
  reason: string;
  attemptedQueries: string[];
  status: UnresolvedQuestionStatus;
}

export interface ResearchQualityAssessment {
  sourceCount: number;
  evidenceCount: number;
  backedClaimCount: number;
  unsupportedClaimCount: number;
  conflictCount: number;
  unresolvedCount: number;
  overallStatus: ResearchQualityStatus;
}

export interface ResearchPackage {
  classification: ContentClassificationResult;
  researchRequirement: ResearchRequirement;
  researchStrategy: ResearchStrategy;
  researchQuestions: ResearchQuestion[];
  queries: ResearchQuery[];
  sources: SourceRegistryEntry[];
  evidence: EvidenceRecord[];
  claims: ClaimRecord[];
  entities: GroundingEntity[];
  events: GroundingEvent[];
  relationships: GroundingRelationship[];
  conflicts: ConflictRecord[];
  unresolvedQuestions: UnresolvedQuestion[];
  qualityAssessment: ResearchQualityAssessment;
  searchResults?: SearchResult[];
  searchExecutions?: SearchExecution[];
  searchStatus?: SearchStatus;
}

export interface FactEntry {
  factId: string;
  description: string;
  provenance: ProvenanceType;
  sourceIds: string[];
  confidence?: 'High' | 'Medium' | 'Low';
  claimId?: string;
  evidenceIds?: string[];
}

export interface GroundingEntity {
  entityId: string;
  name: string;
  type: string;
  aliases?: string[];
  description?: string;
  status?: 'ALIVE' | 'DECEASED' | 'NOT_YET_BORN' | 'UNKNOWN' | 'FICTIONAL' | 'OUT_OF_CONTEXT';
  timeline?: string[];
  sourceIds?: string[];
  constraints?: string[];
  birthYear?: number;
  deathYear?: number;
  timelineBounds?: {
    startYear?: number;
    endYear?: number;
  };
}

export type GroundingParticipationState =
  | 'KNOWN_PARTICIPANT'
  | 'POSSIBLE_PARTICIPANT'
  | 'NOT_ESTABLISHED'
  | 'OUT_OF_CONTEXT'
  | 'FORBIDDEN'
  | 'FORBIDDEN_AS_LIVING_PARTICIPANT';

export interface GroundingEvent {
  eventId: string;
  label: string;
  startYear?: number;
  endYear?: number;
  participantEntityIds?: string[];
  possibleParticipantEntityIds?: string[];
  excludedEntityIds?: string[];
  sourceIds?: string[];
  locationId?: string;
  sourceClaimIds?: string[];
  confidence?: FactConfidence;
  status?: ClaimStatus;
}

export interface GroundingEntityEvaluation {
  entityId: string;
  entityName: string;
  eventId: string;
  temporalState: 'VALID' | 'DECEASED_BEFORE_EVENT' | 'NOT_YET_BORN' | 'UNKNOWN';
  participation: GroundingParticipationState;
  valid: boolean;
  reason: string;
  sourceIds: string[];
}

export interface GroundingRelationship {
  relationshipId: string;
  fromEntity: string;
  toEntity: string;
  relation: string;
  sourceIds?: string[];
  claimIds?: string[];
}

export interface GroundingLocation {
  locationId: string;
  name: string;
  period?: string;
  region?: string;
  culture?: string;
  architecture?: string;
  environment?: string;
  sourceIds?: string[];
  constraints?: string[];
}

export interface GroundingObject {
  objectId: string;
  name: string;
  category?: string;
  material?: string;
  description?: string;
  sourceIds?: string[];
  constraints?: string[];
}

export interface GroundingTimelineEntry {
  eventId: string;
  label: string;
  dateContext?: string;
  sourceIds?: string[];
  notes?: string;
  claimIds?: string[];
  evidenceIds?: string[];
}

export interface ContextPackage {
  version: string;
  contentType: GroundingContentCategory[];
  primaryCategory?: GroundingContentCategory;
  researchRequired: boolean;
  researchSummary: string;
  sources: SourceRegistryEntry[];
  timeline: GroundingTimelineEntry[];
  events?: GroundingEvent[];
  entities: GroundingEntity[];
  relationships: GroundingRelationship[];
  locations: GroundingLocation[];
  objects: GroundingObject[];
  facts: FactEntry[];
  constraints: string[];
  unknowns: string[];
  reconstructionRules: string[];
  productContext?: string[];
  culturalContext?: string[];
  technicalContext?: string[];
  groundingStatus: GroundingStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type StageConsistencyStatus = 'PASS' | 'WARNING' | 'CONFLICT' | 'BLOCKED';

export interface StageConsistencyViolation {
  code: string;
  severity: 'BLOCKING' | 'WARNING';
  message: string;
  constraintId?: string;
  sourceIds?: string[];
}

export interface StageConsistencyReport {
  stage: string;
  status: StageConsistencyStatus;
  violations: StageConsistencyViolation[];
  warnings: string[];
  checkedConstraints: string[];
}

export interface GroundingState {
  readonly contextPackage: ContextPackage;
  readonly facts: readonly FactEntry[];
  readonly entities: readonly GroundingEntity[];
  readonly events: readonly GroundingEvent[];
  readonly relationships: readonly GroundingRelationship[];
  readonly locations: readonly GroundingLocation[];
  readonly objects: readonly GroundingObject[];
  readonly timeline: readonly GroundingTimelineEntry[];
  readonly constraints: readonly string[];
  readonly unresolvedConflicts: readonly ConflictRecord[];
  readonly reconstructionBoundaries: readonly string[];
}

export interface GroundingValidationIssue {
  code: string;
  severity: GroundingSeverity;
  message: string;
  entityName?: string;
  sourceIds?: string[];
  stage?: string;
  action?: 'BLOCKED' | 'REGENERATED' | 'FLAGGED' | 'ALLOWED';
}

export interface GroundingConstraint {
  id: string;
  scope: 'entity' | 'location' | 'object' | 'event' | 'relationship';
  target: string;
  description: string;
  severity: GroundingConstraintSeverity;
  action: 'BLOCK' | 'WARN' | 'ALLOW' | 'REGENERATE';
  sourceIds: string[];
}

export interface GroundingEnforcementPlan {
  constraints: GroundingConstraint[];
  blockedEntities: string[];
  allowedCinematicReconstruction: string[];
}

export interface GroundingValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  blockedEntities: string[];
  conflicts: string[];
  unresolvedItems: string[];
  sourceGaps: string[];
  issues?: GroundingValidationIssue[];
}

export interface StageGroundingTrace {
  stage: string;
  contextVersion: string;
  constraintIds: string[];
  generatedCandidates: string[];
  validation: GroundingValidationResult;
  action: 'CONTINUE' | 'BLOCKED' | 'REGENERATE' | 'FLAGGED';
}

export interface ContentClassificationResult {
  categories: GroundingContentCategory[];
  primaryCategory: GroundingContentCategory;
  researchRequired: boolean;
  summary: string;
}

export interface ResearchStrategy {
  required: boolean;
  freshRequired: boolean;
  researchRequirement?: ResearchRequirement;
  sourceTypes: SourceType[];
  summary: string;
  providers: string[];
}

// --- CONTINUITY ENGINE SCHEMAS ---
export type ContinuityViolationSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ContinuityLockStatus = 'locked' | 'unlocked' | 'modified';

export interface CharacterIdentityLockState {
  face: 'locked' | 'unlocked';
  body: 'locked' | 'unlocked';
  age: 'locked' | 'unlocked';
  skin_tone: 'locked' | 'unlocked';
  hair: 'locked' | 'unlocked';
}

export interface CostumeItem {
  value: string;
  status: 'required' | 'optional';
  notes?: string;
}

export interface CostumeStructure {
  head_cover?: CostumeItem; // Hijab, turban, kufi, scarf, etc.
  outer_garment?: CostumeItem; // Robe, cloak, jubah, etc.
  upper_garment?: CostumeItem; // Shirt, tunic, etc.
  lower_garment?: CostumeItem; // Pants, izar, etc.
  footwear?: CostumeItem; // Sandals, boots, etc.
  accessories?: string[];
  colors?: string[];
  materials?: string[];
  distinctive_details?: string[];
}

export interface ApprovedCostumeTransition {
  from_costume_version: number | string;
  to_costume_version: number | string;
  reason: string;
  approved?: boolean;
  approved_at?: string;
  scene_number?: number;
  transition_time?: string;
}

export interface CharacterContinuityState {
  character_id: string;
  name: string;
  identity_version: number;
  identity: CharacterIdentityLockState;
  costume: CostumeStructure;
  appearance: {
    accessories: string[];
    facial_features: string[];
    body_features: string[];
  };
  continuity_rules: {
    appearance_change_requires_approval: boolean;
    costume_change_requires_approval: boolean;
  };
  current_state: {
    scene_id?: string | null;
    costume_version: number;
    temporary_props?: string[];
    temporary_state?: string;
  };
  approved_transitions?: ApprovedCostumeTransition[];
}

export interface LocationContinuityState {
  location_id: string;
  name: string;
  architecture: string;
  terrain: string;
  layout: string;
  materials: string;
  environmental_identity: string;
  historical_period: string;
  recurring_landmarks: string[];
  lighting_conditions: string;
  prohibited_elements?: string[]; // e.g. ["no modern buildings", "no asphalt roads"]
}

export interface ObjectContinuityState {
  object_id: string;
  name: string;
  appearance: string;
  material: string;
  dimensions_scale?: string;
  color: string;
  condition: string; // e.g. 'pristine', 'battle-worn', 'dusty'
  owner?: string;
  current_location?: string;
  current_state: string; // e.g. 'active', 'stored', 'damaged', 'lost'
}

export interface ContinuitySnapshot {
  characters: CharacterContinuityState[];
  locations: LocationContinuityState[];
  objects: ObjectContinuityState[];
  environment?: string[];
  visual_style?: string[];
  previous_scene_state?: {
    scene_number: number;
    character_states: Record<string, { costume_version: number; head_cover?: string; outer_garment?: string; temporary_props?: string[] }>;
    location_name: string;
  };
}

export type ContinuityTransitionType = 'CONTINUOUS' | 'TIME_JUMP' | 'LOCATION_CHANGE' | 'EVENT_CHANGE' | 'MONTAGE' | 'UNKNOWN';
export type ContinuityIssueSeverity = 'BLOCKING' | 'WARNING';

export interface ContinuityIssue {
  code: string;
  severity: ContinuityIssueSeverity;
  message: string;
  sceneId?: string;
  sourceIds?: string[];
}

export interface CharacterState {
  canonicalIdentity: string;
  displayName: string;
  aliases: string[];
  status?: GroundingEntity['status'];
  birthYear?: number;
  deathYear?: number;
  age?: string;
  attributes: string[];
  clothing: string[];
  accessories: string[];
  currentLocation?: string;
  activeEvent?: string;
  relationships: string[];
  possessions: string[];
  provenance: string[];
  confidence?: FactConfidence;
}

export interface SceneContinuityState {
  sceneId: string;
  previousSceneId?: string;
  nextSceneId?: string;
  activeCharacters: string[];
  location?: string;
  event?: string;
  objects: string[];
  temporalState?: string;
  visualState: Record<string, string[]>;
  transitionType: ContinuityTransitionType;
  continuityConstraints: string[];
}

export interface ContinuityState {
  version: string;
  characters: CharacterState[];
  characterIdentities: Record<string, string>;
  locations: Record<string, { canonicalLocation: string; aliases: string[]; currentScene?: string; temporalValidity?: string; provenance: string[]; confidence?: FactConfidence }>;
  activeEvents: string[];
  relationships: string[];
  objects: Record<string, { canonicalObject: string; owner?: string; location?: string; appearance: string[]; provenance: string[] }>;
  temporalPosition?: string;
  temporalOrder?: Record<string, number>;
  scenes: SceneContinuityState[];
  visualState: Record<string, string[]>;
  continuityConstraints: string[];
  unresolvedIssues: ContinuityIssue[];
}

export interface ContinuityViolation {
  type:
    | 'costume_change'
    | 'identity_change'
    | 'location_drift'
    | 'object_mismatch'
    | 'period_violation'
    | 'head_cover_missing';
  field: string;
  expected: string;
  actual: string;
  severity: ContinuityViolationSeverity;
  character_name?: string;
  location_name?: string;
  object_name?: string;
  scene_number?: number;
  shot_number?: number;
  message: string;
}

export interface ContinuityValidationResult {
  valid: boolean;
  status: 'passed' | 'continuity_failed' | 'warning';
  violations: ContinuityViolation[];
  auto_corrected?: boolean;
  correction_notes?: string[];
}

// --- CINEMATIC STORY ARCHITECTURE SCHEMAS ---
export type NarrativeMode =
  | 'NARRATOR'
  | 'DIALOGUE'
  | 'ACTION'
  | 'VISUAL_ONLY'
  | 'REACTION'
  | 'MIXED';

export interface ColdOpen {
  id?: string;
  title: string;
  visual_hook: string;
  dramatic_question: string;
  dialogue_minimal: string;
  cut_to_black_transition: string;
  forward_scene_reference?: string;
  duration_sec?: number;
}

export interface Act {
  act_id: string;
  act_number: number;
  title: string;
  purpose: string;
  dramatic_goal: string;
  emotional_arc: string;
  sequence_ids: string[];
}

export interface StorySequence {
  sequence_id: string;
  act_id: string;
  sequence_number: number;
  title: string;
  purpose: string;
  dramatic_goal: string;
  scene_ids: string[];
}

export interface Beat {
  id?: string;
  beat_id?: string;
  scene_id?: string;
  beat_number: number;
  description?: string;
  purpose?: string;
  action?: string;
  character?: string;
  dialogue?: string;
  narration?: string;
  emotional_state?: string;
  visual_objective?: string;
  audio?: string;
  narrative_mode: NarrativeMode;
  camera_recommendation?: string;
}

export type ColdOpenArchitecture = ColdOpen;

export interface StoryArchitecture {
  id?: string;
  project_id: string;
  title: string;
  premise: string;
  historical_period: string;
  narrative_objective: string;
  audience: string;
  total_target_duration: number;
  global_narrative_voice: string;
  visual_language: string;
  cold_open?: ColdOpen | null;
  acts: Act[];
  sequences: StorySequence[];
  ending_epilogue?: string;
  created_at?: string;
  updated_at: string;
}

export interface HistoricalFinding {
  id?: string;
  source_type: HistoricalSourceType;
  source_title: string;
  reference: string;
  evidence: string;
  confidence: 'High' | 'Medium' | 'Low';
  description?: string;
}

export type ReasoningProviderType = 'google' | 'openrouter' | 'openai' | 'xai' | 'custom_openai';

export type ModelPreferenceMode = 'fixed' | 'adaptive' | 'custom';
export type FallbackPolicy = 'strict' | 'smart' | 'off';
export type TaskTier = 'deep_reasoning' | 'general_reasoning' | 'fast_structured' | 'lightweight';

export interface ModelReference {
  provider: ReasoningProviderType | string;
  model_id: string;
  priority?: number;
  display_name?: string;
  pricing_class?: 'unknown' | 'free' | 'paid' | 'mixed';
}

export interface ReasoningModelPreferences {
  mode: ModelPreferenceMode;
  primary_model: ModelReference;
  fallback_policy: FallbackPolicy;
  fallback_pool: ModelReference[];
  force_model?: boolean;
  stage_routing?: Record<string, string>;
}

export interface FallbackLogEntry {
  requested_provider: string;
  requested_model: string;
  actual_provider: string;
  actual_model: string;
  fallback: boolean;
  fallback_reason?: string;
  stage?: string;
  entity_id?: string;
  attempt: number;
  timestamp: string;
  user_preference_mode: ModelPreferenceMode;
}

export interface ReasoningConfig {
  provider_type: ReasoningProviderType;
  provider_name: string;
  base_url?: string;
  model_id: string;
  display_name?: string;
  api_key?: string;
}

export interface GeminiModelOption {
  id: string;
  name: string;
  badge?: string;
  description: string;
  isRecommended?: boolean;
  tier?: 'flash' | 'pro' | 'lite';
}

export type PacingType = 'slow' | 'medium' | 'fast';

export type AtmosphereType =
  | 'peaceful'
  | 'solemn'
  | 'contemplative'
  | 'mysterious'
  | 'hopeful'
  | 'tense'
  | 'dramatic'
  | 'action'
  | 'tragic'
  | 'triumphant'
  | 'urgent';

export type TonePresetName =
  | 'SOLEMN'
  | 'CONTEMPLATIVE'
  | 'MYSTERIOUS'
  | 'TENSE'
  | 'ACTION'
  | 'TRAGIC'
  | 'TRIUMPHANT'
  | 'CUSTOM';

export interface GlobalConstraints {
  religious_adab: 'strict';
  historical_fidelity: 'strict';
  dignity: 'strict';
  clarity: 'high';
  cinematic_quality: 'high';
}

export interface DefaultSceneTone {
  intensity: number; // 0-100 (default 50)
  emotional_weight: number; // 0-100 (default 50)
  pacing: PacingType; // default 'medium'
  atmosphere: AtmosphereType; // default 'dramatic'
  dramatic_tension?: number; // 0-100 (default 50)
}

export interface NarrativeStyleConfig {
  language: string; // e.g. 'id-ID'
  narrative_mode: 'cinematic_sirah';
  global_constraints: GlobalConstraints;
  default_scene_tone: DefaultSceneTone;
}

export interface SceneTone {
  intensity: number; // 0-100
  emotional_weight: number; // 0-100
  pacing: PacingType;
  atmosphere: AtmosphereType;
  dramatic_tension: number; // 0-100
  preset?: TonePresetName;
  is_ai_recommended?: boolean;
}

export interface Project {
  id: string;
  title: string;
  raw_script: string;
  total_duration_target_sec: number;
  max_scene_shot_duration_sec: number | null; // Deprecated alias for scene_duration_sec
  scene_duration_sec?: number | null; // null = AUTO, 5-30 = FIXED scene duration
  duration_mode?: 'fixed' | 'auto'; // 'fixed' = strictly fixed duration per scene, 'auto' = dynamic weighted split
  fixed_scene_duration?: number | null; // e.g. 5, 10, 15, 20, 30
  // Patch v1.2: Duration Architecture separation
  projectDuration?: number;
  timelineSceneDuration?: number;
  durationMode?: 'match_scene' | 'extended';
  modelOutputDuration?: number;
  selectedExtendedDuration?: number;
  primaryVideoModel?: 'veo' | 'gemini_omni' | 'seedance';
  foundation_status?: 'not_initialized' | 'initializing' | 'ready' | 'incomplete' | 'failed';
  allow_final_scene_override?: boolean;
  prompt_language: PromptLanguage;
  narrative_style_config?: NarrativeStyleConfig;
  ai_model?: string; // e.g. 'gemini-3.7-flash', 'gemini-3.6-flash', etc.
  reasoning_config?: ReasoningConfig;
  reasoning_model_preferences?: ReasoningModelPreferences;
  image_model: 'nano_banana_pro';
  video_model: ('veo' | 'gemini_omni')[];
  include_seedance_format: boolean;
  created_at: string;
  updated_at: string;
  status: 'draft' | 'processing' | 'completed' | 'failed';
  current_stage?: number;
  error_message?: string | null;
  duration_validation_passed?: boolean;
  retry_count?: number;
  groundingVersion?: string;
  contextPackage?: ContextPackage | null;
  sourceRegistry?: SourceRegistryEntry[];
  validationResult?: GroundingValidationResult | null;
  groundingStatus?: GroundingStatus;
  researchPackage?: ResearchPackage | null;
  consistencyReports?: StageConsistencyReport[];
  continuityState?: ContinuityState | null;
  assetIntegrityReports?: SceneAssetCoverageReport[];
  finalizationReport?: FinalizationGateReport | null;
}

export interface FinalizationGateReport {
  valid: boolean;
  status: 'PASS' | 'BLOCKED' | 'WARNING';
  blockers: string[];
  warnings: string[];
  checkedLayers: string[];
}

export type AssetCoverageStatus = 'PASS' | 'MISSING' | 'MISMATCH' | 'UNKNOWN' | 'BLOCKED' | 'WARNING' | 'RECONSTRUCTION';
export type SceneAssetRequirementLevel = 'REQUIRED' | 'OPTIONAL' | 'NONE' | 'UNKNOWN';
export type SceneAssetType = 'CHARACTER' | 'LOCATION' | 'OBJECT';

export interface SceneAssetRequirement {
  name: string;
  canonicalId?: string;
  assetType: SceneAssetType;
  level: SceneAssetRequirementLevel;
}

export interface AssetReference {
  canonicalAssetId: string;
  assetType: SceneAssetType;
  name: string;
  source: 'CHARACTER_BIBLE' | 'LOCATION_BIBLE' | 'OBJECT_BIBLE' | 'CONTINUITY' | 'RECONSTRUCTION';
  sceneId?: string;
}

export interface AssetCoverageRecord {
  requirement: SceneAssetRequirement;
  asset?: AssetReference;
  status: AssetCoverageStatus;
  message: string;
  reason?: 'MISSING_REQUIRED_ASSET' | 'UNDECLARED_ASSET' | 'CANONICAL_MISMATCH' | 'PROMPT_OMISSION';
  assetName?: string;
  assetType?: SceneAssetType;
  sceneId?: string;
}

export interface SceneAssetCoverageReport {
  sceneId?: string;
  sceneNumber: number;
  status: AssetCoverageStatus;
  characters: AssetCoverageRecord[];
  locations: AssetCoverageRecord[];
  objects: AssetCoverageRecord[];
  promptCoverage?: AssetCoverageRecord[];
  masterFrameCoverage?: AssetCoverageRecord[];
  videoPromptCoverage?: AssetCoverageRecord[];
  phantomAssets?: string[];
}

export interface ProjectFoundation {
  id?: string;
  project_id: string;
  era: string;
  theme: string;
  genre: string;
  timeline: string;
  main_characters: string[];
  supporting_characters: string[];
  locations: string[];
  main_conflict: string;
  emotional_arc: string;
  narrative_arc: string;
  visual_tone: string;
  narrative_beats?: NarrativeBeats;
  updated_at: string;
}

export interface CharacterBible {
  id?: string;
  project_id: string;
  name: string;
  age: string;
  gender: string;
  physical_appearance: string;
  physical_description?: string;
  role?: string;
  face_identity_locked: boolean;
  identity_version?: number;
  hair: string;
  beard: string;
  clothing: string[];
  costume?: string;
  wardrobe?: string;
  accessories: string[];
  personality: string;
  voice_character: string;
  movement_style: string;
  master_portrait_prompt?: string;
  version: number;
  created_at?: string;
  updated_at: string;
}

export interface LocationBible {
  id?: string;
  project_id: string;
  name: string;
  era: string;
  architecture: string;
  architectural_style?: string;
  environment: string;
  landscape: string;
  climate: string;
  culture: string;
  lighting_style: string;
  lighting_atmosphere?: string;
  description?: string;
  color_palette: string[];
  material: string;
  master_environment_prompt?: string;
  version: number;
  created_at?: string;
  updated_at: string;
}

export interface ObjectBible {
  id?: string;
  project_id: string;
  name: string;
  category: string;
  description: string;
  continuity_notes: string;
  material?: string;
  owner?: string;
  version: number;
  created_at?: string;
  updated_at: string;
}

export interface NarrativeBeats {
  beginning: string;
  development: string;
  climax: string;
  consequence: string;
  ending: string;
}

export interface MasterImagePrompt {
  subject: string;
  characters_note: string;
  costume: string;
  location: string;
  era: string;
  architecture: string;
  environment: string;
  lighting: string;
  composition: string;
  camera: string;
  lens: string;
  mood: string;
  cinematic_style: string;
  negative_prompt: string;
}

export interface Scene {
  id?: string;
  project_id: string;
  scene_number: number;
  title: string;
  duration_sec: number;
  story_purpose: string;
  location_name: string;
  time_of_day: string;
  character_names: string[];
  emotional_objective: string;
  event: string;
  narrative_function: string;
  sequence_id?: string;
  act_id?: string;
  conflict?: string;
  beginning_state?: string;
  ending_state?: string;
  beats?: Beat[];
  narrative_modes?: NarrativeMode[];
  scene_tone?: SceneTone;
  era?: string;
  tone?: string;
  lighting?: string;
  characters_present?: string[];
  dramatic_purpose?: string;
  action_summary?: string;
  master_frame_image_url?: string | null;
  master_image_prompt?: string;
  master_image_prompt_json?: MasterImagePrompt | null;
  image_gen_status?: 'pending' | 'success' | 'failed' | 'processing';
  image_gen_error?: string | null;
  full_scene_prompt?: string;
  full_scene_prompt_status?: 'ready' | 'generating' | 'failed';
  continuity_snapshot?: ContinuitySnapshot;
  continuity_status?: 'passed' | 'continuity_failed' | 'warning' | 'pending';
  continuity_violations?: ContinuityViolation[];
  status?:
    | 'pending'
    | 'processing'
    | 'ready'
    | 'incomplete'
    | 'completed'
    | 'shot_breakdown_failed'
    | 'continuity_failed'
    | 'failed';
  version: number;
  created_at?: string;
  updated_at: string;
}

export interface ShotDialogue {
  character_name: string;
  line: string;
}

export interface Shot {
  id?: string;
  scene_id: string;
  project_id: string;
  shot_number: number;
  start_time_sec: number;
  end_time_sec: number;
  duration_sec: number;
  event_detail: string; // Detail Kejadian (single source of truth for Stage 7 & 8)
  character_action: string;
  camera_note: string;
  dialogue: ShotDialogue[];
  emotion: string;
  audio_note: string;
  beat_id?: string;
  beat_number?: number;
  narrative_mode?: NarrativeMode;
  cinematic_grammar?: any;
  shot_image_url?: string | null;
  image_url?: string | null;
  visual_description?: string;
  action?: string;
  camera_movement?: string;
  shot_type?: string;
  audio_narration?: string;
  sound_effects?: string;
  master_image_prompt?: string;
  video_prompt?: string;
  seedance_prompt?: string;
  version: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Canonical prompt target union (PATCH 5.5-R1).
 *
 * Every production prompt is generated for exactly ONE explicit target. The
 * target — never the shot length — determines which adapter runs and which
 * duration contract applies:
 *   - banana_master_frame : still master frame (image, no video timeline)
 *   - banana_image        : still shot image
 *   - veo                 : 10s video
 *   - omni                : 10s video
 *   - seedance_10         : 10s video
 *   - seedance_30         : 30s video (extended mode)
 */
export type PromptTarget =
  | 'banana_master_frame'
  | 'banana_image'
  | 'veo'
  | 'omni'
  | 'seedance_10'
  | 'seedance_30';

export interface VideoPromptTimeline {
  // For Veo & Gemini Omni
  prompt?: string;
  camera?: string; // sub-timestamps "00-04s: ...\n04-07s: ..."
  dialog?: string;
  sfx_ambient?: string;
  clip_duration_sec?: number;
  negative_prompt?: string;
  reference_image?: string;
  follow_up_edit_instructions?: string; // for gemini_omni

  // For Seedance
  global_style?: string;
  characters?: string;
  references?: string; // @Image/@Video/@Audio
  shot_breakdown?: string;
  audio?: string;
  do_not_change?: string;

  // PATCH 5.5-R1: authoritative duration the prompt text was generated for.
  // Comes from the target's model capability via the strict duration resolver,
  // never from the raw shot length.
  resolved_duration_sec?: number;
}

export interface VideoPrompt {
  id?: string;
  shot_id: string;
  scene_id: string;
  project_id: string;
  target_platform: 'veo' | 'gemini_omni' | 'seedance';
  /**
   * PATCH 5.5-R1: explicit prompt target this row was generated for.
   * Optional for backward compatibility with rows persisted before 5.5;
   * all newly generated prompts MUST set it.
   */
  prompt_target?: PromptTarget;
  generation_type: 'direct' | 'prompt_target';
  status?: 'ready' | 'video_prompt_failed' | 'processing';
  error?: string | null;
  timeline_json: VideoPromptTimeline;
  negative_prompt: string;
  version: number;
  created_at?: string;
  updated_at?: string;
}

export interface CombinedScenePrompt {
  status: 'complete' | 'incomplete';
  readyShots: number;
  totalShots: number;
  platform: string;
  text?: string;
  full_scene_prompt?: string;
  full_scene_prompt_status?: EntityState;
  message?: string;
  header?: string;
  shots_text?: {
    shot_number: number;
    time_range: string;
    event_summary: string;
    body: string;
  }[];
}

export type StageCode = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8';
export type StageScope = 'project' | 'scene' | 'shot';
export type ErrorClassification = 'schema_validation' | 'duration_mismatch' | 'auth_error' | 'quota_exceeded' | 'rate_limit' | 'network' | 'unknown';

export interface StageExecutionTelemetry {
  id?: string;
  project_id: string;
  scene_id?: string;
  shot_id?: string;
  stage: number;
  stage_code: StageCode;
  scope: StageScope;
  attempt: number;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  status: 'started' | 'completed' | 'failed' | 'retrying';
  error_type?: ErrorClassification;
  error_message?: string;
}

export interface PipelineLogEvent {
  timestamp: string;
  stage: number;
  stage_name: string;
  stage_code?: StageCode;
  scope?: StageScope;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  duration_ms?: number;
  error_type?: ErrorClassification;
}

export interface ProjectFullData {
  project: Project;
  foundation: ProjectFoundation | null;
  story_architecture?: StoryArchitecture | null;
  characters: CharacterBible[];
  continuity_states?: CharacterContinuityState[];
  locations: LocationBible[];
  objects: ObjectBible[];
  scenes: Scene[];
  shots?: Record<string, Shot[]>; // keyed by scene_id
  video_prompts?: Record<string, VideoPrompt[]>; // keyed by shot_id
}

export type StudioWorkspaceTab =
  | 'overview'
  | 'story'
  | 'characters'
  | 'locations'
  | 'objects'
  | 'bibles'
  | 'scenes'
  | 'shots'
  | 'prompts'
  | 'continuity'
  | 'pipeline'
  | 'queue'
  | 'export'
  | 'settings';

