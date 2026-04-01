---
last_updated: 2026-04-01
updated_by: superpowers-memory:update
triggered_by_plan: 2026-04-01-memory-index.md
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System overview, module structure, data flow
  Key points: Plugin Marketplace pattern; 3 hooks (SessionStart injects MEMORY.md, PreToolUse intercepts skills, Stop blocks on feat/refactor commits); zero-modification principle

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Bash + Markdown + JSON; python3 for stdin JSON parsing; no external dependencies beyond git

- [features.md](features.md) — Implemented features, in-progress work
  Key points: v1.2.2; 6 templates (5 KB files + MEMORY.md); Stop hook scoped to feat/refactor commits only; no features in progress

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: set -euo pipefail + printf in all hooks; triggered_by_plan preserved when no plan exists; no external deps rule; conventional commits

- [decisions.md](decisions.md) — ADR log, known issues
  Key points: ADR-005 MEMORY.md two-layer injection (session-start passive + pre-tool-use enforced); ADR-004 PreToolUse over SessionStart; ADR-003 5-file KB split
