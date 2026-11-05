# ADR 0014: Architecture Design Records a Per-Context Architecture Wireframe

- Status: Accepted
- Date: 2026-11-05
- Amends: the "no diagrams and no separate software-architecture artifact" decision in [ADR 0009](0009-sparse-current-ddd-artifacts.md), and the business-meaning-only scope of [ADR 0011](0011-ddd-artifact-writing-contract.md)
- Issue: [#197](https://github.com/jacexh/skill-workshop/issues/197)

## Context

Tactical Design settles Domain ownership. Codify then decides the outer
structure (Application, Repository, adapters, and technical mechanisms) while
it writes code. House Style rules exist, but no step makes a model decide that
structure before coding, and no artifact holds the decision. Different models
add extra objects and reorder Application coordination for the same change. A
typical case is a cache for high concurrency: the cache belongs behind a
Repository adapter, but models place it elsewhere.

ADR 0007 tried to record BC architecture, sequences, and claims. ADR 0009
removed them, for three reasons:

- the persisted records cost more than they returned;
- participants and sequences competed with behavior ownership;
- Codify could reshape the design while it coded.

## Decision

### A new skill and one artifact per context

`architecture-design` runs after Tactical Design, or after EventStorming for a
Generic context. It is not a gate: Codify proceeds without a drawing.

The skill writes `docs/ddd-expert/context/<slug>/architecture.html`. This file
is a copy of a fixed template whose renderer draws an embedded JSON data block,
and agents edit only that block. It is the only diagram among the DDD
artifacts. It records software structure, so the ADR 0011 rule "each field
records business meaning" now applies only to the Markdown artifacts.

### Content

The drawing has four layers inside the context boundary: Transport,
Application, Domain, and Infrastructure. It has thirteen component kinds,
listed in `artifact-layout.md`.

- Transport holds asynchronous entries only: Integration Message subscribers
  and task processors. Each delegates once to the Application entry. Synchronous request and response APIs are part of the Application
  entry and are not drawn, because they add boxes without design decisions.
- Integration Messages show the context's collaboration surface. A consumed
  message sits in Transport above the subscriber that receives it. A sent
  message sits outside the boundary, below the adapter that sends it, so the
  data other contexts consume stays visible. Each message names its contract
  type and counterpart, and the drawing derives whose contract it is: this
  context owns the Published Fact Contracts it sends and the Asynchronous
  Intent Contracts it receives.
- A task is an Internal Task Contract the context queues for itself, as the
  task queue leaves define it. The context's one task enqueue port and its
  queue adapter form a seam column, each task processor heads that column,
  and each task names the component that enqueues it or its schedule.
- The Domain layer carries names only, and `domain-objects.md` stays the home
  of their meaning. A validator cross-checks Root, Domain Service,
  Domain-owned Port, and Domain Event names against it.
- Each Domain Event sits inside the Root or Domain Service that records it.
- Each contract has at least one outbound adapter beneath it, and every
  adapter implements a contract.
- Each technical mechanism sits on its seam (the Application entry, an inbound
  adapter, or an adapter) and names the delivery constraint or Policy it
  serves.
- The relation type of each edge is derived from the component kinds, so edges
  carry no labels. Dependency lines appear on hover or on request; contract,
  message, and task lines stay visible.

The drawing deliberately leaves out callers, external systems and other
contexts as boxes, use-case or Command mapping, and sequences. Other contexts
appear only as message counterparts, and providers appear in component notes.

Terms follow the industry consensus and the References:

- an `event-handler` realizes a Policy that reacts to a same-context Domain
  Event;
- an `adapter` is an outbound adapter, the Ports and Adapters counterpart of a
  Port.

`ddd-core.md` now uses "adapter" for these Infrastructure components.

### Process: design review, not interview

The skill works in five steps:

1. Derive the complete design from accepted artifacts, House Style, delivery
   constraints, and existing code.
2. Ask only for missing facts that would change a component, dependency, or
   mechanism, one per turn.
3. Self-check the design, then render a draft.
4. List the decisions that are not derived and the assumptions. The user
   challenges the draft, the skill revises it, and the user confirms before
   the write.
5. In a recording branch, add the components and mechanisms that Codify reported.

### Binding

The drawn components, dependencies, and mechanism seams are core design.

- Codify keeps the core design. Detail inside a component is Codify latitude.
- Codify reports components and mechanisms it adds beyond the drawing, next to
  the Domain concepts it introduces.
- A change that must remove, move, or rewire core design is a ⚠️ Conflict.
- Guard reports a violation of core design, and an added component or mechanism
  that Codify did not report.

## Why this differs from ADR 0007

- Ownership is already settled in `domain-objects.md` before this skill runs.
  The drawing derives from that ownership, so it cannot compete with it.
- The artifact holds only the current design. It has no status, lifecycle,
  claims, or reconciliation, and it has no sequences.
- Codify treats the drawing as read-only. Additions return through Architecture
  Design.
- A validator checks the structure mechanically, so a reviewer does not have to
  read it line by line.

## Consequences

- Outer structure becomes a reviewed decision with fewer free choices. Kinds,
  layout, and edge styles are fixed, so different models produce comparable
  drawings.
- The `declare-ownership` line names Architecture Design as a writer.
  Repositories that already declared the old line keep it, because the skill
  does not rewrite an existing mention. Users can update the line by hand.
- The template renderer is copied into each project. A later renderer change
  reaches a project only when Architecture Design rewrites that file.
- Large contexts scroll horizontally, because each layer renders as one row.
