---
context: Order
based_on_model_revision: 1
design_status: codify_ready
---

# Order Tactical Design

## Model Realization

Order consumes the Payment Captured contract through a boundary adapter and
invokes its local Application behavior.

## Context Dependencies and Contracts

Order may depend on Payment's published contract. It does not expose an Order
model or Application dependency back to Payment.
