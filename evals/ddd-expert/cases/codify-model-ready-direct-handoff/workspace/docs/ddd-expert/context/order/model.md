---
context: Order
model_revision: 1
model_status: model_ready
---

# Order Domain Model

## Ubiquitous Language

An Order has one identity and a non-empty business name.

## Invariants and Policies

Renaming an Order requires a non-empty name. A rejected rename leaves the
current name unchanged.

## Model Realization

Order is the Aggregate Root. `RenameOrder` becomes the intention-revealing
`Order.Rename` behavior. The change is local to one in-memory Aggregate and
has no persistence or event change. The existing Domain test is the accepted
behavior contract.
