---
context: Order
model_revision: 2
model_status: model_ready
---

# Order Domain Model

## Scenarios and Lifecycle

An accepted Order may become Fulfilled or Cancelled. Fulfilled and Cancelled
are terminal states.

## Invariants and Policies

A fulfilled Order cannot be cancelled, and a cancelled Order cannot later be
fulfilled. These terminal-state rules were added in model revision 2.

## Model Realization

Order is the Aggregate Root and exposes intention-revealing `Cancel` and
`Fulfill` behaviors. Each rejects a transition from a terminal state and leaves
the current state unchanged.
