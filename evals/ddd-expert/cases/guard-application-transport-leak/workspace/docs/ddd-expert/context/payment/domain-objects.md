# Payment Domain Objects

## Payment

### Payment — Aggregate Root (`PaymentID`)

- **Definition:** A Payment represents one settlement attempt.
- **State:** Payment owns its settlement status and captured amount.
- **Behavior:**
  - `Capture` — Payment settles its amount, producing a captured outcome.
- **Domain Events:**
  - `PaymentCaptured` — Payment emits the completed capture fact, producing durable evidence for publication.
