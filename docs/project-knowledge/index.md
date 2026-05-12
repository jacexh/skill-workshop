---
last_updated: 2026-05-12
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
covers_branch: hotfix/py-ts@cc10ca6
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace; architect `design-patterns/` ships 10 files, with Python/TypeScript DDD guides now mirroring the Go guide's shared gates while preserving language-specific guidance

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; release scripts use git + jq; Codex native plugin hooks require `hooks` + `plugin_hooks` and restart

- [features.md](features.md) — Current capability map
  Key points: marketplace install paths; memory load/update/rebuild/write-lock/verify; DDD guidance spans modeling/core/golang/golang-runtime/python/typescript with shared gates, event-drain lifecycle, and Integration Message boundaries

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: hook-runtime.js (Claude) + codex-runtime.js (Codex); content-rules.md as SSOT; DDD language guides preserve shared gates while Go-only component requirements stay Go-specific

- [decisions.md](decisions.md) — ADR summary log (15 ADRs, 0 superseded)
  Key points: ADR-015 DDD agent contract + Go runtime split; ADR-014 native Codex hooks with cleanup; ADR-013 Codex marketplace compat; ADR-012 UserPromptExpansion slash hook; ADR-010 KB write-lock

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-010 through ADR-015; ADR-001..009 still in pre-v1.8 inline format inside decisions.md

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Domain Event, Integration Message, Canonical Go Component Libraries, DDD Agent Contract, Codex Native Hooks, Auto Release Pipeline, Hook Runtime, Prompt Router, KB Write Lock
