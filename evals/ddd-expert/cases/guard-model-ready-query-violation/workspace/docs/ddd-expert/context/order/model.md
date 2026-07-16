---
context: Order
model_revision: 1
model_status: model_ready
---

# Order Domain Model

## Invariants and Policies

Order is the sole Aggregate Root and invariant owner. Each Order has an
identity, customer, display name, placement time, and at least one OrderLine.
Each OrderLine identifies a product and has a positive quantity.

OrderLine values are owned children. They are created and persisted only as
part of their Order and have no independent lifecycle or Repository.

## Persistence and Query Boundaries

Infrastructure restores existing state through explicit mechanical conversion
and copies owned slices at the mapping boundary. The Domain write Repository
exposes only `Get` and `Save`; one command loads and saves one Order, including
all owned OrderLine values, as one in-memory operation.

Order-history reads use an Application-owned QueryRepository returning
OrderSummary DTOs. Reads filter by exact customer identity and order by
placement time descending, then order ID ascending as the stable tie-breaker.
One Infrastructure Store implements both inward contracts while keeping them
separate. Private records and conversion remain in Infrastructure.

## Accepted Deployment Profile

This boundary uses an accepted in-process, in-memory Store. It has no database,
schema, soft deletion, optimistic-lock token, process-restart durability,
external provider boundary, Domain Events, or cross-context writes.
