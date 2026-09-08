## 2026-09-08 - Concurrent DB queries and linear array indexing in composite endpoints

**Learning:** `getFullProjectData` was fetching 9 independent entity collections sequentially (`await` in sequence), leading to 9 sequential network roundtrips. Additionally, grouping child entities (shots by scene_id, prompts by shot_id) used nested `.filter()` calls inside loops, resulting in O(M*N + N*P) time complexity.
**Action:** Always wrap independent async DB fetches in `Promise.all()` to run queries concurrently. When mapping relational arrays in JS, pre-index child entities into hash maps in a single pass O(N) rather than filtering in a loop.
