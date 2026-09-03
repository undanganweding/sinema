## 2026-09-03 - Parallelize Independent Firestore Entity Reads
**Learning:** `getFullProjectData` and prompt regeneration endpoints in this codebase query 5 to 9 independent entities (`project_foundation`, `characters`, `locations`, `objects`, `scenes`, `shots`, `video_prompts`, `story_architectures`, `continuity_states`). Awaiting each query sequentially created up to 9 network roundtrips per call.
**Action:** Always batch independent Firestore queries using `Promise.all` across DB adapter methods and API handlers to achieve single-roundtrip latency.
