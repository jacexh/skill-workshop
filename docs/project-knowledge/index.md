---
last_updated: 2026-05-10
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
covers_branch: hotfix/message@e01bef6
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace; Codex plugins use native manifest hooks plus cleanup for old fallback entries; architect guidance uses dynamic pattern indexes, Architecture Gate, and explicit standards skills on both tracks

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; release scripts use git + jq; Codex native plugin hooks require `hooks` + `plugin_hooks` and restart

- [features.md](features.md) — Current capability map
  Key points: marketplace install paths; memory load/update/rebuild/write-lock/verify; DDD Architecture Gate, vendor-wrapper ACL triage, Integration Message boundary guidance, and language-specific DDD implementation guides; Codex native hooks and fallback cleanup

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: hook-runtime.js (Claude) + codex-runtime.js (Codex); content-rules.md as SSOT; DDD pattern docs split modeling/core/language ownership, technology-leak prevention, BC-internal Domain Events, Integration Messages via `ddd/message`, Application-only one-shot drain ownership, and Go sloghelper logging

- [decisions.md](decisions.md) — ADR summary log (14 ADRs, 0 superseded)
  Key points: ADR-014 native Codex hooks with cleanup migration; ADR-013 Codex marketplace compat; ADR-012 UserPromptExpansion slash hook; ADR-010 KB write-lock

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-010, ADR-011, ADR-012, ADR-013, ADR-014; ADR-001..009 still in pre-v1.8 inline format inside decisions.md

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Domain Event, Integration Message, Codex Native Hooks, Codex Cleanup Skill, Auto Release Pipeline, Hook Runtime, Prompt Router, KB Write Lock
