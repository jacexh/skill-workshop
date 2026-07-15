---
context: Order
based_on_model_revision: 1
design_status: codify_ready
---

# Order Tactical Design

## Application Responsibilities

Application records the accepted payment fact through the idempotent
`RecordPayment` use case and remains transport-neutral.

## Boundary Contracts

The inbound Integration Message boundary validates the producer-owned contract,
translates it into Order language, and delegates once. Broker envelopes and
generated contract types remain outside Application.

## Runtime Ownership

The message Runtime owns acknowledgement and retry disposition.

## Verification Seams

Boundary tests prove contract translation and one Application delegation;
Application tests prove idempotent payment recording without transport types.
