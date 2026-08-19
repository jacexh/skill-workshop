# Order Model

## Purpose

Own order fulfillment decisions.

## Essential Language

- **Payment Succeeded:** The authoritative settlement outcome received from Payment.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Order | A customer's accepted purchase request. | Order identity and fulfillment eligibility form one independent boundary. |

## Business Rules

- Order records Payment Succeeded idempotently.
- Order and Payment do not require one atomic consistency boundary.
