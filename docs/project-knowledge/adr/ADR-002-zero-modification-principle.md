---
adr: 002
title: Zero-modification principle for superpowers integration
date: 2026-03-31
status: Accepted
alternatives_inferred: true
---

# ADR-002: Zero-modification principle for superpowers integration

## Context

The plugin extends superpowers workflows, but patching upstream superpowers files would couple releases to external implementation details and make upgrades fragile.

## Decision

The plugin only uses host hook systems and independent skills to inject context or block unsafe writes. It does not patch, override, or vendor upstream superpowers files.

## Alternatives Rejected

Reconstructed during the 2026-05-18 inline-to-detail migration; not recorded in the original inline decision.

- **Patch upstream superpowers skills directly:** This could enforce behavior more strongly, but would make every upstream upgrade a merge problem.
- **Fork superpowers into this repository:** This would give full control, but would make the workshop responsible for an unrelated workflow codebase.

## Consequences

Hooks can influence but not fully control model behavior. The plugin remains independently upgradeable and avoids upstream coupling.
