---
name: ingest
description: Use to create, incrementally update, or full-refresh Project Knowledge Base from specs, plans, ADRs, docs, memory candidates, and validated code facts
---

# Ingest Project Knowledge

Write durable project facts into `docs/project-knowledge/`. This is the only normal knowledge-writing path.

**Announce at start:** "I'm ingesting project knowledge."

## Modes

- **Incremental ingest:** default after a spec, plan, PR, or implementation branch. Read source documents first and update only affected owner files. If changed sources introduce or materially change a high-value object, run targeted Core Query Coverage for that object.
- **Topic-scope refresh:** use inside `ingest` when an incremental update touches a high-value module, scenario, capability, or decision family whose nearby owner files are too thin or poorly cross-linked. Refresh only the topic radius, not the whole KB.
- **Bootstrap ingest:** use when `docs/project-knowledge/` does not exist. Read the project and create the initial owner files plus compact `index.md`.
- **Full-refresh ingest:** use when `superpowers-memory:lint` reports high drift, owner-file structure is obsolete, or the user explicitly asks to regenerate target files.

## Source Authority

For superpowers-based projects, specs/plans/ADRs are the primary raw sources.
Read sources in this order:

1. `docs/superpowers/specs/*.md`
2. `docs/superpowers/plans/*.md`
3. ADRs and project decision documents
4. README and user-facing documentation
5. Explicit Memory candidates from `query`
6. Code/diff inspection for validation, paths, names, and implementation status
7. Commit messages as weak hints only

Conversation/chat/transcript is not a Project Knowledge slot. If a conversation
contains a durable conclusion, first prefer a spec/plan/ADR update; otherwise
distill it as a Memory candidate and route the durable fact to an existing owner
file such as features, architecture, decisions, conventions, glossary, or
tech-stack. Do not create `conversation.md`.

## Core Query Coverage

During bootstrap and full-refresh, run a Core Query Coverage pass before writing target files. During incremental ingest, run the same coverage check only for changed or newly introduced high-value objects. The goal is not to document every module; it is to make high-value project objects directly answerable by `query`.

Treat an object as high-value when it is a bounded context, service, major module, product capability, or cross-service flow that is referenced by multiple specs, plans, ADRs, features, glossary terms, or source entry points.

## Incremental Impact Radius

Before writing incremental updates, run an Impact Radius pass. Identify the direct owner file plus adjacent owner files/shards that must stay navigable:

- Feature change → `features*.md`, related architecture owner/shard, related ADRs, and `index.md` when routing changes.
- Architecture module change → module shard/card, participating scenario shards, affected ADR routing, and parent `architecture.md`/`index.md`.
- Architecture scenario change → scenario shard, all participating module shards, authority/order/failure rules, and `index.md`.
- ADR change → `decisions.md`, ADR detail file, affected owner/shard refs, and any feature/convention/architecture entry that cites the ADR.
- Convention/glossary/tech-stack change → reference owner plus source refs, affected ADR or architecture/feature entries, and glossary aliases when terms move.

Run a Related owner sweep after the first write: check parent/index routes, scenario/module bidirectional refs, ADR affected routing, feature references, and reference-slot source anchors for the touched topic.

Escalate to topic-scope refresh when the touched high-value topic is still thin after the narrow update: missing responsibility, internal components, interactions, state/flow/invariants, source refs, bidirectional module/scenario refs, product/workflow feature coverage, ADR detail/trade-off/affected routing, or reference owner/source anchors.

For complex engineering repositories, run an architecture coverage inventory before writing architecture files:

1. **System topology inventory:** identify deployable services/entry points, bounded contexts, external actors/systems, stores, buses, runtime substrates, and trust boundaries.
2. **Module inventory:** identify high-value services, bounded contexts, and main modules that need direct query answers. Use docs/specs/ADRs/features first, then validate paths from code (`cmd/`, `apps/`, `services/`, `api/`, `internal/<context>/...`).
3. **Named scenario inventory:** identify core cross-service scenarios that shape future changes. Prefer 4-7 for complex repos and 2-3 for smaller repos. Favor execution/orchestration, provisioning, delivery/messaging, auth, ingest, artifact/file handling, comments/signals/decisions, trace/metrics, and ownership-transfer flows when they exist.
4. **Lifecycle inventory:** identify aggregates or runtime objects whose state transitions cross contexts, publish messages, update read models, or affect user-visible workflow.
5. **Source traceability:** attach stable source refs to every module card/shard and every scenario section/shard: ADR/spec/plan/docs plus canonical source/proto/config paths.

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

