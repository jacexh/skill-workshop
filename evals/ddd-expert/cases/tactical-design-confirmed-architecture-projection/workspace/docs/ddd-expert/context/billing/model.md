---
context: Billing
model_revision: 2
model_status: model_ready
---

# Billing Domain Model

## Ubiquitous Language

- **Settle Invoice:** Apply an eligible payment to one Invoice.
- **Settlement Rate:** The authoritative conversion from a payment currency to the Invoice currency for one settlement attempt.
- **Invoice Settled:** The Invoice balance is zero after an accepted payment.

## Authority and Ownership

The Billing Clerk may request Settle Invoice. Billing owns Invoice eligibility, balance transition, and settlement completion. The Settlement Rate Authority owns the rate used for a foreign-currency attempt.

## Aggregates and Core Business Objects

- **Invoice:** Aggregate Root owning settlement eligibility and remaining balance.

## Aggregate Capabilities

### Invoice

| Source Command(s) | Capability | Required authoritative facts | Guaranteed business result | Stable rejection |
|---|---|---|---|---|
| Settle Invoice | Settle Invoice | Current balance, positive payment amount, and an authoritative rate for a foreign-currency attempt | A sufficient converted payment makes the remaining balance zero and settlement is accepted | Invalid, insufficient, or already-settled payment leaves state unchanged |

## Scenarios and Lifecycle

An Invoice validates its local eligibility before it requires a Settlement Rate. It becomes settled after a sufficient payment in its own currency or after applying the authoritative rate to a foreign-currency payment.

## Invariants and Policies

An accepted settlement makes the remaining balance exactly zero. An invalid local attempt does not require a rate.

## Failure and Recovery Semantics

If the Settlement Rate Authority cannot provide the required rate, the Invoice remains unchanged and no settlement is accepted.

## Hotspots and Open Questions

- None for the confirmed scope.
