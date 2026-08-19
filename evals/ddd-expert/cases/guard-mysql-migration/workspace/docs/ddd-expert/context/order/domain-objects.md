# Order Domain Objects

## Order

### Order — Aggregate Root (`OrderID`)

- **Definition:** An Order represents one customer's accepted purchase request.
- **State:** Order owns its identity and lifecycle status.
- **Behavior:**
  - `Rename` — Order replaces its display name, producing the updated name.
