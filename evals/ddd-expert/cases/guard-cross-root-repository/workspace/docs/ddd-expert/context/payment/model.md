# Payment Model

## Purpose

Own payment settlement and its durable outcome.

## Essential Language

- **Payment Succeeded:** Settlement completed successfully.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Payment | One settlement attempt. | Payment identity and settlement outcome form one independent boundary. |

## Business Rules

- A successful Payment remains authoritative while downstream Order state is temporarily stale.
