---
context: Payment
model_revision: 1
model_status: shape_ready
---

# Payment Domain Model

## Authority and Ownership

Payment owns capture outcome and publishes Payment Captured.

## Context Dependencies

Payment publishes its fact without consuming Order language or decisions.
