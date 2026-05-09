---
name: ddd-typescript
description: TypeScript implementation guide for DDD + Clean Architecture. Use when implementing backend services in TypeScript with domain-driven design, including aggregates, repositories, domain events, CQRS, and composition-root module assembly. Complements ddd-core specification.
---

# TypeScript Backend Architecture Guide
## DDD + Clean Architecture — TypeScript Implementation

**Version**: v1.0
**Date**: 2026-04-20  
**Scope**: Team backend service architecture standard  
**Prerequisites**:
- **Strategic modeling**: [`ddd-modeling.md`](ddd-modeling.md) — Complete this first to identify bounded contexts and aggregate boundaries from business requirements
- **Architecture spec**: [`ddd-core.md`](ddd-core.md) — Language-agnostic DDD + Clean Architecture rules. All architecture principles defer to `ddd-core.md`; in particular, the architecture review checklist lives at [ddd-core.md §10](ddd-core.md) and the consolidated principles summary lives at [ddd-core.md §11](ddd-core.md).
- This document is the TypeScript implementation guide that builds on both
**Runtime**: Node.js 22+  
**TypeScript**: 5.6+

> **Cross-reference convention**: major architecture sections align with the corresponding `ddd-core.md` sections where applicable. This guide adds only what is implementation-specific.

---

## 0. TypeScript DDD Planning Workflow

Apply the planning gates defined in [ddd-modeling.md §7](ddd-modeling.md). For each gate level, the plan/spec must additionally state these **TypeScript-specific** items.

### Level 1 (Local Change)

Plan must additionally state:

- the TypeScript module being changed (e.g., `apps/api/src/modules/user/domain/`)
- whether tests live alongside the module (`*.spec.ts`) or in a separate `test/` tree (§9)

### Level 2 (New Use Case)

Plan must additionally state:

- file placement under the bounded context (`commands/`, `queries/`, `subscribers/`, `query-repository.ts` — see §6)
- new DTOs / zod schemas required (§3.2)
- composition-root wiring changes (§10)

### Level 3 (New Bounded Context or Aggregate)

Spec must additionally state:

- planned package layout under `apps/api/src/modules/<context>/` (§2.2)
- shared object placement decisions — what stays in the owning context, what goes in `shared/`, what goes in `packages/contracts/` or `packages/shared-kernel/`
- shared infrastructure provider ownership (DB pool, event bus, cache client — see §10)

### Cross-Context Change Without a New Context

Follow the multi-side planning rule in [ddd-modeling.md §7.4](ddd-modeling.md). The TypeScript-side plan must list:

- producing context's subscriber / event publisher path
- consuming context's subscriber and its idempotency strategy
- shared event payload definitions or `packages/contracts/` updates if a protocol contract is involved

---

## 1. Architecture Principles

### 1.1 Core Philosophy

This guide combines **Domain-Driven Design (DDD)** with **Clean Architecture**, targeting:

1. **Domain-centric** — Business logic is independent of frameworks, UI, and databases
2. **Dependency inversion** — Inner layers define interfaces; outer layers implement them
3. **Vertical slicing** — Code organized by bounded context, not by technical layer
4. **Testability** — Business logic testable without external infrastructure

### 1.2 Layered Architecture

Four layers with the **Domain Layer as the core** (innermost):

```
                    ┌─────────────────────────────────────┐
                    │        Interface Layer             │
                    │  HTTP / RPC / queue adapters       │
                    │  validation, routing, error maps   │
                    └───────────────┬─────────────────────┘
                                    │ depends on
                    ┌───────────────▼─────────────────────┐
                    │       Application Layer             │
                    │  use-case orchestration,            │
                    │  transactions, DTOs, CQRS          │
                    └───────────────┬─────────────────────┘
                                    │ depends on
                    ┌───────────────▼─────────────────────┐
                    │         Domain Layer                │
                    │  aggregates, VOs, services,         │
                    │  write repository interfaces,       │
                    │  domain events                      │
                    └─────────────────────────────────────┘
                                    ▲
                                    │ implements
        ┌───────────────────────────┴─────────────────────┐
        │        Infrastructure Layer                     │
        │  database, cache, MQ, third-party APIs,        │
        │  repository implementations                     │
        └─────────────────────────────────────────────────┘
```

### 1.3 Dependency Rule

