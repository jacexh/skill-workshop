# Billing Domain Objects

## Credit Note

### Credit Note — Aggregate Root (`CreditNoteID`)

- **Definition:** A Credit Note represents one approved reduction to an Invoice obligation.
- **State:** Approved quantity and remaining available credit.
- **Behavior:**
  - `Apply Credit` — Credit Note applies available credit to an Invoice reference, producing reduced available credit.
