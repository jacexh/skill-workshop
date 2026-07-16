# Context Map

## Global View

Arrow direction: `U -> D` (Upstream model/published-contract influence -> Downstream model). It does not describe runtime call flow.

```mermaid
graph LR
    order["Order"]
    payment["Payment"]

    payment --> order
```


## Bounded Contexts

### Order

- **Core responsibility:** Own the order lifecycle.
- **Business authority:** Order state and fulfillment decisions.
- **Model:** [Order](context/order/model.md)

#### Local View

```text
+---------+   +-------+
| Payment |-->| Order |
+---------+   +-------+
```

### Payment

- **Core responsibility:** Own payment settlement.
- **Business authority:** Payment attempt and settlement state.
- **Model:** [Payment](context/payment/model.md)

## Model Dependency Contracts

### Payment Succeeded Fact

- **Upstream:** Payment
- **Downstream:** Order
- **Published meaning:** Payment publishes its authoritative settlement outcome.
- **Downstream reliance:** Order relies on the authoritative settlement outcome.
- **Local translation:** Order translates it into its own fulfillment decision.
- **Guarantee:** Payment owns settlement meaning and publication.
