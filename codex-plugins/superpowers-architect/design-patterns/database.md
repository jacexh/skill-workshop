---
name: database
description: Use when designing MySQL database schemas, defining table structures, creating indexes, writing SQL queries, or managing migrations. Covers naming conventions, field types, soft delete patterns, optimistic locking, and sharding strategies.
---

# MySQL Database Design Standard

## 1. Compliance Levels

| Level | Meaning | Action |
|-------|---------|--------|
| [MANDATORY] | Must follow, no exceptions | Code review will fail |
| [PREFERRED] | Strongly recommended | Explain reason if not following |
| [SUGGESTED] | Choose based on scenario | Keep consistent within team |

---

## 2. Naming Conventions

### 2.1 General Naming Rules

1. [MANDATORY] Use lowercase letters and numbers only, **UPPERCASE is prohibited**.
2. [MANDATORY] Use underscore `_` as separator, **spaces and hyphens are prohibited**, no leading numbers.
3. [PREFERRED] Avoid two underscores with only numbers between (e.g., `user__123__name`).
4. [MANDATORY] Name length must not exceed 64 characters.
5. [MANDATORY] Do not use MySQL reserved keywords (e.g., `order`, `table`, `date`, `key`, `index`).

### 2.2 Database Naming

1. [MANDATORY] Follow general naming rules.
2. [PREFERRED] Use singular form, not plural.
3. [PREFERRED] Database name should match application name (convert hyphens to underscores, remove suffixes like `service`).
4. [MANDATORY] Default character set `utf8mb4`, collation `utf8mb4_unicode_ci`.

### 2.3 Table Naming

1. [MANDATORY] Follow general naming rules.
2. [PREFERRED] Use singular form (e.g., `user` not `users`).
3. [PREFERRED] Related module tables should show relationships, e.g., `user` and `user_login`.
4. [MANDATORY] Explicitly specify character set as `utf8mb4`.
5. [MANDATORY] Must have table comment describing business module and data purpose.

### 2.4 Column Naming

1. [MANDATORY] Follow general naming rules.
2. [SUGGESTED] Use 1-2 words to express meaning, avoid abbreviations.
3. [MANDATORY] Column name must not be same as table name.
4. [MANDATORY] Must have column comment.

### 2.5 Index Naming

| Index Type | Naming Rule | Example |
|------------|-------------|---------|
| Primary Key | Fixed as `id` | `id` |
| Unique Index | `uniq_<column_name>` | `uniq_email` |
| Regular Index | `idx_<column_name>` | `idx_user_id` |
| Composite Index | `idx_<col1>_<col2>` | `idx_user_id_status` |

---

## 3. Table Structure Design

### 3.1 Standard Fields (Mandatory)

Every table must include the following 5 standard fields:

```sql
CREATE TABLE `example` (
  `id` varchar(36) NOT NULL COMMENT 'Primary key ID, UUID format',
  
  -- Business fields area
  
  `version` int unsigned NOT NULL DEFAULT '0' COMMENT 'Optimistic lock version',
  `created_at` bigint NOT NULL DEFAULT '0' COMMENT 'Creation timestamp (milliseconds)',
  `updated_at` bigint NOT NULL DEFAULT '0' COMMENT 'Update timestamp (milliseconds)',
  `deleted_at` bigint NOT NULL DEFAULT '0' COMMENT 'Soft delete timestamp (milliseconds), 0 means not deleted',
  
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Table example';
```

#### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | varchar(36) | UUID primary key, recommend UUIDv7 or Snowflake ID |
| `version` | int unsigned | Optimistic lock version, auto-increment on update |
| `created_at` | bigint | Unix timestamp (milliseconds), set by application |
| `updated_at` | bigint | Unix timestamp (milliseconds), updated by application |
| `deleted_at` | bigint | Soft delete marker, 0 = not deleted, non-zero = deletion time |

#### Soft Delete Query Patterns

```sql
-- Query non-deleted data (all business queries must include this condition)
SELECT * FROM table WHERE deleted_at = 0 AND ...;

-- Query deleted data
SELECT * FROM table WHERE deleted_at > 0 AND ...;

-- Soft delete operation
UPDATE table SET deleted_at = UNIX_TIMESTAMP(NOW()) * 1000, version = version + 1 WHERE id = ?;
```

### 3.2 Primary Key Design

1. [MANDATORY] Primary key type is `varchar(36)`, storing UUID.
2. [MANDATORY] Primary key name is `id`.
3. [SUGGESTED] Use UUIDv7 (time-ordered) or Snowflake ID, avoid completely random UUID to prevent index fragmentation.

### 3.3 Data Type Specifications

#### Numeric Types

