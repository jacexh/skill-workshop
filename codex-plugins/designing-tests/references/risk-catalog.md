# Risk Catalog

Use this list to find the few tests that are most likely to prevent real incidents.

## High-Value Risk Shapes

- boundary values and off-by-one conditions
- null, empty, missing, and malformed input
- permission and tenancy edges
- invalid state transitions
- duplicate requests or duplicate messages
- retries, partial failures, and compensating behavior
- schema drift and serialization mismatches
- ordering sensitivity in async flows
- cache consistency and stale reads
- time windows, expiry, timezone, and clock skew
- money, rounding, and precision loss
- idempotency and deduplication
- redaction and sensitive field leakage

## Prioritization Rule

Prefer tests that would catch:

1. high user impact
2. historically common failures
3. failures at module or service seams
4. behavior that is hard to inspect manually

Do not spend early effort exhaustively enumerating low-impact permutations while these risks remain uncovered.
