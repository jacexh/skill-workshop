---
adr: 001
title: Cross-platform polyglot hook dispatcher
date: 2026-03-31
status: Accepted
alternatives_inferred: true
---

# ADR-001: Cross-platform polyglot hook dispatcher

## Context

Claude hook entries need one command path that works across Unix shells and Windows environments used through Git for Windows. Maintaining separate hook declarations for `.sh` and `.cmd` would duplicate marketplace/plugin metadata and increase release drift.

## Decision

`run-hook.cmd` is a polyglot dispatcher that is valid as both a Windows batch file and a bash script. Hook declarations can point to one wrapper, and the wrapper dispatches to the runtime script without adding host-specific setup.

## Alternatives Rejected

Reconstructed during the 2026-05-18 inline-to-detail migration; not recorded in the original inline decision.

- **Separate Unix and Windows hook declarations:** This would make platform behavior explicit, but marketplace metadata and tests would need to keep two command paths aligned.
- **Require users to install a shell compatibility layer:** This reduces plugin complexity, but violates the no-extra-dependencies goal for hook execution.

## Consequences

The wrapper is less obvious than separate platform scripts, but it keeps hook declarations single-path and dependency-free.
