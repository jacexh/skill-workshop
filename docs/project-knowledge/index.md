---
last_updated: 2026-06-01
updated_by: superpowers-memory:update
triggered_by_plan: "2026-05-13-features-capability-reconciliation.md"
covers_branch: hotfix/intergration-message@ab33107
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace; architect ships 12 bundled patterns including Go events/messages, message runner/failure-policy, and taskqueue guidance

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; Codex plugin runtime requires hooks/plugin_hooks flags and restart; release scripts use git + jq

- [features.md](features.md) — Current capability map
  Key points: DDD guidance separates Go event/message rules including message.Runner/Kafka FailurePolicy, taskqueue rules, and Go coding guardrails

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: Go DDD rules require method-driven aggregate behavior, Infrastructure-owned runtime/failure mechanics, thin RPC shortcuts, and Domain-first scheduling

- [decisions.md](decisions.md) — ADR summary log (18 ADRs, 0 superseded)
  Key points: ADR-018 DDD Go events/messages split; ADR-017 DDD Go taskqueue split; ADR-016 progressive KB layout + playbook removal

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-001 through ADR-018

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Boundary Publisher, Message Runner, Kafka FailurePolicy, TaskType, PeriodicTask, Codex Native Hooks, Prompt Router, Knowledge Shard
