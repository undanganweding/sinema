import { FinalizationBlocker, FinalizationGateReport, Project } from '../src/types';

export function evaluateFinalizationGate(project: Project, sceneStatuses: Array<{ sceneId?: string; status?: string }> = []): FinalizationGateReport {
  const blockers: string[] = [];
  const blockerDetails: FinalizationBlocker[] = [];
  const warnings: string[] = [];
  const checkedLayers = ['research', 'grounding', 'stage_outputs', 'consistency', 'continuity', 'asset_integrity'];
  const research = project.researchPackage;
  const addBlocker = (code: string, layer: string, message: string, sceneId?: string) => {
    blockers.push(message);
    blockerDetails.push({ code, layer, message, sceneId });
  };

  if (research) {
    if (research.searchStatus === 'SEARCH_FAILED' || research.searchStatus === 'SEARCH_BLOCKED') addBlocker('RESEARCH_SEARCH_FAILED', 'research', `Research search status: ${research.searchStatus}.`);
    if (research.researchRequirement === 'RESEARCH_REQUIRED' && (research.queries || []).some((query) => query.status === 'PLANNED')) addBlocker('RESEARCH_INCOMPLETE', 'research', 'Required research has planned queries remaining.');
    if ((research.claims || []).some((claim) => claim.status === 'UNSUPPORTED' || claim.provenance === 'UNKNOWN')) addBlocker('RESEARCH_UNSUPPORTED_CLAIM', 'research', 'Unsupported or unknown claims remain in research package.');
    if ((research.conflicts || []).some((conflict) => conflict.status === 'UNRESOLVED')) warnings.push('Unresolved research conflict preserved.');
  }

  if (project.contextPackage?.groundingStatus === 'research_unavailable') addBlocker('GROUNDING_UNAVAILABLE', 'grounding', 'Grounding context is unavailable.');
  if (project.consistencyReports?.some((report) => report.status === 'BLOCKED')) addBlocker('CONSISTENCY_BLOCKED', 'consistency', 'Consistency report contains a blocking violation.');
  if (project.continuityState?.unresolvedIssues.some((issue) => issue.severity === 'BLOCKING')) addBlocker('CONTINUITY_BLOCKED', 'continuity', 'Continuity state contains a blocking issue.');
  if (project.assetIntegrityReports?.some((report) => report.status === 'BLOCKED' || report.videoPromptCoverage?.some((record) => record.status === 'BLOCKED'))) addBlocker('ASSET_INTEGRITY_BLOCKED', 'asset_integrity', 'Asset integrity report contains a blocking coverage failure.');
  for (const scene of sceneStatuses) {
    if (scene.status === 'continuity_failed' || scene.status === 'incomplete' || scene.status === 'blocked' || scene.status === 'shot_breakdown_failed' || scene.status === 'failed') addBlocker('SCENE_NOT_READY', 'stage_outputs', 'One or more scenes are not production-ready.', scene.sceneId);
  }

  if (!project.contextPackage) warnings.push('No ContextPackage: legacy compatibility mode.');
  if (project.researchPackage?.searchStatus === 'SEARCH_BUDGET_EXHAUSTED') warnings.push('Research query budget was exhausted; retained results are partial.');

  return {
    valid: blockers.length === 0,
    status: blockers.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'WARNING' : 'PASS',
    blockers: Array.from(new Set(blockers)),
    blockerDetails: blockerDetails.filter((blocker, index, all) => all.findIndex((item) => item.code === blocker.code && item.sceneId === blocker.sceneId) === index),
    warnings: Array.from(new Set(warnings)),
    checkedLayers,
  };
}

export function assertFinalizationGate(report: FinalizationGateReport): void {
  if (!report.valid) throw new Error(`FINALIZATION_BLOCKED ${JSON.stringify(report)}`);
}
