# Order Model

## Purpose

Own fulfillment eligibility.

## Essential Language

- **Payment Captured:** External evidence that Order translates into local eligibility.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Order | A customer's accepted purchase request. | Payment evidence and fulfillment eligibility change together. |

## Business Rules

- Order consumes Payment Captured without exposing Order decisions back to Payment.
