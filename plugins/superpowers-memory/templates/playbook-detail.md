---
playbook: <slug>
title: <Verb-led title>
last_updated: YYYY-MM-DD
---

<!-- OWNER: One playbook — a reusable procedural recipe for a recurring class of code change.
     Loaded on demand via `Read`, not at session start.

     BOUNDARY:
     - Steps must be code-touching actions with concrete paths. Avoid "use good judgment" steps.
     - Steps must be stable: if they change every sprint, this is the wrong abstraction level.
     - References to specific implementations are OK; references that rot weekly are not.

     SIZE GUARD: ~100 lines / ~2500 tokens.
     If you exceed this, the playbook is probably two playbooks fused — split. -->

# <Verb-led title>

**When:** <one-line trigger condition — identical to the index entry in playbooks.md>
**Why this exists:** <optional — link to ADR-NNN or conventions.md §<section> that motivates this recipe>

## Preconditions

<!-- Facts that must be true before starting. Examples:
     - Branched off main
     - Local environment has `protoc` installed
     - Database migrations are caught up -->

- <precondition 1>
- <precondition 2>

## Steps

<!-- Ordered, file/function-granularity actions. Each step:
     - Names a concrete path or symbol
     - Describes the edit, not the goal
     - Can be followed without re-deriving the recipe -->

1. <action with concrete path>
2. <action with concrete path>
3. ...

## Verification

<!-- How to confirm it worked. Prefer commands and observable outputs over "looks good". -->

- <command or test that should pass>
- <log line or output to check>

## Pitfalls

<!-- Known traps. Things that will bite you if you skip them. -->

- <pitfall 1>
- <pitfall 2>

## References

<!-- Pointers to ADRs, conventions, related playbooks. Keep ≤5 entries. -->

- [ADR-NNN: <title>](../adr/ADR-NNN-<slug>.md)
- conventions.md §<section>
- Related playbook: [<title>](<related-slug>.md)
