# <Bounded Context> Domain Objects

<!--
Use only accepted current descriptions. Identity belongs in the object heading when meaningful.

Definition explains what the object represents; include an essential operating characteristic only when it changes that meaning.
Facts are owned business facts needed by a Behavior or Invariant, not a field inventory.
Lifecycle State names the state-machine states and their Domain meaning, or says "No explicit Lifecycle State". Qualify an otherwise generic State as <Object>.State.
Behavior uses the owning Root, Entity, or Domain Service as Subject and names its Domain target. Include composition only when a Root composes an Entity-owned Behavior; include a transition only when it changes Lifecycle State.
Name material Value Objects and identity references within the fields they explain. Keep descriptions to this schema.

Include Domain-owned Ports only for direct Behavior invocations. Each Port-suffixed contract groups Methods naming the invoking Behavior, decision point, and Domain result; exact signatures and technical fulfillment belong to implementation.
Include Domain Events only when selected by Tactical Design. Link each to its recording Behavior and add one Consumed by line per accepted local Event Handler and Domain intent. Keep event selection reasons and Workshop Events in the conversation.
Omit inapplicable Port/Event sections and the Entity example when the Root has no child Entity.

Group Roots and their owned Entities by Aggregate. Record accepted Domain Services once under the optional context-level Domain Services heading, alongside the Aggregate sections. Each Service has a Definition and Behavior naming its material Domain inputs, decision or result, and collaborating objects or public Aggregate behaviors where needed. It has no Entity identity or owned lifecycle to fill in. Use the same optional Port/Event sections for its own direct invocations or recorded events. Omit the Domain Services section when none is accepted.
-->

## <Aggregate Root>

### <Root Name> — Aggregate Root (`<RootID>`)

- **Definition:** <What this object represents in the domain; include an essential way it operates only when that changes its meaning.>
- **Facts:**
  - `<Fact name>` — <Business-significant fact owned by this object and required by a Behavior or Invariant.>
- **Lifecycle State:**
  - `<State name>` — <State-machine meaning; write `No explicit Lifecycle State` when none exists.>
- **Behavior:**
  - `<Domain verb phrase>` — <Root> <domain verb> <Object>[ by composing `<Entity>.<Behavior>`][, transitioning <Lifecycle State name> from <before> to <after>].
- **Domain-owned Ports:**
  - `<Domain role>Port`
    - `<Method name>` — `<Domain behavior name>` invokes it at <business decision point> to obtain <Domain result>.
- **Domain Events:**
  - `<Event name>` — recorded by `<Producing Domain behavior name>`.
    - **Consumed by:** `<Event Handler>` — <Domain intent>.

### <Entity Name> — Entity (`<EntityID>`)

- **Definition:** <What this Entity represents inside the Aggregate; include an essential way it operates only when that changes its meaning.>
- **Facts:**
  - `<Fact name>` — <Business-significant fact owned by this Entity and required by a Behavior or Invariant.>
- **Lifecycle State:**
  - `<State name>` — <State-machine meaning; write `No explicit Lifecycle State` when none exists.>
- **Behavior:**
  - `<Domain verb phrase>` — <Subject> <domain verb> <Object>[, transitioning <Lifecycle State name> from <before> to <after>].
- **Domain-owned Ports:**
  - `<Domain role>Port`
    - `<Method name>` — `<Domain behavior name>` invokes it at <business decision point> to obtain <Domain result>.
- **Domain Events:**
  - `<Event name>` — recorded by `<Producing Domain behavior name>`.
    - **Consumed by:** `<Event Handler>` — <Domain intent>.

## Domain Services

### <Service Name> — Domain Service

- **Definition:** <Named Domain responsibility with no natural Entity or Value Object owner.>
- **Behavior:**
  - `<Domain verb phrase>` — <Service> <domain verb> <Domain target>; <material Domain inputs, decision or result, and collaboration where needed>.
