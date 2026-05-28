---
id: ADR-015
title: DDD agent contract and Go runtime split as standalone pattern files
status: Accepted
date: 2026-05-11
---

# ADR-015: DDD agent contract and Go runtime split as standalone pattern files

## Context

The architect plugin shipped four DDD pattern files (`ddd-modeling.md`, `ddd-core.md`, `ddd-golang.md`, plus `ddd-python.md` / `ddd-typescript.md`) loaded by the `standards` skill via directory scan. Two pressures accumulated:

1. **Agent-behavior gaps in human-oriented prose.** Reviews (one by Claude, one by Codex) found that LLM agents tended to skip the modeling §0 Architecture Gate, copy code snippets without imports, guess at missing answers instead of stopping, and reproduce a recurring set of anti-patterns (`Cacher` ports, proto-in-Domain, business validation in handlers, full-aggregate UI reads, cross-context `domain/` imports, multi-aggregate transactions justified by ORM convenience). The existing docs *named* these failure modes in scattered prose but never enumerated them as a single, agent-actionable "must not do" list with cross-references.
2. **`ddd-golang.md` had grown to 1723 lines.** Roughly 316 of those covered Go runtime concerns — fx-based configuration plumbing, `fx.Lifecycle` hooks, graceful shutdown ordering, Kubernetes `preStop` — that are orthogonal to DDD layer/aggregate/event content. Agents editing `cmd/server/main.go` or `internal/pkg/redis/` had to load the entire Go DDD guide just to reach those sections, and agents doing pure layer work paid the cost of carrying runtime sections in context.

## Decision

Introduce two standalone files under both `plugins/superpowers-architect/design-patterns/` and `codex-plugins/superpowers-architect/design-patterns/`:

- **`ddd-agent-contract.md`** — the agent-behavior layer. Defines (1) trigger conditions including path patterns (`internal/business/**`, `cmd/**/main.go`, `internal/pkg/**`, `configs/**`, fx wiring), (2) mandatory execution order with a task-classification step and a spec-reading matrix (DDD-business / Go-runtime-only / mixed, with runtime-only explicitly skipping the modeling §0 Architecture Gate), (3) a stop-and-ask protocol preceded by a "inspect repo context first" preamble, (4) 23 enumerated must-not rules each pointing back to the spec section it embodies, including dependency-inversion-only Application-port rejection, routing/topology Application-port rejection, umbrella async handler rejection, mixed event/message handler rejection, and the ban on local substitutes for the adopted Go component stack, (5) a dual-track completion self-check (§5.1 DDD + §5.2 Go runtime), and (6) a compact `Standards read / Task classification / Architecture Gate / Stop questions / Planned files / Self-check result` output template with explicit guidance that ordinary final summaries do not need section-by-section citations.
- **`ddd-golang-runtime.md`** — the Go runtime patterns extracted out of `ddd-golang.md`. Owns §1 Configuration Management (component-owned `Option`, shared middleware client ownership under `internal/pkg/<middleware>`, aggregate `Option` in `main`, `configs/` profiles, `${VAR:default}` placeholder convention) and §2 Entry Point & Graceful Shutdown (`app.Run()`, lifecycle hooks for in-flight work, listen/serve separation, EventBus drain, shutdown ordering, Kubernetes `preStop` race-condition workaround).

`ddd-golang.md` keeps DDD content (§0 planning workflow, §1 principles, §2 directory structure, §3 layer responsibilities, §4 tactical reference, §5 cross-context, §6 naming, §7 stack, §8 error handling, §10 module assembly) and replaces the former §9 §10 with an 8-row index pointing into `ddd-golang-runtime.md`. The Constraints list in `ddd-golang.md §3.1` is rewritten as `see ddd-core.md §3.1` plus a concrete Go-specific import allowlist/denylist and SQL-side `Version` increment rule. Frontmatter `description` fields on the four DDD files plus the runtime guide carry path-pattern triggers; modeling/core/golang each prefix a one-line "agents read contract first" notice. Both directory trees stay byte-equal across `plugins/` and `codex-plugins/`.

## Alternatives Rejected

1. **Fold the agent contract into `ddd-modeling.md §0`.** The §0 Architecture Gate is content-oriented (which fields to declare); the contract is behavior-oriented (when to read which file, when to stop, what never to do). Mixing them would (a) bloat §0 past the point agents reliably read it, (b) couple two concerns that evolve independently (modeling rules vs. agent execution protocol), and (c) leave Go-runtime-only work without a place to live — modeling has no opinion on `fx.Lifecycle`. Rejected because the merge produces a worse `ddd-modeling.md` without solving the agent-selective-absorption problem the contract was created to address.

