The domain facts in `docs/ddd-expert/context/inventory/model.md` are complete
and accepted. We have already reviewed and explicitly accept this complete
integrated Tactical Design proposal:

- `InventoryReservation` is the Aggregate Root and owns its lifecycle and positive-quantity invariant;
  it has no child Entity. `ReservationId` and positive `Quantity` are Value
  Objects owned by the Root.
- creation establishes Reserved; only a Reserved reservation may establish
  Confirmed or Expired; those outcomes are terminal. Duplicate reservation
  identity returns the established result without a second transition.
- the three accepted stock facts are local Domain Events. Inventory publishes a
  distinct Reservation Outcome Integration Message to Order after persistence;
  retries preserve the same reservation identity and outcome.
- a write Repository persists one reservation Aggregate using the MySQL 8.0
  house-style default. Uniqueness and optimistic concurrency protect identity,
  idempotency, and the lifecycle invariant. In the same local transaction, a
  transactional outbox records the accepted outcome; a relay publishes only
  after commit and retries without changing the outcome. No Process Manager is
  needed.
- the Aggregate remains separate from Order because Inventory alone owns stock
  authority; failure or retry of notification cannot roll back the established
  Inventory outcome.

This is the complete accepted design, not merely a preferred direction. Apply
it once to `docs/ddd-expert/context/inventory/design.md` without introducing a
new decision, and keep the accepted Model unchanged.
