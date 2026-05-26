---
last_updated: 2026-05-26
updated_by: superpowers-memory:update
triggered_by_plan: "2026-05-13-features-capability-reconciliation.md"
covers_branch: hotfix/tests@cd653c8
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace; designing-tests now mirrors architecture-aware references and Codex UserPromptSubmit routing across tracks

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; Codex plugin runtime requires hooks/plugin_hooks flags and restart; release scripts use git + jq

- [features.md](features.md) — Current capability map
  Key points: designing-tests supports architecture goal coverage, integration quality, hand-off evidence, and skipped/unrun residual-risk reporting

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: Codex prompt routers stay explicit-skill-only; designing-tests references stay mirrored across Claude/Codex tracks; DDD port rules remain in architect patterns

- [decisions.md](decisions.md) — ADR summary log (15 ADRs, 0 superseded)
  Key points: ADR-015 DDD agent contract + Go runtime split; ADR-014 native Codex hooks with cleanup; ADR-013 Codex marketplace compat; ADR-012 UserPromptExpansion slash hook; ADR-010 KB write-lock

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-001 through ADR-015

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Codex Native Hooks, Prompt Router, Architecture Test Design, Test Hand-off Gate, DDD Agent Contract, Capability-Lifecycle Port, Application Command-Side Port, Playbook
