---
context: Order
model_revision: 1
model_status: model_ready
---

# Order Domain Model

## Authority and Ownership

Order owns order fulfillment.

## Failure and Recovery Semantics

Recording a captured payment is idempotent.

## Context Dependencies

Payment owns payment settlement and publishes the stable `PaymentCaptured`
fact. Order consumes that fact, but the published payload is not part of the
Order Domain model.

## Model Realization

Application records the accepted payment fact through the idempotent
`RecordPayment` use case and remains transport-neutral. The inbound Integration
Message boundary validates the producer-owned contract, translates it into
Order language, and delegates once. Broker envelopes and generated contract
types remain outside Application. The message Runtime owns acknowledgement and
retry disposition.

Boundary tests prove contract translation and one Application delegation;
Application tests prove idempotent payment recording without transport types.
