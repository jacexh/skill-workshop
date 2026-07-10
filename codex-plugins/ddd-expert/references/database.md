---
name: database
description: Mandatory MySQL persistence house style for xorm adapters, schemas, SQL, indexes, concurrency, migrations, read models, integration state, and scale mechanisms.
---

# MySQL Persistence House Style

Use this reference whenever accepted Tactical Design requires MySQL persistence. Model ownership and consistency boundaries come first; this file then governs their physical representation.

## Authority and Applicability

- **[DDD Principle]** A semantic or consistency property that persistence must preserve.
- **[House Rule]** A mandatory implementation rule once its described scenario applies. An uncovered capability requires an explicit accepted technology or design decision; do not silently choose another convention or library.
- **[Heuristic]** A fact-finding or capacity signal. It helps decide whether a scenario applies; it is not permission to ignore an applicable House Rule.

The adopted stack is MySQL 8 with `xorm.io/xorm` and `github.com/go-sql-driver/mysql`. Verify the deployed MySQL minor version, InnoDB row format, SQL mode, topology, and migration tooling before relying on a version-dependent capability. That verification may select the supported execution mechanism; it does not weaken the schema and persistence rules below.

## Navigation

| Need | Section |
|---|---|
| Repository, QueryRepository, and Runtime ownership | Persistence Responsibilities |
| Table names, standard columns, and physical types | Naming, Engine, and Encoding; Standard Columns; Physical Types |
| Aggregate, read-model, integration, and process tables | Role-Specific Table Shapes |
| Indexes, query shape, writes, and pagination | Index Design; SQL Shape |
| Optimistic/pessimistic concurrency | Transactions and Concurrency |
| Safe schema change | Migrations |
| Conditional scale mechanisms | Partitioning and Sharding |

## 1. Persistence Responsibilities

- **[DDD Principle]** Tables are persistence representations, not Domain objects. An Aggregate may map to several tables, and a read model may project or join several sources.
- **[DDD Principle]** The accepted Aggregate boundary determines atomic write ownership. A foreign key, shared table, or database transaction does not create an Aggregate boundary.
- **[House Rule]** A command-side Repository persists exactly one Aggregate Root and its owned state in one local transaction. Independent Aggregate changes require an accepted coordination design.
- **[House Rule]** Lists, pages, history, reports, statistics, cross-Aggregate composition, denormalized views, and optimized projections use an Application-owned QueryRepository. A focused read of one reasonably sized Aggregate may use its Domain Repository when full reconstitution is appropriate and no distinct read semantics exist.
- **[House Rule]** Integration tables, idempotency records, projection checkpoints, and process state are introduced only by an accepted flow. Once introduced, they use this file's naming, standard columns, types, indexes, migration, and concurrency rules.
- **[House Rule]** Transport never queries tables or Repositories directly. Infrastructure owns xorm DOs and adapters; Runtime owns the shared engine lifecycle.

### Adopted Go Dependencies

```go
import (
    _ "github.com/go-sql-driver/mysql"
    "xorm.io/xorm"
)

func OpenEngine(dsn string) (*xorm.Engine, error) {
    return xorm.NewEngine("mysql", dsn)
}
```

- **[House Rule]** Runtime validates the DSN, opens and pings the engine, configures bounded connection pools, and closes the engine during shutdown.
- **[House Rule]** Bounded-context Infrastructure receives an initialized `*xorm.Engine`; it does not load configuration or open a process-wide connection.
- **[House Rule]** Use migrations for production schema changes. Do not use xorm auto-sync as a deployment mechanism.
- **[House Rule]** Bind external values through xorm/driver parameters. Never build SQL by concatenating input.

## 2. Naming, Engine, and Encoding

### Identifiers

