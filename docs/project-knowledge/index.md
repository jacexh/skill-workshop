---
last_updated: 2026-04-13
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: 3 plugins (superpowers-memory, superpowers-architect, designing-tests); Node.js hook runtime; dual PreToolUse hooks intercept skills at invocation; progressive index-first loading

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; node replaces python3 for all hook logic; GitHub Actions release workflow

- [features.md](features.md) — Implemented features, in-progress work
  Key points: superpowers-memory v1.5.4 (3 hooks + verify + 3 skills + 7 templates); superpowers-architect v1.5.1 (6 design patterns); designing-tests v1.5.0 (skill + 4 references)

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: hook-runtime.js for superpowers-memory hooks; content-rules.md as shared SSOT; preserve triggered_by_plan rule

- [decisions.md](decisions.md) — ADR log (8 ADRs, 0 CRITICAL)
  Key points: ADR-008 evidence-based staleness; ADR-007 Node.js hook runtime; ADR-006 progressive pattern loading; ADR-005 index two-layer injection

- [glossary.md](glossary.md) — Domain terminology
  Key points: 5 terms — Knowledge Base, Progressive Loading, Hook Runtime, Evidence Paths, Trigger Skills
