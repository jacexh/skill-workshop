---
last_updated: 2026-05-07
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
covers_branch: hotfix/features@539ed4d
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace; Codex plugins now use native manifest hooks with setup fallback; Codex architect combines SessionStart, explicit skill routing, and standards skill without Stop interception

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; release scripts use git + jq; Codex native hooks require `codex_hooks` and restart

- [features.md](features.md) — Current capability map
  Key points: marketplace install paths; memory load/update/rebuild/write-lock/verify; architecture standards guidance; test design guidance; Codex native hooks and setup fallback

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: hook-runtime.js (Claude) + codex-runtime.js (Codex); content-rules.md as SSOT; features.md now uses grouped `####` capability entries; native Codex hook files mirror fallback snippets

- [decisions.md](decisions.md) — ADR summary log (14 ADRs, 0 superseded)
  Key points: ADR-014 native Codex hooks with setup fallback; ADR-013 Codex marketplace compat; ADR-012 UserPromptExpansion slash hook; ADR-010 KB write-lock

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-010, ADR-011, ADR-012, ADR-013, ADR-014; ADR-001..009 still in pre-v1.8 inline format inside decisions.md

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Codex Native Hooks, Codex Setup Skill, Auto Release Pipeline, Hook Runtime, Prompt Router, KB Write Lock
