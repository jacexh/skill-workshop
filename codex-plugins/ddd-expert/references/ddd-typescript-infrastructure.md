---
name: ddd-typescript-infrastructure
description: TypeScript House Style for Kysely persistence, QueryRepositories, Units of Work, and outbound ACLs.
---

# TypeScript Infrastructure Layer

## Applies When

Load this leaf when TypeScript persistence, a read adapter, local transaction
implementation, or outbound provider/ACL is touched. Load
[database.md](database.md) for MySQL schema and SQL shape.

## Placement and Conversion

Use `src/business/<context>/infrastructure/persistence/` for Kysely database
types, conversion, Repository, and QueryRepository adapters. Runtime creates one
Kysely/mysql2 pool per database and injects it.

Kysely table interfaces describe adapter types; ordered `migrations/*.sql` are
the schema authority. DECIMAL and unsafe BIGINT values remain strings until an
explicit boundary conversion.

```ts
import type { Selectable } from "kysely";

export type UserDO = Pick<
  Selectable<UserTable>,
  "id" | "name" | "email" | "version"
>;

export function convertUserDO(row: UserDO): User {
  return User.reconstitute({ ...row });
}

export function convertUserEntity(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  } as const;
}
```

Conversion performs explicit mechanical mapping, copies mutable values, and
calls Domain reconstitution for existing state.

## Repository and Unit of Work

The Repository accepts either a pool executor or the transaction supplied by
the Unit of Work:

```ts
type Executor = Kysely<Database> | Transaction<Database>;

export class KyselyUserRepository implements UserRepository {
  constructor(
    private readonly db: Executor,
    private readonly nowMillis: () => number,
  ) {}

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

    const result = await this.db.updateTable("user").set({
      name: data.name,
      email: data.email,
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

An accepted Unit of Work uses `db.transaction().execute` and constructs every
participating Repository on the callback's `Transaction<Database>`.

QueryRepositories select explicit columns, apply stable indexed order, and
return readonly Application DTOs. Outbound adapters fulfill Domain-owned and
Application-owned ports through one or more provider/generated contracts. The
adapter owns source composition and any accepted fulfillment policy; Platform
owns credentials, client lifecycle, and policy configuration. Preserve the
first external error in `cause` while translating to a stable inner error.

## Verification

Apply root migrations and run Repository/QueryRepository/Unit-of-Work evidence
against Testcontainers MySQL. Cover mapping, insert version `1`, guarded update
and conflict, complete transaction participation, active-row filtering, driver
runtime types, query order/cursors, and stable error translation. For a changed
Domain-owned Port implementation, verify its Domain result and any accepted
fulfillment policy at the adapter boundary.
