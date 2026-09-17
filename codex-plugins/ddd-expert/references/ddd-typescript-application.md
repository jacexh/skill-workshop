---
name: ddd-typescript-application
description: TypeScript House Style for Application methods, assemblers, commands, queries, and Units of Work.
---

# TypeScript Application Layer

## Applies When

Load this leaf when a TypeScript use case, entry, assembler, Application DTO,
QueryRepository, semantic outbound port, or transaction scope is touched.

## Application Entry and Assembler

Use one `Application` class in `application/application.ts`, following the
[shared Application shape](ddd-core.md#application-and-transport-shape).
Its named methods implement use cases directly. Extract cohesive collaborators
into responsibility-named files when they isolate substantial coordination.

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

Commands and results use readonly structural types. An Application method
coordinates the use case and calls named Domain behavior.

```ts
export class Application {
  constructor(private readonly users: UserRepository) {}

  async createUser(
    command: Readonly<{ name: string; email: string }>,
  ): Promise<Readonly<{ id: string }>> {
    const user = User.create(command);
    await this.users.save(user);
    return { id: user.id };
  }
}
```

For an accepted multi-Root local transaction, Application defines the Unit of
Work callback. Infrastructure supplies every participating Repository from the
same concrete Kysely transaction. Domain remains transaction-unaware.

Accepted event flows use
[ddd-typescript-events-messages.md](ddd-typescript-events-messages.md). Accepted
tasks use [ddd-typescript-taskqueue.md](ddd-typescript-taskqueue.md).

## Query Shape

Expose reads as Application methods or a cohesive query object returning readonly
read models. A focused Aggregate read may load and map the existing Root; lists,
search, reports, and other distinct read semantics use an asynchronous
Application-owned QueryRepository. A read model needs no separate Handler or store.

## Verification

Use real use cases and Domain objects with focused typed fakes. Prove mapping,
semantic call order, immutable results, and the complete accepted Repository set
inside a Unit of Work. Prove physical transaction participation separately at
the Kysely/MySQL boundary.
