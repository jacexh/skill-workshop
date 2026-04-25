---
last_updated: 2026-04-25
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-25-finishing-rich-injection.md"
covers_branch: hotfix/update-trigger-opt@433b4a8
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: 3 plugins; Node.js hook runtime with `lock` / `unlock` / `lock-status` modes; PreToolUse 4-way classifier for `finishing-a-development-branch` (block / no-op / rich injection / soft reminder per ADR-011)

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; GitHub Actions release workflow; no external dependencies beyond Node + git

- [features.md](features.md) — Implemented features, in-progress work
  Key points: superpowers-memory v1.10.1 (rich-context injection on finishing staleness, KB-only commits excluded); superpowers-architect v1.6.2; designing-tests v1.6.0

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: hook-runtime.js for superpowers-memory hooks; content-rules.md as SSOT; KB writes go through `superpowers-memory:update` / `superpowers-memory:rebuild` only (no escape hatch)

- [decisions.md](decisions.md) — ADR summary log (11 ADRs, 0 superseded)
  Key points: ADR-011 finishing rich-injection; ADR-010 KB write-lock; ADR-009 plugin-level KB content discipline

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-010 (write-lock), ADR-011 (rich-injection); ADR-001..009 still in pre-v1.8 inline format inside decisions.md (migration deferred)

- [glossary.md](glossary.md) — Domain terminology
  Key points: 7 terms — Knowledge Base, Progressive Loading, Hook Runtime, Evidence Paths, Trigger Skills, KB Write Lock, Rich Injection
