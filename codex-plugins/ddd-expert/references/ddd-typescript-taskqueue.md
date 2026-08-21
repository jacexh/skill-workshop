---
name: ddd-typescript-taskqueue
description: TypeScript House Style for accepted BullMQ task contracts, processors, schedulers, and Runtime wiring.
---

# TypeScript Task Queue

## Applies When

Load this leaf only when the accepted implementation contains distributed
deferred, background, rate-limited, or scheduled work implemented with BullMQ.

## Placement and Contract

- Application owns a provider-neutral versioned task name, readonly payload,
  and semantic enqueue port under `application/tasks/`.
- Infrastructure maps that contract to BullMQ Queue options.
- Transport decodes one `Job<unknown>` and delegates to one Application command.
- Platform/Runtime owns Queue, Worker, QueueEvents, Redis, concurrency,
  attempts/backoff, Job Schedulers, registration, and lifecycle.

Payloads contain stable identifiers and the minimum immutable facts needed by
the command. Business idempotency remains in accepted Domain/Application
behavior; provider job identity and bounded deduplication remain delivery
settings.

```ts
export type SendWelcomeTask = Readonly<{ userId: string }>;

export interface TaskEnqueuer {
  enqueue(task: SendWelcomeTask): Promise<void>;
}

export class SendWelcomeProcessor {
  constructor(private readonly sendWelcome: SendWelcomeHandler) {}

  async execute(task: SendWelcomeTask): Promise<void> {
    await this.sendWelcome.execute({ userId: task.userId });
  }
}
```

Infrastructure maps `SendWelcomeTask` to BullMQ job data. Transport decodes
`Job<unknown>.data` into this local value before calling the processor.

## Scheduling Shape

Accepted periodic work uses BullMQ 5 `upsertJobScheduler` to enqueue an ordinary
task contract. The scheduled callback contains no Domain behavior or Repository
access. Resolve current time, tenants, and due records inside the Application
use case.

Accepted business waiting creates one bounded delayed follow-up task and
completes the current execution. Runtime configuration owns provider attempt,
timeout, lane, concurrency, and terminal visibility.

## Verification

Test task construction and processor delegation with typed values. Use a real
Redis/BullMQ boundary when registration, serialization, routing, scheduling,
provider attempts, concurrency, or worker shutdown changes.
