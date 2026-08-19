# Order Model

## Purpose

Order owns order acceptance and fulfillment.

## Essential Language

- **Order:** One accepted customer commitment.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Order | Owns one customer commitment. | Acceptance and fulfillment eligibility change together. |

## Business Rules

- Only accepted Orders may enter fulfillment.