| Scenario | Recommended Type | Description |
|----------|-----------------|-------------|
| Primary Key | `varchar(36)` | UUID primary key |
| Amount | `bigint` | **Store 100x the value**, e.g., $123.45 stored as 12345 |
| Status/Type | `tinyint unsigned` | e.g., status, type |
| Counter | `int unsigned` | e.g., view count, like count |
| Large Integer | `bigint` | e.g., timestamps, Snowflake IDs |
| Version | `int unsigned` | Optimistic lock version |

**[MANDATORY]** Disable `float`/`double`, use `bigint` (for amounts) or `decimal` (for precise decimals).

#### String Types

| Scenario | Recommended Type | Description |
|----------|-----------------|-------------|
| Short text (<255) | `varchar(n)` | n set based on actual max length |
| Long text | `text` | Large text blocks, use with caution |
| Binary data | `blob` | For images/files, recommend object storage with URL |
| Fixed length | `char(n)` | Use when n <= 16, otherwise use varchar |

**[MANDATORY]** `char` length > 16 must be changed to `varchar`.

#### Time Types

**[MANDATORY]** Use `bigint` to store Unix timestamp (milliseconds).

```sql
-- Creation time
`created_at` bigint NOT NULL DEFAULT '0' COMMENT 'Creation timestamp (milliseconds)',

-- Update time
`updated_at` bigint NOT NULL DEFAULT '0' COMMENT 'Update timestamp (milliseconds)',

-- Soft delete time
`deleted_at` bigint NOT NULL DEFAULT '0' COMMENT 'Delete timestamp (milliseconds), 0 means not deleted',
```

**[MANDATORY]** Disable `timestamp` (2038 limit), do not use `datetime` (timezone ambiguity).

#### Other Types

**[SUGGESTED]** Do not use `enum`/`set`, use `tinyint unsigned` instead.

**[SUGGESTED]** Avoid `blob`/`text`, if necessary create separate table for storage.

### 3.4 NULL and Default Values

1. [MANDATORY] Fields must use `NOT NULL` with `DEFAULT` value.
2. [MANDATORY] String types default to empty string `''`.
3. [MANDATORY] Numeric types default to `0`.
4. [MANDATORY] Timestamp fields default to `0`.

---

## 4. Index Design

### 4.1 Quantity Limits

1. [MANDATORY] Max 16 indexes per table.
2. [MANDATORY] Max 5 columns per index.
3. [MANDATORY] Max 3 primary key columns for partitioned tables.

### 4.2 Index Creation Principles

1. [MANDATORY] JOIN fields must have indexes.
2. [MANDATORY] High-frequency WHERE filter fields must have indexes.
3. [PREFERRED] In composite indexes, high-selectivity fields first, time range fields last.
4. [PREFERRED] Utilize composite index prefix, avoid redundant single-column indexes.
5. [SUGGESTED] Evaluate index necessity for low-selectivity fields (e.g., status=1 covers most data).

### 4.3 Index Length Limits

**[MANDATORY]** Max 767 bytes for indexed columns.

```sql
-- For utf8mb4, total indexed column length <= 191 characters
-- Use prefix index for long columns:
CREATE INDEX idx_name ON table_name(`name`(50));
```

### 4.4 Index Examples

```sql
-- Primary key (auto-created)
PRIMARY KEY (`id`),

-- Unique index
UNIQUE KEY `uniq_email` (`email`),

-- Regular index
KEY `idx_user_id` (`user_id`),

-- Composite index (high-selectivity fields first)
KEY `idx_user_id_status` (`user_id`, `status`),

-- Prefix index (long strings)
KEY `idx_name` (`name`(50)),

-- Timestamp indexes (add as needed)
-- idx_updated_at: Required for CDC sync, incremental queries
-- idx_deleted_at: Usually as last column in composite index, not standalone
KEY `idx_created_at` (`created_at`),
KEY `idx_updated_at` (`updated_at`)
```

### 4.5 Timestamp and Soft Delete Index Strategy

#### `updated_at` Index

[SUGGESTED] Must add when:
- CDC data sync (e.g., Canal, Debezium)
- Scheduled tasks scanning "recently updated" data
- Admin "recently updated" lists

#### `deleted_at` Index

[MANDATORY] All queries must include `deleted_at = 0` condition.

[SUGGESTED] `deleted_at` is usually **not a standalone index**, but placed as last column in composite index:

```sql
-- Recommended: Composite index includes deleted_at
KEY `idx_user_status_deleted` (`user_id`, `status`, `deleted_at`);

-- Query fully utilizes index
SELECT * FROM orders 
WHERE user_id = ? AND status = ? AND deleted_at = 0;
```

