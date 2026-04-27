# Test Case Patterns

## Minimal Set

For a changed behavior, start with:

1. success path
2. meaningful failure path
3. edge or bug-shaped path

Expand only when risk justifies it.

## Pattern Selection

### Equivalence Partitioning

Divide the input space into classes where all values in a class produce the same behavior. Test **one representative per class**. Testing more within the same class adds no detection value.

Typical classes for any input:
- valid range / valid format
- below minimum / above maximum
- invalid type or format
- empty / null / zero-length

### Boundary Value Analysis

Bugs cluster at boundaries. For every valid range `[min, max]`, test these six points:

```
min-1  (just outside lower → invalid)
min    (lower boundary → valid)
min+1  (just inside lower → valid)
max-1  (just inside upper → valid)
max    (upper boundary → valid)
max+1  (just outside upper → invalid)
```

Always apply alongside equivalence partitioning — boundaries are the edges of equivalence classes.

### Decision Table

For logic controlled by multiple independent conditions, enumerate combinations to avoid missing cases.

| Condition A | Condition B | Expected Outcome |
|-------------|-------------|-----------------|
| true        | true        | result X        |
| true        | false       | result Y        |
| false       | true        | error Z         |
| false       | false       | error W         |

When the number of combinations is large, use **pairwise testing** — cover every pair of condition values at least once rather than all N-way combinations.

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
