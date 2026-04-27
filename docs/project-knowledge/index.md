---
last_updated: 2026-04-27
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
covers_branch: fix/codex-hook-installer-cache-name@31e65f5
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace (Claude `plugins/` + Codex `codex-plugins/`); Codex setup installer resolves actual plugin cache paths and writes strict `~/.codex/hooks.json`; auto-release workflow is script-backed under `scripts/release/`

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; release scripts use git + jq on GitHub Actions; dual deployment targets are Claude Code and Codex CLI

- [features.md](features.md) — Implemented features
  Key points: 3 plugins on each track; Codex setup skills register hooks through strict-JSON installers; PR-merge auto release bumps affected manifests/snippets and publishes releases

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: hook-runtime.js (Claude) + codex-runtime.js (Codex); content-rules.md as SSOT; `~/.codex/hooks.json` must stay strict JSON; Codex installers must handle source-tree and versioned cache layouts

- [decisions.md](decisions.md) — ADR summary log (13 ADRs, 0 superseded)
  Key points: ADR-013 Codex marketplace compat (Strategy A + strict-JSON setup installer); ADR-012 UserPromptExpansion slash hook; ADR-011 finishing rich-injection; ADR-010 KB write-lock

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-010, ADR-011, ADR-012, ADR-013; ADR-001..009 still in pre-v1.8 inline format inside decisions.md (migration deferred)

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Codex Setup Skill, Auto Release Pipeline, Hook Runtime, KB Write Lock, Rich Injection, Standing Primer
