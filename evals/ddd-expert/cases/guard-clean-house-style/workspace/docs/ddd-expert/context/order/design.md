---
context: Order
based_on_model_revision: 1
design_status: codify_ready
---

# Order Tactical Design

## Aggregates and Invariant Ownership

`domain.Order` owns its OrderLine values and validates both the root and its
children. Infrastructure restores existing state through explicit mechanical
conversion and copies owned slices at the mapping boundary. One command loads
and saves one Order. There are no Domain Events, external side effects,
background recovery, or cross-context writes in this scope.

## Persistence and Consistency

The Domain write Repository exposes only `Get` and `Save`; `Save` persists the
Order and all owned OrderLine values as one in-memory operation. Product
order-history reads use an Application-owned QueryRepository returning
OrderSummary DTOs. The read filters by exact customer identity and orders
results by placement time descending, then order ID ascending as the stable
tie-breaker.

One Infrastructure Store implements both inward contracts while keeping them
separate. Private records and record-to-Domain/read-model conversion remain in
Infrastructure and no storage type is exposed inward.

## Accepted Deployment Profile

This review covers an explicitly accepted in-process, in-memory Store. It has no
database, schema, soft deletion, optimistic-lock token, process-restart
durability, or external provider boundary. The MySQL/xorm database profile,
migrations, provider-error wrapping, and database integration tests are
therefore not applicable. A future database-backed adapter requires a separate
accepted Tactical Design.
