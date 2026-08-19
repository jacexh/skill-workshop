# Settlement Domain Objects

## Account

### Account — Aggregate Root (`AccountID`)

- **Definition:** Account represents one balance that Settlement may reduce.
- **State:** Current non-negative balance.
- **Behavior:**
  - `Settle` — Account settles an accepted amount against its balance, producing a decreased non-negative balance.
