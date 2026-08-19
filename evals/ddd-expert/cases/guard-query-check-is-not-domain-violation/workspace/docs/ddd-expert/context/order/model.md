# Order Model

## Purpose

Own customer orders and the rules that make an order valid.

## Essential Language

- **Order Line:** A requested positive quantity of one product inside an Order.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Order | A customer's accepted purchase request. | Customer, placement, display name, and all Order Lines remain valid together. |

## Business Rules

- An Order contains at least one Order Line.
- Every Order Line has a positive quantity.
