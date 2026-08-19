# Order Model

## Purpose

Own order fulfillment eligibility.

## Essential Language

- **Record Payment:** Associate an authoritative captured Payment with an Order.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Order | A customer's accepted purchase request. | Recorded payments and fulfillment eligibility change together. |

## Business Rules

- Each captured Payment changes an Order at most once.
