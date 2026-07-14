# Context Map

## Global View

Arrow direction: `U -> D` (Upstream model/published-contract influence -> Downstream model). It does not describe runtime call flow.

```mermaid
graph LR
    fulfillment["Fulfillment"]
```

## Bounded Contexts

### Fulfillment

- **Core responsibility:** Decide resource allocation outcomes for fulfillment requests.
- **Business authority:** Fulfillment order identity, allocation-line identity, eligibility, and outcome.

#### Local View

- No context dependencies.
