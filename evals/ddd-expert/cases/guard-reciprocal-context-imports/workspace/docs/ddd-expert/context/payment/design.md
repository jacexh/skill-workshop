---
context: Payment
based_on_model_revision: 1
---

# Payment Tactical Design

## Model Realization

Payment publishes the Payment Captured contract from its Application boundary
after the local Aggregate outcome is established.

## Context Dependencies and Contracts

Payment owns publication to Order and has no dependency on the Order model or
Application API.
