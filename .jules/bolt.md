## 2025-05-18 - Hash map indexing in `getFullProjectData`
**Learning:** Grouping relational entities (scenes, shots, video prompts) in `getFullProjectData` using nested `Array.prototype.filter()` results in $O(N \cdot S + S \cdot P)$ quadratic scaling for large projects.
**Action:** Always index relational data in single-pass linear loops ($O(N + S + P)$) using hash maps to preserve ordering while eliminating quadratic iterations on read endpoints.