- **[House Rule]** Database, table, column, and index identifiers contain lowercase ASCII letters, digits, and underscores only. They do not start with a digit, contain spaces or hyphens, or use uppercase letters.
- **[House Rule]** Identifiers do not use MySQL reserved words and do not exceed 64 characters.
- **[House Rule]** Database and table names are singular. A database name follows the application name, replacing hyphens with underscores and omitting a redundant `service` suffix.
- **[House Rule]** Related table names expose ownership or purpose, such as `user`, `user_login`, and `user_summary`.
- **[House Rule]** Column names express business or operational meaning in one or two words where practical. Do not use the table name as a column name.
- **[House Rule]** Every table and column has a descriptive comment.

### Storage Defaults

- **[House Rule]** Use `ENGINE=InnoDB`, `DEFAULT CHARSET=utf8mb4`, and `COLLATE=utf8mb4_unicode_ci` explicitly in every `CREATE TABLE` statement.
- **[House Rule]** Schema review checks collation semantics for every unique textual business key. Case-insensitive collation is not assumed to preserve case-sensitive identity.

### Index Names

| Kind | Required name | Example |
|---|---|---|
| Primary key | `PRIMARY KEY` on `id` for an unsharded table | `PRIMARY KEY (id)` |
| Unique index | `uniq_<columns>` | `uniq_order_no` |
| Regular index | `idx_<columns>` | `idx_user_id_status` |

For a partitioned or sharded physical table, the primary key may include the routing key as specified in the Scale Mechanisms section; `id` remains the logical record identity.

## 3. Standard Columns and Lifecycle

**[House Rule]** Every table governed by this profile, including Aggregate, owned-state, association, read-model, outbox, inbox, checkpoint, and process-state tables, contains these five standard columns:

```sql
`id` varchar(36) NOT NULL COMMENT 'UUIDv7 primary identity',
`version` int unsigned NOT NULL DEFAULT '1' COMMENT 'Stored row version',
`created_at` bigint NOT NULL DEFAULT '0' COMMENT 'Creation time in Unix milliseconds',
`updated_at` bigint NOT NULL DEFAULT '0' COMMENT 'Last update time in Unix milliseconds',
`deleted_at` bigint NOT NULL DEFAULT '0' COMMENT 'Deletion time in Unix milliseconds; 0 means active'
```

- **[House Rule]** Generate `id` as UUIDv7 in the application with `github.com/google/uuid` and store its canonical text in `varchar(36)`.
- **[House Rule]** A new in-memory Aggregate has `Version == 0`; its `INSERT` explicitly writes stored `version = 1`. Rows created outside an Aggregate also start at stored version `1`.
- **[House Rule]** `created_at`, `updated_at`, and `deleted_at` use Unix milliseconds supplied by the application. `timestamp` and `datetime` are not used in this house style.
- **[House Rule]** Active-row reads include `deleted_at = 0`. Reads of deleted data are explicit administrative, retention, audit, or recovery paths.
- **[House Rule]** A soft delete is a version-checked update that sets `deleted_at`, `updated_at`, and increments `version`; it is not an unguarded flag update.
- **[House Rule]** Append-only rows still insert the five columns. They remain at version `1` unless an accepted operational lifecycle updates them.

```sql
UPDATE sales_order
SET deleted_at = ?, updated_at = ?, version = version + 1
WHERE id = ? AND version = ? AND deleted_at = 0;
```

Check affected rows. Zero rows maps to the same stable concurrency-conflict error used by an Aggregate update.

## 4. Physical Types

### Numeric Values

| Meaning | Required representation |
|---|---|
| UUIDv7 identity | `varchar(36)` |
| Two-decimal monetary amount | `bigint`, stored in minor units, for example `12345` means `123.45` |
| Other exact money or quantity | `bigint` with an explicitly modeled unit/exponent, or `decimal(p,s)` with accepted precision and scale |
| Status or compact type code | `tinyint unsigned` |
| Counter | `int unsigned` or `bigint unsigned` according to accepted capacity |
| Unix-millisecond time | `bigint` |
| Optimistic version | `int unsigned` |

