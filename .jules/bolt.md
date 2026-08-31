## 2026-08-31 - Memoizing Entity Lookups in React List Components
**Learning:** In components rendering entity lists (such as character lists in `ContinuityPanel`), performing inline array `.find()` calls inside `.map()` render loops causes $O(C \times K)$ linear scans on every render. Creating a memoized `Map` (`useMemo`) reduces lookups to $O(1)$ time and avoids unnecessary array traversals on UI state changes.
**Action:** When working on React components displaying collections, look for repeated `.find()` calls inside render loops and construct a memoized `Map` indexed by key.
