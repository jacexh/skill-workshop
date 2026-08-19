# Shipping Model

## Purpose

Own shipment dispatch completion.

## Essential Language

- **Dispatched:** The shipment has completed dispatch to its recipient.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Shipment | One delivery prepared for a recipient. | Shipment identity, recipient, and dispatch status change together. |

## Business Rules

- Recipient notification is requested only after dispatch completes.
