# Billing Model

## Purpose

Billing owns invoices and collection decisions.

## Essential Language

- **Invoice:** The amount Billing is entitled to collect.
- **Payment:** Accepted value offered against an Invoice.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Invoice | Owns one collectible amount. | Balance and settlement status change together. |
| Credit Note | Owns one approved reduction. | Approval and available credit change together. |
| Refund | Owns returned value. | Refund eligibility and completion change together. |

## Business Rules

- An Invoice is settled only when its outstanding balance reaches zero.
