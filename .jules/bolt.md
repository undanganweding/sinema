# Bolt's Journal - Critical Performance Learnings

## 2026-09-06 - Subject-Grouped Conflict Detection & Map Lookups in Research Packages
**Learning:** In claim resolution (`claim_resolution_engine.ts`), detecting conflicts across claims defaults to $O(N^2)$ pairs. However, claims with different subjects can never conflict according to `claimConflictType`. Grouping claims by subject reduces comparison operations drastically from $\frac{N(N-1)}{2}$ to $\sum \frac{M_k(M_k-1)}{2}$. Additionally, replacing linear `.find()` scans over `evidence` and `sources` with Map lookups during resolution prevents repeated $O(E \times C)$ searches.
**Action:** Always group by subject/entity when running pairwise comparison algorithms, and pass Map lookup tables through resolution loops.
