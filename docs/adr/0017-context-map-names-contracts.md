# ADR 0017: The Context Map Names Contracts

- Status: Accepted
- Date: 2026-11-08
- Refines: the Context Map content in [ADR 0009](0009-sparse-current-ddd-artifacts.md) and the writing contract in [ADR 0011](0011-ddd-artifact-writing-contract.md)

## Context

The Context Map template asked for "named meaning owned by upstream" and "how
downstream interprets or relies on it" without a size or a shape. In a large
project the map grew to about 28,000 characters over 25 dependencies. One row
held 8 contracts with their operations, and its Downstream use cell held 19
sentences, many of them the downstream's own Business Rules that `model.md`
already holds. Contract kinds were not visible in their names, so a reader, or
the architecture view renderer, could not tell a Published Fact Contract from
a query.

## Decision

- **Published contract** lists each contract as `**<Name> Contract:**` with
  one sentence of meaning. A Published Fact Contract name ends in `Published
  Fact Contract`, and an Asynchronous Intent Contract name ends in `Intent
  Contract`. A surface with commands and queries is two entries. Operations,
  fields, failures, and timing live in the upstream's contract source and
  Business Rules.
- **Downstream use** is one sentence of reliance, followed by `; Policy`
  references. The downstream's Business Rules stay in its `model.md`.
- **Purpose** is one sentence.
- The Context Map validator enforces the shape: bold entries ending in
  `Contract`, and one sentence of at most 25 words per contract meaning,
  reliance, and purpose, as the artifact writing contract already requires.
- A map written before this rule fails the validator, and EventStorming slims
  it in its next write. A detail with no other home becomes a proposed
  Business Rule of its owning context and needs confirmation before it leaves
  the map.

## Consequences

- The map stays a navigation index: which contexts depend on which contracts,
  and where each meaning lives.
- Existing large maps need one slimming pass, done together with the next
  strategic change.
