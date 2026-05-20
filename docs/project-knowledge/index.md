---
last_updated: 2026-05-20
updated_by: superpowers-memory:update
triggered_by_plan: "2026-05-13-features-capability-reconciliation.md"
covers_branch: hotfix/port-anti-design@da7c363
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace; Codex native hook configs and architect pattern files remain mirrored across Claude/Codex tracks

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; Codex plugin runtime requires hooks/plugin_hooks flags and restart; release scripts use git + jq

- [features.md](features.md) — Current capability map
  Key points: Codex marketplace/native hooks require hooks + plugin_hooks + /hooks trust; release/runtime tests guard command hook metadata and canonical Codex deny behavior

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: DDD Application ports require capability classification first; Port boundary follows capability lifecycle and defaults to extension over forking; infra routing/transport/topology details stay out of Application ports; Codex hook metadata rules remain enforced

- [decisions.md](decisions.md) — ADR summary log (15 ADRs, 0 superseded)
  Key points: ADR-015 DDD agent contract + Go runtime split; ADR-014 native Codex hooks with cleanup; ADR-013 Codex marketplace compat; ADR-012 UserPromptExpansion slash hook; ADR-010 KB write-lock

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-001 through ADR-015

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Codex Native Hooks, Prompt Router, Standing Primer, KB Write Lock, Hook Runtime, DDD Agent Contract (18 must-not rules), Capability-Lifecycle Port, Playbook
