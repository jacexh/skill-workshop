---
context: Payment
based_on_model_revision: 1
design_status: codify_ready
---

# Payment Tactical Design

## Aggregates and Invariant Ownership

Payment is an independent Aggregate Root with its own Repository.

## Cross-Context Collaboration

Payment publishes `PaymentSucceeded` after settlement. It does not require
atomic persistence with Order.
