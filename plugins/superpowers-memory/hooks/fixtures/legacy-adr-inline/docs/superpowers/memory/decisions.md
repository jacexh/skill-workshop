---
last_updated: 2026-05-18
updated_by: superpowers-memory:update
triggered_by_plan: null
---

# Decisions

## ADR-001: Inline legacy decision

**Context:** This old-style ADR keeps rationale inline in decisions.md instead of loading detail on demand.

**Decision:** Keep the old inline format.

**Alternatives Rejected:**
- **Split detail files:** Rejected in the legacy format.
- **Drop the decision:** Rejected in the legacy format.

**Consequences:** Agents must load unnecessary rationale and cannot rely on the summary/detail boundary.
