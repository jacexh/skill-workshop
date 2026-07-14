---
name: maintain-artifacts
description: Use when a ddd-expert phase needs to inspect DDD artifacts or apply an already accepted artifact transaction; validates declared phase-operation compatibility, layout, templates, and model-design revisions without making domain or tactical decisions.
---

# Maintain Artifacts

Execute the DDD artifact protocol inside the currently active phase. This is a shared in-process workflow, not a separate agent or trusted caller boundary. It owns no business fact or Tactical Design decision and never asks the user to supply one.

## Operation input

Every operation states:

- `authority`: `explore`, `shape`, `codify`, or `guard`;
- `operation`: `inspect`, `apply-model`, or `apply-design`;
- the affected context names and stable lower-kebab-case slugs when known.

An `inspect` operation needs no expected revision. When its context scope is omitted, inspect the complete artifact root.

An apply operation additionally states:

- a consistency set containing every path whose observed content or Model revision the accepted decision depends on, including read dependencies that remain unchanged;
- the expected pre-state of every path in the consistency set: absent, or an observed content fingerprint plus any Model revision;
- a write set containing the paths whose content changes; the write set is a subset of the consistency set;
- exact accepted terminal content for every changed semantic section, explicit removals, and evidence that the owning phase's write gate passed;
- for `apply-design`, the exact current Model revision for every affected context.

Reject absolute slugs, path separators, `.` or `..` segments, and any slug that can escape its context directory.

| Operation | Allowed authority | Filesystem effect |
|---|---|---|
| `inspect` | Any phase | Read-only |
| `apply-model` | Explore | Root README, Context Map, and affected Models only |
| `apply-design` | Shape | Affected Designs and newly empty context directories only |

Codify and Guard can never run an apply operation. Treat an invalid operation input as an internal protocol error: write nothing, correct it in the active phase, and retry the operation.

## Workflow

1. **Load the contract**: read the Artifact Layout and only the templates needed by the operation.
2. **Inspect current state**: verify the artifact root, accepted context directories, safe slugs, template residue, frontmatter, links, and Model-to-Design revision links. Read every file in the consistency set before changing any.
3. **Compare before apply**: require every expected path pre-state in the consistency set to match. For `apply-design`, also require the delegated Model revision to equal the current Model revision. A stale or missing Design is a valid pre-state for `apply-design`; the operation exists to create or repair it. On mismatch, write nothing and report `revision_conflict` with expected and observed state.
4. **Prepare one transaction**: assemble the complete write set from the templates, exact accepted terminal content, explicit removals, and unaffected current content. Preserve accepted wording and distinctions. Do not rename terms, infer replacements, decide that a statement is superseded, omit a section on semantic grounds, or turn a summary delta into new domain or tactical prose. Return an invalid operation input to the active phase when exact content is missing.
5. **Apply the authorized write set**:
   - `apply-model`: bootstrap the root README and Context Map when needed; update navigation, dependencies, and affected Models; start a new Model at revision `1` and increment each changed Model at most once for the accepted integrated model transaction; never touch a Design.
   - `apply-design`: create, update, move, or delete affected Designs as required by the accepted context topology and set each retained Design's `based_on_model_revision` to the exact current Model revision; a proven no-semantic-change revalidation may update only this field; never touch Explore-owned artifacts.
6. **Verify the result**: re-read the consistency set, confirm layout, links, no placeholders/comments, accepted language and distinctions, expected terminal content, authorized paths only, unchanged read dependencies, and revision invariants. Whenever a Context Map exists, run `node ../../scripts/validate-context-map.mjs <context-map-path>` from this skill directory during inspection and before apply; validate prepared terminal Context Map content before any write; then run it again after apply. An inspection, current-pre-state, or prepared-target failure is `invalid_layout` and aborts every apply operation with no write or semantic repair. A post-write failure is a partial filesystem failure: report `blocked` with exact observed state; do not conceal it as success.
7. **Resume the phase**: expose the operation status, observed and written revisions, changed paths, validation evidence, and any required route to the active phase. Do not replace that phase's completion response.

## Context Map dependency projection

