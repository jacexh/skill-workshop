---
context: Payment
model_revision: 1
model_status: model_ready
---

# Payment Domain Model

## Authority and Ownership

Payment owns capture outcome and publishes Payment Captured.

## Context Dependencies

Payment publishes its fact without consuming Order language or decisions.

## Model Realization

Payment publishes the Payment Captured contract from its Application boundary
after the local Aggregate outcome is established. It owns publication to Order
and has no dependency on the Order model or Application API.
