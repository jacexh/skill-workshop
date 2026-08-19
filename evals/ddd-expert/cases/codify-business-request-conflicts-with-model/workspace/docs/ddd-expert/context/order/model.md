# Order Model

## Purpose

Own the customer order lifecycle and the rules that permit cancellation.

## Essential Language

- **Fulfilled:** The order has completed fulfillment and is final.
- **Cancelled:** The order was stopped before fulfillment completed.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Order | A customer's accepted purchase request. | Order status and cancellation eligibility change together. |

## Business Rules

- A fulfilled Order cannot be cancelled.
