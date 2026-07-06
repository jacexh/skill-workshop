---
last_updated: 2026-07-06
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-07-06-designing-tests-evidence-choice-slimming.md"
covers_branch: hotfix/testing@c1f666d
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace; ddd-expert is the standalone hookless DDD/backend plugin with design, implement, review skills and shared references; superpowers-architect is restored to its v1.13.10 dynamic design-pattern injection content including bundled DDD/database patterns; memory SessionStart reports KB availability/status only; designing-tests is evidence-choice guidance and Codex UserPromptSubmit-only

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; Codex plugin runtime requires hooks/plugin_hooks flags and restart; release scripts use git + jq

- [features.md](features.md) — Current capability map
  Key points: ddd-expert guidance is explicit/hookless and uses phase-specific skills plus a shared risk router; superpowers-architect still injects dynamic design-pattern standards for Superpowers workflows and includes legacy bundled DDD/database patterns; designing-tests now chooses verification evidence before tests through Intent/Risk/Evidence gates; memory query reads index on demand and reports retrieval routes; ingest can rebuild decision/glossary roots into router + shard layouts

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: ddd-expert references live under plugin-root references while superpowers-architect restored legacy design-pattern defaults; DDD phases are strategic-first design, accepted-model implementation translation with evidence-driven preflight surface routing, review evidence gates, and observed responsibility-role classification before concept-name risk cards; designing-tests hooks stay restrained and evidence-oriented with no Codex SessionStart; KB content rules require Slot Contracts, ingest eligibility gates, qualityGate summaries, query-router index sizing, dual Claude/Codex parity, and root README review when plugin READMEs change

- [decisions.md](decisions.md) — Decision router / ADR family index
  Key points: routes to decisions-memory, decisions-architect, decisions-codex, and decisions-foundation shards; ADR-026 restores superpowers-architect v1.13.10 content while ADR-025 keeps superpowers-ddd-architect retired and ddd-expert standalone; ADR-024 retires legacy memory migration

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-001 through ADR-026

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Boundary Publisher, Message Runner, Kafka FailurePolicy, TaskType, PeriodicTask, Codex Native Hooks, Prompt Router, Knowledge Shard
