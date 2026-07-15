---
context: Order
model_revision: 1
model_status: shape_ready
---

# Order Domain Model

## Invariants and Policies

Order is the sole Aggregate Root and invariant owner. Each Order has an
identity, customer, display name, placement time, and at least one OrderLine.
Each OrderLine identifies a product and has a positive quantity.

OrderLine values are owned children. They are created and persisted only as
part of their Order and have no independent lifecycle or Repository.
