# Order Domain Objects

## Order

### Order — Aggregate Root (`OrderID`)

- **Definition:** An Order represents one accepted purchase request.
- **State:** Order owns Accepted, Fulfilled, and Cancelled status.
- **Behavior:**
  - `Cancel` — Order cancels an accepted purchase request, producing Cancelled status or a terminal-state rejection.
  - `Fulfill` — Order fulfills an accepted purchase request, producing Fulfilled status or a terminal-state rejection.
