# Tactical Design

Accepted model source: the existing Order domain package.

## Model Decisions

Order is the Aggregate Root. `RenameOrder` becomes `Order.Rename(name)` and
protects the existing non-empty-name invariant. A rejected rename leaves the
current name unchanged.

## Boundary / Consistency

The change is local to one in-memory aggregate and has no persistence or event
change.

## Implementation Constraints

Keep the behavior in `internal/order/domain`. Do not introduce ports or adapters.

## Verification Seams

The existing domain test is the accepted behavior contract.
