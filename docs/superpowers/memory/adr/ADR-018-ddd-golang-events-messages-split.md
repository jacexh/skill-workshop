---
id: ADR-018
title: DDD Go events/messages split as standalone pattern file
status: accepted
date: 2026-05-28
supersedes: []
superseded_by: null
---

# ADR-018: DDD Go events/messages split as standalone pattern file

## Context

After ADR-015 moved runtime concerns out of `ddd-golang.md` and ADR-017 moved taskqueue/polling concerns out, the largest remaining cross-cutting content in the Go guide was event/message guidance. It covered `event.Collection`, same-BC Domain Event Handlers, Boundary Publishers, Integration Messages, `message.Kind`, Kafka adapter behavior, module registration, idempotency, and failure semantics across multiple sections.

This content has clear trigger terms (`eventhandler`, `messagepublisher`, `messagehandler`, Domain Event, Integration Message, Boundary Publisher, Kafka, `message.Publisher`) and a recurring agent failure mode: mixing Domain Events with Integration Messages, creating umbrella handlers, making Boundary Publishers advance workflow state, or leaking Kafka mechanics inward.

## Decision

Add `ddd-golang-events-messages.md` as a sibling design-pattern file under both:

- `plugins/superpowers-architect/design-patterns/`
- `codex-plugins/superpowers-architect/design-patterns/`

The new file owns Go event/message guidance:

- Domain Event collection and one-shot drain semantics;
- same-BC Domain Event Handler contract;
- Boundary Publisher contract;
- Integration Message Handler contract;
- `message.Kind`, protobuf payloads, publisher/handler/subscriber ports;
- Kafka adapter wiring and operational semantics;
- module registration for event/message handlers;
- idempotency, delivery, and failure semantics;
- event/message testing and review checklist.

Keep `ddd-golang.md` as the Go DDD layer/layout skeleton. It now contains only placement summaries and links for event/message work.

## Alternatives Rejected

1. **Keep events/messages inside `ddd-golang.md`.** Rejected because this was the largest remaining mechanism-specific section and would keep the main guide too large for reliable agent reading.

2. **Fold events/messages into `ddd-core.md`.** Rejected because `ddd-core.md` owns language-neutral concepts. The Go content depends on `go-jimu/components/ddd/event`, `go-jimu/components/ddd/message`, Kafka adapter conventions, package names, and fx module registration.

3. **Use the broader name `ddd-golang-async.md`.** Rejected because "async" can be misread as goroutines, worker pools, or taskqueue. `ddd-golang-events-messages.md` names the actual concepts and avoids overlap with `ddd-golang-taskqueue.md`.

## Consequences

- Pattern-file count grows from 11 to 12.
- Claude and Codex tracks must keep `ddd-golang-events-messages.md` synchronized.
- Agents working on event/message concerns can load a focused file instead of the full Go guide.
- `ddd-golang.md` shrinks and stays focused on layers, aggregates, repositories, CQRS, file organization, naming, stack, and module assembly.
