---
name: maintain-artifacts
description: Use when a ddd-expert workflow needs to inspect DDD artifacts, apply an accepted decision slice, or promote ready artifacts; validates authority, minimal consistency closure, layout, status, and model-design revisions without making semantic decisions.
user-invocable: false
---

# Maintain Artifacts

Execute the DDD artifact protocol inside the currently active workflow. This is a shared in-process workflow, not a separate agent or trusted caller boundary. It owns no business fact or Tactical Design decision and never asks the user to supply one.

## Operation input

Every operation states:

- `authority`: `event-storming`, `codify`, or `guard`;
- `operation`: `inspect`, `apply-model`, or `apply-design`;
- the affected context names and stable lower-kebab-case slugs when known.

An `inspect` operation needs no expected revision. When its context scope is omitted, inspect the complete artifact root.

An apply operation additionally states:

- the exact accepted decision slice and its evidence, or a readiness status change with `event-storming`'s gap or complete-readiness evidence;
- a consistency set containing every path whose observed content or Model revision the accepted decision depends on, including read dependencies that remain unchanged;
- the expected pre-state of every path in the consistency set: absent, or an observed content fingerprint plus any Model revision;
- a write set containing the paths whose content changes; the write set is a subset of the consistency set;
- exact accepted terminal content for every changed semantic section, explicit removals, and the target `model_status` or `design_status`;
- for `apply-design`, the exact current Model revision for every affected context.

Allowed Model targets are `evolving` and `shape_ready`; allowed Design targets are `evolving` and `codify_ready`. Every semantic statement in either state must already be accepted. Require `event-storming`'s complete scoped replay evidence before a ready promotion. A legacy artifact with no status contains accepted content but has unproved readiness: report it as `evolving_model` or `evolving_design` until `event-storming` replays the scope and authorizes an explicit status.

Missing readiness status is the only legacy frontmatter compatibility exception. Do not return `invalid_layout` for that absence alone; apply every other frontmatter and layout check normally, and do not mutate the legacy file during inspection.

Only the controlled legacy Context Map replacement described below may additionally state `context_map_migration: true`; omit it from every other operation.

Reject absolute slugs, path separators, `.` or `..` segments, and any slug that can escape its context directory.

| Operation | Allowed authority | Filesystem effect |
|---|---|---|
| `inspect` | Any workflow | Read-only |
| `apply-model` | `event-storming` | Root README, Context Map, and affected Models only |
| `apply-design` | `event-storming` | Affected Designs and newly empty context directories only |

Codify and Guard can never run an apply operation. Treat an invalid operation input as an internal protocol error: write nothing, correct it in the active workflow, and retry the operation. It is not an Apply result; if accepted data needed to correct it is unavailable, the active workflow reports its own `blocked` completion.

## Workflow

1. **Load the contract**: read the Artifact Layout and only the templates needed by the operation.
2. **Inspect current state**: verify the artifact root, accepted context directories, safe slugs, template residue, frontmatter, links, and Model-to-Design revision links. Read every file in the consistency set before changing any. Preserve the exact validator diagnostic when a current Context Map is invalid; inspection still returns `invalid_layout` under every authority.
3. **Compare before apply**: require every expected path pre-state in the consistency set to match. For `apply-design`, also require the delegated Model revision to equal the current Model revision. A stale or missing Design is a valid pre-state for `apply-design`; the operation exists to create or repair it. On mismatch, write nothing and report `revision_conflict` with expected and observed state.
4. **Prepare the smallest consistency transaction**: validate the `event-storming`-declared consistency closure against its stated read dependencies and accepted terminal content; never derive or enlarge semantic scope on the executor's own authority. Mechanically assemble the declared write set from the templates, exact accepted terminal content, explicit removals, and unaffected current content. A declared local decision normally changes one Model or Design; a declared topology or cross-context contract decision includes every artifact `event-storming` identified to keep both accepted sides consistent. Preserve accepted wording and distinctions. Do not rename terms, infer replacements, decide that a statement is superseded, omit a section on semantic grounds, or turn a summary delta into new domain or tactical prose. Return an invalid operation input when the declared closure, its necessary structural counterpart, or exact content is missing.
5. **Apply the authorized write set**:
   - `apply-model`: bootstrap the root README and Context Map when needed; update navigation, dependencies, and affected Models; start a new Model at revision `1` and increment each changed Model at most once for the accepted decision slice. A status-only readiness invalidation or promotion does not increment the revision or alter accepted prose. Never touch a Design.
   - `apply-design`: create, update, move, or delete affected Designs as required by accepted topology, set each retained Design's `based_on_model_revision` to the exact current Model revision, and set `design_status` to the authorized target. A proven no-semantic-change revalidation, readiness invalidation, or readiness promotion may update only frontmatter. Never touch the root README, Context Map, or Models.
