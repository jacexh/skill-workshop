# Payment Domain Objects

## Payment

### Payment — Aggregate Root (`PaymentID`)

- **Definition:** A Payment represents one settlement attempt.
- **State:** Payment owns its settlement status and amount.
- **Behavior:**
  - `Succeed` — Payment completes settlement, producing a durable successful outcome.
- **Domain Events:**
  - `PaymentSucceeded` — Payment emits its successful settlement fact, producing evidence for downstream publication.
