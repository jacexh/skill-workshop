---
context: Order
model_revision: 1
---

# Order Domain Model

## Authority and Ownership

Order has its own identity and lifecycle.

## Failure and Recovery Semantics

Payment may succeed before Order reflects the fact. The Order reaction is
idempotent and temporary inconsistency is accepted.
