# <Bounded Context> Domain Objects

<!--
Use only accepted current descriptions. The object heading carries its identity and, when the business limits it, its uniqueness scope.
Write every field to artifact-layout.md "Artifact writing". Each rule lives with the owner of its decision, by artifact-layout.md "Business rule writing".

Definition explains what the object represents in one or two sentences; include an essential operating characteristic only when it changes that meaning.
Facts are owned business facts needed by a Behavior or Invariant, one sentence each, not a field inventory.
Lifecycle State lists each state-machine state by its bare name, such as `Free`, with its Domain meaning, or says "No explicit Lifecycle State".
Invariants are the named rules that hold across this object's Behaviors, one EARS sentence each. Omit the field when the object has none.
Behavior is one sentence that uses the owning Root, Entity, or Domain Service as Subject and names its Domain target. Each clause under it is one EARS sentence for a condition or outcome that only this Behavior owns. After "Rules:", cite by name each Invariant or shared Business Rule that also governs it. Name each Supplied Fact with its owning authority. Include composition only when a Root composes an Entity-owned Behavior; include a transition only when it changes Lifecycle State, and qualify an otherwise generic State as <Object>.State in that transition.
Name material Value Objects and identity references within the fields they explain. Keep descriptions to this schema.

Include Domain-owned Ports only for direct Behavior invocations. Each Port-suffixed contract groups Methods naming the invoking Behavior, decision point, and Domain result; exact signatures and technical fulfillment belong to implementation.
Include Domain Events only when selected by Tactical Design. Link each to its recording Behavior. Add one Consumed by line per same-context Policy in model.md that reacts to it, and name the Published Fact Contract it feeds, if any. Keep event selection reasons and Workshop Events in the conversation.
Omit inapplicable Port/Event sections and the Entity example when the Root has no child Entity.

Group Roots and their owned Entities by Aggregate. Record accepted Domain Services once under the optional context-level Domain Services heading, alongside the Aggregate sections. Each Service has a Definition and Behavior naming its material Domain inputs, decision or result, and collaborating objects or public Aggregate behaviors where needed. It has no Entity identity or owned lifecycle to fill in. Use the same optional Port/Event sections for its own direct invocations or recorded events. Omit the Domain Services section when none is accepted.
-->

## <Aggregate Root>

### <Root Name> — Aggregate Root (`<RootID>`[, unique per <scope>])

- **Definition:** <What this object represents in the domain; include an essential way it operates only when that changes its meaning.>
- **Facts:**
  - `<Fact name>` — <Business-significant fact owned by this object and required by a Behavior or Invariant.>
- **Lifecycle State:**
  - `<State name>` — <State-machine meaning; write `No explicit Lifecycle State` when none exists.>
- **Invariants:**
  - `<Invariant name>` — <One EARS sentence that holds across this object's Behaviors.>
- **Behavior:**
  - `<Domain verb phrase>` — <Root> <domain verb> <Object>[ by composing `<Entity>.<Behavior>`][, using supplied `<Fact>` from <authority>][, transitioning <Lifecycle State name> from <before> to <after>].[ Rules: `<Rule name>`[, `<Rule name>`].]
    - <Clause: one EARS sentence for a condition under which this Behavior accepts or rejects, or for an outcome it establishes.>
- **Domain-owned Ports:**
  - `<Domain role>Port`
    - `<Method name>` — `<Domain behavior name>` invokes it at <business decision point> to obtain <Domain result>.
- **Domain Events:**
  - `<Event name>` — recorded by `<Producing Domain behavior name>`[; published as `<Published Fact Contract>`].
    - **Consumed by:** Policy `<Policy name>`.

### <Entity Name> — Entity (`<EntityID>`[, unique per <scope>])

- **Definition:** <What this Entity represents inside the Aggregate; include an essential way it operates only when that changes its meaning.>
- **Facts:**
  - `<Fact name>` — <Business-significant fact owned by this Entity and required by a Behavior or Invariant.>
- **Lifecycle State:**
  - `<State name>` — <State-machine meaning; write `No explicit Lifecycle State` when none exists.>
- **Invariants:**
  - `<Invariant name>` — <One EARS sentence that holds across this object's Behaviors.>
- **Behavior:**
  - `<Domain verb phrase>` — <Subject> <domain verb> <Object>[, using supplied `<Fact>` from <authority>][, transitioning <Lifecycle State name> from <before> to <after>].[ Rules: `<Rule name>`[, `<Rule name>`].]
    - <Clause: one EARS sentence for a condition under which this Behavior accepts or rejects, or for an outcome it establishes.>
- **Domain-owned Ports:**
  - `<Domain role>Port`
    - `<Method name>` — `<Domain behavior name>` invokes it at <business decision point> to obtain <Domain result>.
- **Domain Events:**
  - `<Event name>` — recorded by `<Producing Domain behavior name>`[; published as `<Published Fact Contract>`].
    - **Consumed by:** Policy `<Policy name>`.

## Domain Services

### <Service Name> — Domain Service

- **Definition:** <Named Domain responsibility with no natural Entity or Value Object owner.>
- **Behavior:**
  - `<Domain verb phrase>` — <Service> <domain verb> <Domain target>; <material Domain inputs, decision or result, and collaboration where needed>.[ Rules: `<Rule name>`[, `<Rule name>`].]
    - <Clause: one EARS sentence for a condition under which this Behavior accepts or rejects, or for an outcome it establishes.>
