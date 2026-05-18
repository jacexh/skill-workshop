---
adr: 003
title: Split knowledge base into separate files
date: 2026-03-31
status: Accepted
alternatives_inferred: true
---

# ADR-003: Split knowledge base into separate files

## Context

A single project-memory file grows quickly and forces agents to rewrite unrelated content during incremental updates. Separate knowledge domains have different update triggers and token-loading needs.

## Decision

Store project knowledge in separate files for architecture, tech stack, features, conventions, decisions, and glossary, with later optional detail slots such as ADR details and playbooks. Incremental updates modify only the files whose owner facts changed.

## Alternatives Rejected

Reconstructed during the 2026-05-18 inline-to-detail migration; not recorded in the original inline decision.

- **One large memory file:** Easy to discover, but creates noisy diffs and encourages duplicate fact ownership.
- **Only generated summaries with no stable slots:** Flexible, but agents lose reliable routing when deciding which knowledge to load or update.

## Consequences

The KB has more files and needs routing rules, but incremental updates stay small and ownership is clearer.