6. **Verify the result**: re-read the consistency set; confirm layout, links, explicit statuses, no placeholders/comments, exact accepted terminal content, authorized paths only, unchanged read dependencies, and revision invariants. For a ready promotion, require `event-storming`'s declared replay evidence, zero-material-open-obligation statement, and exact referenced paths and revisions; validate those references mechanically without deciding semantic completeness. A `shape_ready` target also requires a valid Context Map and structurally consistent affected Models. A `codify_ready` target also requires `shape_ready` Models at exact revisions and structurally consistent affected Designs. Keep the workspace working directory unchanged. Resolve the installed validator and each current, prepared, or written Context Map to absolute paths, then run `node <absolute-validator-path> <absolute-context-map-path>` during inspection, before apply, and after apply. A prepared-target failure always aborts before writing. A current legacy-map failure may proceed only through the controlled exception below. Any other current-pre-state failure inside the declared consistency closure or a required structural counterpart aborts with no write or semantic repair. Report an invalid artifact outside that closure without expanding or blocking the apply, unless it prevents validation of the declared closure. A post-write failure is a partial filesystem failure: report `blocked` with exact observed state; do not conceal it as success.
7. **Resume the workflow**: expose the operation status, observed and written revisions, changed paths, validation evidence, and any required route to the active workflow. Do not replace that workflow's completion response.

## Controlled legacy Context Map migration

An eligible legacy set starts with an existing Context Map in the retired pre-DAG shape, identified by the old arrow legend or detached `## Relationships` structure. Symmetric relationship notation may be evidence inside that retired structure but is not sufficient by itself. Discover the set from an unscoped inspection of the complete DDD artifact root: it contains that Map, every Model in the root that still uses the retired `## Context Relationships` heading, and the root README when it still says `Context relationships are authoritative`. A legacy Model or README with those markers cannot be omitted as "unrelated". A validator failure or any other stale or invalid artifact outside this objectively discovered coordinated set does not create migration authority.

Accept `context_map_migration: true` only for `authority: event-storming` with `operation: apply-model`, after the complete migration target has explicit acceptance. Require all of the following before preparing a write:

- complete-root inspection returned the exact `invalid_layout` diagnostics for the legacy Context Map and every retired Model section, proved that no legacy Model was omitted, and proved that no other current invalidity prevents validation of the coordinated migration set;
- the consistency set contains the invalid Context Map, every coordinated legacy Model, and any coordinated legacy README; the exact observed fingerprint and bytes of each still match;
- the write set supplies the complete accepted terminal Context Map, exact terminal content for every semantically affected Model, and exact terminal README content whenever its legacy wording is present or the accepted context inventory changes; and
- the complete prepared terminal Context Map passes the bundled validator before any project artifact changes.

Replace the complete Context Map, every coordinated legacy Model, and any coordinated legacy README in the same atomic transaction as all other affected Models. The executor copies accepted terminal content and never infers a dependency direction, contract, authority, translation, or other semantic repair. It cannot patch only an offending legacy relationship, rename a Model heading without accepted terminal content, preserve retired README authority wording, or preserve an unaccepted remainder. Reject the flag for any authority other than `event-storming`, for `inspect`, `apply-design`, an unaccepted or partial target, a stale source fingerprint or byte sequence, or a map whose failure is not a recognized retired shape. Any current invalidity inside the coordinated set, or outside it but preventing validation of that set, aborts the transaction; other invalid artifacts remain unchanged and reported.

## Context Map dependency projection

The Context Map Global View is a mechanical projection of the accepted context inventory and local contract details; it owns no additional domain meaning. The entire graph follows the `ddd-expert` House Rule that model and contract dependencies form a directed acyclic graph. Validate that it:

