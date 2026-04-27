---
last_updated: 2026-04-26
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-26-codex-marketplace-compat-plan.md"
covers_branch: hotfix/codex@3f34ae1
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace (Claude `plugins/` + Codex `codex-plugins/`); 3 plugins per track; codex-runtime.js drops `user-prompt-expansion`, adds `user-prompt-submit` (regex on `$superpowers:brainstorming` / `finishing-a-development-branch`), PreToolUse matcher = `apply_patch|mcp__filesystem__.*`

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; dual deployment targets (Claude Code + Codex CLI); no external dependencies beyond Node + git

- [features.md](features.md) — Implemented features
  Key points: 3 plugins on Claude track (memory v1.11.0, architect v1.6.2, designing-tests v1.6.0); 3 codex-plugins variants (experimental, ADR-013); each Codex plugin ships `setup` skill for `~/.codex/hooks.json` registration

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: hook-runtime.js (Claude) + codex-runtime.js (Codex); content-rules.md as SSOT; KB writes only via `superpowers-memory:update`/`rebuild`; Strategy A red line — never modify `plugins/` from Codex work; codex-hooks-snippet.json + setup-skill marker protocol

- [decisions.md](decisions.md) — ADR summary log (13 ADRs, 0 superseded)
  Key points: ADR-013 Codex marketplace compat (Strategy A); ADR-012 UserPromptExpansion slash hook; ADR-011 finishing rich-injection; ADR-010 KB write-lock

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-010, ADR-011, ADR-012, ADR-013; ADR-001..009 still in pre-v1.8 inline format inside decisions.md (migration deferred)

- [glossary.md](glossary.md) — Domain terminology
  Key points: 8 terms — Knowledge Base, Progressive Loading, Hook Runtime (dual-track), Trigger Skills, KB Write Lock, Rich Injection, Codex Setup Skill, Standing Primer