**Golden rule: dependencies point inward only. The Domain Layer must not depend on any other layer.**

- Interface Layer depends on Application and Domain layers
- Application Layer depends on Domain Layer
- Domain Layer must not import ORM, database, HTTP/RPC, cache, MQ, or third-party service client packages
- Infrastructure Layer depends on Domain Layer (implements Repository interfaces) and Application Layer (implements QueryRepository interfaces)

The Domain layer may use a small number of stable, general-purpose libraries when they do not introduce IO, framework lifecycle coupling, or transport/persistence concerns. Typical examples in TypeScript are `node:crypto`, `ulid`, and small in-memory helper abstractions.

> For full dependency rules and common violations, see [ddd-core.md §1.3](ddd-core.md). Concrete TypeScript code is shown in §3.1 / §3.2 / §3.4.

---

## 2. Directory Structure

### 2.1 Overall Layout

> Corresponds to [ddd-core.md §2.1](ddd-core.md). TypeScript-specific conventions applied.

```
project/
├── apps/
│   └── api/
│       ├── src/
│       │   ├── main.ts                  # entry point / composition root
│       │   ├── app.ts                   # web server assembly
│       │   ├── config/                  # config loading
│       │   ├── shared/                  # shared infrastructure adapters
│       │   │   ├── db/
│       │   │   ├── event-bus/
│       │   │   ├── logger/
│       │   │   └── tx/
│       │   └── modules/
│       │       └── <context>/
│       │           ├── domain/
│       │           ├── application/
│       │           ├── interfaces/
│       │           ├── infrastructure/
│       │           └── module.ts        # bounded context assembly
│       └── test/
│           ├── integration/
│           └── e2e/
├── packages/
│   ├── contracts/                       # generated/openapi/proto contracts if shared
│   └── shared-kernel/                   # only if truly cross-context and stable
├── migrations/
├── package.json
├── tsconfig.json
└── pnpm-lock.yaml
```

**`modules/` vs `shared/`** — `modules/` holds bounded contexts (the DDD four-layer structure); `shared/` holds technical infrastructure adapters used across contexts. Business code may depend on `shared/`; `shared/` must never import concrete business modules.

**One directory under `modules/` = one bounded context.** The directory name (`<context>`) is the bounded context's name, and its `domain/`, `application/`, `interfaces/`, `infrastructure/` sub-tree is the full DDD four-layer slice for that context. Do not split a single bounded context across sibling `modules/` directories, and do not collapse two bounded contexts into one.

### 2.2 Bounded Context Internal Structure

> Corresponds to [ddd-core.md §2.2](ddd-core.md).

```
apps/api/src/modules/user/
├── domain/
│   ├── user.aggregate.ts
│   ├── value-objects.ts
│   ├── events.ts
│   ├── repository.ts
│   ├── services.ts
│   └── errors.ts
│
├── application/
│   ├── commands/
│   │   └── change-password.command.ts
│   ├── queries/
│   │   └── find-user.query.ts
│   ├── handlers/
│   │   ├── change-password.handler.ts
│   │   ├── find-user.handler.ts
│   │   └── user-created.handler.ts
│   ├── dto.ts
│   ├── query-repository.ts
│   └── unit-of-work.ts
│
├── interfaces/
│   ├── http/
│   │   ├── user.routes.ts
│   │   └── schemas.ts
│   └── rpc/
│       └── user.controller.ts
│
├── infrastructure/
│   ├── persistence/
│   │   ├── user.repository.ts
│   │   ├── user.query-repository.ts
│   │   ├── schema.ts
│   │   └── mapper.ts
│   └── messaging/
│       └── publisher.ts
│
└── module.ts
```

Start with flat files when the module is small. When handlers grow numerous, promote to sub-directories (`commands/`, `queries/`, `handlers/`, one file per handler). `module.ts` remains the single entry point that wires the bounded context.

---

## 3. Layer Responsibilities

### 3.1 Domain Layer

**Role**: Core business logic, independent from frameworks, transport, and persistence.

> For the full specification, see [ddd-core.md §3.1](ddd-core.md).

**Contents**:
- **Aggregate Root**: Guardian of business invariants
- **Entity**: Object with stable identity
- **Value Object**: Immutable object defined by attributes
- **Domain Service**: Cross-aggregate business logic
- **Repository Interface**: Write-side persistence abstraction
- **Domain Event**: Records significant domain occurrences

