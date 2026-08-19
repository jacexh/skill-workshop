# Order Domain Objects

## Order

### Order — Aggregate Root (`OrderID`)

- **Definition:** Order represents one accepted customer commitment.
- **State:** Identity and non-empty business name.
- **Behavior:**
  - `Rename` — Order replaces its business name with a non-empty name, producing the updated Order name.
