---
name: ddd-golang-cqrs
description: Go / go-jimu CQRS/read-side reference. Use when implementing or reviewing QueryRepository interfaces, read DTOs, query handlers, product read models, cross-context read facades, projections, read-model freshness, authorization, pagination, or QueryRepository port granularity.
---

# Go CQRS and Read-Side Reference

CQRS here means command writes go through Domain aggregates, while product/application reads use read-side DTOs and QueryRepository/read facade ports. Do not use CQRS as a reason to create one interface per query method.

## 0. Go / go-jimu CQRS Building Block Lookup

| Object | Start here |
|---|---|
| QueryRepository | §0.1 QueryRepository Card |
| Read DTO / read model | §0.2 Read DTO Card |
| Query Handler | §0.3 Query Handler Card |
| Cross-context read facade | §0.4 Read Facade Card |
| Projection/read-model updater | §0.5 Projection Card |

### 0.1 QueryRepository Card

**Placement**

- Interface: `internal/business/<context>/application/query/repository.go` or a focused file in `application/query/`.
- Implementation: `internal/business/<context>/infrastructure/<read_model>_query_repository.go`.

**Granularity**

- Default to one QueryRepository per bounded-context product read-model family.
- Add methods for new query scenarios when freshness, authorization, pagination, failure behavior, consistency window, data source, and test substitute semantics are the same.
- Split only when one of those semantics differs materially.

**Return shape**

- Return Application/read DTOs, generated read contracts when explicitly accepted, or local read-model structs.
- Do not return Domain aggregates for product read models.
- Do not expose storage-shaped methods such as `Select`, `Scan`, `FindBySQL`, or table-centric stores.

**Review checks**

- A new `XxxReader`, `XxxFetcher`, or `XxxStore` must prove semantic split, not just a new screen/RPC.
- Same read store/projection source is a merge signal.
- Different sources such as OLTP current-state rows versus analytics buckets are split signals, but names remain product-semantic.

### 0.2 Read DTO Card

- DTOs live in `application/query/dto.go` or next to the query when narrow.
- DTOs are read contracts, not Domain objects.
- They may include denormalized fields, masked fields, pagination metadata, or display-specific values.
- Business writes still go through commands and Domain aggregates.
- Do not add behavior methods that enforce write-side invariants on DTOs.

### 0.3 Query Handler Card

Use a dedicated query handler only when the read path does meaningful work:

- composes multiple QueryRepository/facade calls;
- decodes cursors or applies read-specific authorization/masking;
- applies named cache/read policy;
- normalizes or filters data in a way that is part of the read use case.

For trivial reads, the generated RPC shortcut or Interface handler may call QueryRepository directly and map the result. The QueryRepository interface still exists.

### 0.4 Read Facade Card

Use a read facade/API when another bounded context needs current data owned by this context.

**Placement**

- Owning context publishes a small port/API under `internal/business/<context>/api/**` or an existing local convention.
- Consuming context depends on that published API, not on the owner's internal `application/query.Repository`.

Rules:

- Return DTOs/read models, not Domain aggregates.
- Keep facade names product-semantic (`UserSummaryReader`, `CustomerEligibilityReader`) rather than technology-semantic.
- Cross-process reads use protocol contracts under `proto/**` / `pkg/gen/**`.

### 0.5 Projection Card

Projection/read-model updates can be triggered by Domain Events, Integration Messages, or tasks.

- Same-BC projection update from a Domain Event routes through `application/eventhandler`.
- Cross-context projection update from an Integration Message routes through `application/messagehandler`.
- Durable retry/backfill/reconciliation routes through `application/taskprocessor` and `ddd-golang-taskqueue.md`.
- Projection state is read-side state; do not treat the projection row as the write aggregate unless the model explicitly says it is.

## CQRS Naming

| Object | Preferred naming |
|---|---|
| Main read-model family | `Repository` inside `application/query`, or `<ProductArea>QueryRepository` when multiple families exist |
| Analytics read family | `<ProductArea>MetricRepository`, `<ProductArea>AnalyticsRepository` |
| Cross-context facade | `<PublishedConcept>Reader` / `<PublishedConcept>Facade` |
| Read DTO | `<UseCase>DTO`, `<Concept>Summary`, `<Concept>Detail`, `<Concept>Page` |

## Common Misplacements

- Creating one QueryRepository interface per screen, RPC method, or handler.
- Using Domain aggregates as read DTOs.
- Naming ports after storage technology (`ClickHouseReader`, `RedisQueryStore`) instead of product semantics.
- Putting routing topology, peer address lookup, replica selection, or hop headers into QueryRepository.
- Calling another context's internal QueryRepository instead of its published facade/API.
