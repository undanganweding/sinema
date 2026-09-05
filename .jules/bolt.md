## 2025-05-18 - Memoizing Derived Component State in Production & Scene Workspaces
**Learning:** Re-evaluating array `.filter()`, `.find()`, `.flatMap()`, and string `.includes()` on every keystroke/accordion toggle in large React views (like `ProductionProjectsView` and `SceneWorkspace`) causes unnecessary render lag as project/scene counts grow.
**Action:** Always wrap derived filters, status aggregations (combining multiple `.filter()` into a single loop pass), and nested lookups in `useMemo` with minimal dependency arrays.
