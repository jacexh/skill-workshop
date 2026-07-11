---
context: Order
model_revision: 1
---

# Order Domain Model

## Invariants and Policies

Order is the sole Aggregate Root and invariant owner. OrderLine values are
owned children and change only through Order.
