## 2025-05-20 - Memoizing Aggregate Calcs Across Frequent SSE Progress Updates
**Learning:** Top-level components like `App.tsx` and workspace views receive frequent state updates from SSE streams during orchestrator run execution. Unmemoized array reductions (such as counting total shots across scenes or filtering error logs) execute on every tick, causing unnecessary JS main-thread churn during high-frequency pipeline progress events.
**Action:** Always wrap aggregate metrics and array filtering/slicing in `useMemo` when rendering components exposed to streaming or frequent status events.