**Constraints**:
- No infrastructure dependencies
- Must not depend on other bounded contexts' domain layers
- All state changes go through domain methods
- **No anemic aggregates.** An Aggregate Root that is a `type` / interface with public fields and no behavior, while the rules live in `application/handlers/`, is prohibited. Every state transition is a method on the Aggregate Root class (or Value Object). Use `private` fields + `private constructor` + static factory (`User.create(...)`); expose read-only access via getters; mutation only via named domain methods (`changePassword`, `activate`, …)
- **Version is a read-only concurrency token** — Infrastructure increments it
- **IDs are generated in Domain** via UUID/ULID factory methods — database auto-increment IDs are prohibited

**Factory Design**:
- Simple cases: use the Aggregate Root's own factory method (`User.create(...)`)
- Complex cases (assembling multiple Value Objects, cross-entity validation): extract an independent Domain Factory inside the domain package

**Domain Event Collection Contract**:
- Aggregate Root keeps an internal event list
- Domain methods append events; they never dispatch directly
- Application calls `collectEvents()` after successful persistence
- `collectEvents()` drains the list; a second call returns an empty array

**Validation Contract** — implements [ddd-core.md §3.1 "Validation Contract"](ddd-core.md). TypeScript-specific notes:

- `validate(): void` (throwing a `DomainError` subclass) is the canonical method signature
- Inside `validate()`, you may use `zod`, `valibot`, or hand-written checks — these are an implementation detail. The Aggregate Root / Entity itself must not extend a zod schema or be a `class-validator`-decorated DTO; external layers must never call `Schema.parse(domainObj)` to validate a Domain object
- Use explicit code for cross-field rules and state-transition invariants that cannot be expressed cleanly with declarative schemas

**Domain Rules in Technical Capabilities** — see [ddd-core.md §3.1 "Domain Rules in Technical Capabilities"](ddd-core.md). The rule applies to TypeScript projects exactly as written.

**TypeScript-specific guidance**:
- Prefer `readonly` and private fields to preserve invariants
- Prefer factory methods over public constructors for aggregates
- Avoid decorators and framework metadata in Domain
- Keep `Date`, `bigint`, and `string` semantics explicit; do not hide business meaning inside loose primitives when a Value Object is warranted

```ts
// domain/events.ts
export interface DomainEvent {
  readonly type: string;
  readonly occurredAt: Date;
}

export class UserCreatedEvent implements DomainEvent {
  readonly type = "user.created";

  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly email: string,
    public readonly occurredAt: Date,
  ) {}
}

export class PasswordChangedEvent implements DomainEvent {
  readonly type = "user.password_changed";

  constructor(
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}
```

```ts
// domain/value-objects.ts
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { InvalidEmailError, WeakPasswordError } from "./errors";

export class Email {
  private constructor(public readonly value: string) {}

  static create(value: string): Email {
    const normalized = value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new InvalidEmailError(normalized);
    }
    return new Email(normalized);
  }
}

export class HashedPassword {
  private constructor(
    public readonly hash: string,
    public readonly salt: string,
  ) {}

  static reconstitute(hash: string, salt: string): HashedPassword {
    return new HashedPassword(hash, salt);
  }

  static fromPlain(raw: string): HashedPassword {
    if (raw.length < 8) {
      throw new WeakPasswordError();
    }
    const salt = randomBytes(16).toString("hex");
    const hash = createHash("sha256").update(`${salt}:${raw}`).digest("hex");
    return new HashedPassword(hash, salt);
  }

  verify(raw: string): boolean {
    const candidate = createHash("sha256")
      .update(`${this.salt}:${raw}`)
      .digest();
    const current = Buffer.from(this.hash, "hex");
    return candidate.length === current.length && timingSafeEqual(candidate, current);
  }
}

export enum UserStatus {
  Inactive = "inactive",
  Active = "active",
  Suspended = "suspended",
}
```

