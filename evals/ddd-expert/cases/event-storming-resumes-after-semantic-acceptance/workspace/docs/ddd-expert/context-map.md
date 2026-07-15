# Context Map

## Global View

Arrow direction: `U -> D` (Upstream model/published-contract influence -> Downstream model). It does not describe runtime call flow.

```mermaid
graph LR
    reservation["Reservation"]
```

## Bounded Contexts

### Reservation

- **Core responsibility:** Decide and record Reservation outcomes.
- **Business authority:** Reservation owns its lifecycle facts.

#### Local View

```text
+-------------+
| Reservation |
+-------------+
```
