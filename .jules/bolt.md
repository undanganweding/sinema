# Bolt's Journal - Critical Performance Learnings

## 2026-09-13 - Parallelizing Sub-queries in `getFullProjectData`
**Learning:** Sequential `await` calls in composite retrieval methods (like fetching foundation, characters, locations, objects, scenes, shots, prompts) create massive latency bottlenecks due to sequential network/IO calls. Combining independent sub-queries with `Promise.all` and converting $O(N \cdot M)$ nested array `.filter()` loops into single-pass $O(N)$ bucket aggregations eliminates this bottleneck without changing external return behavior or error handling contracts.
**Action:** Always inspect composite database data aggregation functions for sequential sub-queries and nested array filtering, and convert them to parallel execution and single-pass hash map bucketing.
