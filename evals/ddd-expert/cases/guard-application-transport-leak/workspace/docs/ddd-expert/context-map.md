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

- **Core responsibility:** Own order fulfillment.
- **Business authority:** Order state and fulfillment decisions.
- **Model:** [Order](context/order/model.md)

#### Local View

```text
+---------+   +-------+
| Payment |-->| Order |
+---------+   +-------+
```

### Payment

- **Core responsibility:** Settle payments.
- **Business authority:** Payment capture facts.
- **Model:** [Payment](context/payment/model.md)

## Model Dependency Contracts

### Payment Captured Fact

- **Upstream:** Payment
- **Downstream:** Order
- **Published meaning:** Payment publishes its authoritative captured fact.
- **Downstream reliance:** Order relies on successful payment capture.
- **Local translation:** Order translates the fact into its Record Payment intent.
- **Guarantee:** Payment owns capture meaning and publication.
