---
context: Reservation
model_revision: 1
model_status: shape_ready
---

# Reservation Domain Model

## Ubiquitous Language

A Reservation is one customer's time-limited claim on one resource. A
Reservation Item is the resource identity and positive quantity claimed within
that Reservation. It has no independent identity or lifecycle, and two Items
are equal when both Domain values are equal. A hold deadline limits the
customer's right to confirm.

## Authority and Ownership

Reservation owns claim eligibility, capacity admission, confirmation, release,
expiry, and their effects on the customer's confirmation right and resource
availability.

## Scenarios and Lifecycle

An eligible Customer asks a Reservation Agent to `Request Reservation` for an
available positive quantity, establishing Reservation Requested. If the
quantity remains available and within capacity, the Reservation Agent may
`Accept Capacity`, establishing Reservation Held. Held makes that quantity
unavailable to other customers and gives the requesting Customer the exclusive
right to confirm until the hold deadline.

While Held and before the deadline, the Customer may `Confirm Reservation`,
establishing Reservation Confirmed. Confirmation commits the claim and keeps
the quantity unavailable. The Customer may instead `Release Reservation`,
establishing Reservation Released. Released closes the claim, returns the
quantity to availability, and ends the right to confirm.

If the deadline arrives first, the trusted Clock triggers `Expire Reservation`.
Reservation accepts that intent only while Held and establishes Reservation
Expired. Expired closes the claim, returns the quantity to availability, and
ends the right to confirm.

## Invariants and Policies

Only Requested may become Held, and only Held may become Confirmed, Released,
or Expired. Confirmed, Released, and Expired are terminal and mutually
exclusive. A held quantity is positive and may not exceed accepted capacity.
The same Reservation identity cannot establish two terminal outcomes.

## Failure and Recovery Semantics

Repeating an intent with the same Reservation identity returns the established
fact. When terminal intents compete, only the first admissible outcome is
established; later intents observe it and cannot change the outcome.
