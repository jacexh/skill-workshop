# Layer Selection

## Decision Rule

Ask: what is the lowest boundary that can fail in the same way production fails?

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

Avoid duplicating every unit-level branch here. Cover the scenario, not every permutation.

### Seam or Contract

Use for:

- message schema and serialization
- route or topic wiring
- consumer and producer compatibility
- retry and dedup boundaries
- cross-service assumptions likely to drift

These tests exist because many real outages happen at the seam, not inside one unit.

### E2E

Use for:

- core user journeys
- full-system regressions that lower layers cannot prove
- a small number of critical failure journeys when the user-visible recovery path matters

Keep E2E minimal. Most validation belongs lower.

## Duplication Rule

If two layers both seem plausible:

1. choose the lower one if it catches the same bug with a stable signal
2. keep the higher one only if it validates a different failure mode

Examples:

- validation rule: unit
- status code mapping for validation error: integration
- browser error banner for rejected submission: component or E2E
