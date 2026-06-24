---
adr: 008
title: Evidence-based staleness detection in stop hook
date: 2026-04-09
status: Accepted
alternatives_inferred: true
---

# ADR-008: Evidence-based staleness detection in stop hook

## Context

Commit-message based staleness detection missed meaningful changes without conventional prefixes. The memory plugin needed a stronger signal for whether code changed without a corresponding KB update.

## Decision

The stop hook checks file-level changes outside `docs/superpowers/memory/` using committed, staged, unstaged, and untracked git queries. It emits reminders only when non-KB changes exist.

## Alternatives Rejected

Reconstructed during the 2026-05-18 inline-to-detail migration; not recorded in the original inline decision.

- **Match conventional commit prefixes:** Cheap to compute, but misses changes with non-conventional messages.
- **Always remind after every turn:** Hard to miss, but too noisy to be trusted.

## Consequences

The approach uses more git probes than commit-message matching, but reduces false negatives. Later ADR-011 replaces stop-hook enforcement with finishing-time rich injection because stop hooks were too noisy.
