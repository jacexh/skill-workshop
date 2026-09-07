---
name: ddd-golang-infrastructure
description: Go adapter boundaries and routing for persistence, transactions, outbound ports, and provider errors.
---

# Go Infrastructure Layer

## Applies When

Infrastructure implements Domain-owned and Application-owned ports and owns external mechanisms. For MySQL persistence in this House Style, use `xorm.io/xorm` with `github.com/go-sql-driver/mysql`. Use `github.com/samber/oops` when an external error first enters controlled code.

## Responsibility And File Shape

```text
internal/business/<context>/infrastructure/
  do.go                    # private xorm Data Objects
  convert.go               # pure DO <-> exported Domain/read-model mapping
  <aggregate>_repository.go
  <read_model>_query_repository.go
  <port>_adapter.go        # Domain-owned Port or outbound provider adapter
```

- Data Objects describe persistence, not Domain behavior. Mandatory columns and physical types follow [database.md](database.md); the persistence guide owns their Go mapping.
- `convert.go` performs pure mechanical mapping. It does no I/O, logging, transaction control, authorization, or business decisions.
- A Domain Repository adapter persists one Aggregate Root and its owned state.
- A QueryRepository adapter implements an Application-owned read port and returns Application read models.
- A Domain-owned Port adapter fulfills its Domain contract from one or more external sources.
- Compile-time assertions make the implemented inward contract visible.
- Shared engines and provider clients arrive from `internal/pkg`; a bounded-context adapter does not load config or open process-wide clients.

## Select the Adapter Guidance

- For xorm Data Objects, persistence conversion, or write Repositories, read
  [ordinary persistence](ddd-golang-persistence.md) and the affected
  [database rules](database.md).
- For QueryRepository SQL and read mapping, read [CQRS](ddd-golang-cqrs.md)
  and the affected database rules; load persistence conversion only if touched.
- For a confirmed multi-Root local atomic change, read
  [transaction participation](ddd-golang-transactions.md).
- For outbound-only ports or ACLs, use the adapter and error rules below.

## Outbound Adapters

Infrastructure fulfills Domain-owned Ports and Application-owned ports through external APIs, Kafka, cache, taskqueue, or other providers. Keep source composition, generated clients, credentials, topics, serialization, and any accepted fulfillment policy here.

## Error And Logging Boundary

- At the first controlled boundary, enrich and wrap once with `oops.With(...).Wrap(providerErr)`; use `oops.Wrap(providerErr)` only when there is no owned context. Never wrap an already wrapped provider error again.
- Preserve `errors.Is/As` and stable Domain/Application errors. Later layers add context only when they add new semantics.
- Do not log and return the same error. Transport or Runtime owns the Execution Completion Log.
- Infrastructure logs only when it suppresses/retries an error or owns a terminal provider operation.
- Never attach passwords, DSNs, tokens, message payloads, or unbounded SQL values to errors or logs.

## Verification

For changed persistence or query behavior, use MySQL-backed integration evidence
for the affected lifecycle, conversion, filtering, ordering, transaction, or
error behavior. Under request-scoped optimistic persistence, exercise affected
version/conflict and stale-Save semantics; under resident checkpoints, exercise
affected snapshot/token and continued-live-authority semantics.

For a changed outbound adapter, verify its Domain result, contract translation,
and affected fulfillment policy at that provider boundary. An outbound-only
change does not require MySQL evidence. Reuse unaffected evidence; Guard reviews
available results without executing this verification.
