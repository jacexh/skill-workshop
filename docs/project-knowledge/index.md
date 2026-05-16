---
last_updated: 2026-05-16
updated_by: superpowers-memory:update
triggered_by_plan: "2026-05-13-features-capability-reconciliation.md"
covers_branch: hotfix/enh@afef7eb
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: dual-track marketplace; superpowers-memory templates now ship 10 files (7 canonical + adr-detail + playbooks index + playbook-detail); architect `design-patterns/` ships 10 files with Python/TypeScript DDD guides mirroring shared Go gates

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; release scripts use git + jq; Codex native plugin hooks require `hooks` + `plugin_hooks` and restart

- [features.md](features.md) — Current capability map
  Key points: product-first capability map with canonical group order; new Code-change Playbook Recipes capability (lazy `playbooks.md` + `playbooks/<slug>.md`, 3-gate creation rule); verify covers playbooks size threshold

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: hook-runtime.js (Claude) + codex-runtime.js (Codex); KB schema meta-rule (slots vs topics, lazy slots allowed); DDD Go infrastructure flat by semantic capability; KB verify uses 30K token budget

- [decisions.md](decisions.md) — ADR summary log (15 ADRs, 0 superseded)
  Key points: ADR-015 DDD agent contract + Go runtime split; ADR-014 native Codex hooks with cleanup; ADR-013 Codex marketplace compat; ADR-012 UserPromptExpansion slash hook; ADR-010 KB write-lock

- [adr/](adr/) — On-demand ADR detail files (loaded via `Read`, not at session start)
  Currently: ADR-010 through ADR-015; ADR-001..009 still in pre-v1.8 inline format inside decisions.md

- [glossary.md](glossary.md) — Domain terminology
  Key points: includes Domain Event, Integration Message, Canonical Go Component Libraries, DDD Agent Contract, Codex Native Hooks, Auto Release Pipeline, Hook Runtime, Prompt Router, KB Write Lock, Playbook
