---
last_updated: 2026-05-21
updated_by: superpowers-memory:update
triggered_by_plan: "2026-05-13-features-capability-reconciliation.md"
covers_branch: hotfix/domain-service@5f8ec55
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace; Codex native hook configs and architect pattern files remain mirrored across Claude/Codex tracks

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; Codex plugin runtime requires hooks/plugin_hooks flags and restart; release scripts use git + jq

- [features.md](features.md) — Current capability map
  Key points: Codex marketplace/native hooks require hooks + plugin_hooks + /hooks trust; release/runtime tests guard command hook metadata and canonical Codex deny behavior

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: DDD Application command-side ports are exceptions after a hot-path decision card; P1-P4 checks cover port eligibility, handler pressure, read-side DTOs, and event/message extraction; plugin/codex design-pattern tracks stay mirrored

- [decisions.md](decisions.md) — ADR summary log (15 ADRs, 0 superseded)
  Key points: ADR-015 DDD agent contract + Go runtime split; ADR-014 native Codex hooks with cleanup; ADR-013 Codex marketplace compat; ADR-012 UserPromptExpansion slash hook; ADR-010 KB write-lock

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-001 through ADR-015

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Codex Native Hooks, Prompt Router, Standing Primer, KB Write Lock, Hook Runtime, DDD Agent Contract (hot-path card, P1-P4, 21 must-not rules), Capability-Lifecycle Port, Application Command-Side Port, Playbook
