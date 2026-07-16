---
name: ddd-typescript
description: Compact TypeScript DDD House Style for Node.js services, multi-BC placement, the adopted stack, layer boundaries, persistence, conditional flows, runtime, and verification.
---

# TypeScript DDD House Style

This compact guide adds TypeScript/Node.js constraints to the confirmed Model
and [`ddd-core.md`](ddd-core.md). Rule-strength meanings come from the
common references. Kafka, BullMQ, XState, CQRS, Outbox, Inbox, and OpenTelemetry
remain absent until confirmed semantics or accepted project constraints require them; once applicable, the stack
and placement here are mandatory. An existing alternative is a conflict to
resolve, not an automatic exception.

## 1. Dependency Direction

Organize business code by Bounded Context before layer. The physical layer
names are fixed:

| Layer | Location | Owns |
|---|---|---|
| Domain | `src/business/<context>/domain` | Business language, behavior, invariants, lifecycle, Domain facts, write Repository contracts |
| Application | `src/business/<context>/application` | Commands, Queries, use-case orchestration, transactions, DTOs, QueryRepositories, semantic outbound ports |
| Transport | `src/business/<context>/transport` | ConnectRPC/HTTP/message/task decoding, one Application delegation, public outcome mapping |
| Infrastructure | `src/business/<context>/infrastructure` | Persistence and outbound provider implementations, DO conversion, ACLs |
| Platform/Runtime | `src/platform`, `src/runtime` | Shared clients, listeners, provider loops, composition, startup, shutdown, telemetry |

Dependencies point inward. Domain/Application do not import framework,
provider, generated inbound/RPC, telemetry SDK, or process-config types. The
only generated-contract exception is a producer Application event handler
importing its own fact contract. Transport never calls a Repository, controls a
transaction, mutates an Aggregate, or coordinates several use cases.

No bounded context imports another context's Domain, Application,
Infrastructure, QueryRepository, or internal task contract. Cross-context work
uses an accepted published API, Integration Message, or ACL from
[`ddd-collaboration.md`](ddd-collaboration.md). A Process Manager is a local
durable coordinator that consumes those contracts; it is not a contract another
context imports.

## 2. Mandatory Adopted Stack

Use the supported major/minor line selected by the repository and pin it in
`package.json` and `pnpm-lock.yaml`.

| Concern | Adopted stack | Applicability |
|---|---|---|
| Runtime | Node.js 24 LTS | Every governed service |
| Language/build | TypeScript 7.0 `tsc`, ESM, `NodeNext`; temporary TypeScript 6 API alias for typed tooling | Every governed service |
| Package manager | pnpm 11 | Every governed service |
| Static analysis | ESLint flat config with typed `typescript-eslint` rules | Every governed service |
| Formatting | Prettier | Every governed service |
| Composition | Explicit typed factories at the composition root | Every governed service |
| Logging | Pino 10 | Every governed long-running service |
| IDs | UUIDv7 from `uuid` | New Domain identity |
| Tests | Vitest 4 | Every governed service |
| HTTP server | Fastify 5 | An HTTP listener exists |
| HTTP schemas | `typebox` with `@fastify/type-provider-typebox` | Hand-written HTTP exists |
| RPC | Buf, Protobuf-ES 2, Connect-ES 2, `@connectrpc/connect-fastify` | RPC exists |
| MySQL access | Kysely 0.29 with `mysql2` | MySQL persistence exists |
| Integration tests | Testcontainers modules | A real provider boundary changes |
| Kafka | `@confluentinc/kafka-javascript` promisified API after the compatibility gate below | Kafka is accepted |
| Task Queue | BullMQ 5 and Redis | Task Queue is accepted |
| State machine | XState 5 `setup()` | An FSM is accepted |
| Telemetry | OpenTelemetry JS 2 and OTLP | Telemetry is available and accepted |

Other frameworks/providers are not alternate defaults; extending one needs an
explicit compatibility or migration decision.

TypeScript 7 is the build authority. Until typed ESLint tooling supports its
programmatic API, declare `"@typescript/native": "npm:typescript@^7.0.2"`
(an npm alias, not a registry package) and
`"typescript": "npm:@typescript/typescript6@^6.0.2"` for the tool API, following
the official transition layout. Remove the aliases only after the typed lint/
build pipeline passes on the supported TypeScript 7 API line.

