---
context: Order
based_on_model_revision: 1
design_status: codify_ready
---

# Order Tactical Design

## Aggregates and Invariant Ownership

Order is the Aggregate Root. `RenameOrder` becomes the intention-revealing
`Order.Rename` behavior and protects the existing non-empty-name invariant.

## Persistence and Consistency

The change is local to one in-memory Aggregate and has no persistence or event
change.

## Verification Seams

The existing Domain test is the accepted behavior contract.
