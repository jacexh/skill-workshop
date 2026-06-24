---
name: ingest
description: Use to create, incrementally update, or full-refresh Project Knowledge Base from specs, plans, ADRs, docs, memory candidates, and validated code facts
---

# Ingest Project Knowledge

Write durable project facts into `docs/project-knowledge/`. This is the only normal knowledge-writing path.

**Announce at start:** "I'm ingesting project knowledge."

## Modes

- **Incremental ingest:** default after a spec, plan, PR, or implementation branch. Read source documents first and update only affected owner files. If changed sources introduce or materially change a high-value object, run targeted Core Query Coverage for that object.
- **Bootstrap ingest:** use when `docs/project-knowledge/` does not exist. Read the project and create the initial owner files plus compact `index.md`.
- **Full-refresh ingest:** use when `superpowers-memory:lint` reports high drift, owner-file structure is obsolete, or the user explicitly asks to regenerate target files.

## Source Authority

Read sources in this order:

1. `docs/superpowers/specs/*.md`
2. `docs/superpowers/plans/*.md`
3. ADRs and project decision documents
4. README and user-facing documentation
5. Explicit Memory candidates from `query`
6. Code/diff inspection for validation, paths, names, and implementation status
7. Commit messages as weak hints only

## Core Query Coverage

During bootstrap and full-refresh, run a Core Query Coverage pass before writing target files. During incremental ingest, run the same coverage check only for changed or newly introduced high-value objects. The goal is not to document every module; it is to make high-value project objects directly answerable by `query`.

Treat an object as high-value when it is a bounded context, service, major module, product capability, or cross-service flow that is referenced by multiple specs, plans, ADRs, features, glossary terms, or source entry points.

For complex engineering repositories, run an architecture coverage inventory before writing architecture files:

1. **System topology inventory:** identify deployable services/entry points, bounded contexts, external actors/systems, stores, buses, runtime substrates, and trust boundaries.
2. **Service card inventory:** identify high-value services/bounded contexts that need direct cards. Use docs/specs/ADRs/features first, then validate paths from code (`cmd/`, `apps/`, `services/`, `api/`, `internal/<context>/...`).
3. **Scenario inventory:** identify core cross-service scenarios that shape future changes. Prefer 4-7 for complex repos and 2-3 for smaller repos. Favor execution/orchestration, provisioning, delivery/messaging, auth, ingest, artifact/file handling, comments/signals/decisions, trace/metrics, and ownership-transfer flows when they exist.
4. **Lifecycle inventory:** identify aggregates or runtime objects whose state transitions cross contexts, publish messages, update read models, or affect user-visible workflow.
5. **Source traceability:** attach stable source refs to every service card and every scenario section: ADR/spec/plan/docs plus canonical source/proto/config paths.

For each high-value object, ensure one owner entry or shard can directly answer:

- Responsibility: what the object owns and what it explicitly does not own.
- Internal layers/main components: the main layers, collaborators, or implementation parts. Prefer stable architecture structure from design docs when it exists: planes, subsystems, workflows, processors, policies, gates, projections, or named runtime components. Do not stop at generic `domain/application/infrastructure` labels when sources provide richer structure.
- Upstream/downstream interactions: callers, callees, events, APIs, storage, or external systems.
- Key state/flow/invariants: lifecycle, ordering, state transitions, or constraints that shape changes.
- Source refs: related ADRs, specs, plans, docs, and canonical source paths.

Before writing or finalizing architecture files, run an architecture answerability self-check for the top 3-5 high-value services/bounded contexts and flows:

- Can `query` answer "what is its internal architecture/layering?" from the KB without broad code search?
- Can `query` answer "which core scenarios does it participate in?" from direct owner entries or shards?
- Can `query` answer "what state, lifecycle, ordering, or invariant matters for changes?"
- Does every service card and every scenario section cite enough source refs to validate the answer?

If any answer requires broad cross-file inference, add or refine the relevant owner entry/shard before verification.

Use existing owner files first. Create or refresh a shard only when a high-value object cannot be answered cleanly from the canonical owner file without making it noisy. Do not create shards for every package, helper, or low-risk implementation detail.

For complex repos, prefer these shard shapes when needed:

- `architecture-contexts.md` — service/bounded-context architecture cards.
- `architecture-flows.md` — scenario sequences and cross-context lifecycle diagrams.
- `architecture-<domain>.md` — a focused domain/runtime shard only when one service family or platform subsystem would otherwise dominate the overview.

Do not treat service cards as a full code tour. Record stable architectural layers/components and invariants; route package-level details to source refs.

## Process

1. Acquire the write lock:

```bash
node "${PLUGIN_ROOT:-codex-plugins/superpowers-memory}/hooks/codex-runtime.js" lock superpowers-memory:ingest
```

2. Identify changed or requested source documents.
3. Extract durable capabilities, boundaries, decisions, terms, conventions, dependencies, and lifecycle facts.
4. Run Core Query Coverage: whole-KB for bootstrap/full-refresh, or targeted only to changed/new high-value objects for incremental ingest. For architecture, produce or refresh the system topology, service cards, scenario sequences, lifecycle/FSM coverage, answerability self-check fixes, and source refs needed for direct query answers.
5. Route each fact to exactly one owner file per `content-rules.md`.
6. Validate anchors against code or docs when the fact names files, commands, dependencies, or implemented behavior.
7. Update only affected owner files.
8. Regenerate `docs/project-knowledge/index.md` when routing or key points changed.
9. Run verification:

```bash
node "${PLUGIN_ROOT:-codex-plugins/superpowers-memory}/hooks/codex-runtime.js" verify
```

10. Fix `staleRefs`, `shapeViolations`, `readinessWarnings`, or `ssotViolations` before committing.
11. Release the write lock:

```bash
node "${PLUGIN_ROOT:-codex-plugins/superpowers-memory}/hooks/codex-runtime.js" unlock
```

## Compatibility

- `superpowers-memory:update` is a thin alias for incremental ingest.
- `superpowers-memory:rebuild` is a thin alias for bootstrap ingest when no KB exists, or full-refresh ingest when one exists.
