---
context: Order
based_on_model_revision: 1
---

# Order Tactical Design

## Aggregates and Invariant Ownership

Order is one Aggregate Root.

## Persistence and Consistency

Order is stored in MySQL and follows the ddd-expert MySQL House Style. This
review does not reopen the accepted Aggregate boundary.
