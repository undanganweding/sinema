# Bolt Performance Journal

## 2025-02-23 - Memoize ShotRow and CommandPalette to avoid list/parent re-renders
**Learning:** In cinematic scene & shot lists or app-wide overlays like `CommandPalette`, frequent parent state updates (such as real-time SSE progress events or tab navigations) cause all child rows and modals to re-render even when their props haven't changed.
**Action:** Wrap heavy list item components (`ShotRow`) and app-wide modal/overlay components (`CommandPalette`) with `React.memo` to eliminate unnecessary re-renders.
