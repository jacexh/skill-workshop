---
context: Fulfillment
model_revision: 1
---

# Fulfillment Domain Model

## Ubiquitous Language

A Fulfillment Order groups the resource allocations requested together. An
Allocation Line is one resource allocation request and retains its Line identity
through allocation or rejection.

## Authority and Ownership

Fulfillment owns Fulfillment Order and Allocation Line identity, eligibility,
and outcome. An Allocation Line belongs to one Fulfillment Order.

## Scenarios and Lifecycle

Adding an eligible line establishes Allocation Line Added and Pending. A Pending
line may establish Allocation Accepted or Allocation Rejected. Accepted and
Rejected are terminal outcomes for that Line identity.

## Invariants and Policies

Line identity is unique within one Fulfillment Order. Requested Quantity is
positive. One Line identity cannot establish both terminal outcomes.

## Failure and Recovery Semantics

Repeating an intent for the same Line identity returns the established fact.
Concurrent terminal intents permit only the first admissible outcome.