`package.json` declares `"type": "module"`, pins pnpm with `packageManager`, and
restricts Node to `24.x`. Production code is compiled before deployment;
runtime type stripping is not the build pipeline.

```json
{
  "type": "module",
  "packageManager": "pnpm@11.10.0",
  "engines": { "node": "24.x" },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "check": "tsc --noEmit && eslint . && prettier --check .",
    "test": "vitest run"
  }
}
```

Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, and `useUnknownInCatchVariables`. Relative ESM imports in
TypeScript source include the emitted `.js` extension. Do not use `any`, unsafe
assertions, non-null assertions, or generated-code edits to conceal a boundary
mismatch; decode, narrow, or correct the contract.

## 3. Multi-BC Structure

```text
project/
├── src/
│   ├── business/
│   │   ├── user/
│   │   │   ├── domain/
│   │   │   │   ├── user.ts, repository.ts
│   │   │   │   └── event.ts, service.ts, state-machine.ts # conditional
│   │   │   ├── application/
│   │   │   │   ├── application.ts, assembler.ts
│   │   │   │   ├── commands/, queries/
│   │   │   │   ├── event-handlers/        # conditional
│   │   │   │   ├── tasks/                 # conditional task contracts
│   │   │   │   └── ports/                 # named semantic capabilities
│   │   │   ├── transport/
│   │   │   │   ├── connectrpc/
│   │   │   │   ├── http/                  # conditional hand-written HTTP
│   │   │   │   ├── message-subscriber/    # conditional
│   │   │   │   └── task-processor/         # conditional
│   │   │   ├── infrastructure/
│   │   │   │   ├── persistence/
│   │   │   │   │   ├── database.ts, convert.ts, repository.ts
│   │   │   │   │   └── query-repository.ts # conditional
│   │   │   │   ├── messaging/             # conditional
│   │   │   │   ├── task-queue/            # conditional
│   │   │   │   └── acl/                   # conditional
│   │   │   └── user.ts                     # BC assembly
│   │   └── notification/                   # independent full BC slice
│   ├── platform/
│   │   ├── database/
│   │   ├── connectrpc/
│   │   ├── message-bus/                    # conditional
│   │   ├── task-queue/                     # conditional
│   │   ├── logging/
│   │   └── telemetry/                      # conditional
│   └── runtime/
│       ├── config.ts
│       ├── application.ts
│       ├── instrumentation.ts              # conditional
│       └── main.ts
├── proto/<owner>/...
├── gen/...                                 # root generated output; never edit
├── migrations/*.sql                       # canonical ordered SQL
├── test/{integration,e2e}/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── tsconfig.build.json
```

Each `src/business` child is one full Bounded Context. `src/platform` holds only
technical runtime capabilities. `<context>.ts` constructs its graph and returns
registrations but never imports `src/runtime`; Runtime passes dependencies in.

`buf generate` writes `proto/<owner>` contracts to root `gen/`. Producer facts
use the producer namespace and asynchronous intents the receiver namespace.
Generated code is never moved into Domain or edited.

Do not pre-create empty Kafka, task, HTTP, FSM, Outbox, or Inbox directories.

## 4. Domain

Entity, Aggregate, and Value Object behavior is synchronous, I/O-free, and
telemetry-free. Behavior-rich Entities/Aggregates use private mutable state and
named behavior. Public read accessors support pure DTO/Domain/DO conversion and
safe result or identity mapping, not outer business branching, validation, or
authorization; return copies of mutable values.

New state enters through a Domain Factory. Reconstitution maps existing state,
validates it, and records no creation event. When time identifies a business
fact, Application supplies an explicit UTC instant rather than Domain reading
`new Date()`.

