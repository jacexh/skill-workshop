# ADR 0013: Subdomain-Scaled Tactical Design and the EventStorming Assumption Sweep

- Status: Accepted
- Date: 2026-11-05
- Amends: the Model contents and the EventStorming-to-Tactical-Design handoff in [ADR 0009](0009-sparse-current-ddd-artifacts.md)
- Amended by: [ADR 0016](0016-remove-subdomain-classification.md) (Subdomain classification removed)
- Amended by: [ADR 0015](0015-architecture-design-closed-contract-catalog.md) (`architecture.md` cites the read needs and delivery constraints it realizes)
- Builds on: [ADR 0011](0011-ddd-artifact-writing-contract.md) for artifact wording and [ADR 0012](0012-eventstorming-records-policies.md) for failure outcomes of required next intents

## Context

ADR 0009 keeps artifacts to what EventStorming and Tactical Design can decide
cheaply and Codify cannot reinterpret. Two gaps remain after ADR 0012 records
Policies and Process Aggregate Roots:

- **How much design a context deserves.** Tactical Design gives every context
  the same pressure-led interview. The plugin has no Core / Supporting / Generic
  distinction, so a commodity context such as standard invoicing pays the same
  design cost as the context the business competes on.
- **Requirements that the model filters out.** EventStorming asks only
  questions that can change a Bounded Context, Aggregate Root, Business Rule,
  Policy, or semantic dependency. It writes every other point on the board as
  an assumption, and nothing revisits those assumptions. Read needs, acceptance
  scenarios, non-functional expectations, and compatibility then reach Codify
  as conservative guesses. ddd-expert relied on a separate requirements
  interview for this, so the plugin could not clarify requirements on its own.

## Decision

### Subdomain classification is strategic Model content

EventStorming classifies each accepted Bounded Context with a Differentiation
probe as Core, Supporting, or Generic. `model.md` gains one `Subdomain` section
holding the classification and its one-line business reason. The Context Map
and its validator are unchanged.

Tactical Design scales to the classification:

- Core and Supporting contexts receive the full interview.
- A Model without a classification is treated as Core or Supporting, so
  existing artifacts keep their current behavior.
- A Generic context goes to Codify by default. Codify realizes its Business
  Rules with the simplest representation, or an existing solution, that
  satisfies them. Tactical design runs there only when the user asks or when a
  Business Rule makes object ownership a material decision. Differentiating
  rules found that way trigger a reclassification as a strategic correction.

### An assumption sweep closes EventStorming

Before the integrated proposal, EventStorming revisits each board assumption.
It also checks four delivery dimensions where the scoped scenarios touch them:

- read needs before a Command;
- acceptance scenarios;
- volume, latency, audit, retention, or compliance expectations;
- existing data, APIs, or clients that must keep working.

Each question is asked one per turn, like every other EventStorming question.
Permissions are not a sweep dimension, because ADR 0012's Roles step already
records them as Business Rules.

The answers are routed as follows:

- An answer that changes business meaning becomes a Business Rule or reopens
  the affected step.
- Every other answer is a **delivery constraint**. It goes to the project's
  spec or issue when one exists; otherwise it stays in the conversation.
- Codify treats delivery constraints as accepted requirements. Satisfying each
  of them is part of Codify's completion bar.
- Delivery constraints never enter DDD artifacts.

The sweep is complete when every assumption and touched dimension has become a
Business Rule, a delivery constraint, or a non-blocking Hotspot.

### Hard-to-reverse choices get an ADR offer

The shared workflow contract records a design or implementation choice only
when three conditions hold: it is hard to reverse, it would surprise a future
reader, and it came from a real trade-off. When the project has no decision
mechanism, the skill offers to create an ADR under `docs/adr/`.

## Consequences

- Design effort concentrates where the business differentiates. Generic
  contexts go from EventStorming to Codify.
- ddd-expert can clarify requirements without a separate requirements
  interview. The DDD artifacts stay sparse, because delivery constraints live
  outside them.
- Model artifacts written before this decision remain valid. A missing
  Subdomain section is filled the next time EventStorming revises that context.
- Command-to-Behavior mapping is still not persisted. Persisting it would push
  toward the Application-design artifact that ADR 0009 removed.
