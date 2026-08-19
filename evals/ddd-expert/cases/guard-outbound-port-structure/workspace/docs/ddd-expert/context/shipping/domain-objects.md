# Shipping Domain Objects

## Shipment

### Shipment — Aggregate Root (`ShipmentID`)

- **Definition:** A Shipment represents one delivery prepared for a recipient.
- **State:** Shipment owns recipient identity and dispatch status.
- **Behavior:**
  - `Dispatch` — Shipment completes delivery dispatch, producing Dispatched status and recipient notification intent.
