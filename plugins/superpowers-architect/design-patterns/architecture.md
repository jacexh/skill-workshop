---
name: Architecture Standards
description: Service boundaries, dependency direction, module structure, and layering rules
---

## Dependency Direction

- Dependencies flow inward: `handlers → services → domain → (no outward dependencies)`
- Domain layer has zero infrastructure dependencies (no database imports, no HTTP clients)
- Services orchestrate domain logic and coordinate infrastructure via interfaces
- Handlers (HTTP, CLI, workers) translate external I/O into service calls

## Module Structure

- One module per bounded context; bounded contexts do not import each other directly
- Cross-context communication goes through events or explicit API contracts
- Shared utilities live in `internal/shared/`; shared domain concepts do NOT (each context owns its model)

## Service Boundaries

- A service owns its data; no direct database access across service boundaries
- Services expose interfaces, not implementations; callers depend on the interface
- Constructor injection only — no service locator pattern, no global state

## File Size

- No file exceeds 300 lines; split by responsibility when approaching this limit
- Test files may be longer but must remain readable without scrolling for a single test case
