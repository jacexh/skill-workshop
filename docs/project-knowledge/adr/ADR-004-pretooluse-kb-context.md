---
adr: 004
title: PreToolUse hook over SessionStart for KB context injection
date: 2026-04-01
status: Accepted
alternatives_inferred: true
---

# ADR-004: PreToolUse hook over SessionStart for KB context injection

## Context

Loading all project knowledge at session start wastes context on turns that do not need architectural or planning guidance. Agents need stronger reminders at the exact moment they invoke planning or finishing workflows.

## Decision

Inject detailed KB workflow guidance at relevant skill invocation time through PreToolUse. SessionStart retains lightweight index injection for passive awareness.

## Alternatives Rejected

Reconstructed during the 2026-05-18 inline-to-detail migration; not recorded in the original inline decision.

- **Inject all KB guidance at SessionStart:** This maximizes visibility, but spends tokens on unrelated turns and becomes easy for the model to ignore later.
- **Rely only on skill descriptions:** This keeps hooks simple, but does not provide branch-specific or KB-state-specific reminders.

## Consequences

Coverage depends on hookable tool invocations. The benefit is lower background context and more task-specific instructions.
