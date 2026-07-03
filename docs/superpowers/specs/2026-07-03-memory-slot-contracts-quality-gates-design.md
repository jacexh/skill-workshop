# superpowers-memory Slot Contracts and Quality Gates — Design Spec

**Date:** 2026-07-03
**Status:** Ready for user review
**Triggering case study:** `/home/xuhao/talgent/docs/superpowers/memory/`

---

## Context

The memory plugin already has meaningful Project Knowledge rules, but they are
hard to discover as a coherent contract. The core rules are split across
`content-rules.md`, templates, ingest skills, and `verify` runtime checks. This
causes two practical problems:

- Users and agents can see a file named `architecture.md` and still disagree
  about whether it is "architecture enough".
- Different KB slots have different degrees of enforcement. `features.md`
  missing fields are shape violations, while architecture answerability gaps are
  advisory `coverageGaps`.

The talgent KB shows the intended advanced shape: `architecture.md` is a
topology/router, with module shards and named scenario shards carrying deeper
detail. That shape is valid. The current weak point is not the shard model; it is
that the slot contracts and gate severity are not explicit enough.

## Goals

1. Make each Project Knowledge slot's required elements visible in one place.
2. Preserve the current progressive layout model: `architecture.md` can be a
   router, and detailed knowledge can live in reachable `<slot>-<domain>.md`
   shards.
3. Strengthen ingest so it writes to the slot contract, not only to a rough
   template.
4. Strengthen `verify` output so users can distinguish format breakage from
   answerability risks.
5. Keep existing warn-oriented workflow compatibility unless a future explicit
   decision turns selected coverage gaps into hard blockers.

## Non-goals

- Do not remove any existing KB slot.
- Do not require every project to create every section when the project lacks
  that concern; conditional slots remain conditional.
- Do not force talgent cleanup as part of this plugin change.
- Do not replace Markdown templates with a full machine-readable schema in this
  iteration.
- Do not make architecture coverage warnings fail `verify.ok` by default.

## Design

### D1 — Add an explicit `KB Slot Contracts` section

Add a compact section near the top of `plugins/superpowers-memory/content-rules.md`
and mirror it in `codex-plugins/superpowers-memory/content-rules.md`. Each slot
gets the same shape:

- `Owner`: the fact type this file owns.
- `Required shape`: sections or fields that should exist when the slot has
  applicable content.
- `Conditional shape`: extra requirements for complex repos or large domains.
- `Shard rule`: when and how to split.
- `Must not include`: wrong-owner or stale-prone content.
- `Verify coverage`: runtime checks that currently protect the slot.

The section is an index to the longer per-file rules, not a second source of
truth. If a detail changes, update both the compact contract line and the
detailed rule in the same patch.

### D2 — Clarify the architecture contract

Keep the architecture model as:

- `architecture.md`: overview/router, topology/context map, compact cards or
  shard links, scenario links, lifecycle routing, ADR pointers.
- `architecture-<module>.md`: one high-value service, bounded context, or main
  module.
- `architecture-<scenario>.md`: one named cross-service flow or stable scenario
  family.

For complex repos, architecture coverage should answer:

- What are the main services, stores, buses, trust boundaries, and call/event
  direction rules?
- Which module owns a high-value responsibility, and what does it explicitly not
  own?
- Which named scenarios shape future changes?
- What authority, ordering, idempotency, and failure rules matter in each
  scenario?
- Which lifecycle/FSM transitions cross module or bounded-context boundaries?
- Which source refs validate the architecture entry?

This makes a router-like `architecture.md` acceptable only when the linked
module/scenario shards are reachable and query-grade.

### D3 — Introduce verify severity buckets

Keep existing `verify.ok` semantics for now: stale refs, SSOT violations, shape
violations, and readiness warnings can make `ok=false`. Add clearer severity
grouping to the output:

- `shapeViolations`: format or slot-contract errors.
- `readinessWarnings`: capability readiness calibration problems.
- `coverageGaps`: query answerability gaps, advisory by default.
- `qualityGate`: new summary object that reports counts by severity and whether
  advisory coverage gaps exist.

`qualityGate` should not replace existing fields. It summarizes them so humans
and agents can see whether a KB is mechanically clean but architecturally thin.

Example:

```json
{
  "qualityGate": {
    "ok": false,
    "blockingFindings": 4,
    "advisoryFindings": 1,
    "coverageAdvisoryOnly": true
  }
}
```

The default `qualityGate.ok` follows current `verify.ok` and remains
backward-compatible. A later ADR can decide whether selected coverage gaps become
blocking.

