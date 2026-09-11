## 2025-05-18 - Single-pass Map Grouping in Composite Project Queries
**Learning:** `getFullProjectData` in `server/db.ts` fetched scenes, shots, and video prompts, but grouped shots by scene and video prompts by shot using nested `.filter()` calls inside loops over scenes/shots, resulting in O(N*M + M*P) quadratic complexity.
**Action:** Replace nested array `.filter()` calls in composite database fetching functions with single-pass hash map accumulation to achieve linear O(N + M + P) time complexity.
