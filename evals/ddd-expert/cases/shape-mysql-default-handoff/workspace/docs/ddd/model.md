# Domain Model

## Inventory

### Ubiquitous Language

An `InventoryReservation` has one identity across reservation, expiration, and
confirmation.

### Authority and Lifecycle

Inventory is the sole authority for sellable and reserved quantities.
`ReserveStock` records `StockReserved`; expiration records
`StockReservationExpired`; confirmation records `StockReservationConfirmed`.

### Invariants and Failure Semantics

Reserved quantity is positive and available quantity never becomes negative.
Duplicate reservation IDs return the original result. Temporary inconsistency
between Order and Inventory is acceptable and repaired by retry.

### Context Relationships

Order and Inventory are separate bounded contexts. Order consumes the published
reservation result but does not own inventory language or stock rules.
