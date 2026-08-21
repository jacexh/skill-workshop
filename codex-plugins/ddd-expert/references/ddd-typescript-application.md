---
name: ddd-typescript-application
description: TypeScript House Style for Application registries, assemblers, commands, queries, and Units of Work.
---

# TypeScript Application Layer

## Applies When

Load this leaf when a TypeScript use case, registry, assembler, Application DTO,
QueryRepository, semantic outbound port, or transaction scope is touched.

## Registry and Assembler

Every context exposes `application/application.ts`. It groups handlers and adds
no forwarding, discovery, provider wiring, or I/O.

```ts
export type Commands = Readonly<{ createUser: CreateUserHandler }>;
export type Queries = Readonly<{
  getUser: GetUserHandler;
  listUsers: ListUsersHandler;
}>;

export class Application {
  constructor(
    public readonly commands: Commands,
    public readonly queries: Queries,
  ) {}
}
```

`application/assembler.ts` maps existing Application DTO and Domain state.
DTOs are `Readonly` values; new objects enter through the Domain Factory.

```ts
export type UserDTO = Readonly<{
  id: string;
  name: string;
  email: string;
  version: number;
}>;

export function assembleUserDTO(dto: UserDTO): User {
  return User.reconstitute({ ...dto });
}

export function assembleUserEntity(user: User): UserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    version: user.version,
  };
}
```

## Command and Unit of Work

Commands and results use readonly structural types. A handler coordinates one
use case and calls named Domain behavior.

```ts
export interface UserUnitOfWork {
  execute<T>(
    work: (repositories: Readonly<{ users: UserRepository }>) => Promise<T>,
  ): Promise<T>;
}

export class CreateUserHandler {
  constructor(private readonly unitOfWork: UserUnitOfWork) {}

  async execute(
    command: Readonly<{ name: string; email: string }>,
  ): Promise<Readonly<{ id: string }>> {
    return this.unitOfWork.execute(async ({ users }) => {
      const user = User.create(command);
      await users.save(user);
      return { id: user.id };
    });
  }
}
```

For an accepted multi-Root local transaction, the callback receives every
Repository constructed on the same concrete Kysely transaction. Domain remains
transaction-unaware.

Accepted event flows use
[ddd-typescript-events-messages.md](ddd-typescript-events-messages.md). Accepted
tasks use [ddd-typescript-taskqueue.md](ddd-typescript-taskqueue.md).

## Query Shape

Every query enters through `application.queries` and returns a readonly
Application result. Accepted distinct read semantics use an asynchronous
Application-owned QueryRepository returning readonly DTOs.

## Verification

Use real handlers and Domain objects with focused typed fakes. Prove mapping,
semantic call order, immutable results, and the complete accepted Repository set
inside a Unit of Work. Prove physical transaction participation separately at
the Kysely/MySQL boundary.