```ts
// src/business/user/domain/user.ts
import { v7 as uuidv7 } from "uuid";
type UserState = Readonly<{ id: string; name: string; email: string; version: number }>;
export class User {
  #state: UserState;
  private constructor(state: UserState) {
    User.validate(state);
    this.#state = { ...state };
  }
  static create(input: Readonly<{ name: string; email: string }>): User {
    return new User({ ...input, id: uuidv7(), version: 0 });
  }
  static reconstitute(state: UserState): User {
    if (!Number.isSafeInteger(state.version) || state.version < 1) {
      throw new Error("persisted user version is invalid");
    }
    return new User(state);
  }

  get id(): string { return this.#state.id; }
  get name(): string { return this.#state.name; }
  get email(): string { return this.#state.email; }
  get version(): number { return this.#state.version; }
  rename(name: string): void {
    const next = { ...this.#state, name };
    User.validate(next);
    this.#state = next;
  }

  private static validate(state: UserState): void {
    if (state.id.length === 0) throw new Error("user id is required");
    if (state.name.trim().length === 0) throw new Error("user name is required");
    if (state.email.trim().length === 0) throw new Error("user email is required");
    if (!Number.isSafeInteger(state.version) || state.version < 0) {
      throw new Error("user version is invalid");
    }
  }
}
```

Real errors/rules use the accepted Ubiquitous Language, not generic password,
email, money, or authorization examples. Domain validation runs in creation,
reconstitution, and transitions. Transport decodes protocol shape; a cast such
as `row.status as UserStatus` is not validation. Query read models are the
exception and do not construct fake Domain Entities.

Define a write Repository beside its Aggregate with collection semantics:

```ts
import type { User } from "./user.js";
export interface UserRepository {
  get(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

export class ConcurrentModificationError extends Error {}
```

Product lists, reports, histories, summaries, and presentation joins are not
write Repository methods.

A Domain Service follows `ddd-core.md`: Application normally supplies facts, but
an accepted narrow Domain-owned semantic collaborator or Repository query may
make that Service asynchronous when precomputing primitives would erase Domain
meaning. It still never saves, transacts, logs, retries, or chooses provider
policy.

Many/forbidden transitions, hierarchy, parallel states, timers, or repeated
bugs may justify an FSM; no count proves it. Once accepted, use XState 5
`setup()` in Domain with I/O-free guards/actions. Persist business state/version,
not opaque snapshots, unless an accepted Process Manager requires restoration.

## 5. Application

Every context has `application/application.ts`. It groups all handlers used by
inbound Transport and performs no forwarding, I/O, discovery, or framework
wiring.

```ts
// src/business/user/application/application.ts
import type { CreateUserHandler } from "./commands/create-user.js";
import type { GetUserHandler } from "./queries/get-user.js";
import type { ListUsersHandler } from "./queries/list-users.js";
export type Commands = Readonly<{ createUser: CreateUserHandler }>;
export type Queries = Readonly<{ getUser: GetUserHandler; listUsers: ListUsersHandler }>;

export class Application {
  constructor(
    public readonly commands: Commands,
    public readonly queries: Queries,
  ) {}
}
```

`application/assembler.ts` maps existing DTO/Domain state, never generated
messages, persistence rows, or new Aggregates.

```ts
// src/business/user/application/assembler.ts
import { User } from "../domain/user.js";
export type UserDTO = Readonly<{ id: string; name: string; email: string; version: number }>;

export function assembleUserDTO(dto: UserDTO): User {
  return User.reconstitute({ ...dto });
}

export function assembleUserEntity(entity: User): UserDTO {
  return { id: entity.id, name: entity.name, email: entity.email, version: entity.version };
}
```

A create command calls `User.create`, never an assembler. Copy mutable values.

A transaction callback provides repositories scoped to the real provider
transaction. Closing over an unrelated global Repository does not establish
transaction participation.

```ts
// src/business/user/application/commands/create-user.ts
import { User } from "../../domain/user.js";
import type { UserRepository } from "../../domain/repository.js";
export interface UserUnitOfWork {
  execute<T>(
    work: (repositories: Readonly<{ users: UserRepository }>) => Promise<T>,
  ): Promise<T>;
}
export type CreateUserResult = Readonly<{ id: string; name: string; email: string }>;

export class CreateUserHandler {
  constructor(private readonly unitOfWork: UserUnitOfWork) {}

  async execute(
    command: Readonly<{ name: string; email: string }>,
  ): Promise<CreateUserResult> {
    return this.unitOfWork.execute(async ({ users }) => {
      const user = User.create(command);
      await users.save(user);
      return { id: user.id, name: user.name, email: user.email };
    });
  }
}
```

