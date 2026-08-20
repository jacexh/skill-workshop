# <Bounded Context> Domain Objects

## <Aggregate Root>

### <Root Name> — Aggregate Root (`<RootID>`)

- **Definition:** <What this object represents in the domain; include an essential way it operates only when that changes its meaning.>
- **Facts:**
  - `<Fact name>` — <Business-significant fact owned by this object and required by a Behavior or Invariant.>
- **Lifecycle State:**
  - `<State name>` — <State-machine meaning; write `No explicit Lifecycle State` when none exists.>
- **Behavior:**
  - `<Domain verb phrase>` — <Root> <domain verb> <Object>[ by composing `<Entity>.<Behavior>`][, transitioning <Lifecycle State name> from <before> to <after>].
- **Domain Events:**
  - `<Event name>` — recorded by `<Domain behavior name>`.

### <Entity Name> — Entity (`<EntityID>`)

- **Definition:** <What this Entity represents inside the Aggregate; include an essential way it operates only when that changes its meaning.>
- **Facts:**
  - `<Fact name>` — <Business-significant fact owned by this Entity and required by a Behavior or Invariant.>
- **Lifecycle State:**
  - `<State name>` — <State-machine meaning; write `No explicit Lifecycle State` when none exists.>
- **Behavior:**
  - `<Domain verb phrase>` — <Subject> <domain verb> <Object>[, transitioning <Lifecycle State name> from <before> to <after>].
- **Domain Events:**
  - `<Event name>` — recorded by `<Domain behavior name>`.
