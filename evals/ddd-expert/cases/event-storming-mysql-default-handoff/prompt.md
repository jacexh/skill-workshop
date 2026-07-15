The domain facts in `docs/ddd-expert/context/inventory/model.md` are complete
and accepted. Across earlier EventStorming turns we have already reviewed and
explicitly accepted these tactical decisions:

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

Together these accepted decisions close the remaining Inventory Design
obligations. Apply their smallest consistency closure to
`docs/ddd-expert/context/inventory/design.md`, promote it to `codify_ready`
without asking for a duplicate acceptance, and keep the accepted Model
unchanged.
