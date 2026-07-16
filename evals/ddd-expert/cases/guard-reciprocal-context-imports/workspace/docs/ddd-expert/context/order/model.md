---
context: Order
model_revision: 1
model_status: model_ready
---

# Order Domain Model

## Authority and Ownership

Order owns fulfillment readiness and accepts Payment Captured as external
evidence.

## Context Dependencies

Order translates Payment Captured into its local eligibility language.

## Model Realization

Order consumes the Payment Captured published contract through a boundary
adapter and invokes its local Application behavior. It may depend on Payment's
published contract but does not expose an Order model or Application dependency
back to Payment.
