---
context: Order
model_revision: 1
model_status: model_ready
---

# Order Domain Model

## Authority and Ownership

Order owns its lifecycle and invariant decisions.

## Persistence

Order is one Aggregate Root stored in MySQL. Its schema must follow the
installed ddd-expert MySQL House Style; this conformance review does not reopen
the accepted Aggregate boundary.