[SUGGESTED] Only create standalone `deleted_at` index when:
- Recycle bin feature (frequently query deleted data)
- Data archiving tasks (batch process by deletion time)

[Reason] `deleted_at = 0` usually covers 90%+ of data, very low selectivity, little benefit from standalone index.

---

## 5. SQL Writing Standards

### 5.1 Query Statements

1. [MANDATORY] Prohibit `SELECT *`, must specify specific fields.
2. [MANDATORY] Except static tables (<100 rows), queries must have WHERE condition using index.
3. [MANDATORY] WHERE condition prohibits `LIKE '%xxx%'` (prefix fuzzy), must have other equality conditions.
4. [MANDATORY] Both sides of WHERE equality must have same type, avoid implicit conversion.
5. [PREFERRED] `IN` list values not exceeding 50.
6. [PREFERRED] Reduce `OR` usage, can optimize to `UNION`.
7. [SUGGESTED] Avoid functions or expressions on indexed columns (e.g., `WHERE LENGTH(name) = 5` cannot use index).

### 5.2 Pagination Standards

**[PREFERRED]** Use Keyset pagination (cursor pagination):

```sql
-- Not recommended: OFFSET gets slower as it goes deeper
SELECT * FROM orders LIMIT 10000, 20;

-- Recommended: Keyset pagination (with index)
SELECT * FROM orders 
WHERE (created_at, id) < (?, ?) 
ORDER BY created_at DESC, id DESC 
LIMIT 20;
```

### 5.3 Write Statements

1. [MANDATORY] `INSERT` must specify column names, do not use `INSERT INTO t VALUES(...)`.
2. [SUGGESTED] Batch `INSERT` not exceeding 1000 rows per batch.
3. [SUGGESTED] Control batch update quantity within transactions, small batches multiple times.

### 5.4 Multi-Table Joins

1. [MANDATORY] Cross-database JOIN is prohibited.
2. [MANDATORY] JOIN in UPDATE/DELETE is prohibited.
3. [PREFERRED] Subqueries not recommended, rewrite as JOIN or multiple application queries.
4. [PREFERRED] Production multi-table JOIN not exceeding 3 tables.
5. [PREFERRED] Use aliases in JOIN, SELECT list references fields with aliases.

### 5.5 Prohibited SQL

**[MANDATORY]** The following SQL is prohibited in production:

```sql
-- 1. Uncertain update with LIMIT
UPDATE/DELETE t1 WHERE a = XX LIMIT XX;

-- 2. Correlated subquery
UPDATE t1 SET ... WHERE name IN (SELECT name FROM user WHERE ...);

-- 3. Stored procedures, functions, triggers, views, events, foreign keys
-- Implement all in application layer
```

---

## 6. Transaction and Concurrency Control

### 6.1 Transaction Standards

1. [SUGGESTED] INSERT/UPDATE/DELETE rows within transaction controlled under 2000.
2. [SUGGESTED] `IN` list parameters controlled under 50.
3. [SUGGESTED] SQL within transaction not exceeding 5 (except core scenarios like payments).
4. [SUGGESTED] Updates within transaction preferably based on primary key or unique key, avoid gap locks.
5. [PREFERRED] Move external calls (HTTP, RPC, files) outside transactions.

### 6.2 Optimistic Locking (Based on version Field)

```sql
-- Read with version number
SELECT id, ..., version FROM orders WHERE id = ? AND deleted_at = 0;

-- Update with version check
UPDATE orders 
SET status = ?, version = version + 1, updated_at = ? 
WHERE id = ? AND version = ? AND deleted_at = 0;

-- Check affected rows, 0 means concurrent conflict
```

**Applicable Scenarios**:
- Read-heavy write-light, low concurrent conflict probability
- High network latency, not suitable for long-duration database locks
- Need cross-service data consistency

### 6.3 Pessimistic Locking (FOR UPDATE)

```sql
BEGIN;

-- Lock in primary key order to prevent deadlocks
SELECT * FROM accounts WHERE id IN (?, ?) ORDER BY id FOR UPDATE;

-- Execute business operations
UPDATE accounts SET balance = balance - ? WHERE id = ?;
UPDATE accounts SET balance = balance + ? WHERE id = ?;

COMMIT;
```

**Applicable Scenarios**:
- Write-heavy read-light, frequent concurrent conflicts
- Strong consistency requirements (e.g., fund operations)
- Operations completed within same thread/process

---

## 7. Sharding

### 7.1 Sharding Rules

1. [MANDATORY] Max 1024 databases, max 4096 tables.
2. [PREFERRED] Single shard table not exceeding 5 million rows, file size not exceeding 2GB.
3. [MANDATORY] Sharding key must be in primary key, create single-column index.
4. [MANDATORY] SQL accessing sharded tables must include sharding key.

