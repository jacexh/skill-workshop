---
context: Payment
model_revision: 1
model_status: shape_ready
---

# Payment Domain Model

## Authority and Ownership

Payment has its own identity, lifecycle, and settlement authority.

## Failure and Recovery Semantics

Successful settlement is durable even while Order remains temporarily stale.
