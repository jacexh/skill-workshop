---
name: ddd-python-infrastructure
description: Python House Style for SQLAlchemy persistence, QueryRepositories, local transaction adapters, and outbound ACLs.
---

# Python Infrastructure Layer

## Applies When

Load this leaf when Python persistence, read adapters, a local transaction
implementation, or an outbound provider/ACL is touched. Load
[database.md](database.md) as well for MySQL schema and SQL shape.

## Placement and Resources

Use `business/<context>/infrastructure/persistence/{model,convert,repository,query_repository}.py`
and semantic `acl/` or outbound-adapter modules. Runtime creates one SQLAlchemy
Engine per database, one synchronous session factory, and shared provider
clients; adapters receive them through constructors.

SQLAlchemy models are persistence types. Ordered root `migrations/*.sql` remain
the production schema authority.

## Conversion

Conversion is mechanical: select explicit fields, copy mutable values, translate
enums, call Domain reconstitution/validation for existing state, and perform no
I/O, logging, event creation, or business branch.

```python
def to_domain(row: UserRow) -> User:
    return User.reconstitute(
        user_id=UUID(row.id),
        name=row.name,
        email=Email(row.email),
        status=UserStatus(row.status),
        version=row.version,
    )


def to_mutable_values(user: User) -> dict[str, object]:
    return {
        "name": user.name,
        "email": user.email.value,
        "status": user.status.value,
    }
```

## Repository Shape

Use synchronous SQLAlchemy 2 `Session`. `save()` covers insert and
version-guarded update for the request-scoped optimistic lifecycle. SQL owns
technical timestamps and the stored version increment.

```python
class UserRepositoryAdapter:
    def __init__(self, sessions: sessionmaker[Session], now_millis: Callable[[], int]) -> None:
        self._sessions = sessions
        self._now_millis = now_millis

    def save(self, user: User) -> None:
        values = to_mutable_values(user)
        now = self._now_millis()
        with self._sessions.begin() as session:
            if user.version == 0:
                session.add(UserRow(
                    id=str(user.id),
                    **values,
                    version=1,
                    created_at=now,
                    updated_at=now,
                    deleted_at=0,
                ))
                return

            result = session.execute(
                update(UserRow)
                .where(
                    UserRow.id == str(user.id),
                    UserRow.version == user.version,
                    UserRow.deleted_at == 0,
                )
                .values(**values, version=UserRow.version + 1, updated_at=now)
            )
            if result.rowcount != 1:
                raise ConcurrentModificationError(user.id)
```

Translate `IntegrityError`/`DBAPIError` once into stable inner errors while
preserving the cause. Keep the stable concurrency error outside a broad provider
catch. A successful save leaves the in-memory version unchanged.

## Transactions, Reads, and ACLs

An accepted multi-Root Unit of Work opens one `Session.begin()` and constructs
every participating Repository against that same `Session`; the callback never
uses a separately pool-scoped Repository.

A QueryRepository selects explicit columns, applies stable indexed ordering,
and constructs frozen Application DTOs explicitly. It does not reconstitute an
Aggregate or return SQLAlchemy rows.

Outbound ACLs translate local semantic contracts to provider/generated
contracts. They receive a process-managed synchronous `httpx.Client` or other
adopted client; Runtime owns credentials, pooling, timeouts, and provider
configuration.

## Verification

Apply root migrations to real MySQL. Verify conversion, insert version `1`,
guarded update/conflict, transaction participation, active-row filtering,
query ordering/cursor behavior, provider runtime types, and stable error
translation. Use Testcontainers when physical MySQL behavior is part of the
change.
