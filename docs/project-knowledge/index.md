---
last_updated: 2026-04-25
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-25-kb-write-lock.md"
covers_branch: hotfix/update-trigger@6afb00d
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: 3 plugins; Node.js hook runtime with `lock` / `unlock` / `lock-status` modes; PreToolUse dispatches both `Skill` and `Write|Edit|MultiEdit|NotebookEdit` (KB write-lock per ADR-010)

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; GitHub Actions release workflow; no external dependencies beyond Node + git

- [features.md](features.md) — Implemented features, in-progress work
  Key points: superpowers-memory v1.9.0 (adds KB write-lock + Write/Edit interception); superpowers-architect v1.6.2; designing-tests v1.6.0

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: hook-runtime.js for superpowers-memory hooks; content-rules.md as SSOT; KB writes go through `superpowers-memory:update` / `superpowers-memory:rebuild` only (no escape hatch)

- [decisions.md](decisions.md) — ADR summary log (10 ADRs, 0 superseded)
  Key points: ADR-010 KB write-lock via PreToolUse hook; ADR-009 plugin-level KB content discipline; ADR-008 evidence-based staleness

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-010 detail (KB write-lock); ADR-001..009 still in pre-v1.8 inline format inside decisions.md (migration deferred)

- [glossary.md](glossary.md) — Domain terminology
  Key points: 6 terms — Knowledge Base, Progressive Loading, Hook Runtime, Evidence Paths, Trigger Skills, KB Write Lock
