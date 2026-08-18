---
context: Billing
model_revision: 2
model_status: model_ready
---

# Billing Domain Model

## Ubiquitous Language

- **Settle Invoice:** Apply an accepted payment amount to one Invoice.
- **Invoice Settled:** The Invoice balance is durably zero.

## Authority and Ownership

The Billing Clerk may request Settle Invoice. Billing owns invoice eligibility, balance transition, and settlement completion.

## Aggregates and Core Business Objects

- **Invoice:** Aggregate Root owning settlement eligibility and remaining balance.

## Aggregate Capabilities

### Invoice

| Source Command(s) | Capability | Required authoritative facts | Guaranteed business result | Stable rejection |
|---|---|---|---|---|
| Settle Invoice | Settle Invoice | Current balance and positive payment amount | Remaining balance becomes zero and settlement is accepted | Invalid amount or already-settled Invoice leaves state unchanged |

## Scenarios and Lifecycle

An Invoice becomes settled only after its accepted balance change is durable.

## Invariants and Policies

An accepted settlement makes the remaining balance exactly zero.

## Failure and Recovery Semantics

Persistence failure leaves the Invoice unsettled and returns a failed settlement.

## Hotspots and Open Questions

- None for the confirmed scope.