### 7.2 Partitioning Rules

1. [MANDATORY] Partitioned table's partition field must be in primary key.
2. [MANDATORY] Partitions (including subpartitions) not exceeding 1024.
3. [PREFERRED] Single partition file not exceeding 2GB.
4. [MANDATORY] SQL accessing partitioned tables must include partition key.

---

## 8. Migration Standards

### 8.1 File Naming

```
migrations/
├── 001_create_orders.sql
├── 002_add_order_index.sql
├── 003_add_order_version.sql
└── 004_alter_amount_type.sql
```

### 8.2 Migration Content Standards

```sql
-- UP
ALTER TABLE orders ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Optimistic lock version';

-- DOWN
ALTER TABLE orders DROP COLUMN version;
```

### 8.3 Safe Changes

```sql
-- Add index to large table (use ONLINE DDL or pt-online-schema-change)
ALTER TABLE orders ADD INDEX idx_created_at (created_at), ALGORITHM=INPLACE, LOCK=NONE;

-- Add NOT NULL column (three steps)
-- 1. Add column allowing NULL
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
-- 2. Update default values
UPDATE users SET phone = '' WHERE phone IS NULL;
-- 3. Modify to NOT NULL
ALTER TABLE users MODIFY COLUMN phone VARCHAR(20) NOT NULL DEFAULT '';
```

---

## 9. Complete Table Creation Example

```sql
CREATE TABLE `order` (
  -- Primary key
  `id` varchar(36) NOT NULL COMMENT 'Primary key ID, UUID format',
  
  -- Business fields
  `order_no` varchar(32) NOT NULL DEFAULT '' COMMENT 'Order number',
  `user_id` bigint unsigned NOT NULL DEFAULT '0' COMMENT 'User ID',
  `merchant_id` bigint unsigned NOT NULL DEFAULT '0' COMMENT 'Merchant ID (denormalized to avoid JOIN)',
  `status` tinyint unsigned NOT NULL DEFAULT '0' COMMENT 'Order status: 0-pending, 1-paid, 2-shipped, 3-completed, 4-cancelled',
  `amount` bigint NOT NULL DEFAULT '0' COMMENT 'Order amount (cents)',
  `pay_time` bigint NOT NULL DEFAULT '0' COMMENT 'Payment timestamp (milliseconds)',
  `remark` varchar(500) NOT NULL DEFAULT '' COMMENT 'Remarks',
  
  -- Standard fields
  `version` int unsigned NOT NULL DEFAULT '0' COMMENT 'Optimistic lock version',
  `created_at` bigint NOT NULL DEFAULT '0' COMMENT 'Creation timestamp (milliseconds)',
  `updated_at` bigint NOT NULL DEFAULT '0' COMMENT 'Update timestamp (milliseconds)',
  `deleted_at` bigint NOT NULL DEFAULT '0' COMMENT 'Delete timestamp (milliseconds), 0 means not deleted',
  
  -- Primary key
  PRIMARY KEY (`id`),
  
  -- Unique index
  UNIQUE KEY `uniq_order_no` (`order_no`),
  
  -- Regular index
  KEY `idx_user_id` (`user_id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_status` (`status`),
  
  -- Composite index (deleted_at usually as last column)
  KEY `idx_user_id_status` (`user_id`, `status`, `deleted_at`),
  
  -- Timestamp indexes
  KEY `idx_created_at` (`created_at`),
  KEY `idx_updated_at` (`updated_at`),
  KEY `idx_pay_time` (`pay_time`)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Order table';
```

---

## 10. Checklist

### 10.1 Pre-Table Creation Checklist

- [ ] Table name uses singular, lowercase, underscore-separated
- [ ] Contains 5 standard fields: `id`, `version`, `created_at`, `updated_at`, `deleted_at`
- [ ] Timestamps use `bigint` type
- [ ] Amounts use `bigint` (100x scaled)
- [ ] All fields are NOT NULL with DEFAULT
- [ ] All fields have comments
- [ ] Table has comment
- [ ] Character set is `utf8mb4`
- [ ] Index naming follows convention
- [ ] Single table indexes not exceeding 16

### 10.2 SQL Review Checklist

- [ ] No `SELECT *`
- [ ] No `LIKE '%xxx%'`
- [ ] No implicit type conversion
- [ ] No large transactions (SQL not exceeding 5)
- [ ] No cross-database JOIN
- [ ] No UPDATE/DELETE JOIN
- [ ] No LIMIT uncertain updates
- [ ] Pagination uses Keyset method
- [ ] Query includes `deleted_at = 0` condition

---

*Standard Version: 1.0.0*  
*Updated: 2026-04-02*
