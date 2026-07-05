---
last_updated: 2026-07-05
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-07-02-superpowers-ddd-architect.md"
covers_branch: hotfix/ddd-expert-enh@0cc5ed7494dc
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace; ddd-expert is the standalone hookless DDD/backend plugin with design, implement, review skills and shared references; superpowers-architect is restored to its v1.13.10 dynamic design-pattern injection content including bundled DDD/database patterns; memory SessionStart reports KB availability/status only; Codex designing-tests is UserPromptSubmit-only

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; Codex plugin runtime requires hooks/plugin_hooks flags and restart; release scripts use git + jq

- [features.md](features.md) — Current capability map
  Key points: ddd-expert guidance is explicit/hookless and uses phase-specific skills plus a shared risk router; superpowers-architect still injects dynamic design-pattern standards for Superpowers workflows and includes legacy bundled DDD/database patterns; implement/review use evidence-driven surface routers with high-risk examples rather than fixed inventories; memory query reads index on demand and reports retrieval routes; ingest can rebuild decision/glossary roots into router + shard layouts

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: ddd-expert references live under plugin-root references while superpowers-architect restored legacy design-pattern defaults; generated IDL/RPC adapter placement is repository-calibrated, with language-specific shortcuts treated as instances; DDD phases are strategic-first design, accepted-model implementation translation with evidence-driven preflight surface routing, review evidence gates, and observed responsibility-role classification before concept-name risk cards; KB content rules require Slot Contracts, ingest eligibility gates, qualityGate summaries, query-router index sizing, dual Claude/Codex parity, root README review when plugin READMEs change, and no Codex designing-tests SessionStart

- [decisions.md](decisions.md) — Decision router / ADR family index
  Key points: routes to decisions-memory, decisions-architect, decisions-codex, and decisions-foundation shards; ADR-026 restores superpowers-architect v1.13.10 content while ADR-025 keeps superpowers-ddd-architect retired and ddd-expert standalone; ADR-024 retires legacy memory migration

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-001 through ADR-026

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Boundary Publisher, Message Runner, Kafka FailurePolicy, TaskType, PeriodicTask, Codex Native Hooks, Prompt Router, Knowledge Shard