When a post-commit best-effort Domain Event flow is accepted, add the event
buffer and dispatcher conditionally: capture/drain inside the transaction,
dispatch only after `execute` resolves, and suppress only a stable admitted
dispatch-failure type. A commit failure discards the instance/events; programming
defects remain visible. Otherwise omit all event machinery.

A saved Aggregate is stale. It may be mapped to the command result and have
this transaction's events drained, but it must not be mutated or saved again
without reload. The stored version is incremented by Infrastructure, not
written back into the Entity.

Application errors express stable use-case outcomes, not provider codes.
Application logs only valuable business facts or suppressed post-commit failure.

### Conditional CQRS

Every read enters through `application.queries`; Transport never calls a
Repository directly. Follow `ddd-core.md`: a focused one-Aggregate Get may use
the Domain Repository and map a read-only result, while distinct read semantics
use an Application-owned asynchronous QueryRepository returning Application
DTOs. Infrastructure owns SQL and provider cursors.

## 6. Transport

An inbound adapter decodes its envelope, extracts actor/correlation metadata,
maps primitives, delegates once through `Application.commands` or `.queries`,
and maps the result. It does not implement business validation, transactions,
retry, provider lifecycle, or multi-use-case orchestration.

When RPC exists, Connect-ES 2 is mandatory. Generated descriptors stop in
`transport/connectrpc`:

```ts
// src/business/user/transport/connectrpc/routes.ts
import type { ConnectRouter } from "@connectrpc/connect";
import { UserService } from "../../../../../gen/user/v1/user_pb.js";
import type { Application } from "../../application/application.js";

export function createUserConnectRoutes(application: Application) {
  return (router: ConnectRouter): void => {
    router.service(UserService, {
      async createUser(request) {
        const created = await application.commands.createUser.execute({
          name: request.name,
          email: request.email,
        });
        return { user: created };
      },
    });
  };
}
```

Map stable Application errors to Connect codes in `transport/connectrpc/error.ts`
and unknown errors to a non-leaking Internal response. A sibling assembler may
map large Protobuf messages; it is distinct from Application assembly.

Hand-written HTTP is conditional. Use Fastify 5 on the same listener and
`typebox` with `@fastify/type-provider-typebox` for params/body/query/response
shape. Do not duplicate Domain name/password/lifecycle/cross-field rules in a
route schema. Transport maps query syntax; Application owns read semantics.

An accepted `transport/message-subscriber` decodes the generated contract,
extracts identity, and delegates once. Kafka polling/commit/retry/DLQ stay out.

An accepted `transport/task-processor` decodes one `Job<unknown>` and delegates
once. Queue/Worker/Redis/concurrency/retry stay out.

## 7. Infrastructure and MySQL

When MySQL exists, use Kysely with `mysql2`. Platform creates one pool/Kysely
instance per database and injects it. DECIMAL and unsafe BIGINT values remain
strings until explicit conversion; time behavior follows
[`database.md`](database.md), not accidental driver defaults.

Ordered immutable `migrations/*.sql` are the canonical schema. Kysely table
interfaces are adapter compile-time descriptions, not a code-first schema or a
second migration source. Use all naming, type, index, timestamp, soft-delete,
batch, migration, and transaction constraints from `database.md`.

DO/Domain Entity conversion lives in `infrastructure/persistence/convert.ts`.
It maps existing state, calls Domain reconstitution validation, copies mutable
values, and contains no business branch, I/O, logging, or event creation.

```ts
// infrastructure/persistence/convert.ts
import type { Selectable } from "kysely";
import { User } from "../../domain/user.js";
import type { UserTable } from "./database.js";
export type UserDO = Pick<Selectable<UserTable>, "id" | "name" | "email" | "version">;

export function convertUserDO(row: UserDO): User {
  return User.reconstitute({
    id: row.id,
    name: row.name,
    email: row.email,
    version: row.version,
  });
}

export function convertUserEntity(user: User) {
  return { id: user.id, name: user.name, email: user.email } as const;
}
```

`save` covers insert and version-guarded update. New in-memory version `0`
inserts database version `1`; existing state uses `WHERE id = ? AND version = ?`
and increments in SQL. It never mutates the Entity version.

