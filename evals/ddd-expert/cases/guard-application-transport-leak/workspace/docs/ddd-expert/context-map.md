# Context Map

## Bounded Contexts

### Order

- **Core responsibility:** Own order fulfillment.
- **Business authority:** Order state and fulfillment decisions.

### Payment

- **Core responsibility:** Settle payments.
- **Business authority:** Payment capture facts.

## Relationships

### Payment -> Order

- **Relationship:** Published Language
- **Authority boundary:** Payment owns `PaymentCaptured`; Order owns its fulfillment reaction.
- **Translation boundary:** Order translates the published fact into its local `RecordPayment` use case.
