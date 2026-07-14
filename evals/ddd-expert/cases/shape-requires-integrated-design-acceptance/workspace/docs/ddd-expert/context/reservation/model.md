---
context: Reservation
model_revision: 1
---

# Reservation Domain Model

## Ubiquitous Language

A Reservation is one customer's time-limited claim on one resource. A
Reservation Item identifies the resource and quantity claimed within that
Reservation.

## Authority and Ownership

Reservation owns claim eligibility, confirmation, release, and expiry.

## Scenarios and Lifecycle

An eligible request establishes Reservation Requested. Capacity acceptance
establishes Reservation Held. A held Reservation may establish Confirmed,
Released, or Expired. These outcomes are terminal.

## Invariants and Policies

A held quantity is positive and may not exceed the capacity accepted for the
identified resource. The same reservation identity cannot establish two
terminal outcomes.

## Failure and Recovery Semantics

Repeating an intent with the same Reservation identity returns the established
fact. Concurrent terminal intents permit only the first admissible outcome.
