---
context: Order
model_revision: 1
---

# Order Domain Model

## Authority and Ownership

Order owns order acceptance and the decision to react to reservation outcomes.

## Context Dependencies

Inventory owns reservation outcomes and publishes them in its language. Order
consumes those outcomes without importing Inventory's internal stock model.
