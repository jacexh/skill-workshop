---
context: Order
model_revision: 1
model_status: shape_ready
---

# Order Domain Model

## Authority and Ownership

Order owns its lifecycle and the decision that an order is ready for
fulfillment.

## Context Dependencies

Order consumes published Payment facts and translates them into its local
language before making an Order decision.