```ts
// infrastructure/persistence/repository.ts
import { sql, type Kysely, type Transaction } from "kysely";

import {
  ConcurrentModificationError,
  type UserRepository,
} from "../../domain/repository.js";
import type { User } from "../../domain/user.js";
import type { Database } from "./database.js";
import { convertUserDO, convertUserEntity } from "./convert.js";

type Executor = Kysely<Database> | Transaction<Database>;

export class KyselyUserRepository implements UserRepository {
  constructor(
    private readonly db: Executor,
    private readonly nowMillis: () => number,
  ) {}

  async get(id: string): Promise<User | null> {
    const row = await this.db.selectFrom("user")
      .select(["id", "name", "email", "version"])
      .where("id", "=", id).where("deleted_at", "=", 0)
      .executeTakeFirst();
    return row === undefined ? null : convertUserDO(row);
  }

  async save(user: User): Promise<void> {
    const data = convertUserEntity(user);
    const now = this.nowMillis();
    if (user.version === 0) {
      await this.db.insertInto("user").values({
        ...data,
        version: 1,
        created_at: now,
        updated_at: now,
        deleted_at: 0,
      }).executeTakeFirstOrThrow();
      return;
    }

    const mutableData = { name: data.name, email: data.email };
    const result = await this.db.updateTable("user").set({
      ...mutableData,
      version: sql<number>`version + 1`,
      updated_at: now,
    }).where("id", "=", user.id)
      .where("version", "=", user.version)
      .where("deleted_at", "=", 0)
      .executeTakeFirst();
    if (result.numUpdatedRows !== 1n) {
      throw new ConcurrentModificationError(user.id);
    }
  }
}
```

The Application Unit of Work adapter calls `db.transaction().execute` and
constructs each Repository on the callback's `Transaction<Database>`. Do not
close over a pool-scoped Repository, hold a MySQL transaction across Kafka/
HTTP/BullMQ, or use hidden AsyncLocalStorage transaction context without an
accepted and tested propagation contract.

Business deletion is a Domain transition persisted through `save`;
`deleted_at` is an Infrastructure lifecycle column. QueryRepository
implementations select explicit columns, use stable indexed ordering, and
return Application DTOs rather than Kysely rows. Repository `get` selects the
full Aggregate DO, filters technical soft deletion, and calls `convertUserDO`.

Outbound adapters map one semantic port to one provider; serialization,
topology, retry, credentials, and timeouts stay outer. Preserve the first
external error with `cause`; never leak driver text to Transport.

## 8. Conditional Events, Messages, and Reliability

Use the semantics in `ddd-collaboration.md`. In TypeScript, Domain Event types
stay in Domain, producer fact source stays under its root `proto/` namespace,
generated code stays in root `gen/`, and only a producer Application event
handler may import its own generated fact contract. Intent senders use a local
port; Infrastructure maps the receiver-owned contract.

When Kafka is accepted, use `@confluentinc/kafka-javascript` promisified API.
Platform owns producer/consumer connection, polling, offset commit, rebalance,
retry/DLQ, and shutdown. Use a stable message key for the accepted ordering
scope and propagate message ID, contract kind/version, occurred time,
correlation, and W3C trace context. Handler success is not proof of offset
commit. Kafka transactions cannot make a MySQL write atomic with publication.

The Confluent compatibility matrix currently omits Node 24 and marks pnpm
experimental. Kafka therefore requires an accepted Node-24 compatibility
decision plus install and real producer/consumer smoke evidence in the exact
target image. Until that passes, Kafka remains uncovered; do not silently
downgrade Node or substitute a client.

Outbox/Inbox remain conditional under `ddd-collaboration.md`. Their Kysely
adapters use the same local transaction as the accepted state/effect; Runtime
owns relay loops, and physical tables, indexes, and claim batching come from
`database.md`. Neither makes a later HTTP or Kafka effect atomic.

## 9. Conditional Task Queue

Task Queue is introduced only for accepted deferred, background, rate-limited,
or scheduled work. An internal task belongs to one BC; another context requests
work through a published API or Integration Message, not its task name.

Application owns a provider-neutral versioned task name/payload and semantic
enqueue port. Infrastructure maps it to BullMQ Queue options. Transport decodes
the BullMQ Job and delegates once. Platform/Runtime owns Queue, Worker,
QueueEvents, Redis, concurrency, attempts/backoff, stalled-job behavior, Job
Schedulers, and lifecycle.

