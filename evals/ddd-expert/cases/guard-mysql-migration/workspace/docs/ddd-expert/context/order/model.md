# Order Model

## Purpose

Own customer order lifecycle and invariant decisions.

## Essential Language

- **Order:** A customer's accepted purchase request.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Order | A customer's accepted purchase request. | Order identity, status, and invariant state change together. |

## Business Rules

- Order is one independent consistency boundary.
