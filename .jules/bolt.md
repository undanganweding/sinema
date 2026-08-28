## 2025-05-20 - File-backed store caching using mtime validation
**Learning:** `server/db.ts` re-read and parsed `firestore_store.json` on every read helper function. Composite queries like `getFullProjectData` invoked 10-15 DB reads, resulting in repeated synchronous file reads and JSON parsing. Caching in-memory state based on `statSync(DB_FILE).mtimeMs` reduces execution time from ~158ms to ~0.49ms (over 300x faster).
**Action:** Always check for repeated file I/O or JSON deserialization loops in local file-backed persistence layers and validate cache freshness with `mtimeMs`.
