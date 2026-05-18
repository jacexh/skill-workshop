---
adr: 009
title: Plugin-level enforcement of KB content discipline
date: 2026-04-10
status: Accepted
alternatives_inferred: true
---

# ADR-009: Plugin-level enforcement of KB content discipline

## Context

A real project KB showed drift across size, duplicated facts, and content-shape violations. Existing template comments and coarse size warnings did not force agents to route facts to a single owner or keep feature, glossary, and decision entries scannable.

## Decision

Add an explicit Ownership Matrix, ADR gate, capability-view `features.md`, ≤2-line glossary rule, Exclusion Gate steps in update/rebuild skills, and richer `verify` checks for SSOT, content shape, and token budget. Raise the `decisions.md` size cap from 150 to 300 lines while moving full rationale to ADR detail files.

## Alternatives Rejected

Reconstructed during the 2026-05-18 inline-to-detail migration; not recorded in the original inline decision.

- **Keep template comments as guidance only:** Low implementation cost, but agents repeatedly missed the implied rules.
- **Hard-block all warnings:** Stronger enforcement, but would remove user control over accepted size or transitional migration warnings.

## Consequences

`verify` remains warn-oriented except for git commit readiness. Users retain control over whether to compress or accept warnings. Machine-checkable format rules surface legacy patterns progressively as KBs are updated.
