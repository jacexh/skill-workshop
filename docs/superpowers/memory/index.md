---
last_updated: 2026-06-25
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-05-13-features-capability-reconciliation.md"
covers_branch: hotfix/memory-query-routing@3f793a6
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace; Codex native hooks use `${PLUGIN_ROOT}` with bounded timeouts and quiet configs

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; Codex plugin runtime requires hooks/plugin_hooks flags and restart; release scripts use git + jq

- [features.md](features.md) — Current capability map
  Key points: memory query classifies questions and reports retrieval routes; ingest can rebuild decision/glossary roots into router + shard layouts

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: KB content rules require query routing output, decision-family shards, glossary alias-router rebuilds, and dual Claude/Codex parity

- [decisions.md](decisions.md) — Decision router / ADR family index
  Key points: routes to decisions-memory, decisions-architect, decisions-codex, and decisions-foundation shards; ADR details stay under adr/

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-001 through ADR-019

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Boundary Publisher, Message Runner, Kafka FailurePolicy, TaskType, PeriodicTask, Codex Native Hooks, Prompt Router, Knowledge Shard
