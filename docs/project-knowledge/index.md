---
last_updated: 2026-05-28
updated_by: superpowers-memory:update
triggered_by_plan: "2026-05-13-features-capability-reconciliation.md"
covers_branch: hotfix/job@101450c
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace; architect now ships 12 bundled patterns including standalone Go events/messages and taskqueue/polling guidance

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; Codex plugin runtime requires hooks/plugin_hooks flags and restart; release scripts use git + jq

- [features.md](features.md) — Current capability map
  Key points: DDD guidance separates Go event/message rules and Go taskqueue/polling rules; progressive knowledge layout replaces playbooks

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: event/message work loads ddd-golang-events-messages.md; taskqueue work loads ddd-golang-taskqueue.md; Codex prompt routers stay explicit-skill-only

- [decisions.md](decisions.md) — ADR summary log (18 ADRs, 0 superseded)
  Key points: ADR-018 DDD Go events/messages split; ADR-017 DDD Go taskqueue split; ADR-016 progressive KB layout + playbook removal

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-001 through ADR-018

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Boundary Publisher, TaskType, Task Schema Registry, Codex Native Hooks, Prompt Router, Knowledge Shard, Retrieval Cost
