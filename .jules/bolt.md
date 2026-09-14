## 2026-09-14 - Concurrent Database Fetching in `getFullProjectData`
**Learning:** `getFullProjectData` previously executed 9 DB read calls sequentially (awaiting each sub-query one after another). By replacing sequential awaits with `Promise.all`, all entity queries run concurrently, significantly reducing total latency for fetching complete project data.
**Action:** When fetching multiple independent entities or collections from Firestore or local storage, execute sub-queries concurrently using `Promise.all`.
