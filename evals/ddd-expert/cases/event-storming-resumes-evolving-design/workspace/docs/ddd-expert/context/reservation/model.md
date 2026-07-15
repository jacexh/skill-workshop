---
context: Reservation
model_revision: 1
model_status: shape_ready
---

# Reservation Domain Model

## Ubiquitous Language

A Reservation is one customer's time-limited claim on one resource. A
Reservation Item identifies the resource and positive quantity claimed within
that Reservation. A hold deadline limits the customer's right to confirm.

## Authority and Ownership

Reservation owns claim eligibility, capacity admission, confirmation, release,
expiry, and their effects on the customer's confirmation right and resource
availability.

## Scenarios and Lifecycle

An eligible Customer asks a Reservation Agent to `Request Reservation` for an
available positive quantity. The request establishes Reservation Requested. If
the quantity remains available and within capacity, the Reservation Agent may
`Accept Capacity`, establishing Reservation Held. That fact makes the accepted
quantity unavailable to other customers and gives the requesting Customer the
exclusive right to confirm until the hold deadline.

While the Reservation is Held and before its deadline, the Customer may
`Confirm Reservation`, establishing Reservation Confirmed. Confirmation commits
the claim for that Customer and keeps the quantity unavailable to others.

While the Reservation is Held, the Customer may cancel it by asking to
`Release Reservation`, establishing Reservation Released. When the hold
deadline passes first, the deadline triggers `Expire Reservation`, establishing
Reservation Expired. Released and Expired each close the claim, return its
quantity to availability, and end the Customer's right to confirm.

## Invariants and Policies

Only Requested may become Held, and only Held may become Confirmed, Released,
or Expired. Confirmed, Released, and Expired are terminal and mutually
exclusive. A held quantity is positive and may not exceed accepted capacity.
The same Reservation identity cannot establish two terminal outcomes.

## Failure and Recovery Semantics

Repeating an intent with the same Reservation identity returns the established
fact. When terminal intents compete, only the first admissible outcome is
established; later intents observe it and cannot change the outcome.
