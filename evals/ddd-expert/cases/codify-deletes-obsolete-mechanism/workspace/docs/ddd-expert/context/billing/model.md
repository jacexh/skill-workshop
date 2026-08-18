---
context: Billing
model_revision: 1
model_status: model_ready
last_changed_by: "../../event-storming/settle-invoice.md"
---

# Billing Domain Model

## Ubiquitous Language

An Invoice is unsettled until it accepts one positive payment. Settlement is the
business result; persistence is not a separate Invoice fact.

## Authority and Ownership

Billing owns Invoice settlement eligibility and settlement state.

## Aggregates and Core Objects

Invoice is the Aggregate Root. It owns its identity, current settlement state,
and the rule that only an unsettled Invoice accepts a positive payment.

## Aggregate Capabilities

| Aggregate | Capability | Source Command | Required facts | Result |
|---|---|---|---|---|
| Invoice | Settle Invoice | Settle Invoice | Invoice is unsettled and payment is positive | Invoice becomes settled |

## Lifecycle

An Invoice begins unsettled and becomes settled after accepting one payment.

## Invariants and Policies

An already settled Invoice or a non-positive payment is rejected without state
change.

## Hotspots

None.
