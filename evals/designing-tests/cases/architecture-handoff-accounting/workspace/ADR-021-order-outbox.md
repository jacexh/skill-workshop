# ADR-021: Atomic order acceptance

## Goals

- G1: The Order Service is the authoritative writer for accepted order state.
- G2: Accepted order state and its outbox message commit atomically.
- G3: Consumers remain compatible with the current and previous event schema
  during rolling deployment.
- G4: An operator can identify and replay a failed delivery.

## Decision

The API calls the Order Service. The service writes `orders` and `outbox_events`
in PostgreSQL in one transaction. A relay publishes `OrderAccepted` to the
broker. Consumers update their projections idempotently.
