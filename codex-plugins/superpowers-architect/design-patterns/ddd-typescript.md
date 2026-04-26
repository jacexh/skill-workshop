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
- **Architecture spec**: [`ddd-core.md`](ddd-core.md) — Language-agnostic DDD + Clean Architecture rules. All architecture principles defer to `ddd-core.md`; in particular, the consolidated principles checklist lives at [ddd-core.md §10](ddd-core.md).
- This document is the TypeScript implementation guide that builds on both
**Runtime**: Node.js 22+  
**TypeScript**: 5.6+

> **Cross-reference convention**: every section number below mirrors the corresponding `ddd-core.md` section (e.g., §3.2 here ↔ ddd-core.md §3.2). The TypeScript guide adds only what is implementation-specific; for the full language-agnostic rationale, jump to the matching `ddd-core` section.

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
- As a default rule, one command modifies one aggregate; cross-aggregate workflows should prefer domain events and eventual consistency unless a stronger consistency requirement is explicit
- Dispatch domain events only after successful persistence
- QueryRepository interfaces live here, return DTOs, and bypass Domain aggregates on the read side

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
- Owns optimistic locking implementation
- Must not leak ORM entities into Domain

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
    const values = {
      name: user.name,
      email: user.email.value,
      status: user.status,
      version: user.version + 1,
      updated_at: new Date(),
    };

    const result = await this.db
      .updateTable("users")
      .set(values)
      .where("id", "=", user.id)
      .where("version", "=", user.version)
      .executeTakeFirst();

    if (Number(result.numUpdatedRows ?? 0) === 0) {
      throw new ConcurrentModificationError(user.id);
    }
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
| **Application Service** | Application | use-case orchestration |
| **Event Handler** | Application | subscribed handler class/function |
| **DTO** | Application / Interface | explicit transfer `type` |
| **Factory** | Domain | static `create()` / dedicated factory |
| **CQRS** | Application | command/query separation |

---

## 5. Cross-Context Communication

### 5.1 Direct Boundary Bypass Is Prohibited

Different bounded contexts should not bypass boundaries by directly reaching into another context's Repository or Domain objects.

Preferred integration styles:
- Domain events for asynchronous workflows and eventual consistency
- Anti-corruption layer / client abstraction for necessary synchronous integration
- Dedicated read model or public query API when another context needs data

### 5.2 When to Use Events

Use domain events when:
- the consumer does not need to block the producer
- eventual consistency is acceptable
- multiple consumers may react independently
- the producer should remain unaware of downstream workflows

### 5.3 When Synchronous Calls Are Acceptable

Synchronous cross-context calls are acceptable when:
- the use case is read-heavy and requires immediate data
- the dependency is explicit and stable
- you place the integration behind an application-facing interface or anti-corruption layer
- failure semantics and timeout behavior are designed explicitly

Do not turn every cross-context interaction into asynchronous messaging by default. Choose the simplest consistency model that satisfies the business requirement.

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
