---
context: Reservation
model_revision: 1
model_status: shape_ready
---

# Reservation Domain Model

## Ubiquitous Language

A Reservation is one customer's time-limited claim on one resource. A
Reservation Item is the resource identity and positive quantity claimed within
that Reservation. It has no independent identity or lifecycle, and equality is
by those Domain values. A hold deadline limits the customer's right to confirm.

## Authority and Ownership

Reservation owns claim eligibility, capacity admission, confirmation, release,
expiry, and their effects on the customer's confirmation right and resource
availability.

## Scenarios and Lifecycle

An eligible Customer asks a Reservation Agent to `Request Reservation`,
establishing Reservation Requested. If the requested quantity remains available
and within capacity, the Agent may `Accept Capacity`, establishing Reservation
Held. Held makes the quantity unavailable to other customers and grants the
Customer the exclusive right to confirm until the hold deadline.

While Held and before that deadline, the Customer may `Confirm Reservation`,
establishing Reservation Confirmed and committing the claim, or `Release
Reservation`, establishing Reservation Released, returning the quantity to
availability, and ending the right to confirm. If the deadline arrives first,
the trusted Clock triggers `Expire Reservation`; Reservation establishes
Reservation Expired, returns the quantity to availability, and ends the right
to confirm.

## Invariants and Policies

Only Requested may become Held, and only Held may become Confirmed, Released,
or Expired. Confirmed, Released, and Expired are terminal and mutually
exclusive. A held quantity is positive and may not exceed accepted capacity.
The same Reservation identity cannot establish two terminal outcomes.

## Failure and Recovery Semantics

Repeating an intent with the same Reservation identity returns the established
fact. Concurrent terminal intents permit only the first admissible outcome;
later intents observe it and cannot change it.
