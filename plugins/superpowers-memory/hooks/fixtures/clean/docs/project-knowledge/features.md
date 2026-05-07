---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Features

## Implemented

### Product Capabilities

#### HTTP API

**Enables** — Serves JSON requests for the application.

**Actors / Entry Points** — External clients call the service through `cmd/server/main.go`.

**Capability Boundary** — Request routing and module wiring live in `architecture.md`.

**References** — ADR-001.
