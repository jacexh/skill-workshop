---
name: ddd-typescript-domain
description: TypeScript House Style for accepted Aggregate Roots, Entities, Value Objects, Domain Services, Domain-owned Ports, and Repository contracts.
---

# TypeScript Domain Layer

## Applies When

Load this leaf when TypeScript Domain objects or their write Repository
contracts are touched. Accepted design supplies the object names, facts,
lifecycle, behavior, invariants, capabilities, and Domain Events.

## Placement and Shape

Place Domain code under `src/business/<context>/domain/`. Behavior-rich
Aggregates and Entities use classes with ECMAScript private state and named
methods. Read accessors exist for mapping, identity, and safe result creation.
Copy mutable inputs and outputs.

Factories establish valid new state. `reconstitute()` restores and validates
existing state without creation behavior. Application supplies an explicit UTC
instant when a business operation needs time.

```ts
import { v7 as uuidv7 } from "uuid";

type UserState = Readonly<{
  id: string;
  name: string;
  email: string;
  version: number;
}>;

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
      throw new InvalidUserError();
    }
    return new User(state);
  }

  get id(): string { return this.#state.id; }
  get name(): string { return this.#state.name; }
  get email(): string { return this.#state.email; }
  get version(): number { return this.#state.version; }

  rename(name: string): void {
    const next = { ...this.#state, name: name.trim() };
    User.validate(next);
    this.#state = next;
  }

  private static validate(state: UserState): void {
    if (state.id.length === 0 || state.name.length === 0) {
      throw new InvalidUserError();
    }
    if (!Number.isSafeInteger(state.version) || state.version < 0) {
      throw new InvalidUserError();
    }
  }
}
```

Value Objects are immutable values with valid-at-construction factories and
explicit value equality. Protocol decoding and persistence conversion remain at
outer boundaries.

## Lifecycle and Service Shape

For an accepted request-scoped optimistic lifecycle, a new Root uses version
`0`, Infrastructure stores version `1`, and `save()` leaves the loaded instance
stale. For an accepted resident lifecycle, the live object remains authoritative
and persistence accepts an immutable snapshot/checkpoint.

A Domain Service is a named, mostly stateless operation over Domain values,
snapshots, authoritative facts, or time. It returns a Domain decision, value,
error, or fact.

## Domain-owned Port

Declare each accepted Domain-owned Port as a narrow interface beside its direct
Domain owner. Use idiomatic signatures and injection for its accepted sparse
Methods.

## Repository Contract

```ts
import type { User } from "./user.js";

export interface UserRepository {
  get(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

export class ConcurrentModificationError extends Error {}
```

Place one write interface beside each accepted Root. Lists, reports, histories,
and projections use an Application QueryRepository.

## Verification

Test creation, reconstitution, invariants, transitions, Value Object equality,
Domain Services, accepted Domain-owned Ports with focused fakes, and accepted
event recording with real objects. Type-level assertions supplement rather than
replace runtime behavior evidence.