```ts
// domain/user.aggregate.ts
import { ulid } from "ulid";

import {
  PasswordChangedEvent,
  type DomainEvent,
  UserCreatedEvent,
} from "./events";
import { UserNotActiveError } from "./errors";
import { Email, HashedPassword, UserStatus } from "./value-objects";

type UserProps = {
  id: string;
  name: string;
  email: Email;
  hashedPassword: HashedPassword;
  status: UserStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export class User {
  private readonly events: DomainEvent[] = [];

  private constructor(private props: UserProps) {}

  static create(input: {
    name: string;
    email: Email;
    rawPassword: string;
  }): User {
    const now = new Date();
    const user = new User({
      id: ulid(),
      name: input.name,
      email: input.email,
      hashedPassword: HashedPassword.fromPlain(input.rawPassword),
      status: UserStatus.Inactive,
      version: 0,
      createdAt: now,
      updatedAt: now,
    });

    user.record(
      new UserCreatedEvent(user.id, user.name, user.email.value, now),
    );
    return user;
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get email(): Email {
    return this.props.email;
  }

  get version(): number {
    return this.props.version;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  get hashedPassword(): HashedPassword {
    return this.props.hashedPassword;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  changePassword(oldRaw: string, newRaw: string): void {
    if (this.props.status !== UserStatus.Active) {
      throw new UserNotActiveError();
    }
    if (!this.props.hashedPassword.verify(oldRaw)) {
      throw new Error("old password incorrect");
    }

    this.props = {
      ...this.props,
      hashedPassword: HashedPassword.fromPlain(newRaw),
      updatedAt: new Date(),
    };
    this.record(new PasswordChangedEvent(this.id, this.props.updatedAt));
  }

  collectEvents(): DomainEvent[] {
    const drained = [...this.events];
    this.events.length = 0;
    return drained;
  }

  private record(event: DomainEvent): void {
    this.events.push(event);
  }
}
```

```ts
// domain/repository.ts
import type { User } from "./user.aggregate";

export interface UserRepository {
  get(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
```

### 3.2 Application Layer

**Role**: Orchestrate use cases; define transactions; coordinate Domain objects.

> Corresponds to [ddd-core.md §3.2](ddd-core.md). The TypeScript guide adds transaction and composition details specific to Node.js services.

**Contents**:
- Command and Query definitions
- Command and Query handlers
- DTOs
- QueryRepository interfaces
- Unit of Work / transaction boundary abstractions
- Event handlers for consuming domain events

**Constraints**:
- No business rules
- Depends on Domain
- Owns transaction boundaries
- **One transaction modifies one aggregate only.** Co-locating multiple aggregate mutations in a single transaction is prohibited. To modify multiple aggregates, persist the first and use domain events to trigger subsequent aggregate modifications in separate transactions (eventual consistency)
- Dispatch domain events only after successful persistence
- QueryRepository interfaces live here, return DTOs, and bypass Domain aggregates on the read side
- After `repo.save()`, the in-memory aggregate is stale — reload via `repo.get()` before any further operation on the same aggregate

```ts
// application/commands/change-password.command.ts
export type ChangePasswordCommand = {
  userId: string;
  oldPassword: string;
  newPassword: string;
};
```

```ts
// application/unit-of-work.ts
export interface UnitOfWork {
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
}
```

```ts
// application/query-repository.ts
export type UserDetailDto = {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
};

export interface UserQueryRepository {
  findDetail(id: string): Promise<UserDetailDto | null>;
}
```

```ts
// application/handlers/change-password.handler.ts
import type { EventBus } from "../../../shared/event-bus/event-bus";
import { UserNotFoundError } from "../../domain/errors";
import type { UserRepository } from "../../domain/repository";
import type { ChangePasswordCommand } from "../commands/change-password.command";
import type { UnitOfWork } from "../unit-of-work";

export class ChangePasswordHandler {
  constructor(
    private readonly repo: UserRepository,
    private readonly uow: UnitOfWork,
    private readonly eventBus: EventBus,
  ) {}

  async handle(command: ChangePasswordCommand): Promise<void> {
    const events = await this.uow.runInTransaction(async () => {
      const user = await this.repo.get(command.userId);
      if (!user) {
        throw new UserNotFoundError(command.userId);
      }

      user.changePassword(command.oldPassword, command.newPassword);
      await this.repo.save(user);
      return user.collectEvents();
    });

    await this.eventBus.publishAll(events);
  }
}
```

### 3.3 Interface Layer

**Role**: Protocol adaptation only.

> Corresponds to [ddd-core.md §3.3](ddd-core.md). In TypeScript, this layer usually contains Fastify/Express/Nest controllers, RPC handlers, validation schemas, and request/response mapping.

