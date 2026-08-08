---
context: Order
model_revision: 1
model_status: model_ready
---

# Order Domain Model

## Authority and Ownership

Order owns its lifecycle and invariant decisions.

## Persistence

Order is one Aggregate Root. Its Domain Repository keeps persistence mechanics
outside Domain and saves the complete Root. The concrete MySQL schema and
migration mechanics are producer-owned implementation evidence; they do not
change this accepted boundary.