2. **Promote the contract to a standalone Claude/Codex skill (`skills/ddd-agent-contract/SKILL.md`).** This would put the contract description into the always-loaded skill index, giving it higher trigger probability. The trade-offs are: (a) every additional skill description occupies session-start tokens for *every* session, even ones that never touch DDD; (b) the `standards` skill currently orchestrates pattern loading and review-checklist injection — extracting the contract bypasses that orchestration and risks agents reading only the contract while skipping the spec set; (c) SKILL.md format is heavier than a pattern file and requires changes to `standards` skill load order. Rejected as the first move; documented as a follow-up path with explicit promotion criteria (agent observed skipping the gate / committing must-not violations / needing manual `/standards` invocation).

3. **Keep all Go runtime content inside `ddd-golang.md`.** The pure split-cost is small — adding pointer headings is cheap. But the recurring agent failure mode is selective reading of long documents; a 1723-line guide invites skipping the first half (DDD content) when the task is `main.go`. A separate runtime file lets the `standards` skill's directory scan offer the right scope to the agent based on the task path, and lets DDD-only work avoid carrying runtime sections in context. Rejected because the cost of staying combined falls disproportionately on agent workflows.

4. **Split each DDD topic (events, repositories, transactions, etc.) into its own file.** Aggressive splitting would harm cross-reference density: many tactical rules are stated once and referenced from many sections (e.g., the multi-aggregate exception gate is referenced from §3.2, §3.4, §5, and §10 of `ddd-core.md`). Rejected because the runtime split has a natural seam (orthogonal concern, mechanically extractable) while topic-level splits do not.

## Consequences

**Positive.**
- Agents have a single page that tells them *how* to work, separate from *what* the rules are. The 23 must-not enumeration gives review-time grep targets.
- Go-runtime-only work no longer requires loading the full DDD Go guide; runtime-only path explicitly bypasses the modeling §0 Architecture Gate, removing a tax that produced fabricated `n/a` values.
- `ddd-golang.md` is reduced from 1723 → 1427 lines (−17%) with no DDD content loss; cross-references inside it use renumbered §10 for Module Assembly (was §11) and the new §9 stub for Runtime Concerns.
- Both Codex and Claude tracks stay byte-equal (Strategy A from ADR-013), preserving the parallel-tree invariant.
- Frontmatter path patterns let the `standards` skill's directory scan match agent triggers more reliably than semantic-only descriptions.

**Negative.**
- The pattern-file count grows from 8 to 10. The `standards` skill loads them all when DDD is in scope; agents must keep "read contract first" as a stable habit rather than relying on file-count expectations.
- The contract's `description` and trigger conditions carry both DDD and Go runtime keywords; if Python or TypeScript later grow runtime guides, the contract description must generalize (currently Go-keyed in the runtime path).
- Existing entries in this knowledge base that referenced `ddd-modeling.md` / `ddd-core.md` / `ddd-golang.md` by name still resolve correctly, but capability boundaries and review references need explicit pointers to the new files (handled in this same KB update).
- Drift risk between contract and the underlying rules: if `ddd-core.md` adds a new must-do rule, the contract's §4 must-not enumeration and §5 self-check may need a matching entry. No automated check enforces this — manual review during `superpowers-memory:update` is the safety net.

**Reversibility.** The split is reversible at modest cost: the runtime content can be inlined back into `ddd-golang.md` and the contract can be folded into `ddd-modeling.md §0` or promoted to a skill. The non-trivial cost is updating all the cross-references that this ADR justifies adding (path-pattern triggers, capability-boundary notes in `features.md`, conventions rules, KB pointers).

**Promotion criteria for the deferred "contract → standalone skill" move.** If any of the following are observed in normal agent operation, revisit: (1) DDD-tagged tasks where the modeling §0 Architecture Gate core / placement extension is absent from the plan/PR; (2) commits introducing any of the 23 must-not patterns despite the contract being loaded; (3) cases where the agent reads `ddd-golang.md` but not the contract; (4) users repeatedly invoking `/standards` manually because automatic triggers fail. If none of these surface within a normal review cadence, leave the contract as a pattern file.

## References

- `plugins/superpowers-architect/design-patterns/ddd-agent-contract.md`
- `plugins/superpowers-architect/design-patterns/ddd-golang-runtime.md`
- `plugins/superpowers-architect/design-patterns/ddd-golang.md` (§9 stub + §10 renumbered)
- `plugins/superpowers-architect/design-patterns/ddd-modeling.md` (§0 reference to contract)
- `plugins/superpowers-architect/design-patterns/ddd-core.md` (top reference to contract)
- ADR-013 (Strategy A parallel codex-plugins/ tree)
- ADR-002 (zero-modification principle; the contract does not modify upstream superpowers)