The Context Map Global View is a mechanical projection of the accepted context inventory and local contract details; it owns no additional domain meaning. The entire graph follows the `ddd-expert` House Rule that model and contract dependencies form a directed acyclic graph. Validate that it:

- contains exactly one Mermaid `graph LR` and the visible `U -> D` direction statement;
- declares every accepted project Bounded Context exactly once, including contexts with no directed relationship, using its lower-kebab-case slug with hyphens replaced by underscores as the node identifier and its accepted name as the visible label;
- contains no external context node;
- represents every accepted dependency between project contexts exactly once as a plain, unlabeled edge from upstream to downstream, with no other edge;
- rejects self-loops, reciprocal edges, longer cycles, `<->`, `<-->`, Partnership, Shared Kernel, and the legacy `## Relationships` structure;
- gives every context a Local View containing exactly its direct upstream and downstream neighbors; and
- projects every named contract with the same identity and endpoints into the upstream context's Downstream Contracts and downstream context's Upstream Dependencies.

An arrow means upstream model or published-contract influence on a downstream model, never runtime call flow. A runtime request and response may use one owned contract without creating a reverse dependency. Directional collaboration patterns may annotate an established edge but cannot create, reverse, or duplicate it. When `apply-model` changes the accepted context inventory or a dependency, update both local projections and the Global View in the same Context Map write. A missing, extra, mislabeled, reversed, reciprocal, or cyclic projection is `invalid_layout`; never repair it by inventing direction, ownership, or contract meaning.

## Integrated model transaction scope

An accepted integrated proposal may affect only one context; in that case the write set may contain one Model when context inventory and dependencies remain unchanged. This is the final Explore transaction, not an intermediate discovery checkpoint. Include the root README, Context Map, and every Model supplying a read dependency in the consistency set.

When the accepted proposal changes context responsibility, business authority, a dependency, an authority boundary, or a translation boundary, put the Context Map and every semantically affected Model in one write set. Add the root README when the accepted context inventory or navigation changes. Apply the complete accepted proposal atomically so each context records only its accepted side of the dependency.

## Context topology changes

Explore may accept a context rename, split, merge, or removal. `apply-model` updates only Explore-owned files and leaves any old Design untouched. It returns `changed` with a `pending_design_reconciliation` observation. Shape then accepts the tactical consequence and `apply-design` creates, moves, rewrites, or deletes affected Designs. Remove an obsolete context directory only after it is empty.

This two-step state is intentional. Until Shape completes it, Codify treats affected Designs as unavailable authority and Guard reports the evidence gap while continuing independent review.

## Inspect result

Return structural observations only; semantic sufficiency belongs to the active phase:

- `ready`: the applicable files and revision links are structurally valid;
- `uninitialized`: the artifact root does not yet exist;
- `missing_model`: an accepted context has no readable Model;
- `missing_design`: a Model has no Design; this is valid between Explore and the first successful Shape;
- `stale_design`: a Design references a different Model revision;
- `pending_design_reconciliation`: context topology and retained Designs are temporarily out of alignment;
- `invalid_layout`: a root file, path, slug, link, frontmatter field, or template constraint is invalid.

Inspection never decides that business facts are contradictory or that a Tactical Design covers the Model. It reports paths, revisions, and concrete structural evidence so the active phase can decide whether to clarify, route, implement, or review.

## Apply result

Return one of:

- `changed`: list every changed path, resulting revision, and structural observation such as `pending_design_reconciliation`;
- `no_change`: cite the evidence that made writing unnecessary;
- `revision_conflict`: report expected and observed pre-state without writing;
- `blocked`: identify the external failure and exact resulting filesystem state.

Never write implementation progress, review findings, task history, or phase status into DDD artifacts.

## References

- Load [../../templates/artifact-layout.md](../../templates/artifact-layout.md) for the canonical project tree and artifact meanings.
- Load [../../templates/README.md](../../templates/README.md), [../../templates/context-map.md](../../templates/context-map.md), and [../../templates/model.md](../../templates/model.md) only for `apply-model`.
- Load [../../templates/design.md](../../templates/design.md) only for `apply-design`.
