---
context: Reservation
based_on_model_revision: 1
design_status: evolving
---

# Reservation Tactical Design

## Model Realization

| Accepted Model Obligation | Tactical Owner or Mechanism | Defined In |
|---|---|---|
| Positive quantity within accepted capacity | Reservation | Aggregate Designs |

## Aggregate Designs

### Reservation

Reservation is the Aggregate Root. It owns Reservation Item as a Value Object
without an independent identity. Reservation Item equality uses resource
identity and positive quantity, and quantity remains within accepted capacity.
