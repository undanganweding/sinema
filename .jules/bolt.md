## 2026-09-01 - CommandPalette Static Workspace Items Hoisting
**Learning:** Static menu structures or command items created inside React component bodies or `useMemo` hooks cause unnecessary object allocations on re-renders. Hoisting static object templates outside component scope reduces heap churn and keeps `useMemo` closures lightweight.
**Action:** Always check command palettes, sidebar nav items, and dropdown menu configs for static metadata that can be defined outside the React component.
