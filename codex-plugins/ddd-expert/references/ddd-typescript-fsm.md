---
name: ddd-typescript-fsm
description: TypeScript House Style for an accepted XState Domain lifecycle.
---

# TypeScript Domain FSM

## Applies When

Load this leaf only when Tactical Design or project authority already selected
an FSM for a TypeScript Domain lifecycle.

## Canonical Shape

Use XState 5 `setup()` inside Domain. Define typed context, events, guards, and
actions with Domain names. The Aggregate owns the machine state and exposes
business methods; Application and Transport call those methods rather than
sending raw machine events.

Guards and actions are deterministic and I/O-free. Persist the accepted
business state value and Domain data, then reconstitute the machine through a
Domain factory. Opaque interpreter snapshots and provider/runtime metadata stay
outside persistence contracts.

A business method resolves the current state with
`machine.resolveState({ value })`, computes the next state with the pure
`transition()` function, raises a stable Domain error when the state is
unchanged, and only then assigns state. The Aggregate starts no actor.

## Verification

Run the real XState machine through Aggregate methods. Cover accepted edges,
guards, rejected actions, reconstitution, and the persisted business-state
representation. Type-level exhaustiveness complements runtime transition tests.
