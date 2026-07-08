---
last_updated: 2026-07-08
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-07-02-superpowers-ddd-architect.md"
---

# ADR-025: ddd-expert replaces Superpowers DDD architect plugin

## Status

Accepted.

## Context

`superpowers-ddd-architect` originally provided DDD/backend phase skills plus Claude/Codex hook routing for Superpowers workflows. The DDD guidance now needs to work through explicit phase-skill invocation and non-Superpowers skill systems. Keeping both `superpowers-ddd-architect` and standalone `ddd-expert` would duplicate the same DDD reference set and phase skills, creating drift risk and an unclear canonical entry point.

The implement workflow also exposed a process gap: agents could read runtime, generated RPC, database, and logging references without converting them into pre-edit checks. Those concrete misses are examples of a broader failure mode: the agent must classify touched surfaces from evidence and route to the relevant rule family, not execute a fixed incident checklist. The canonical DDD plugin needs stronger phase-skill contracts rather than more hook surface area.

## Decision

Retire `superpowers-ddd-architect` on both Claude and Codex tracks. Remove it from plugin trees and marketplace catalogs.

Make `ddd-expert` the canonical DDD/backend guidance plugin. It remains explicit, with `domain-modeling`, `design`, `implement`, and `review` phase skills plus shared DDD/backend references under plugin-root `references/`. Hooks are restrained route reminders only; detailed DDD context loads through the selected phase skill.

Strengthen `ddd-expert:implement` with a Preflight Rule Gate that:

- turns explicit user requirements into acceptance items;
- classifies touched surfaces from user requirements, planned files, imports, generated artifacts, migrations, runtime entrypoints, tests, and local conventions;
- uses high-risk surface rows such as runtime/config, generated RPC/protocol, persistence/database, logging, and lifecycle work as a router, not an exhaustive inventory;
- lets agents add or rename surfaces from repository evidence and route them to required references;
- requires placement decisions before edits;
- requires a Rules Satisfied / Not Applicable / Exception table after implementation;
- suggests DDD-aware test seams for generated RPC mapping, real schema checks, fx/config profile behavior, and lifecycle/logging behavior.

Strengthen `ddd-expert:review` with an Evidence Gate, Workflow, and Layer Baseline that classify code shape from concrete evidence, close Smell List verdicts, synthesize root causes, and treat missing proof as an evidence gap rather than a finding.

## Consequences

- `superpowers-architect` initially remained explicit-only for general standards and pointed DDD/backend users to `ddd-expert`; ADR-026 later restores its v1.13.10 dynamic design-pattern content while keeping `superpowers-ddd-architect` retired.
- `ddd-expert` can be used by Superpowers and non-Superpowers skill systems without relying on hook-injected reference content.
- Agents and users must invoke `ddd-expert` explicitly when no host-level skill discovery activates it automatically.
- Legacy Codex hook cleanup scripts may still recognize the retired `superpowers-ddd-architect` name so stale fallback hook blocks can be removed.
- Historical ADRs for the Superpowers DDD architect split remain valid history, but current capability and architecture owners route to `ddd-expert`.

## Affected Files

- `plugins/ddd-expert/`
- `codex-plugins/ddd-expert/`
- `.claude-plugin/marketplace.json`
- `.agents/plugins/marketplace.json`
- `README.md`
- `plugins/superpowers-architect/`
- `codex-plugins/superpowers-architect/`
- `scripts/release/test/`
