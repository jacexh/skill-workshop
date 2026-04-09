# Test Case Patterns

## Minimal Set

For a changed behavior, start with:

1. success path
2. meaningful failure path
3. edge or bug-shaped path

Expand only when risk justifies it.

## Pattern Selection

### Range or format rules

Use equivalence partitioning and boundary value analysis.

Check:

- valid representative
- just-inside boundary
- boundary
- just-outside boundary
- malformed or empty input

### Multi-condition decisions

Use a decision table.

Do not brute-force every combination if pairwise or risk-based selection is enough.

### State machines

For each risky transition:

1. set the source state directly when possible
2. trigger the transition
3. assert target state and side effects
4. add at least one invalid transition from the same source state

### Async or message-driven systems

Include:

- producer-side contract test
- consumer-side behavior test
- duplicate or retry behavior if the system claims idempotency

### UI flows

Prefer component or page-level tests for user-visible behavior.

Assert:

- what the user can see
- what the user can do
- what error or recovery state appears when the flow fails
