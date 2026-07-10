# Domain Model

## Inventory reservation

Inventory is the data authority. `InventoryReservation` is the Aggregate Root
for one reservation lifecycle. It owns the invariant that reserved quantity is
positive and available quantity never becomes negative.

`ReserveStock` records `StockReserved`. Duplicate reservation IDs are
idempotent. Expiration records `StockReservationExpired`; confirmation records
`StockReservationConfirmed`. Order and Inventory are separate bounded contexts.
Temporary cross-context inconsistency is accepted and repaired by retry.
