# ADR 0016: Remove Subdomain Classification

- Status: Accepted
- Date: 2026-11-08
- Amends: the Subdomain classification and Subdomain-scaled Tactical Design in [ADR 0013](0013-subdomain-scaled-design-and-assumption-sweep.md); the assumption sweep stays

## Context

ADR 0013 made EventStorming classify every Bounded Context as Core,
Supporting, or Generic, and let a Generic context skip Tactical Design. In use,
the classification was decided by the agent without a user discussion, and it
changed no design for the projects that follow this plugin's House Style. A
context that needs no object decisions already skips Tactical Design through
the step-order entry condition, so the classification added a concept without
adding a decision.

## Decision

- EventStorming no longer asks the Differentiation probe and writes no
  `Subdomain` section; the Model template drops it.
- Tactical Design no longer scales by Subdomain. Its entry condition in the
  workflow contract is enough: it runs when Aggregate internals or
  domain-object behavior still need a decision.
- Existing `Subdomain` sections in projects are inert. EventStorming removes
  one when it next writes that `model.md`.

## Consequences

- The strategic model has one concept fewer, and every context reaches
  Tactical Design by the same condition.
- A commodity context still avoids design cost when it has no object decision
  to make.
