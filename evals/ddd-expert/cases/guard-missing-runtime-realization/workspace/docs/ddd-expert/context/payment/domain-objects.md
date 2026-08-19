# Payment Domain Objects

## Payment

### Payment — Aggregate Root (`PaymentID`)

- **Definition:** A Payment represents one settlement attempt.
- **State:** Payment owns its capture status and amount.
- **Behavior:**
  - `Capture` — Payment completes settlement, producing a captured outcome.
- **Domain Events:**
  - `PaymentCaptured` — Payment emits its capture outcome, producing durable evidence for publication.