- contains exactly one Mermaid `graph LR` and the visible `U -> D` direction statement;
- declares every accepted project Bounded Context exactly once, including contexts with no directed relationship, using one document-local unique `lower_snake_case` Mermaid identifier and its accepted name as the visible label;
- contains no external context node;
- represents every accepted dependency between project contexts exactly once as a plain, unlabeled edge from upstream to downstream, with no other edge;
- rejects self-loops, reciprocal edges, longer cycles, `<->`, `<-->`, Partnership, Shared Kernel, and the legacy `## Relationships` structure;
- gives every context one non-Mermaid `text` wireframe containing itself and exactly its direct neighbors, with arrow direction expressing dependency and no U/D labels; and
- projects every named contract with the same identity and endpoints into the upstream context's Downstream Contracts and downstream context's Upstream Dependencies.

An arrow means upstream model or published-contract influence on a downstream model, never runtime call flow. A runtime request and response may use one owned contract without creating a reverse dependency. Directional collaboration patterns may annotate an established edge but cannot create, reverse, or duplicate it. When `apply-model` changes the accepted context inventory or a dependency, update both local projections and the Global View in the same Context Map write. A missing, extra, mislabeled, reversed, reciprocal, or cyclic projection is `invalid_layout`; never repair it by inventing direction, ownership, or contract meaning.

## Decision-slice transaction scope

An accepted decision slice may affect only one context; in that case the write set may contain one Model when context inventory and dependencies remain unchanged. Include every artifact supplying a semantic read dependency in the consistency set, but do not expand the write set to unrelated files.

When the accepted slice changes context responsibility, business authority, a dependency, an authority boundary, or a translation boundary, put the Context Map and every semantically affected Model in one write set. Add the root README when the accepted context inventory or navigation changes. Apply that minimal semantic closure together so each context records only its accepted side of the dependency. Independent contexts and unrelated decisions never need a workflow-wide transaction.

## Context topology changes

`event-storming` may accept a context rename, split, merge, or removal. `apply-model` updates only the root README, Context Map, and Models and leaves any old Design untouched. It returns `changed` with a `pending_design_reconciliation` observation. The same `event-storming` workflow then accepts the tactical consequence and `apply-design` creates, moves, rewrites, or deletes affected Designs. Remove an obsolete context directory only after it is empty.

This two-operation state is intentional. Until `event-storming` completes `apply-design`, Codify treats affected Designs as unavailable authority and Guard reports the evidence gap while continuing independent review.

## Inspect result

Return structural observations only; semantic sufficiency belongs to the active workflow:

- `ready`: every artifact required by the current operation is structurally valid, carries its required ready status, and has every required revision link matched; never return this observation for an `evolving` artifact;
- `uninitialized`: the artifact root does not yet exist;
- `missing_model`: an accepted context has no readable Model;
- `missing_design`: a Model has no Design; this is valid after Model acceptance and before the first successful `apply-design`;
- `evolving_model`: a Model contains accepted facts but is not `shape_ready`, including a legacy Model with no explicit status;
- `evolving_design`: a Design contains accepted decisions but is not `codify_ready`, including a legacy Design with no explicit status;
- `stale_design`: a Design references a different Model revision;
- `pending_design_reconciliation`: context topology and retained Designs are temporarily out of alignment;
- `invalid_layout`: a root file, path, slug, link, frontmatter field, or template constraint is invalid.

Inspection never decides that business facts are contradictory or that a Tactical Design covers the Model. It reports paths, revisions, and concrete structural evidence so the active workflow can decide whether to clarify, route, implement, or review.

## Apply result

Return one of:

- `changed`: list every changed path, resulting revision, and structural observation such as `pending_design_reconciliation`;
- `no_change`: cite the evidence that made writing unnecessary;
- `revision_conflict`: report expected and observed pre-state without writing;
- `blocked`: identify the external failure and exact resulting filesystem state.

Never write implementation progress, review findings, task history, or transient session status into DDD artifacts. Model and Design readiness frontmatter is structural authority metadata, not a discovery log.

## References

- Load [../../templates/artifact-layout.md](../../templates/artifact-layout.md) for the canonical project tree and artifact meanings.
- Load [../../templates/README.md](../../templates/README.md), [../../templates/context-map.md](../../templates/context-map.md), and [../../templates/model.md](../../templates/model.md) only for `apply-model`.
- Load [../../templates/design.md](../../templates/design.md) only for `apply-design`.
