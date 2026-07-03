---
last_updated: 2026-07-03
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-07-02-superpowers-ddd-architect.md"
covers_branch: hotfix/templates@0579057b5c64
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace; DDD architect has product-semantics design, model-to-code implement, and evidence-based review skills; old architect is explicit-only with no bundled DDD/database files; memory SessionStart reports KB availability/status only; Codex designing-tests is UserPromptSubmit-only

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; Codex plugin runtime requires hooks/plugin_hooks flags and restart; release scripts use git + jq

- [features.md](features.md) — Current capability map
  Key points: DDD architect guidance uses phase-specific skills over default phase playbook + risk-router budgets; memory query reads index on demand and reports retrieval routes; ingest can rebuild decision/glossary roots into router + shard layouts; memory Slot Contracts, qualityGate summaries, and ingest-owned log.md are implemented in both runtime tracks

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: DDD architect references live under plugin-root references, not root design-patterns or one standards skill; hooks inject only risk-router + active phase playbook by default while deep rules stay on demand; risk cards require routing matrix evidence before findings; KB content rules require Slot Contracts, ingest-owned log.md, qualityGate summaries, query-router index sizing, dual Claude/Codex parity, root README review when plugin READMEs change, and no Codex designing-tests SessionStart

- [decisions.md](decisions.md) — Decision router / ADR family index
  Key points: routes to decisions-memory, decisions-architect, decisions-codex, and decisions-foundation shards; ADR-023 moves Python/TypeScript DDD guides into the DDD plugin and removes bundled DDD/database files from old architect

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-001 through ADR-023

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Boundary Publisher, Message Runner, Kafka FailurePolicy, TaskType, PeriodicTask, Codex Native Hooks, Prompt Router, Knowledge Shard

- [log.md](log.md) — Chronological KB maintenance ledger
  Key points: ingest appends KB maintenance events; query and lint do not append read-only events
