# Order Domain Objects

## Order

### Order — Aggregate Root (`OrderID`)

- **Definition:** An Order represents one customer's accepted purchase request.
- **State:** Order owns its identity and lifecycle status.
- **Behavior:**
  - `Cancel` — Order cancels an unfulfilled purchase request, producing Cancelled status or a rejection when fulfillment has completed.
