# Order Model

## Purpose

Own order fulfillment and decide how captured payments affect eligibility.

## Essential Language

- **Record Payment:** Associate an authoritative captured payment with an Order.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Order | A customer's accepted purchase request. | Payment association and fulfillment eligibility change together. |

## Business Rules

- Recording the same captured payment more than once has one business effect.
