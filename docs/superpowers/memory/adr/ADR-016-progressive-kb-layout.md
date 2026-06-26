---
id: ADR-016
title: Progressive KB layout and playbook removal
status: Accepted; superseded in part by ADR-020
date: 2026-05-27
---

# ADR-016: Progressive KB layout and playbook removal

## Context

The memory plugin used fixed per-file line thresholds and an aggregate token budget as verification pressure for project knowledge. In large projects, especially architecture files with many sequence diagrams, this creates the wrong incentive: valid knowledge may be compressed or dropped only to satisfy a mechanical cap.

The plugin also carried a `playbooks.md` lazy slot for recurring procedural code-change recipes. In real projects this slot was not observed to trigger or provide value, and its "will there be a next similar change" premise was too speculative for reliable generation.

## Decision

Remove the playbook slot from superpowers-memory across both Claude and Codex tracks: templates, runtime shape checks, update/rebuild instructions, and content rules no longer generate or validate `playbooks.md`.

Keep `index.md` as the only strict query-router size constraint because `query` reads it first on demand. All other recognized entry files may split vertically by domain or submodule using `<slot>-<domain>.md` names, for example `architecture-runtime.md` or `features-release.md`. Agents must update `index.md` routing when they create or maintain shards.

Verification reports `retrievalCost` and `splitCandidates` as advisory signals. These guide loading and splitting decisions but are not a reason to delete valid knowledge. Legacy `playbooks.md` files are ignored rather than treated as schema errors.

## Alternatives Rejected

1. **Raise the global caps.** Larger caps postpone the failure mode but keep the same compression pressure for sufficiently large projects.
2. **Keep playbooks as an optional lazy slot.** This preserves unused schema complexity and ambiguous generation criteria for no observed operational benefit.
3. **Require compression before splitting.** Compression is appropriate for noise, duplication, or changelog residue, but not for valid dense knowledge such as architecture diagrams or module-specific behavior.

## Consequences

**Positive.**
- Large projects can preserve valid knowledge while keeping the query-router `index.md` small.
- Runtime verification becomes aligned with retrieval behavior: cost and split candidates are advisory, while only the first query-router index has a hard size gate.
- The KB schema loses the speculative playbook concept and the maintenance burden around recipe detection.

**Negative.**
- Project knowledge may contain more files, so `index.md` routing quality matters more.
- Agents must recognize shard names as first-class KB entries and avoid loading every shard by default.
- Existing legacy `playbooks.md` files are unmanaged; removal from the schema does not automatically delete user content.

## References

- `plugins/superpowers-memory/content-rules.md`
- `plugins/superpowers-memory/hooks/hook-runtime.js`
- `codex-plugins/superpowers-memory/hooks/codex-runtime.js`
- `plugins/superpowers-memory/templates/index.md`
- `scripts/release/test/test_memory_verify.sh`
