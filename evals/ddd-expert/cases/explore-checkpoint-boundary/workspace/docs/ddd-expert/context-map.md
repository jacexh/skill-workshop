# Context Map

## Global View

Arrow direction: `U -> D` (Upstream -> Downstream).

```mermaid
graph LR
    payment["Payment"]
    order["Order"]
```

## Bounded Contexts

### Payment

- **Core responsibility:** Own payment processing and its business outcomes.
- **Business authority:** Payment lifecycle and payment outcome facts.

### Order

- **Core responsibility:** Own customer orders and fulfillment readiness.
- **Business authority:** Order lifecycle and the decision to begin fulfillment.
