# Bolt Performance Journal

## 2026-08-29 - Optimize ContinuityState Deep Cloning in `updateContinuityState`
**Learning:** `JSON.parse(JSON.stringify(state))` was used for deep cloning `ContinuityState` during scene continuity updates. Native V8 `structuredClone()` is actually slower than `JSON.parse(JSON.stringify())` for small-to-medium JavaScript plain object trees in Node.js, while a targeted structural shallow-copying function (`cloneContinuityState`) is ~10x faster (~340ms vs ~3.4s over 50k iterations).
**Action:** When deep cloning domain state objects in hot execution loops, prefer specialized structural spread cloning over `JSON.parse(JSON.stringify())` or `structuredClone()`.
