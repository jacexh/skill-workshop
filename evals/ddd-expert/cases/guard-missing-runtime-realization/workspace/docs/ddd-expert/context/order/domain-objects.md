# Order Domain Objects

## Order

### Order — Aggregate Root (`OrderID`)

- **Definition:** An Order represents one accepted purchase request.
- **State:** Order owns recorded payment identities and fulfillment eligibility.
- **Behavior:**
  - `RecordPayment` — Order records a captured Payment, producing idempotent fulfillment eligibility.