- **[DDD Principle]** Money includes amount, currency, and unit/exponent semantics. Storage must not silently assume two decimals for currencies or assets whose contract differs.
- **[House Rule]** `float` and `double` are prohibited for exact business values. Use integer units or `decimal`.
- **[House Rule]** Integer signedness and capacity match the business range; do not use unsigned arithmetic when negative values are meaningful.

### Text, Binary, and Structured Values

- **[House Rule]** Short bounded text uses `varchar(n)` with `n` derived from the accepted maximum. Fixed-length values may use `char(n)` only when `n <= 16`; longer values use `varchar`.
- **[House Rule]** Large text uses `text` only when the record owns it and query paths do not require indexing the full value.
- **[House Rule]** Large binary objects live in object storage with a persisted locator unless atomic database ownership of the bytes is explicitly accepted.
- **[House Rule]** MySQL `enum` and `set` are prohibited. Persist stable numeric or textual codes and map them explicitly in Infrastructure.
- **[House Rule]** JSON is used only for accepted flexible or contract-shaped data. Fields used for core constraints, joins, ordering, or frequent filtering are modeled as typed columns or verified generated columns with indexes.

### NULL and Defaults

- **[House Rule]** Persistence preserves the accepted distinction among `NULL`, empty string, zero, and an absent row.
- **[House Rule]** Ordinary scalar columns are `NOT NULL` and declare an explicit default. Strings default to `''`; numeric and Unix-millisecond columns default to `0`; row versions default to `1`.
- **[House Rule]** A field whose Domain meaning is genuinely optional uses an explicit representation accepted in Tactical Design; it must not turn unknown into an apparently valid zero value merely to avoid `NULL`.
- **[House Rule]** `text`, `blob`, and other types whose default support varies by MySQL version are `NOT NULL` without a schema default; every `INSERT` supplies the value explicitly.

## 5. Role-Specific Table Shapes

### Aggregate Write Model

