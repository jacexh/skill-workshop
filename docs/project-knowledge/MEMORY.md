---
last_updated: 2026-04-02
updated_by: superpowers-memory:update
triggered_by_plan: 2026-04-02-superpowers-architect.md
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System overview, module structure, data flow
  Key points: 2 plugins (superpowers-memory, superpowers-architect); dual PreToolUse hooks intercept skills at invocation; progressive pattern loading injects index only

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Bash + Markdown + JSON; python3 for stdin JSON parsing and safe json.dumps escaping; no external dependencies beyond git

- [features.md](features.md) — Implemented features, in-progress work
  Key points: v1.2.3; superpowers-memory (3 hooks + 3 skills + MEMORY.md index); superpowers-architect (PreToolUse progressive loading with global + project pattern layers)

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: set -euo pipefail + printf in all hooks; preserve triggered_by_plan; python3 json.dumps as valid alternative to bash escape_for_json

- [decisions.md](decisions.md) — ADR log, known issues
  Key points: ADR-006 progressive pattern loading via PreToolUse; ADR-005 MEMORY.md two-layer injection; ADR-004 PreToolUse over SessionStart
