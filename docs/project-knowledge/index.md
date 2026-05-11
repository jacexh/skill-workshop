---
last_updated: 2026-05-11
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
covers_branch: hotfix/issues@4cbb6ab
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace; architect `design-patterns/` now ships 10 files including the new DDD agent contract and Go runtime guide loaded by the `standards` skill's directory scan

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; release scripts use git + jq; Codex native plugin hooks require `hooks` + `plugin_hooks` and restart

- [features.md](features.md) — Current capability map
  Key points: marketplace install paths; memory load/update/rebuild/write-lock/verify; DDD guidance now spans modeling/core/golang/golang-runtime; DDD Code Agent Execution Contract capability is a behavior layer with trigger/stop/self-check; Codex native hooks and fallback cleanup

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: hook-runtime.js (Claude) + codex-runtime.js (Codex); content-rules.md as SSOT; DDD pattern doc ownership extended with agent contract + Go runtime split (ADR-015); Application-only one-shot event drain and Go sloghelper logging unchanged

- [decisions.md](decisions.md) — ADR summary log (15 ADRs, 0 superseded)
  Key points: ADR-015 DDD agent contract + Go runtime split; ADR-014 native Codex hooks with cleanup; ADR-013 Codex marketplace compat; ADR-012 UserPromptExpansion slash hook; ADR-010 KB write-lock

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-010 through ADR-015; ADR-001..009 still in pre-v1.8 inline format inside decisions.md

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Domain Event, Integration Message, DDD Agent Contract, Codex Native Hooks, Codex Cleanup Skill, Auto Release Pipeline, Hook Runtime, Prompt Router, KB Write Lock