### D4 — Make architecture coverage checks more actionable

Keep the existing architecture coverage checks and tighten their messages around
the contract:

- missing topology/context map
- legacy view shards (`architecture-contexts.md`, `architecture-flows.md`)
- sparse or shallow module cards
- missing module shards in complex repos
- sparse scenario sequences
- missing named scenario shards
- sequence diagrams without local `Source refs`
- missing module/scenario bidirectional refs
- scenario shards missing Participants, Sequence Phases, Authority Boundaries,
  or Ordering / Idempotency / Failure Rules
- DDD/context signals without lifecycle/FSM coverage
- architecture entries with no source refs

The output should point to the relevant target owner, such as
`architecture-<module>.md` or `architecture-<scenario>.md`, and should describe
the missing query answer rather than only the missing syntax.

### D5 — Add ingest self-checks against slot contracts

Update `ingest`, `update`, and `rebuild` skill instructions for both Claude and
Codex tracks. Before writing:

1. Select the owner slot from the Ownership Matrix.
2. Pick the applicable Slot Contract.
3. Identify whether the change is a narrow incremental update or a topic-scope
   refresh.

After writing:

1. Check that touched owner/shard files satisfy their Slot Contract.
2. Check that new shards are reachable from `index.md` and the parent owner file
   when high value.
3. For architecture module updates, check responsibility, non-responsibility,
   internal architecture model, interactions, state/invariants, scenario refs,
   and source refs.
4. For architecture scenario updates, check participants, sequence, authority,
   data/control flow, ordering/idempotency/failure rules, module refs, and source
   refs.
5. If the touched topic remains too thin, perform topic-scope refresh or record a
   full-refresh recommendation.

### D6 — Update templates to expose contracts at the point of writing

Templates should remain Markdown-friendly, but their comments should match the
Slot Contract headings. Update both tracks:

- `architecture.md`
- `architecture-module.md`
- `architecture-scenario.md`
- `features.md`
- `decisions.md`
- `conventions.md`
- `tech-stack.md`
- `glossary.md`
- `index.md`

The goal is not more template text. The goal is to make generated files easier
for an agent to complete correctly on the first pass.

### D7 — Add focused verify fixtures

Add fixture coverage for both Claude and Codex runtime checks:

- complex repo with thin `architecture.md` and no module/scenario shards
- topology present but no named scenario source refs
- scenario shard missing authority/failure fields
- module shard missing scenario refs
- scenario shard missing module refs
- feature entry missing required fields
- decision summary missing detail link or affected owner routing
- reference slot missing source refs or tech-stack rationale

Existing release tests should run the fixtures through both runtimes to preserve
Claude/Codex parity.

## File Scope

Primary files:

- `plugins/superpowers-memory/content-rules.md`
- `codex-plugins/superpowers-memory/content-rules.md`
- `plugins/superpowers-memory/skills/*/SKILL.md`
- `codex-plugins/superpowers-memory/skills/*/SKILL.md`
- `plugins/superpowers-memory/templates/*.md`
- `codex-plugins/superpowers-memory/templates/*.md`
- `plugins/superpowers-memory/hooks/hook-runtime.js`
- `codex-plugins/superpowers-memory/hooks/codex-runtime.js`
- `plugins/superpowers-memory/hooks/fixtures/` as the shared fixture source used
  by both runtime verification paths.
- `scripts/release/test/test_memory_verify.sh`

Project KB updates are expected after implementation because this change modifies
stable plugin behavior and rules.

## Compatibility

This design keeps existing `verify.ok` behavior compatible. Users still get
`coverageGaps` as advisory findings. The new `qualityGate` summary makes the
advisory state more visible without blocking commits or changing current
automation expectations.

The design also keeps the progressive layout rule: large valid KB content should
be split by stable module/domain/scenario, not deleted to satisfy token pressure.

## Verification Strategy

1. Run fixture tests for the memory runtime.
2. Run `node plugins/superpowers-memory/hooks/hook-runtime.js verify` in this
   repository.
3. Run the Codex runtime equivalent.
4. Dry-run the updated verifier against `/home/xuhao/talgent` and confirm it
   reports architecture gaps in the new severity summary without changing the
   existing blocking behavior.
5. Inspect generated template/comment changes for Claude/Codex parity.

## Follow-up Decisions

These are explicitly out of scope for this implementation:

- Decide in a future ADR whether selected architecture coverage gaps should
  become blocking for complex repositories.
- Decide later whether to introduce a machine-readable schema that generates
  templates and verify metadata from one source.
