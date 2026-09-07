## 2026-09-07 - Pre-compiling Static Sanitization Patterns in Prompt Engines
**Learning:** High-volume prompt adapter pipelines in this architecture invoke validation and repair functions on every model target. Dynamic `RegExp` construction and repetitive string lowercasing inside loops create unnecessary GC churn and string allocation overhead.
**Action:** Always pre-compile static matchers and combined sanitization regex patterns at module scope for hot-path validator/repair functions.
