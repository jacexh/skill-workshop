# Layer Selection

## Decision Rule

Ask: what is the lowest boundary that can fail in the same way production fails?

The lowest boundary is not always a unit. If production can fail only through real persistence, middleware, generated contracts, serialization, broker behavior, or deployment configuration, choose the narrowest integration, seam, contract, or E2E boundary that includes that mechanism.

## Typical Placement

### Unit

Use for:

- branching logic
- normalization and parsing
- reducers and state guards
- validation rules
- deterministic calculations

Avoid when the real risk is request wiring, persistence, rendering, or serialization at a seam.

### Integration

Use for:

- handler to service to repository behavior
- request and response contract verification
- persistence side effects
- cache writes or event emission inside one service boundary
- production-like middleware, configuration, migrations, and dependency wiring when those are part of the risk

Avoid duplicating every unit-level branch here. Cover the scenario, not every permutation.

Do not call a test `real integration` when it mocks the internal collaborator that carries the risk being claimed. Mocking a third-party edge can still be valid; mocking the service, repository, storage, broker, auth middleware, or generated client under review makes the test shallow for that risk.

### Seam or Contract

Use for:

- message schema and serialization
- route or topic wiring
- consumer and producer compatibility
- retry and dedup boundaries
- cross-service assumptions likely to drift

These tests exist because many real outages happen at the seam, not inside one unit.

Escalate to this layer when the risk is contract drift rather than a local rule: renamed fields, enum changes, null/default semantics, topic names, route names, time precision, schema migration, or generated client/server mismatch.

### E2E

Use for:

- core user journeys
- full-system regressions that lower layers cannot prove
- a small number of critical failure journeys when the user-visible recovery path matters

Keep E2E minimal. Most validation belongs lower.

Add E2E when user-visible trust depends on the whole deployed path: auth redirects, browser-to-backend wiring, cross-service recovery, file download/upload flows, payment/order completion, or critical operational journeys that lower layers cannot prove.

## Duplication Rule

If two layers both seem plausible:

1. choose the lower one if it catches the same bug with a stable signal
2. keep the higher one only if it validates a different failure mode

Examples:

- validation rule: unit
- status code mapping for validation error: integration
- browser error banner for rejected submission: component or E2E
