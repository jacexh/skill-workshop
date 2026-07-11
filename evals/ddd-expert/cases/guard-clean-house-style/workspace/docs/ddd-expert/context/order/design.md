---
context: Order
based_on_model_revision: 1
---

# Order Tactical Design

## Aggregates and Invariant Ownership

OrderLine values are persisted with Order. One command loads and saves one
Order. There are no Domain Events, external side effects, background recovery,
or cross-context writes in this scope.

## Persistence and Consistency

The write Repository exposes only Get and Save. Product order-history reads use
an Application QueryRepository returning OrderSummary DTOs. One Infrastructure
adapter implements both contracts without exposing storage types inward.
