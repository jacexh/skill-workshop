---
context: Order
model_revision: 3
---

# Order Domain Model

## Language

- **Payment Captured:** The upstream fact that Payment has completed settlement.
- **Record Payment:** Order's decision to associate a captured payment with an order.

## Invariants and Policies

Order owns whether a captured payment may be recorded and whether fulfillment
may proceed. A Payment Captured fact is translated into one Record Payment
command; provider delivery concerns do not change the business meaning of that
command.

## Context Boundary

Payment owns settlement and the Payment Captured contract. Order consumes only
that published contract and does not depend on Payment's internal model.