**Contents**:
- HTTP routes / controllers
- RPC handlers
- Request validation
- Authentication extraction
- Error mapping
- Request/response DTO mapping

**Constraints**:
- No business rules
- Depends on Application and Domain
- Owns protocol details such as headers, status codes, cookies, pagination envelopes

**TypeScript-specific guidance**:
- Put Zod/Valibot schemas here, not in Domain
- Do not leak Fastify/Express/Nest request objects into Application
- Map domain/application errors into transport errors here

```ts
// interfaces/http/schemas.ts
import { z } from "zod";

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
```

```ts
// interfaces/http/user.routes.ts
import type { FastifyPluginAsync } from "fastify";

import { ChangePasswordHandler } from "../../application/handlers/change-password.handler";
import { changePasswordSchema } from "./schemas";

export const userRoutes = (
  changePassword: ChangePasswordHandler,
): FastifyPluginAsync => {
  return async (app) => {
    app.put<{ Params: { id: string } }>("/users/:id/password", async (request, reply) => {
      const body = changePasswordSchema.parse(request.body);
      await changePassword.handle({
        userId: request.params.id,
        oldPassword: body.oldPassword,
        newPassword: body.newPassword,
      });
      return reply.status(204).send();
    });
  };
};
```

### 3.4 Infrastructure Layer

**Role**: Implement Domain and Application contracts against real external systems.

> Corresponds to [ddd-core.md §3.4](ddd-core.md). TypeScript-specific examples below use an explicit data-mapper style rather than active record.

**Contents**:
- Repository implementations
- QueryRepository implementations
- ORM / SQL mapping
- Cache clients
- MQ publishers / subscribers
- Third-party API clients

**Constraints**:
- No business rules
- Handles technical concerns: SQL, retries, pooling, serialization, timeouts
- Owns optimistic locking implementation; Domain holds `version` as a read-only token, Infrastructure increments it via SQL
- Must not leak ORM entities into Domain
- `save()` is the single method covering create, update, and state-driven soft delete; never split into `insert()` / `update()` / `delete()` based on SQL operation. `version === 0` → INSERT; `version > 0` → version-guarded UPDATE. `Save()` determines the operation internally based on the aggregate's state
- Adding a technical client (`ioredis`, `kysely`, an HTTP/MQ SDK) does not justify a new TS interface in `domain/` or `application/`. If Redis only accelerates a SQL-backed repository, compose it inside `infrastructure/persistence/`; do not introduce a separate `Cacher` interface. Add a new interface only for a named use-case capability (distributed lock, lease ownership, explicit cache invalidation, rate limiting, event publication)

**Persistence Guidance**:
- Prefer explicit mapping over active-record style domain models
- Keep persistence schema types separate from Domain aggregates
- Optimistic locking should be implemented in the repository with `WHERE version = ?`

```ts
// infrastructure/persistence/schema.ts
export type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  password_salt: string;
  status: string;
  version: number;
  created_at: Date;
  updated_at: Date;
};
```

```ts
// infrastructure/persistence/mapper.ts
import { HashedPassword, Email, UserStatus } from "../../domain/value-objects";
import { User } from "../../domain/user.aggregate";
import type { UserRow } from "./schema";

export function toDomain(row: UserRow): User {
  return User.reconstitute({
    id: row.id,
    name: row.name,
    email: Email.create(row.email),
    hashedPassword: HashedPassword.reconstitute(row.password_hash, row.password_salt),
    status: row.status as UserStatus,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
```

