---
last_updated: 2026-05-07
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Features

## Implemented

### Work Lifecycle

Work can start from an Issue, provision an execution environment, attach an Executor runtime, stream activity to users, accept host commands, handle stop requests, publish lifecycle events, recover from startup timeouts, converge sandbox and executor failures into terminal Work outcomes, archive completed work, preserve user-supplied agent configuration, merge platform runtime environment, and expose the result through Portal work views. Entry points are `cmd/supervisor/`, `internal/work/`, and Portal `/issues/:issueKey/work`; architectural wiring lives in `architecture.md`, and rationale lives in ADR-035, ADR-038, ADR-039, and ADR-040.
