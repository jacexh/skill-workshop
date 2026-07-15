---
context: Reservation
model_revision: 1
model_status: evolving
---

# Reservation Domain Model

## Ubiquitous Language

A Reservation is one customer's time-limited claim on one resource. A
Reservation Item identifies the resource and quantity claimed within that
Reservation. A hold deadline limits how long a held claim remains open.

## Authority and Ownership

Reservation owns claim eligibility, confirmation, release, and the outcome of
reaching its hold deadline.

## Scenarios and Lifecycle

An eligible customer's request establishes Reservation Requested. A
Reservation Agent may accept available capacity for that request, establishing
Reservation Held. Held capacity is unavailable to other customers and gives the
requesting customer the right to confirm until the hold deadline.

Before the deadline, the customer may confirm a held Reservation, establishing
Reservation Confirmed and committing the claim, or cancel it, establishing
Reservation Released, returning its quantity to availability, and ending the
right to confirm. Confirmed and Released are terminal.

## Invariants and Policies

A held quantity is positive and may not exceed the capacity accepted for the
identified resource. Only a held Reservation may be confirmed or released. The
same Reservation identity cannot establish two terminal outcomes.

## Failure and Recovery Semantics

Repeating an intent with the same Reservation identity returns the established
fact. Concurrent terminal intents permit only the first admissible outcome.