```sql
CREATE TABLE `sales_order` (
  `id` varchar(36) NOT NULL COMMENT 'UUIDv7 primary identity',
  `order_no` varchar(32) NOT NULL DEFAULT '' COMMENT 'Business order number',
  `user_id` varchar(36) NOT NULL DEFAULT '' COMMENT 'Ordering user identity',
  `merchant_id` varchar(36) NOT NULL DEFAULT '' COMMENT 'Merchant identity',
  `status` tinyint unsigned NOT NULL DEFAULT '0' COMMENT 'Persisted order status code',
  `amount_minor` bigint NOT NULL DEFAULT '0' COMMENT 'Amount in accepted minor units',
  `currency` char(3) NOT NULL DEFAULT '' COMMENT 'ISO currency code',
  `paid_at` bigint NOT NULL DEFAULT '0' COMMENT 'Payment time in Unix milliseconds; 0 means unpaid',
  `remark` varchar(500) NOT NULL DEFAULT '' COMMENT 'Order remark',
  `version` int unsigned NOT NULL DEFAULT '1' COMMENT 'Stored row version',
  `created_at` bigint NOT NULL DEFAULT '0' COMMENT 'Creation time in Unix milliseconds',
  `updated_at` bigint NOT NULL DEFAULT '0' COMMENT 'Last update time in Unix milliseconds',
  `deleted_at` bigint NOT NULL DEFAULT '0' COMMENT 'Deletion time in Unix milliseconds; 0 means active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_order_no` (`order_no`),
  KEY `idx_user_id_deleted_at_created_at_id` (`user_id`, `deleted_at`, `created_at`, `id`),
  KEY `idx_merchant_id_status_deleted_at` (`merchant_id`, `status`, `deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sales order Aggregate root';
```

- **[House Rule]** Owned child rows carry the root identity and a child identity or stable ordinal. Uniqueness and indexes reflect root ownership.
- **[House Rule]** Infrastructure DOs contain xorm tags and storage-only fields; Domain Entities contain neither ORM tags nor storage timestamps.
- **[House Rule]** `infrastructure/convert.go` performs explicit DO/Domain conversion for existing data. New objects use a Domain Factory, not a DO converter.

### CQRS Read Model

```sql
CREATE TABLE `order_summary` (
  `id` varchar(36) NOT NULL COMMENT 'UUIDv7 projection row identity',
  `order_id` varchar(36) NOT NULL DEFAULT '' COMMENT 'Source order identity',
  `user_id` varchar(36) NOT NULL DEFAULT '' COMMENT 'Ordering user identity',
  `display_status` varchar(24) NOT NULL DEFAULT '' COMMENT 'Display status',
  `amount_minor` bigint NOT NULL DEFAULT '0' COMMENT 'Amount in accepted minor units',
  `currency` char(3) NOT NULL DEFAULT '' COMMENT 'ISO currency code',
  `source_version` int unsigned NOT NULL DEFAULT '0' COMMENT 'Last applied source version',
  `version` int unsigned NOT NULL DEFAULT '1' COMMENT 'Projection row version',
  `created_at` bigint NOT NULL DEFAULT '0' COMMENT 'Creation time in Unix milliseconds',
  `updated_at` bigint NOT NULL DEFAULT '0' COMMENT 'Last projection time in Unix milliseconds',
  `deleted_at` bigint NOT NULL DEFAULT '0' COMMENT 'Deletion time in Unix milliseconds; 0 means active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_order_id` (`order_id`),
  KEY `idx_user_id_deleted_at_created_at_id` (`user_id`, `deleted_at`, `created_at`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Order list read model';
```

- **[House Rule]** A read-model table is shaped from its concrete filter, sort, display, freshness, and authorization semantics. It does not copy an Aggregate schema mechanically.
- **[House Rule]** Projection consumers use a source version, message identity, or accepted checkpoint to make duplicate and out-of-order behavior explicit.
- **[House Rule]** QueryRepository returns Application read DTOs and selects only required columns. It does not reconstitute Domain Entities for a projection path.

### Integration and Process State

These tables are conditional. Do not introduce them merely because the schema profile describes them.

- **[House Rule]** When committed Aggregate state and publish intent must not diverge, an accepted outbox row is inserted in the same local xorm transaction as the Aggregate state. Its minimum business columns are `message_kind`, `message_version`, `payload`, `occurred_at`, `available_at`, `status`, `attempts`, and bounded error evidence in addition to the five standard columns.
- **[House Rule]** When a local transactional consumer side effect must be idempotent, an accepted inbox/idempotency table enforces a consumer-scoped message or business key with a unique index and commits the record in the same local transaction. External RPC, broker, and file effects require a separate accepted idempotency or recovery protocol.
- **[House Rule]** A durable Process Manager or orchestrated Saga stores its correlation key, process kind, current state, input/message checkpoint, next action or wake-up time, and terminal outcome in addition to the five standard columns. State changes use optimistic locking.
- **[House Rule]** Pending-work scans use a concrete composite index that begins with equality state and availability predicates and ends with a deterministic tie-breaker such as `id`.
- **[House Rule]** Retention or archival is explicit. Successful publication or process completion does not authorize immediate physical deletion when replay, audit, or incident diagnosis requires the row.

```sql
KEY `idx_status_available_at_id` (`status`, `available_at`, `id`),
UNIQUE KEY `uniq_consumer_message` (`consumer`, `message_id`),
UNIQUE KEY `uniq_process_correlation` (`process_kind`, `correlation_id`)
```

## 6. Index Design

### Operational Caps

- **[House Rule]** A table has no more than 16 indexes, including the primary key.
- **[House Rule]** An index has no more than 5 key parts.
- **[House Rule]** A partitioned table's physical primary key has no more than 3 key parts.
- **[House Rule]** Under the adopted MySQL 8, InnoDB 16 KiB page, and dynamic row-format baseline, an index key does not exceed 3072 bytes. Calculate bytes from the declared charset and prefixes. If the deployed baseline differs, establish its supported limit before writing the migration.
- **[House Rule]** Prefix indexes are permitted only when measured prefix cardinality and the concrete query semantics are sufficient; uniqueness never relies on a lossy prefix.

The legacy 767-byte/191-utf8mb4-character limit is not a MySQL 8 universal limit and must not be copied into new schema decisions.

### Access-Path Rules

- **[House Rule]** Every index serves a concrete uniqueness, filter, join, ordering, projection, or locking path. Column popularity alone is not an index design.
- **[House Rule]** Production join keys and high-frequency filter/order paths have compatible indexes with matching types and collations.
- **[House Rule]** Composite index order follows the actual equality predicates, then range/order requirements, covering needs, and MySQL leftmost-prefix behavior. Do not put a column first merely because it has higher standalone selectivity.
- **[House Rule]** Remove redundant indexes after accounting for leftmost prefixes and the InnoDB primary-key suffix on secondary indexes.
- **[House Rule]** `deleted_at` is not a standalone index unless a concrete recycle, purge, audit, or recovery query uses it selectively. For ordinary active-row access it belongs in the composite index position supported by the full query.
- **[House Rule]** `updated_at` is indexed when CDC, incremental synchronization, or an operational scan uses it. `created_at` is indexed when an accepted ordering or range path uses it. Do not index every timestamp automatically.
- **[House Rule]** Material new or changed queries include representative `EXPLAIN ANALYZE` or equivalent plan evidence before release.

## 7. SQL Shape

### Reads

- **[House Rule]** Stable application queries list required columns; `SELECT *` is prohibited.
- **[House Rule]** Except for declared static tables with fewer than 100 rows, an operational query has a bounded, indexable predicate. MySQL may still choose a scan for a small or high-coverage result; the plan, not a slogan, proves whether that is acceptable.
- **[House Rule]** A leading-wildcard predicate such as `LIKE '%term%'` is prohibited on an unbounded candidate set. Use an accepted search capability or first bound the set through another indexed equality path.
- **[House Rule]** Predicate values use the same type and collation as indexed columns; implicit conversion is prohibited.
- **[House Rule]** Do not apply functions or expressions to an indexed column in a predicate when that prevents the required access path. Use a supported generated column when the derived value is an accepted query key.
- **[House Rule]** An `IN` list contains no more than 50 values. Larger input is chunked or handled by an accepted bulk/query mechanism.
- **[Heuristic]** `OR`, subqueries, joins, and full scans are evaluated with representative plans and row counts. Several application round trips are not automatically safer or faster than one owned-database join.
- **[House Rule]** A production read joins no more than three tables and never joins across databases. All selected columns are qualified through aliases.

### Pagination

- **[House Rule]** Deep or unbounded traversal uses keyset pagination with a deterministic indexed order and unique tie-breaker.
- **[House Rule]** Offset pagination is limited to accepted bounded or randomly addressable page ranges whose plan and latency meet the product requirement.

```sql
SELECT id, order_no, status, created_at
FROM sales_order
WHERE user_id = ?
  AND deleted_at = 0
  AND (
    created_at < ?
    OR (created_at = ? AND id < ?)
  )
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

Do not assume a row-constructor range such as `(created_at, id) < (?, ?)` will produce a full composite range seek on every MySQL 8 minor version. Use the expanded predicate above and verify the target deployment with `EXPLAIN ANALYZE` or equivalent supported plan evidence.

### Writes

- **[House Rule]** `INSERT` names every column; `INSERT INTO t VALUES (...)` is prohibited.
- **[House Rule]** A batch `INSERT` contains at most 1000 rows.
- **[House Rule]** A transaction changes at most 2000 rows and executes at most 5 SQL statements. A use case that cannot fit these bounds requires an accepted bulk, streaming, or consistency design.
- **[House Rule]** `UPDATE` and `DELETE` use deterministic predicates and check affected rows. An update/delete with an arbitrary `LIMIT` is prohibited.
- **[House Rule]** `UPDATE ... JOIN`, `DELETE ... JOIN`, cross-database joins, correlated update/delete subqueries, stored procedures, stored functions, triggers, views, scheduled database events, and foreign keys are prohibited in this house style.
- **[House Rule]** Required relationships and uniqueness are enforced through owned write logic plus primary/unique constraints. The foreign-key prohibition is a deployment house rule, not a claim that DDD forbids foreign keys.

## 8. Transactions and Concurrency

- **[DDD Principle]** Transaction scope implements an accepted consistency boundary; it does not define one.
- **[House Rule]** Keep transactions short, acquire locks in stable primary-key order, and update by primary or unique keys where possible.
- **[House Rule]** HTTP, RPC, file, Kafka, and other external calls do not occur inside a database transaction. A flow that requires atomic durable handoff uses an accepted local record such as an outbox, not an open network call.

### Optimistic Aggregate Lifecycle

```sql
-- New in-memory Aggregate Version == 0; stored row begins at 1.
INSERT INTO sales_order (
  id, order_no, user_id, merchant_id, status,
  amount_minor, currency, paid_at, remark,
  version, created_at, updated_at, deleted_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0);

-- Existing Aggregate update.
UPDATE sales_order
SET status = ?, updated_at = ?, version = version + 1
WHERE id = ? AND version = ? AND deleted_at = 0;
```

- **[House Rule]** The Repository checks affected rows. An update count other than one maps to a stable concurrency-conflict error; do not hide it as not-found or success.
- **[House Rule]** `Repository.Save` does not increment the in-memory Aggregate version. After a successful Save, the instance is stale: Application may assemble a result and drain already-recorded events, but it must not expose the stale Version as the newly persisted concurrency token, mutate, or save that instance again. A later transaction reloads it.
- **[House Rule]** An Aggregate spanning several owned tables uses one `*xorm.Session` transaction. All writes succeed or roll back together.

```go
affected, err := session.Where(
    "id = ? AND version = ? AND deleted_at = 0",
    aggregate.ID,
    aggregate.Version,
).Incr("version").Cols("status", "updated_at").Update(data)
if err != nil {
    return err // Infrastructure wraps once with owned operation context.
}
if affected != 1 {
    return domain.ErrConcurrentModification
}
```

### Pessimistic Locking

- **[House Rule]** Use `SELECT ... FOR UPDATE` only when accepted behavior requires a decision against current locked state and expected contention makes optimistic retry unsuitable.
- **[House Rule]** Lock rows in stable primary-key order and keep the decision plus writes in the same local transaction.
- **[House Rule]** After a deadlock or lock timeout, roll back and close the whole session, reload current Aggregate state, and rerun the complete use case only under an accepted bounded retry policy. Never retry only the failed SQL statement or continue using the prior transaction; otherwise return an explicit failure.

```sql
SELECT id, balance, version
FROM account
WHERE id IN (?, ?) AND deleted_at = 0
ORDER BY id
FOR UPDATE;
```

A row version or row lock protects local database state; it does not provide cross-service consistency.

## 9. Migrations

### Files and Ownership

```text
migrations/
├── 001_create_sales_order.sql
├── 002_add_order_lookup_index.sql
├── 003_expand_order_currency.sql
└── 004_contract_legacy_amount.sql
```

- **[House Rule]** Migration files are ordered, immutable after deployment, and contain comments describing intent, compatibility, and recovery.
- **[House Rule]** Every migration has a tested roll-forward path and an explicit rollback decision. Include a `DOWN` operation only when reversing it is data-safe; destructive reversal is not presented as reliable recovery.
- **[House Rule]** A deployed migration remains compatible with every application version that may run during the rollout.
- **[House Rule]** Incompatible changes use expand -> backfill -> switch reads/writes -> contract. Large backfills are observable, restartable, and bounded below the 1000-row batch and 2000-row transaction caps.
- **[House Rule]** Verify the exact MySQL minor version and operation before claiming `INSTANT`, `INPLACE`, or `LOCK=NONE`. Requested syntax is not proof that the server avoids a table rebuild or blocking lock.
- **[House Rule]** Dry-run migration order and syntax against representative MySQL data, then record duration, locks, replication impact, affected rows, and recovery evidence.

```sql
-- Expand: application versions can tolerate the new column.
ALTER TABLE sales_order
  ADD COLUMN channel varchar(16) NOT NULL DEFAULT '' COMMENT 'Ordering channel';

-- Add an index only after verifying algorithm support on the deployed server.
ALTER TABLE sales_order
  ADD INDEX idx_channel_created_at_id (channel, created_at, id),
  ALGORITHM=INPLACE,
  LOCK=NONE;
```

When a new non-null value cannot be assigned safely by a schema default, first add a nullable expansion column, backfill in bounded batches, switch all writers, validate, then contract it to `NOT NULL`.

## 10. Partitioning and Sharding

Partitioning and sharding are conditional scale mechanisms. Do not introduce them without measured size, retention, locality, throughput, or operational evidence and an accepted routing design.

### Sharding

- **[House Rule]** The accepted topology contains no more than 1024 databases and 4096 physical tables.
- **[House Rule]** Every sharded-table query includes the sharding key so one request does not silently fan out.
- **[House Rule]** The sharding key participates in the physical primary key and has its own single-column index for routing. The logical UUIDv7 `id` remains explicit.
- **[Heuristic]** At 5 million rows or 2 GiB in one physical shard table, perform a measured capacity review. This is an operational review threshold, not a universal MySQL storage limit and not an automatic instruction to reshard.

### MySQL Partitioning

MySQL requires every unique key on a partitioned table to include every column used by the partitioning expression.
- **[House Rule]** A partitioned table contains no more than 1024 partitions including subpartitions, and production access paths include the partition key for pruning.
- **[House Rule]** Verify representative plans prove partition pruning. A path that requires cross-partition fan-out requires an explicit accepted read or scale design.
- **[Heuristic]** At 2 GiB in one partition, review retention, scan cost, DDL behavior, backup, and recovery. File size alone does not select the next mechanism.

## 11. Required Verification

- **[House Rule]** Repository integration tests run against MySQL and cover insert version `1`, update comparison/increment, affected-row conflict mapping, active-row filtering, owned-table rollback, and DO conversion.
- **[House Rule]** QueryRepository integration tests cover real column selection, filters, stable ordering, pagination boundaries, and read-model mapping.
- **[House Rule]** Applicable outbox, inbox, projection, or process-state tests cover atomic persistence, uniqueness/idempotency, duplicate delivery, out-of-order evidence, and pending-work index paths.
- **[House Rule]** Schema review checks naming, five standard columns, types, comments, collation, index caps, redundant indexes, migration compatibility, and representative query plans.

## Related References

- [`ddd-modeling.md`](ddd-modeling.md) for ownership, lifecycle, and Aggregate boundaries.
- [`ddd-core.md`](ddd-core.md) for Repository, CQRS, and transaction semantics.
- [`ddd-collaboration.md`](ddd-collaboration.md) for durable handoff, idempotency, and Process Manager semantics.
- [`ddd-golang-infrastructure.md`](ddd-golang-infrastructure.md) for xorm DO conversion and Repository adapters.
- [`ddd-golang-cqrs.md`](ddd-golang-cqrs.md) for Application QueryRepository contracts.
- [`ddd-golang-events-messages.md`](ddd-golang-events-messages.md) for conditional outbox and consumer flows.