```ts
// infrastructure/persistence/user.repository.ts
import type { Kysely } from "kysely";

import { ConcurrentModificationError } from "../../domain/errors";
import type { UserRepository } from "../../domain/repository";
import type { User } from "../../domain/user.aggregate";
import { toDomain } from "./mapper";
import type { UserRow } from "./schema";

type Database = {
  users: UserRow;
};

export class KyselyUserRepository implements UserRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async get(id: string): Promise<User | null> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toDomain(row) : null;
  }

  async save(user: User): Promise<void> {
    if (user.version === 0) {
      // New aggregate — INSERT, version starts at 1
      await this.db
        .insertInto("users")
        .values({
          id: user.id,
          name: user.name,
          email: user.email.value,
          password_hash: user.hashedPassword.hash,
          password_salt: user.hashedPassword.salt,
          status: user.status,
          version: 1,
          created_at: user.createdAt,
          updated_at: user.updatedAt,
        })
        .execute();
      return;
    }

    // Existing aggregate — version-guarded UPDATE; SQL increments version
    const result = await this.db
      .updateTable("users")
      .set({
        name: user.name,
        email: user.email.value,
        password_hash: user.hashedPassword.hash,
        password_salt: user.hashedPassword.salt,
        status: user.status,
        version: user.version + 1,
        updated_at: new Date(),
      })
      .where("id", "=", user.id)
      .where("version", "=", user.version)
      .executeTakeFirst();

    if (Number(result.numUpdatedRows ?? 0) === 0) {
      throw new ConcurrentModificationError(user.id);
    }
    // After save(), the in-memory user is stale — caller must reload via get() before further operations
  }
}
```

---

## 4. DDD Tactical Design Reference

| DDD Concept | Layer | TypeScript Implementation |
|-------------|-------|---------------------------|
| **Aggregate** | Domain | `class` with private state + domain methods |
| **Entity** | Domain | `class` with stable ID |
| **Value Object** | Domain | immutable `class` / `type` with validated creation |
| **Domain Service** | Domain | stateless function / class |
| **Repository** | Domain + Infra | interface + implementation |
| **Query Repository** | Application + Infra | interface + implementation |
| **Domain Event** | Domain | immutable object with `type` + payload |
| **Application Service** (Command/Query Handler) | Application | use-case orchestration; concrete form is `<Action>Handler` class for commands, `Find<Target>Handler` for queries |
| **Event Handler** | Application | subscribed handler class/function |
| **DTO** | Application / Interface | explicit transfer `type` |
| **Factory** | Domain | static `create()` / dedicated factory |
| **CQRS** | Application | command/query separation |

---

## 5. Cross-Context Communication

> For the full specification (four legitimate mechanisms and Rich Event payload rules), see [ddd-core.md §5](ddd-core.md). This section captures the TypeScript decision points.

### 5.1 Direct Domain Coupling Is Prohibited

Bounded contexts must not import another context's Domain model or call its Application Service / Domain Service / Repository directly. Cross-module imports between `modules/<a>/domain/` and `modules/<b>/domain/` are a hard error.

### 5.2 Choosing the Mechanism

Use [ddd-core.md §5.2](ddd-core.md)'s four-mechanism table to pick the right tool:

