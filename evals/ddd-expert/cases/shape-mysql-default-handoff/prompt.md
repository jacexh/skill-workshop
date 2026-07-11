The domain facts in `docs/ddd-expert/context/inventory/model.md` are complete
and accepted. I also accept
this tactical direction: `InventoryReservation` owns its invariant boundary,
the write Repository persists that Aggregate, cross-context notification uses
an Integration Message, and persistence uses the MySQL 8.0 default. Merge the
complete target-state Tactical Design into
`docs/ddd-expert/context/inventory/design.md` now. Keep the
accepted model unchanged.
