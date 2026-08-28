import { evaluateFinalizationGate } from './finalization_gate';
import { executeResearchPackage, ResearchEngine } from './research_engine';
import { ContextPackage, Project, ResearchPackage } from '../src/types';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`ASSERTION FAILED: ${message}`); }

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'phase8', title: 'Canary', raw_script: 'A historical story', total_duration_target_sec: 10,
    max_scene_shot_duration_sec: 10, prompt_language: 'en', image_model: 'nano_banana_pro', video_model: ['veo'], include_seedance_format: false,
    created_at: '', updated_at: '', status: 'processing', researchPackage: null, contextPackage: null, ...overrides,
  };
}

const context: ContextPackage = {
  version: '1.0', contentType: ['HISTORICAL'], primaryCategory: 'HISTORICAL', researchRequired: false, researchSummary: 'canary', sources: [], timeline: [],
  events: [{ eventId: 'event', label: 'Event B', startYear: 1945 }], entities: [{ entityId: 'a', name: 'A', type: 'person', status: 'DECEASED', deathYear: 1943, sourceIds: ['source'] }], relationships: [{ relationshipId: 'rel', fromEntity: 'A', toEntity: 'B', relation: 'parent', sourceIds: ['source'] }], locations: [], objects: [], facts: [{ factId: 'fact', description: 'A died in 1943', provenance: 'SOURCE_FACT', sourceIds: ['source'], claimId: 'claim', evidenceIds: ['evidence'] }], constraints: ['Preserve chronology'], unknowns: [], reconstructionRules: ['visualized interior is reconstruction'], groundingStatus: 'complete',
};

class CountingEngine extends ResearchEngine {
  discovers = 0;
  retrieves = 0;
  async discover(...args: Parameters<ResearchEngine['discover']>) { this.discovers++; return super.discover(...args); }
  async retrieve(...args: Parameters<ResearchEngine['retrieve']>) { this.retrieves++; return super.retrieve(...args); }
}

async function main(): Promise<void> {
  const happy = evaluateFinalizationGate(project({ contextPackage: context, continuityState: { version: '1.0', characters: [], characterIdentities: {}, locations: {}, activeEvents: [], relationships: [], objects: {}, scenes: [], visualState: {}, continuityConstraints: [], unresolvedIssues: [] } }), [{ sceneId: 's1', status: 'ready' }]);
  assert(happy.valid && happy.status === 'PASS', 'full pipeline happy path passes final gate');

  const blocked = evaluateFinalizationGate(project({ contextPackage: context, consistencyReports: [{ stage: 'S8', status: 'BLOCKED', violations: [], warnings: [], checkedConstraints: [] }] }), [{ sceneId: 's1', status: 'ready' }]);
  assert(!blocked.valid && blocked.status === 'BLOCKED', 'consistency blocker prevents finalization');
  assert(evaluateFinalizationGate(project({ contextPackage: context }), [{ sceneId: 's1', status: 'continuity_failed' }]).status === 'BLOCKED', 'continuity mismatch blocks finalization');
  assert(evaluateFinalizationGate(project({ contextPackage: context, assetIntegrityReports: [{ sceneNumber: 1, status: 'BLOCKED', characters: [], locations: [], objects: [] }] })).status === 'BLOCKED', 'missing asset blocks finalization');
  assert(evaluateFinalizationGate(project({ contextPackage: context, researchPackage: { claims: [{ status: 'UNSUPPORTED', provenance: 'UNKNOWN' }] } as any })).status === 'BLOCKED', 'unsupported claim blocks finalization');
  assert(evaluateFinalizationGate(project({ contextPackage: context, researchPackage: { researchRequirement: 'RESEARCH_REQUIRED', queries: [{ status: 'PLANNED' }] } } as any)).status === 'BLOCKED', 'required planned research blocks finalization');
  assert(evaluateFinalizationGate(project({ contextPackage: context, researchPackage: { conflicts: [{ status: 'UNRESOLVED' }] } } as any)).status === 'WARNING', 'unresolved conflict is preserved as warning');
  assert(evaluateFinalizationGate(project({ contextPackage: null })).status === 'WARNING', 'legacy project remains allowed with warning');
  assert(evaluateFinalizationGate(project({ contextPackage: { ...context, groundingStatus: 'research_unavailable' } })).status === 'BLOCKED', 'research unavailable is not success');

  const packageData = { researchRequirement: 'RESEARCH_OPTIONAL', queries: [], sources: [], evidence: [], claims: [], searchResults: [], researchQuestions: [], researchStrategy: {}, classification: {}, entities: [], events: [], relationships: [], conflicts: [], unresolvedQuestions: [], qualityAssessment: {} } as unknown as ResearchPackage;
  const engine = new CountingEngine();
  const first = await executeResearchPackage(packageData, engine);
  const second = await executeResearchPackage({ ...first, queries: [] }, engine);
  assert(engine.discovers === 0 && engine.retrieves === 0 && second.evidence.length === first.evidence.length, 'optional research does not duplicate execution');

  const persisted = project({ researchPackage: packageData, contextPackage: context, consistencyReports: [], assetIntegrityReports: [], continuityState: { version: '1.0', characters: [], characterIdentities: {}, locations: {}, activeEvents: [], relationships: [], objects: {}, scenes: [], visualState: {}, continuityConstraints: [], unresolvedIssues: [] } });
  const reloaded = JSON.parse(JSON.stringify(persisted)) as Project;
  assert(reloaded.contextPackage?.facts[0].evidenceIds?.[0] === 'evidence' && reloaded.contextPackage?.facts[0].sourceIds[0] === 'source', 'provenance survives persistence reload');
  assert(reloaded.continuityState && reloaded.assetIntegrityReports && reloaded.researchPackage, 'all phase state fields survive reload');
  assert(context.reconstructionRules[0].includes('reconstruction'), 'reconstruction boundary remains marked');
  console.log('PATCH 6.0 PHASE 8 hardening assertions: PASS');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
