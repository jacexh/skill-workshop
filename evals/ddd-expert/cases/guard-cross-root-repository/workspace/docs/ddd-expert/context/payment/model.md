---
context: Payment
model_revision: 1
model_status: model_ready
---

# Payment Domain Model

## Authority and Ownership

Payment has its own identity, lifecycle, and settlement authority.

## Failure and Recovery Semantics

Successful settlement is durable even while Order remains temporarily stale.

## Model Realization

Payment is an independent Aggregate Root with its own Repository. It publishes
`PaymentSucceeded` after settlement and does not require atomic persistence
with Order.
