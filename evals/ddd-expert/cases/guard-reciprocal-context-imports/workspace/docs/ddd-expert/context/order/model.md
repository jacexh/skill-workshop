---
context: Order
model_revision: 1
---

# Order Domain Model

## Authority and Ownership

Order owns fulfillment readiness and accepts Payment Captured as external
evidence.

## Context Dependencies

Order translates Payment Captured into its local eligibility language.
