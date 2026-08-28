import { FinalizationGateReport, Project } from '../src/types';

export function evaluateFinalizationGate(project: Project, sceneStatuses: Array<{ sceneId?: string; status?: string }> = []): FinalizationGateReport {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const checkedLayers = ['research', 'grounding', 'stage_outputs', 'consistency', 'continuity', 'asset_integrity'];
  const research = project.researchPackage;

  if (research) {
    if (research.searchStatus === 'SEARCH_FAILED' || research.searchStatus === 'SEARCH_BLOCKED') blockers.push(`Research search status: ${research.searchStatus}.`);
    if (research.researchRequirement === 'RESEARCH_REQUIRED' && (research.queries || []).some((query) => query.status === 'PLANNED')) blockers.push('Required research has planned queries remaining.');
    if ((research.claims || []).some((claim) => claim.status === 'UNSUPPORTED' || claim.provenance === 'UNKNOWN')) blockers.push('Unsupported or unknown claims remain in research package.');
    if ((research.conflicts || []).some((conflict) => conflict.status === 'UNRESOLVED')) warnings.push('Unresolved research conflict preserved.');
  }

  if (project.contextPackage?.groundingStatus === 'research_unavailable') blockers.push('Grounding context is unavailable.');
  if (project.consistencyReports?.some((report) => report.status === 'BLOCKED')) blockers.push('Consistency report contains a blocking violation.');
  if (project.continuityState?.unresolvedIssues.some((issue) => issue.severity === 'BLOCKING')) blockers.push('Continuity state contains a blocking issue.');
  if (project.assetIntegrityReports?.some((report) => report.status === 'BLOCKED' || report.videoPromptCoverage?.some((record) => record.status === 'BLOCKED'))) blockers.push('Asset integrity report contains a blocking coverage failure.');
  if (sceneStatuses.some((scene) => scene.status === 'continuity_failed' || scene.status === 'incomplete')) blockers.push('One or more scenes are not production-ready.');

  if (!project.contextPackage) warnings.push('No ContextPackage: legacy compatibility mode.');
  if (project.researchPackage?.searchStatus === 'SEARCH_BUDGET_EXHAUSTED') warnings.push('Research query budget was exhausted; retained results are partial.');

  return {
    valid: blockers.length === 0,
    status: blockers.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'WARNING' : 'PASS',
    blockers: Array.from(new Set(blockers)),
    warnings: Array.from(new Set(warnings)),
    checkedLayers,
  };
}

export function assertFinalizationGate(report: FinalizationGateReport): void {
  if (!report.valid) throw new Error(`FINALIZATION_BLOCKED ${JSON.stringify(report)}`);
}
