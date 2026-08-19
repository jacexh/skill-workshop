# Order Domain Objects

## Order

### Order — Aggregate Root (`OrderID`)

- **Definition:** An Order represents one accepted purchase request.
- **State:** Order owns captured-payment references and fulfillment eligibility.
- **Behavior:**
  - `ConfirmPayment` — Order records captured-payment evidence, producing local fulfillment eligibility.
