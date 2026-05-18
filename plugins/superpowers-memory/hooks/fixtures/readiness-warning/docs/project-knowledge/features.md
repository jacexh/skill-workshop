---
last_updated: 2026-05-18
updated_by: superpowers-memory:update
triggered_by_plan: null
---

# Features

## Implemented

### Platform Capabilities

#### BuildKit Image Builds

**Enables** — Operators can build executor images through the BuildKit driver.

**Actors / Entry Points** — Sandbox build flow and `internal/buildkit/driver.go`.

**Capability Boundary** — BuildKit owns executor image construction.

**References** — `internal/buildkit/driver.go`.
