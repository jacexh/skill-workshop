# Billing Model

## Purpose

Billing owns Invoice settlement.

## Essential Language

- **Invoice:** One collectible amount.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Invoice | Owns one collectible amount. | Settlement state changes with accepted payment. |

## Business Rules

- A positive payment settles an unsettled Invoice.
- Persistence completion is not a business fact.
