# Context Map

## Global View

Arrow direction: `U -> D` (Upstream model/published-contract influence -> Downstream model). It does not describe runtime call flow.

```mermaid
graph LR
    order["Order"]
```


## Bounded Contexts

### Order

- **Core responsibility:** Own the order lifecycle.
- **Business authority:** Order identity, name, and lifecycle state.

- **Model:** [Order](context/order/model.md)

#### Local View

```text
+-------+
| Order |
+-------+
```

## Model Dependency Contracts
