# Reserve inventory for an order

The checkout service sends `ReserveStock` after an order is accepted.
Inventory is the sole authority for sellable and reserved quantities.

The business fact after a successful command is `StockReserved`. A reservation
has identity across retry and release, and operations manages it as
`InventoryReservation`. The reservation expires after 15 minutes unless the
order confirms it. Available quantity must never become negative. A duplicate
command with the same reservation ID returns the original result. Temporary
inconsistency between Order and Inventory is acceptable and repaired by retry.

Order consumes the published reservation result but does not own inventory
language or stock rules.
