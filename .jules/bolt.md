## 2026-09-10 - Pre-compiled Extraction Regexes & Map Lookups in Research Pipeline
**Learning:** `candidatesFromExcerpt` and `extractEvidenceClaims` in `server/claim_extraction_engine.ts` were repeatedly instantiating 9 `RegExp` objects per excerpt and scanning the `sources` array ($O(E \times S)$) per evidence item.
**Action:** Pre-compile static regex patterns at module scope (safe when `/g` flag is omitted) and build an $O(1)$ source `Map` prior to iterating evidence items.
