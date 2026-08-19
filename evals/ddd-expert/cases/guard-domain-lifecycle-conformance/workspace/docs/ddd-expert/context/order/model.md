# Order Model

## Purpose

Own the customer order lifecycle.

## Essential Language

- **Fulfilled:** The Order completed fulfillment and is terminal.
- **Cancelled:** The Order was stopped and is terminal.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Order | A customer's accepted purchase request. | Order status and terminal-state rules change together. |

## Business Rules

- A fulfilled Order cannot be cancelled.
- A cancelled Order cannot be fulfilled.