Use existing owner files first, but architecture full-refresh should converge on a module-first + named scenario layout:

- `architecture.md` — overview/router: topology, context map, shard links, compact cards/scenarios only when they fit.
- `architecture-<module>.md` — one high-value service, bounded context, or main module. Use `templates/architecture-module.md`. Example: `architecture-orchestrator.md`.
- `architecture-<scenario>.md` — one stable cross-service scenario or flow family. Use `templates/architecture-scenario.md`. Example: `architecture-runtime-message-chain.md`.

Do not create shards by document view or diagram type. `architecture-contexts.md` and `architecture-flows.md` are legacy view shards: if full-refresh sees them, migrate durable facts into module shards and named scenario shards, then route those shards from `index.md`.

For cross-service features such as "Portal to Executor complete message chain", do not split the end-to-end sequence across participating service shards. Put the complete chain in one `architecture-<scenario>.md` shard with `Participants`, `Sequence Phases`, `Authority boundaries`, `Ordering / Idempotency / Failure Rules`, `Module refs`, and `Source refs`. Each participating `architecture-<module>.md` shard should include `Scenario refs` that link back to that scenario shard.

Create or refresh a shard only when a high-value object cannot be answered cleanly from the canonical owner file without making it noisy. Do not create shards for every package, helper, or low-risk implementation detail.

Do not treat service cards as a full code tour. Record stable architectural layers/components and invariants; route package-level details to source refs.

Run Feature Query Coverage before finalizing `features.md` or `features-<domain>.md`:

- Can `query` answer what users/operators can do now from product-facing capability entries?
- Can `query` answer the main user workflow(s), not only platform capabilities?
- Does each high-value capability name actors/entry points, capability boundaries, and owner-file references?
- Are deferred or partial capabilities calibrated in `Capability Boundary` instead of overstated as implemented?

Run Decision Query Coverage before finalizing `decisions.md` or `adr/`:

- Does each active ADR summary include a decision, trade-off, and detail link when it passes the ADR granularity gate?
- Can `query` traverse from the decision to affected owner files, affected modules, features, or conventions without broad search?
- Are single-module choices, tool picks, temporary workarounds, and workflow rules routed away from ADRs per `content-rules.md`?

Run Reference Query Coverage before finalizing `conventions.md`, `glossary.md`, or `tech-stack.md`:

- Cross-cutting conventions point to canonical source/config/CI/design-pattern/ADR refs.
- Glossary terms include owner/source refs unless they are deleted-term tombstones.
- Critical tech-stack entries include purpose and selection rationale, not only names or versions.

## Process

1. Acquire the write lock:

```bash
node "${PLUGIN_ROOT:-codex-plugins/superpowers-memory}/hooks/codex-runtime.js" lock superpowers-memory:ingest
```

2. Identify changed or requested source documents.
3. Extract durable capabilities, boundaries, decisions, terms, conventions, dependencies, and lifecycle facts.
4. Run Core Query Coverage: whole-KB for bootstrap/full-refresh, or targeted only to changed/new high-value objects for incremental ingest. For architecture, produce or refresh the system topology, service cards, scenario sequences, lifecycle/FSM coverage, answerability self-check fixes, and source refs needed for direct query answers.
5. For incremental ingest, run Impact Radius and a Related owner sweep. If the touched topic remains thin or poorly linked, Escalate to topic-scope refresh before finalizing.
6. Route each fact to exactly one owner file per `content-rules.md`.
7. Validate anchors against code or docs when the fact names files, commands, dependencies, or implemented behavior.
8. Update only affected owner files or the bounded topic radius.
9. Regenerate `docs/project-knowledge/index.md` when routing or key points changed.
10. Run targeted lint mentally over touched owner files and related shards; then run verification:

```bash
node "${PLUGIN_ROOT:-codex-plugins/superpowers-memory}/hooks/codex-runtime.js" verify
```

11. Fix `staleRefs`, `shapeViolations`, `readinessWarnings`, or `ssotViolations` before committing. Treat relevant `coverageGaps` as targeted lint escalation targets: fix the topic radius, or note that full-refresh is needed.
12. Release the write lock:

```bash
node "${PLUGIN_ROOT:-codex-plugins/superpowers-memory}/hooks/codex-runtime.js" unlock
```

## Compatibility

- `superpowers-memory:update` is a thin alias for incremental ingest.
- `superpowers-memory:rebuild` is a thin alias for bootstrap ingest when no KB exists, or full-refresh ingest when one exists.
