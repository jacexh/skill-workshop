# Order Model

## Purpose

Order owns customer Orders.

## Essential Language

- **Order:** One accepted customer commitment.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Order | Owns one customer commitment. | Identity and valid business name change together. |

## Business Rules

- An Order has a non-empty business name.
