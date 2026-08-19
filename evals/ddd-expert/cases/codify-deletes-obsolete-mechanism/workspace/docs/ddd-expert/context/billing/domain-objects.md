# Billing Domain Objects

## Invoice

### Invoice — Aggregate Root (`InvoiceID`)

- **Definition:** Invoice represents one collectible amount.
- **State:** Identity and whether settlement has occurred.
- **Behavior:**
  - `Settle` — Invoice applies a positive payment to itself, producing settled state.
  - `Settled` — Invoice reports its settlement state, producing the current settlement result.
