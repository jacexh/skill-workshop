---
adr: 005
title: KB index with two-layer injection
date: 2026-04-01
status: Accepted
alternatives_inferred: true
---

# ADR-005: KB index with two-layer injection

## Context

Agents need to know that a project KB exists without eagerly loading every detail file. Older installations used `MEMORY.md`; newer KBs use `docs/project-knowledge/index.md`.

## Decision

Use `docs/project-knowledge/index.md` as a structured, ≤50-line index. SessionStart injects it for passive awareness, while workflow hooks and the `load` skill direct agents to detail files on demand. Legacy `MEMORY.md` remains a read fallback.

## Alternatives Rejected

Reconstructed during the 2026-05-18 inline-to-detail migration; not recorded in the original inline decision.

- **Inject every KB file at SessionStart:** This makes all facts available, but wastes token budget and increases stale/noisy context.
- **Do not inject any index:** This saves tokens, but agents must already know the KB path before benefiting from it.

## Consequences

The index is an extra artifact to regenerate, but it keeps SessionStart context small while still making detailed files discoverable.
