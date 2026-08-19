# <Bounded Context> Domain Objects

## <Aggregate Root>

### <Root Name> — Aggregate Root (`<RootID>`)

- **Definition:** <What this object represents in the domain.>
- **State:** <Meaningful state or status owned by this object.>
- **Behavior:**
  - `<Behavior name>` — <Subject> <acts on object>, producing <result>.
- **Domain Events:**
  - `<Event name>` — <Object> emits or consumes <actual domain fact>, producing <required domain reaction or durable evidence>.

### <Entity Name> — Entity (`<EntityID>`)

- **Definition:** <What this Entity represents inside the Aggregate.>
- **State:** <Meaningful state or status owned by this Entity.>
- **Behavior:**
  - `<Behavior name>` — <Subject> <acts on object>, producing <result>.
- **Domain Events:**
  - `<Event name>` — <Entity> emits or consumes <actual domain fact>, producing <required domain reaction or durable evidence>.
