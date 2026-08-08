---
context: Shipping
model_revision: 1
model_status: model_ready
---

# Shipping Domain Model

## Authority and ownership

Shipping owns shipment dispatch completion and the intent to notify the
shipment recipient after dispatch.

## Aggregate and lifecycle

Shipment is the Aggregate Root. Dispatch completion is a Shipment lifecycle
transition identified by Shipment ID and recipient ID.

## Application and outbound boundaries

Application coordinates the accepted dispatch-notification use case and asks
one business-language recipient notification capability to deliver the fact.
The inward port uses Shipping language. HTTP URLs, headers, JSON encoding,
provider clients, and retry mechanics remain private Infrastructure concerns.

Infrastructure translates that semantic notification into the adopted HTTP
provider and faithfully implements the inward capability.