Expected business waiting requests one bounded delayed follow-up and completes
the current job. Provider retry is only bounded transient-failure handling.

Periodic work uses BullMQ 5 `upsertJobScheduler`; do not use deprecated
repeatable-job APIs or `QueueScheduler`. A schedule enqueues an ordinary task,
never calls Domain or a Repository directly. BullMQ job IDs/deduplication can
reduce duplicate admission but do not establish business idempotency.

If work has durable business-visible steps, correlation, timeout,
cancellation, or compensation, persist the accepted Process Manager state.
BullMQ progress is not the business source of truth by convenience.

## 10. Runtime, Logging, and Telemetry

Runtime validates config before opening resources. Never log config/environment,
DSNs, secrets, credentials, certificates, or payloads; allow-list startup facts.

Composition uses typed factories and ordinary variables. Runtime constructs
shared Kysely/mysql2, Pino, Fastify, Kafka, BullMQ, and telemetry resources;
passes minimum dependencies into each `<context>.ts`; combines returned routes,
subscribers, and processors; then starts provider loops. Do not use a DI
container, Fastify decorator, or global singleton as an Application service
locator.

Fastify mounts Connect routes with `@connectrpc/connect-fastify` and conditional
hand-written HTTP on one listener. Platform owns listener/interceptors, Kafka
consumer loops, BullMQ workers/schedulers, pools, readiness, and registration.
Constructing a subscriber/processor does not prove its loop is running.

Start telemetry/config/clients before BCs, listeners, consumers, and workers;
partial failure closes opened resources. Shutdown stops admission, drains with
a bound, closes providers/Kysely, then telemetry. Unexpected loop exit is a
process failure.

Use Pino structured records with one execution-completion owner:

- Fastify owns HTTP/Connect duration and public outcome;
- Kafka Runtime owns attempt/commit/terminal delivery outcome;
- BullMQ Runtime owns task duration, attempt, retry, and terminal outcome;
- a scheduler/enqueuer owns admission, not later task completion.

Use Fastify's request logging or one custom completion hook, never both. Stable
fields include `operation`, `outcome`, `duration_ms`, `request_id`, `message_id`,
`task_id`, `attempt`, `trace_id`, and `span_id`. Log Error objects as structured
data under Pino's `err` field, unless Runtime explicitly configures another
error serializer. Application does not duplicate generic completion; Domain
never logs.

When OpenTelemetry is available and accepted, use OpenTelemetry JS 2 Node SDK
and OTLP. Initialize before instrumented libraries. Compiled ESM auto-
instrumentation uses the current documented ESM loader hook in addition to SDK
startup; `--import` alone is insufficient. Prove a representative library span
in the built artifact. Transport extracts/injects W3C context; Kafka/BullMQ
headers retain trace and message/task identity. Completion logs add active
trace/span IDs. Runtime calls SDK shutdown.

## 11. Verification

- Domain tests cover creation/reconstitution and transitions with real objects;
  add event-drain and FSM paths only when those capabilities exist.
- Application tests prove scoped repositories, stale discipline, and mapping
  with real handlers and focused fakes; accepted events also prove capture,
  commit, dispatch, and failure disposition.
- Transport tests cover real decode/map/delegate/error/correlation behavior.
- Kysely Repository/QueryRepository/migrations run against Testcontainers MySQL.
  Cover insert version `1`, guarded update/conflict, rollback, soft-delete
  filtering, invalid persisted state, runtime types, cursor/order boundaries,
  and migration compatibility. Mocked query chains are insufficient.
- Accepted Kafka and BullMQ paths run real Testcontainers smoke/integration
  tests for registration, delivery, commit/retry, duplicates, malformed work,
  scheduling, trace propagation, and shutdown drain.
- Composition/Runtime tests cover all registrations, startup cleanup, readiness,
  one completion log, secret redaction, and bounded shutdown.

## Related References

- [`ddd-modeling.md`](ddd-modeling.md): language, authority, lifecycle, consistency.
- [`ddd-core.md`](ddd-core.md): layers, Aggregate, Domain Service, Repository, CQRS.
- [`ddd-collaboration.md`](ddd-collaboration.md): contracts, messages, processes, delivery.
- [`database.md`](database.md): canonical MySQL schema, SQL, migration, concurrency.
