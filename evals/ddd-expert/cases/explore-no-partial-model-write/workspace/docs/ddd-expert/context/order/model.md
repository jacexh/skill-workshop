---
context: Order
model_revision: 1
---

# Order Domain Model

## Authority and Ownership

Order owns its lifecycle and the decision that an order is ready for
fulfillment.

## Context Relationships

Order consumes published Payment facts and translates them into its local
language before making an Order decision.
