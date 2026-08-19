# Payment Model

## Purpose

Own payment settlement and capture outcomes.

## Essential Language

- **Payment Captured:** Settlement completed successfully.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Payment | One settlement attempt. | Settlement state and capture outcome change together. |

## Business Rules

- Payment owns the authoritative captured outcome.
