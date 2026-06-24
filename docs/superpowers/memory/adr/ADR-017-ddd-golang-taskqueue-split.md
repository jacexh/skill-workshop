---
id: ADR-017
title: DDD Go taskqueue and polling split as standalone pattern file
status: accepted
date: 2026-05-28
supersedes: []
superseded_by: null
---

# ADR-017: DDD Go taskqueue and polling split as standalone pattern file

## Context

The DDD Go guide had already been split once because `ddd-golang.md` was too long and agents were selectively reading only the sections that looked immediately relevant. The runtime split in ADR-015 moved config, `fx.Lifecycle`, graceful shutdown, and Kubernetes concerns into `ddd-golang-runtime.md`.

Task queues and polling/reconciliation jobs now have the same pressure. They combine DDD placement decisions (Application processor vs Domain rule vs Infrastructure runtime), Go package layout, schema registration, middleware, asynq worker lifecycle, graceful shutdown, and default `go-jimu` component/contrib library choices. Putting all of that into `ddd-golang.md` would make the main guide longer and weaker as an agent routing surface.

## Decision

Add `ddd-golang-taskqueue.md` as a sibling design-pattern file under both:

- `plugins/superpowers-architect/design-patterns/`
- `codex-plugins/superpowers-architect/design-patterns/`

The new file owns Go taskqueue/polling guidance:

- `TaskType` as the semantic task contract identifier;
- `taskqueue.SchemaRegistry` as a service-owned registry, not a global singleton;
- one `taskqueue.Processor` per `TaskType`;
- task processors and task payload schemas under the owning bounded context's `application` subtree;
- `internal/pkg/taskqueue` as the owner of asynq client/worker construction, middleware, processor registration, config, and lifecycle hooks;
- `github.com/go-jimu/components/taskqueue` and `github.com/go-jimu/contrib/taskqueue/asynq` as the default stack;
- explicit polling policy: "not ready yet" re-enqueues with delay and a bound, while transient failures return errors for provider retry.

Keep `ddd-golang.md` and `ddd-golang-runtime.md` as light routing surfaces. Update `ddd-agent-contract.md` so agents load the taskqueue guide when work mentions polling, asynq, `TaskType`, task payload schemas, task processors, schema registry, task middleware, or `internal/pkg/taskqueue`.

## Alternatives Rejected

1. **Keep all taskqueue guidance inside `ddd-golang.md`.** Rejected because it reverses ADR-015's rationale. A longer Go guide makes it more likely that agents skip the frontmatter, layer rules, or runtime-specific details.

2. **Leave taskqueue guidance only in `go-jimu/components` and `go-jimu/contrib` docs.** Rejected because those libraries can document APIs and provider behavior, but they should not own this repository's DDD placement rules, Application-vs-Infrastructure boundaries, or agent self-checks.

3. **Create a project-specific sample only, without a reusable pattern file.** Rejected because the goal is to guide repeated LLM coding across services. A sample alone would not reliably trigger when agents see `TaskType`, schema registry, polling, or asynq worker lifecycle tasks.

## Consequences

- Pattern-file count grows from 10 to 11.
- Claude and Codex tracks must keep `ddd-golang-taskqueue.md` semantically aligned with the rest of the DDD pattern set.
- `ddd-golang.md` remains focused on layers, aggregates, events, integration messages, file organization, and module assembly.
- `ddd-golang-runtime.md` remains focused on runtime lifecycle, but now points task workers to the taskqueue guide for provider-specific worker semantics.
- Agents get a smaller, better-triggered document for taskqueue/polling work instead of loading or extending the full Go guide.
