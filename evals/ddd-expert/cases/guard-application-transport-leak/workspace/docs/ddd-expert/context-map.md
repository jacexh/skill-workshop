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

#### Local View

```text
+---------+   +-------+
| Payment |-->| Order |
+---------+   +-------+
```

#### Upstream Dependencies

##### Payment Captured Fact

- **Upstream:** Payment
- **Accepted meaning:** Order accepts that payment capture succeeded.
- **Local translation:** Order translates the fact into its Record Payment intent.

### Payment

- **Core responsibility:** Settle payments.
- **Business authority:** Payment capture facts.

#### Local View

```text
+---------+   +-------+
| Payment |-->| Order |
+---------+   +-------+
```

#### Downstream Contracts

##### Payment Captured Fact

- **Downstream:** Order
- **Published meaning:** Payment publishes its authoritative captured fact.
- **Guarantee:** Payment owns capture meaning and publication.
