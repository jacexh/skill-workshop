# Order Domain Objects

## Order

### Order — Aggregate Root (`OrderID`)

- **Definition:** An Order represents one accepted purchase request.
- **State:** Order owns payment outcome references and fulfillment eligibility.
- **Behavior:**
  - `RecordPaymentSucceeded` — Order records a successful Payment outcome, producing idempotent fulfillment eligibility.
