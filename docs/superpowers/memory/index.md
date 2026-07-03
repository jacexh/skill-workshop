---
last_updated: 2026-07-03
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-07-02-superpowers-ddd-architect.md"
covers_branch: hotfix/ingest@7b0a541788dacb7008bd0d9411bb4e70dac13467
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace; DDD architect has product-semantics design, model-to-code implement, and evidence-based review skills; old architect is explicit-only with no bundled DDD/database files; memory SessionStart reports KB availability/status only; Codex designing-tests is UserPromptSubmit-only

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; Codex plugin runtime requires hooks/plugin_hooks flags and restart; release scripts use git + jq

- [features.md](features.md) — Current capability map
  Key points: DDD architect guidance uses phase-specific skills plus a shared risk-router budget; memory query reads index on demand and reports retrieval routes; ingest can rebuild decision/glossary roots into router + shard layouts; memory ingest runs only for durable project-knowledge changes, not deployment-only or version/tag-only churn

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: DDD architect references live under plugin-root references, not root design-patterns or one standards skill; hooks inject only the active phase skill + risk-router by default while deep rules stay on demand; generated IDL/RPC adapter placement is repository-calibrated, with language-specific shortcuts treated as instances; DDD phases are strategic-first design, accepted-model implementation translation, evidence-precondition review, and observed responsibility-role classification before concept-name risk cards; KB content rules require Slot Contracts, ingest eligibility gates, qualityGate summaries, query-router index sizing, dual Claude/Codex parity, root README review when plugin READMEs change, and no Codex designing-tests SessionStart

- [decisions.md](decisions.md) — Decision router / ADR family index
  Key points: routes to decisions-memory, decisions-architect, decisions-codex, and decisions-foundation shards; ADR-024 retires legacy memory migration; ADR-023 moves Python/TypeScript DDD guides into the DDD plugin and removes bundled DDD/database files from old architect

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-001 through ADR-024

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Boundary Publisher, Message Runner, Kafka FailurePolicy, TaskType, PeriodicTask, Codex Native Hooks, Prompt Router, Knowledge Shard
