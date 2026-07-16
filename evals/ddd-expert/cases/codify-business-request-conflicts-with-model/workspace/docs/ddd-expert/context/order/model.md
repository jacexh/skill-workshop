---
context: Order
model_revision: 2
model_status: model_ready
---

# Order Domain Model

## Scenarios and Lifecycle

An accepted Order may be cancelled before fulfillment starts.

## Invariants and Policies

A fulfilled Order cannot be cancelled. This rule was added in model revision 2.

## Model Realization

Order is the Aggregate Root and owns cancellation decisions. A cancellation
operation must reject a fulfilled Order without changing its state.
