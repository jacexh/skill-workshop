---
name: ddd-typescript
description: Router and baseline for the TypeScript DDD House Style.
---

# TypeScript DDD House Style Router

## Applies When

Use this router after the accepted design selects TypeScript/Node.js. Read this
baseline, then load the smallest complete set of leaves covering the touched
code surfaces. Conditional leaves remain unloaded until their mechanism exists
in the accepted implementation.

## Baseline

```text
Transport -> Application -> Domain
Infrastructure -> Application and Domain contracts
Platform/Runtime -> composition, provider resources, listeners and workers
```

Business code is grouped by Bounded Context under `src/business/<context>`.
Technical shared resources live under `src/platform`; process composition lives
under `src/runtime`. Root `proto/`, `gen/`, and `migrations/` own contract
source, generated output, and ordered SQL respectively.

## Adopted Stack

| Concern | House Style | Applies when |
|---|---|---|
| Runtime | Node.js 24 LTS | Every governed service |
| Language/build | TypeScript 7.0 `tsc`, ESM, `NodeNext` | Every governed service |
| Package manager | pnpm 11 with committed `pnpm-lock.yaml` | Every governed service |
| Static analysis | ESLint flat config with typed `typescript-eslint` | Every governed service |
| Formatting | Prettier | Every governed service |
| Tests | Vitest 4 | Every governed service |
| Composition | Explicit typed factories | Every governed service |
| Logging | Pino 10 | Long-running Runtime exists |
| IDs | UUIDv7 from `uuid` | A new Domain identity exists |
| HTTP | Fastify 5 | HTTP exists |
| HTTP schemas | `typebox`, `@fastify/type-provider-typebox` | Hand-written HTTP exists |
| RPC | Buf, Protobuf-ES 2, Connect-ES 2, `@connectrpc/connect-fastify` | RPC exists |
| MySQL | Kysely 0.29 with `mysql2` | MySQL exists |
| Provider evidence | Testcontainers | Physical provider semantics change |
| Kafka | `@confluentinc/kafka-javascript` promisified API | Kafka exists after its compatibility gate |
| Task queue | BullMQ 5 with Redis | Distributed tasks exist |
| State machine | XState 5 `setup()` | An FSM exists |
| Telemetry | OpenTelemetry JS 2 and OTLP | Telemetry exists |

Use the supported version line pinned by the repository. A stack change is a
project technology decision.

## Reference Map

| Touched code surface | Load |
|---|---|
| Aggregate, Entity, Value Object, Domain Service, Repository | [ddd-typescript-domain.md](ddd-typescript-domain.md) |
| Command, Query, registry, assembler, Unit of Work | [ddd-typescript-application.md](ddd-typescript-application.md) |
| ConnectRPC, Fastify, subscriber, task processor | [ddd-typescript-transport.md](ddd-typescript-transport.md) |
| Kysely/MySQL mapping, QueryRepository, outbound ACL | [ddd-typescript-infrastructure.md](ddd-typescript-infrastructure.md) and [database.md](database.md) for SQL/schema |
| Local Domain Event or Integration Message | [ddd-typescript-events-messages.md](ddd-typescript-events-messages.md) |
| BullMQ task contract or worker | [ddd-typescript-taskqueue.md](ddd-typescript-taskqueue.md) |
| Composition, configuration, Pino, telemetry, shutdown | [ddd-typescript-runtime.md](ddd-typescript-runtime.md) |
| XState realization | [ddd-typescript-fsm.md](ddd-typescript-fsm.md) |

Load [ddd-core.md](ddd-core.md) only for an affected cross-language object/layer
shape and [ddd-collaboration.md](ddd-collaboration.md) only for an accepted
collaboration contract.

## Project Shape

```text
src/
  business/<context>/{domain,application,transport,infrastructure}/
  platform/
  runtime/
proto/<owner>/...
gen/...                                      # generated
migrations/*.sql
test/{integration,e2e}/
package.json
pnpm-lock.yaml
tsconfig.json
tsconfig.build.json
```

Each `src/business` child is one full Bounded Context. Its `<context>.ts`
constructs the context graph and returns registrations; Runtime supplies
technical dependencies and starts active loops.

## TypeScript Conventions

- `package.json` uses ESM, pins pnpm with `packageManager`, and restricts Node to
  `24.x`.
- Enable `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`, and
  `useUnknownInCatchVariables`.
- Relative ESM imports include the emitted `.js` extension.
- Decode and narrow `unknown` at boundaries; keep `any`, non-null assertions,
  and unchecked casts out of hand-written production code.
- Generated output is read-only and reproduced from contract source.
- Run locked install, `tsc --noEmit`, typed ESLint, Prettier check, build, and
  applicable Vitest suites.
