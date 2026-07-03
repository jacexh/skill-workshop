---
last_updated: 2026-07-03
updated_by: superpowers-memory:ingest
triggered_by_plan: null
---

# Project Knowledge Log

## [2026-07-03] ingest | DDD phase skills as method entrypoints

- Source: `plugins/superpowers-ddd-architect/skills/design/SKILL.md`; `plugins/superpowers-ddd-architect/skills/implement/SKILL.md`; `plugins/superpowers-ddd-architect/skills/review/SKILL.md`; `plugins/superpowers-ddd-architect/hooks/pre-tool-use`; `codex-plugins/superpowers-ddd-architect/hooks/codex-runtime.js`; `scripts/release/test/test_codex_ddd_architect_runtime.sh`
- Source query: user asked whether hook injection was too large and whether the phase skill prompts should own the actual requirements
- Touched: `docs/superpowers/memory/index.md`, `docs/superpowers/memory/features.md`, `docs/superpowers/memory/conventions.md`, `docs/superpowers/memory/architecture.md`, `docs/superpowers/memory/decisions-architect.md`, `docs/superpowers/memory/adr/ADR-022-ddd-phase-specific-skills.md`, `docs/superpowers/memory/log.md`
- Verify: ok; qualityGate blocking=0 advisory=0

## [2026-07-03] ingest | memory log slot support

- Source: LLM Wiki adaptation confirmed in user discussion; `plugins/superpowers-memory/content-rules.md`; `plugins/superpowers-memory/skills/ingest/SKILL.md`
- Source query: user confirmed pure `query` should not append `log.md`; only later accepted ingest work should log query-driven candidates
- Touched: `docs/superpowers/memory/index.md`, `docs/superpowers/memory/features.md`, `docs/superpowers/memory/conventions.md`, `docs/superpowers/memory/log.md`
- Verify: ok; qualityGate blocking=0 advisory=0

## [2026-07-03] ingest | DDD generated RPC handler placement

- Source: `plugins/superpowers-ddd-architect/references/ddd-golang.md`; `plugins/superpowers-ddd-architect/skills/implement/SKILL.md`; `plugins/superpowers-ddd-architect/references/ddd-risk-router.md`; `scripts/release/test/test_codex_ddd_architect_runtime.sh`
- Touched: `docs/superpowers/memory/index.md`, `docs/superpowers/memory/conventions.md`, `docs/superpowers/memory/log.md`
- Verify: ok; qualityGate blocking=0 advisory=0

## [2026-07-03] ingest | DDD implement hot-path placement gates

- Source: `plugins/superpowers-ddd-architect/references/ddd-core.md`; `plugins/superpowers-ddd-architect/skills/implement/SKILL.md`; `plugins/superpowers-ddd-architect/references/ddd-risk-router.md`; `scripts/release/test/test_codex_ddd_architect_runtime.sh`
- Source query: user requested continuing the optimization while preserving generality instead of tailoring the plugin to one downstream repository or language
- Touched: `docs/superpowers/memory/index.md`, `docs/superpowers/memory/conventions.md`, `docs/superpowers/memory/log.md`
- Verify: ok; qualityGate blocking=0 advisory=0

## [2026-07-03] ingest | DDD design and review hot-path gates

- Source: `plugins/superpowers-ddd-architect/skills/design/SKILL.md`; `plugins/superpowers-ddd-architect/skills/review/SKILL.md`; `scripts/release/test/test_codex_ddd_architect_runtime.sh`
- Source query: user asked whether design and review needed the same late-rule-loading optimization as implement
- Touched: `docs/superpowers/memory/index.md`, `docs/superpowers/memory/conventions.md`, `docs/superpowers/memory/log.md`
- Verify: ok; qualityGate blocking=0 advisory=0

## [2026-07-03] ingest | DDD phase boundary refinement

- Source: subagent review of DDD phase skills; `plugins/superpowers-ddd-architect/skills/design/SKILL.md`; `plugins/superpowers-ddd-architect/skills/implement/SKILL.md`; `plugins/superpowers-ddd-architect/skills/review/SKILL.md`; `plugins/superpowers-ddd-architect/references/ddd-risk-router.md`; `scripts/release/test/test_codex_ddd_architect_runtime.sh`
- Source query: user asked to continue after the independent review recommended strategic-first design, accepted-model implementation, and evidence-precondition review
- Touched: `docs/superpowers/memory/index.md`, `docs/superpowers/memory/conventions.md`, `docs/superpowers/memory/log.md`
- Verify: ok; qualityGate blocking=0 advisory=0

## [2026-07-03] ingest | DDD responsibility-role risk routing

- Source: `plugins/superpowers-ddd-architect/references/ddd-risk-router.md`; `plugins/superpowers-ddd-architect/references/ddd-agent-contract.md`; `codex-plugins/superpowers-ddd-architect/references/ddd-risk-router.md`; `codex-plugins/superpowers-ddd-architect/references/ddd-agent-contract.md`; `scripts/release/test/test_codex_ddd_architect_runtime.sh`
- Source query: user requested generalizing DDD risk recognition beyond downstream `drain` examples and asked whether concepts such as event handlers, message handlers, and CQRS should become risk classifications
- Touched: `docs/superpowers/memory/index.md`, `docs/superpowers/memory/conventions.md`, `docs/superpowers/memory/log.md`
- Verify: ok; qualityGate blocking=0 advisory=0
