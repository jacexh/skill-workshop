# Reserve inventory for an order

A caller sends a Reserve Stock request after an order is accepted.
Inventory is the sole authority for sellable and reserved quantities.

The business fact after a successful command is Stock Reserved. A reservation
has identity across retry and release, and operations manages it as
an Inventory Reservation. The reservation expires after 15 minutes unless the
order confirms it. Available quantity must never become negative. A duplicate
command with the same reservation ID returns the original result. Temporary
inconsistency between the caller and Inventory is acceptable and repaired by retry.

The caller consumes the published reservation result but does not own inventory
language or stock rules.
