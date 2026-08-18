---
context: Settlement
model_revision: 2
model_status: model_ready
---

# Settlement Domain Model

## Ubiquitous Language

- **Settle Account:** Apply one accepted settlement amount to an Account.
- **Settlement Completed:** The settlement is durably committed and may be announced.

## Authority and Ownership

Settlement owns account eligibility, balance transition, and completion.

## Aggregates and Core Business Objects

- **Account:** Aggregate Root owning balance and settlement eligibility.

## Aggregate Capabilities

### Account

| Source Command(s) | Capability | Required authoritative facts | Guaranteed business result | Stable rejection |
|---|---|---|---|---|
| Settle Account | Settle | Current balance and positive amount | Balance decreases and settlement is accepted | Insufficient balance or invalid amount leaves Account unchanged |

## Scenarios and Lifecycle

A settlement becomes completed only after its Account change is durably committed.

## Invariants and Policies

An Account balance never becomes negative.

## Failure and Recovery Semantics

Persistence failure leaves the settlement incomplete and announces no completion.

## Hotspots and Open Questions

- None for the confirmed scope.
