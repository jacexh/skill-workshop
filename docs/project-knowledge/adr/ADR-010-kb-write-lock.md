---
adr: 010
title: KB write-lock enforced by PreToolUse hook
date: 2026-04-25
status: Accepted
---

# ADR-010: KB write-lock enforced by PreToolUse hook

## Context

`docs/project-knowledge/` is the Single Source of Truth for cross-session project memory in superpowers-memory. Content rules already designate `superpowers-memory:update` and `superpowers-memory:rebuild` as the sole editors (per the Ownership Matrix in `content-rules.md`), but enforcement was advisory: the PreToolUse hook only matched the `Skill` tool, leaving `Write`, `Edit`, `MultiEdit`, and `NotebookEdit` on KB paths completely unguarded.

Field evidence from a downstream project (talgent) showed the failure mode: AI assistants implementing features routinely judged "this is significant enough to record as an ADR" and used `Write` directly on `docs/project-knowledge/decisions.md` and `docs/project-knowledge/adr/`. The next `superpowers-memory:update` run then re-applied the Exclusion Gate and Single-Owner audit (Step 4 of the update SKILL.md: "Apply ... per-file format rule to ALL entries in any file you touch ... rewrite [violators] to comply") — silently overwriting or restructuring the standalone entries. Result: unpredictable churn, lost authorial intent, and a mental model split where users couldn't rely on the update skill as the canonical edit path.

The same risk applies to manual user edits (typo fixes, in-IDE tweaks). Without a hard gate, "use `superpowers-memory:update`" is documented convention only.

## Decision

Extend the superpowers-memory PreToolUse hook to match `Skill|Write|Edit|MultiEdit|NotebookEdit`. For Write-family tools, inspect the resolved file path: if it falls inside `docs/project-knowledge/`, return `decision: "block"` with a remediation message unless a write-lock is held.

The lock is a file at `<gitDir>/superpowers-memory.lock` (typically `.git/superpowers-memory.lock`) containing `{ acquired_at, skill }`. It is acquired and released only by the `superpowers-memory:update` and `superpowers-memory:rebuild` skills via three new `hook-runtime.js` subcommands: `lock <skill-name>`, `unlock`, `lock-status`. Stale locks (mtime older than 60 minutes) are ignored and auto-cleaned, so an aborted skill run cannot permanently lock the KB.

Protection scope is the entire `docs/project-knowledge/` tree, not just `decisions.md` / `adr/`. There is no environment-variable bypass and no user escape hatch — all KB edits, including one-line typo fixes, must go through `superpowers-memory:update`.

## Alternatives Rejected

- **Transcript-based skill detection**: Have the hook read `transcript_path` from PreToolUse stdin and look for a recent `Skill(superpowers-memory:update)` invocation in the assistant's turns. Rejected because "recent" is fuzzy (how many turns? how does compaction affect it?), the transcript is large to parse on every Write, and the heuristic breaks when subagents or tool-result-only turns intervene. Hook-managed explicit lock has unambiguous semantics.

- **Time-bounded sentinel without explicit acquire/release**: The skill writes a sentinel file on first edit and never explicitly releases — hook treats any sentinel newer than N minutes as license. Rejected because the lifecycle is implicit; the lock state becomes coupled to "did the AI write something recently" instead of "is the canonical workflow active." Explicit `lock` / `unlock` calls in SKILL.md make the contract auditable from the skill markdown alone.

- **Environment-variable escape hatch (`SUPERPOWERS_MEMORY_FORCE_WRITE=1`)**: Allow users to set an env var when they want to manually edit. Rejected per user mandate "must be triggered by update": any quiet escape would re-introduce the divergence problem. The TTL is the only safety valve, and it exists for crash recovery, not for routine bypass. If a typo absolutely must be fixed without re-running `superpowers-memory:update`, the user can manually invoke `node hook-runtime.js lock test` — but this leaves a trace and is explicitly off the documented happy path.

- **Narrow scope (`decisions.md` + `adr/` only)**: Protect just the decision artifacts the user observed being abused. Rejected because every KB file has the same ownership contract per `content-rules.md`; protecting only some files creates a split mental model ("`features.md` is editable but `decisions.md` isn't") that will produce the same drift in other files later.

## Consequences

KB integrity is now mechanically enforced: no path through Claude Code's standard tool surface can modify `docs/project-knowledge/` outside `superpowers-memory:update` / `superpowers-memory:rebuild`. Write attempts return a structured block message pointing at the canonical workflow.

Existing projects upgrading to superpowers-memory v1.9.0 will see all direct KB edits blocked at the hook layer until they re-install the plugin and let `superpowers-memory:update` acquire the lock. This is a breaking change in user contract — flagged with a minor version bump (v1.8.x → v1.9.0) and a `KB Write Lock` README section. Plugins not yet on v1.9.0 retain prior behavior.

The 60-minute lock TTL bounds blast radius if `superpowers-memory:update` aborts before calling `unlock` — the next session opens with the lock auto-cleaned. `lock-status` provides a debugging entry point. The lock file lives in `.git/`, so it is never tracked, never committed, and survives across hook invocations within a single skill run.

Two follow-up items are deferred but worth noting: (1) the cached marketplace plugin version is what actually runs in user shells, so the new behavior only takes effect after `/plugin update`; (2) the existing `decisions.md` still contains pre-v1.8 ADRs (001–008) in full-body format — they predate this work and should be migrated in a separate update with per-ADR granularity-gate review.
