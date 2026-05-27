---
last_updated: 2026-05-27
updated_by: superpowers-memory:update
triggered_by_plan: "2026-05-13-features-capability-reconciliation.md"
covers_branch: hotfix/memory-budge@d32a864
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace; superpowers-memory now uses progressive KB layout with shardable non-index files and advisory retrieval cost

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; Codex plugin runtime requires hooks/plugin_hooks flags and restart; release scripts use git + jq

- [features.md](features.md) — Current capability map
  Key points: progressive knowledge layout replaces playbooks; designing-tests supports architecture goal coverage, integration quality, hand-off evidence, and skipped/unrun residual-risk reporting

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: only index.md has strict size; retrievalCost/splitCandidates are advisory; Codex prompt routers stay explicit-skill-only; designing-tests references stay mirrored

- [decisions.md](decisions.md) — ADR summary log (16 ADRs, 0 superseded)
  Key points: ADR-016 progressive KB layout + playbook removal; ADR-015 DDD agent contract + Go runtime split; ADR-014 native Codex hooks with cleanup; ADR-013 Codex marketplace compat; ADR-010 KB write-lock

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-001 through ADR-016

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Codex Native Hooks, Prompt Router, Knowledge Shard, Retrieval Cost, Architecture Test Design, Test Hand-off Gate, DDD Agent Contract
