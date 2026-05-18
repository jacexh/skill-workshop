---
adr: 006
title: Progressive design pattern loading via PreToolUse hook
date: 2026-04-02
status: Accepted
alternatives_inferred: true
---

# ADR-006: Progressive design pattern loading via PreToolUse hook

## Context

Architecture standards can be large, and different projects may override or add pattern files. Agents need to see which standards exist without always loading full pattern text.

## Decision

`superpowers-architect` intercepts target skills via PreToolUse, scans global and project pattern directories, and injects a compact index with pattern name, description, and path. Agents load full pattern content on demand.

## Alternatives Rejected

Reconstructed during the 2026-05-18 inline-to-detail migration; not recorded in the original inline decision.

- **Full-content injection:** Guarantees availability, but causes token bloat and pushes unrelated standards into every planning turn.
- **Tag-based manual activation:** Saves context, but depends on users or agents remembering the right tags.

## Consequences

Agents must load full pattern content on demand. This preserves context budget and lets project-local patterns override team defaults.
