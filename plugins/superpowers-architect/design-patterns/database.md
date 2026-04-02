---
name: Database Design Standards
description: Table schema conventions, index strategy, and migration rules
---

## Schema Conventions

- All tables MUST have `created_at` and `updated_at` timestamp columns (non-nullable, default `now()`)
- Primary keys use UUID v4 (`gen_random_uuid()`)
- Foreign key columns are named `<table_singular>_id` (e.g., `user_id`)
- Boolean columns are prefixed with `is_` or `has_` (e.g., `is_active`)
- Deleted records use soft-delete via `deleted_at` timestamp (nullable); never hard-delete

## Index Strategy

- Index every foreign key column
- Add composite indexes for common query patterns (profile the query first)
- Unique constraints are implemented as unique indexes, not column constraints

## Migrations

- Migrations are forward-only; no down migrations
- Each migration file is named `YYYYMMDDHHMMSS_<description>.sql`
- Migrations must be idempotent where possible (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`)
- Never alter column types in-place on large tables; use shadow-table migration pattern
