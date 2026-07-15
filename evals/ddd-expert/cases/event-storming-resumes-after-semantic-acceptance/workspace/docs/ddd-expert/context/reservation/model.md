---
context: Reservation
model_revision: 1
model_status: shape_ready
---

# Reservation Domain Model

## Ubiquitous Language

A Reservation is an identified commitment to hold one positive quantity of a
resource for one Reservation Holder.

## Authority and Ownership

Reservation owns its admission, confirmation, and terminal outcomes.

## Scenarios and Lifecycle

An eligible Reservation Holder asks a Reservation Agent to `Request
Reservation`, establishing Reservation Requested. If the quantity remains
available and within accepted capacity, the Agent may `Accept Capacity`,
establishing Reservation Held. Held makes that quantity unavailable to other
holders and gives this Holder the right to confirm.

While Held, the Reservation Holder may `Confirm Reservation`, establishing
Reservation Confirmed. Confirmed commits the claim for that Holder, keeps its
quantity unavailable, and is terminal.

## Invariants and Policies

Only Requested may become Held, and only Held may become Confirmed. The held
quantity is positive and does not exceed accepted capacity. One Reservation
identity establishes at most one terminal outcome.

## Failure and Recovery Semantics

Repeating an intent for the same Reservation identity returns the established
fact. Concurrent terminal intents permit only the first admissible outcome.
