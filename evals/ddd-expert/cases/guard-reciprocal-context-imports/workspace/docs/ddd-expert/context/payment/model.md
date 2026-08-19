# Payment Model

## Purpose

Own payment capture outcomes.

## Essential Language

- **Payment Captured:** Settlement completed successfully.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Payment | One settlement attempt. | Payment identity and capture outcome change together. |

## Business Rules

- Payment publishes its capture outcome without depending on Order decisions.
