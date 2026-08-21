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

```ts
import { setup, transition } from "xstate";

type OrderStatus = "unpaid" | "paid";

const orderLifecycle = setup({
  types: {
    events: {} as { type: "pay"; amount: number },
  },
  guards: {
    positiveAmount: ({ event }) => event.amount > 0,
  },
}).createMachine({
  initial: "unpaid",
  states: {
    unpaid: {
      on: {
        pay: { target: "paid", guard: "positiveAmount" },
      },
    },
    paid: {},
  },
});

export class Order {
  constructor(
    private status: OrderStatus,
    private paidAmount = 0,
  ) {}

  pay(amount: number): void {
    const current = orderLifecycle.resolveState({ value: this.status });
    const [next] = transition(orderLifecycle, current, { type: "pay", amount });
    if (next.value === current.value || !next.matches("paid")) {
      throw new InvalidOrderTransitionError();
    }
    this.status = "paid";
    this.paidAmount = amount;
  }
}
```

## Verification

Run the real XState machine through Aggregate methods. Cover accepted edges,
guards, rejected actions, reconstitution, and the persisted business-state
representation. Type-level exhaustiveness complements runtime transition tests.
