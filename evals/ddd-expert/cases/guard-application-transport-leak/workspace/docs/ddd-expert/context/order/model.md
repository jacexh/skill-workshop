---
context: Order
model_revision: 1
---

# Order Domain Model

## Authority and Ownership

Order owns order fulfillment.

## Failure and Recovery Semantics

Recording a captured payment is idempotent.

## Context Relationships

Payment owns payment settlement and publishes the stable `PaymentCaptured`
fact. Order consumes that fact, but the published payload is not part of the
Order Domain model.
