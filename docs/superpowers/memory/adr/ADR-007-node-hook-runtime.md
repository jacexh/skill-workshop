---
adr: 007
title: Node.js hook runtime for superpowers-memory
date: 2026-04-09
status: Accepted
alternatives_inferred: true
---

# ADR-007: Node.js hook runtime for superpowers-memory

## Context

The memory plugin originally had hook behavior spread across shell and Python snippets. JSON parsing/escaping and git checks were becoming hard to keep consistent across hook modes.

## Decision

Consolidate superpowers-memory hook logic into `plugins/superpowers-memory/hooks/hook-runtime.js`. Shell wrappers become thin dispatchers that execute `node hook-runtime.js <mode>`.

## Alternatives Rejected

Reconstructed during the 2026-05-18 inline-to-detail migration; not recorded in the original inline decision.

- **Keep bash plus Python helpers:** This kept individual hooks small, but duplicated parsing and increased dependency assumptions.
- **Implement each hook as a separate JS file:** This reduces file size per hook, but makes shared state classification and write-lock behavior easier to drift.

## Consequences

Hook logic becomes a larger JS runtime file, but avoids coordinated shell/Python quoting behavior and reduces host dependencies.