- **Integration Events** — default for asynchronous cross-context state propagation; loose coupling, eventual consistency. Produce them from selected internal Domain Events after successful persistence
- **Cross-context queries** — read-only DTOs through a port the owning context **explicitly exports** (e.g., `UserReader` / `UserSummaryPort`, a small read-side facade — *not* the context's internal `UserQueryRepository`, which is a CQRS read-side concern within the User context itself). Appropriate when the consumer needs a current snapshot and event-driven projection is not viable
- **Anti-Corruption Layer** — when integrating with external/legacy systems; lives in `infrastructure/` and is transparent to Domain
- **Protocol contracts** — for cross-service / cross-package data contracts; generated code lives in `packages/contracts/`, never imported by Domain

Do not default every cross-context interaction to asynchronous messaging — pick the simplest consistency model that satisfies the business requirement, but never bypass the boundary by reaching into another context's Domain layer.

Generated code in `packages/contracts/` is DTOs / contracts, not Domain entities. Do not place a port in `application/` just because its request/response are generated proto/OpenAPI types — decide port ownership from the semantic capability ([ddd-modeling.md §0.2](ddd-modeling.md)). When the capability is Domain-facing, keep the TS interface in `domain/` with Domain-typed signatures and map `Proto ↔ Domain` in `application/` (handler or assembler) or in an Infrastructure inbound adapter.

---

## 6. Naming Conventions

| Type | Naming Pattern | Example |
|------|----------------|---------|
| Aggregate | `<Entity>` | `User` |
| Domain Event | `<Entity><Action>Event` | `UserCreatedEvent` |
| Command | `<Action><Entity>Command` | `ChangePasswordCommand` |
| Command Handler | `<Action><Entity>Handler` | `ChangePasswordHandler` |
| Query | `<Action><Entity>Query` | `FindUserQuery` |
| Query Handler | `<Action><Entity>Handler` | `FindUserHandler` |
| Repository Interface | `<Entity>Repository` | `UserRepository` |
| Query Repository | `<Entity>QueryRepository` | `UserQueryRepository` |
| Persistence Row | `<Entity>Row` | `UserRow` |
| Mapper | `toDomain` / `toRow` | `toDomain(userRow)` |

File naming:
- Prefer kebab-case file names
- Keep one primary concept per file
- Name files by role, not framework suffix noise

---

## 7. Recommended Technology Stack

These are **recommended team defaults**, not hard requirements:

| Purpose | Recommended Library |
|---------|---------------------|
| Runtime | Node.js 22+ |
| Language | TypeScript 5.6+ |
| HTTP Server | `fastify` |
| Validation | `zod` or `valibot` |
| SQL Query Builder | `kysely` |
| ORM alternative | `drizzle-orm` |
| DI / Composition | manual composition root or `awilix` |
| Logging | `pino` |
| Test Runner | `vitest` |
| API Contracts | OpenAPI / Connect / gRPC as needed |
| ID Generation | `ulid` or `uuid` |

**Selection Criteria**:
- Prefer libraries that keep Domain free from decorators and framework metadata
- Prefer explicit composition over magic auto-discovery
- Prefer schema-first or contract-first interfaces when multiple clients consume the API

---

## 8. Error Handling

### 8.1 Per-Layer Strategy

| Layer | Approach |
|-------|----------|
| Domain | throw domain-specific errors |
| Application | translate missing entities / authorization / orchestration failures into use-case errors |
| Interface | map errors into HTTP/RPC status and response envelopes |
| Infrastructure | wrap low-level failures with operational context; do not leak driver-specific errors upward unchanged |

### 8.2 Domain Error Example

```ts
// domain/errors.ts
export class DomainError extends Error {}

export class UserNotFoundError extends DomainError {
  constructor(userId: string) {
    super(`user not found: ${userId}`);
  }
}

export class InvalidEmailError extends DomainError {
  constructor(email: string) {
    super(`invalid email: ${email}`);
  }
}

export class WeakPasswordError extends DomainError {
  constructor() {
    super("password too weak");
  }
}

export class UserNotActiveError extends DomainError {
  constructor() {
    super("user is not active");
  }
}

export class ConcurrentModificationError extends DomainError {
  constructor(entityId: string) {
    super(`concurrent modification detected: ${entityId}`);
  }
}
```

### 8.3 HTTP Error Mapping Example

```ts
// interfaces/http/error-mapper.ts
import { DomainError, UserNotActiveError, UserNotFoundError } from "../../domain/errors";

export function toHttpError(error: unknown): { status: number; body: object } {
  if (error instanceof UserNotFoundError) {
    return { status: 404, body: { message: error.message } };
  }
  if (error instanceof UserNotActiveError) {
    return { status: 409, body: { message: error.message } };
  }
  if (error instanceof DomainError) {
    return { status: 400, body: { message: error.message } };
  }
  return { status: 500, body: { message: "internal server error" } };
}
```

---

## 9. Testing Strategy

- **Domain tests**: pure unit tests, no mocks unless unavoidable
- **Application tests**: orchestration tests using fake repositories / event bus
- **Infrastructure tests**: integration tests against real database or containerized dependencies
- **Interface tests**: request/response tests at HTTP/RPC boundary

Priority order:
1. Domain invariants
2. Command handler orchestration
3. Repository persistence behavior
4. Error mapping and transport behavior

Avoid:
- re-implementing domain logic inside tests
- asserting only TypeScript types without runtime behavior
- mock-heavy tests that never touch the changed boundary

---

## 10. Composition Root

The application is assembled at the edge, not inside Domain.

```ts
// apps/api/src/main.ts
import Fastify from "fastify";

import { KyselyUserRepository } from "./modules/user/infrastructure/persistence/user.repository";
import { ChangePasswordHandler } from "./modules/user/application/handlers/change-password.handler";
import { userRoutes } from "./modules/user/interfaces/http/user.routes";
import { createDb } from "./shared/db/create-db";
import { InMemoryEventBus } from "./shared/event-bus/event-bus";
import { KyselyUnitOfWork } from "./shared/tx/kysely-unit-of-work";

async function main(): Promise<void> {
  const app = Fastify();
  const db = createDb();
  const eventBus = new InMemoryEventBus();
  const uow = new KyselyUnitOfWork(db);
  const userRepository = new KyselyUserRepository(db);
  const changePassword = new ChangePasswordHandler(userRepository, uow, eventBus);

  await app.register(userRoutes(changePassword));
  await app.listen({ port: 8080, host: "0.0.0.0" });
}

void main();
```

Guidelines:
- Wire dependencies in `main.ts` or a bounded-context `module.ts`
- Do not let Domain or Application instantiate concrete infrastructure
- Keep framework bootstrapping and plugin registration at the edge

---

## 11. Key Principles Summary

> These are the TypeScript-specific phrasings of the principles summarized in [ddd-core.md §11](ddd-core.md). For the architecture review checklist see [ddd-core.md §10](ddd-core.md).

1. **Domain layer has no concrete implementation dependencies** — no `import` of Kysely / Prisma / TypeORM, Fastify / Express / Nest, HTTP/MQ clients, or generated protocol packages; `node:crypto`, `ulid`, and small in-memory helpers are allowed when they don't couple Domain to an external system
2. **Vertical slicing** — organize by bounded context (`modules/<context>/`), not by technical layer
3. **Dependency inversion** — Domain defines write Repository interfaces; Application defines read QueryRepository interfaces; Infrastructure implements both
4. **Port granularity** — define interfaces by caller semantics, not implementation technology; cache/database/queue clients stay inside Infrastructure unless they are a named use-case capability ([ddd-modeling.md §0.2](ddd-modeling.md))
5. **Aggregate boundary** — Repository operates on aggregate roots only, not child entities
6. **State encapsulation** — all state changes go through domain methods; use `private` fields, `readonly`, and `private constructor` + static factories to prevent external mutation
7. **ID generation in Domain** — use `ulid()` / `uuidv7()` factory inside the aggregate's `create()`; database auto-increment IDs are prohibited
8. **Disciplined cross-context communication** — Integration Events (default for cross-context state propagation), cross-context queries (read-only DTOs through a published facade port — *not* another context's internal `UserQueryRepository`), ACL, or protocol contracts; direct imports of another context's Domain model are prohibited; events use Rich Event style (ID + minimum necessary fields)
9. **Event collection** — aggregates collect events in a private array; Application calls `collectEvents()` after successful `save()` to drain and dispatch
10. **CQRS** — Commands go through the Domain model; Queries go through QueryRepository directly to the DB and return DTO `type`s
11. **Transaction boundary** — one Command Handler owns one transaction (typically via `UnitOfWork.runInTransaction`); one transaction modifies one aggregate only
12. **Repository collection semantics** — `save()` is the single method covering create, update, and state-driven soft delete; `version === 0` → INSERT, `version > 0` → version-guarded UPDATE; never split into `insert()` / `update()` / `delete()` by SQL operation
13. **Soft delete** — business-driven deletion is modeled as Domain state; `deleted_at` is always an Infrastructure concern
14. **Optimistic locking** — Infrastructure increments `version` via `SET version = version + 1 WHERE version = ?`; Domain holds `version` as a read-only token; always reload via `repo.get()` after `save()` before further operations
15. **Event dispatch timing** — dispatch after successful persist (after `runInTransaction` resolves), never before
16. **Event reliability** — choose in-memory bus / Outbox Pattern / message queue based on reliability requirements
17. **Technical capability classification** — technical-facing code (dispatchers, registries, schedulers, routers, projections, ownership managers) is Domain-facing when it owns stable language, states, policies, or invariants; Infrastructure only adapts external systems and mechanisms ([ddd-core.md §3.1](ddd-core.md))
18. **Type safety** — `tsconfig` `strict: true`; never use `any` to escape type errors; prefer branded types or value objects over loose primitives at Domain boundaries
19. **Async discipline** — Repository / QueryRepository / external clients return `Promise`; Domain methods stay synchronous unless the rule itself is asynchronous

---

**References:**
- [ddd-modeling.md](ddd-modeling.md) — Strategic domain modeling (bounded context discovery, aggregate design)
- [ddd-core.md](ddd-core.md) — Language-agnostic DDD + Clean Architecture specification
- [The Clean Architecture — Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design Reference — Eric Evans](https://domainlanguage.com/ddd/reference/)
