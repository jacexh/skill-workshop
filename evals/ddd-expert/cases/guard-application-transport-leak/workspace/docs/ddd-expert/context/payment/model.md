# Payment Model

## Purpose

Own payment settlement and authoritative capture outcomes.

## Essential Language

- **Payment Captured:** Payment completed settlement successfully.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Payment | One settlement attempt for an amount. | Settlement state and capture outcome change together. |

## Business Rules

- Payment alone decides whether settlement is captured.
