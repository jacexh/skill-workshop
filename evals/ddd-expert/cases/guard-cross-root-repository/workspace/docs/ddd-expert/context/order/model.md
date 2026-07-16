---
context: Order
model_revision: 1
model_status: model_ready
---

# Order Domain Model

## Authority and Ownership

Order has its own identity and lifecycle.

## Failure and Recovery Semantics

Payment may succeed before Order reflects the fact. The Order reaction is
idempotent and temporary inconsistency is accepted.

## Model Realization

Order is an independent Aggregate Root with its own Repository. A
`PaymentSucceeded` reaction updates Order idempotently. Retry and reconciliation
own recovery; no invariant requires a transaction with Payment.
