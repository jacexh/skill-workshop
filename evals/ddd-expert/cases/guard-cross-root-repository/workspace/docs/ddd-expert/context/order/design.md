---
context: Order
based_on_model_revision: 1
---

# Order Tactical Design

## Aggregates and Invariant Ownership

Order is an independent Aggregate Root with its own Repository.

## Cross-Context Collaboration

A `PaymentSucceeded` reaction updates Order idempotently. Retry and
reconciliation own recovery; no invariant requires a transaction with Payment.
