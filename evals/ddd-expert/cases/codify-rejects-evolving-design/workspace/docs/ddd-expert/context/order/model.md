---
context: Order
model_revision: 1
model_status: shape_ready
---

# Order Domain Model

## Ubiquitous Language

An Order has one identity and a non-empty business name.

## Invariants and Policies

Renaming an Order requires a non-empty name. A rejected rename leaves the
current name unchanged.
