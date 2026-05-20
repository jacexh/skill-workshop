---
last_updated: 2026-05-20
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---

# Glossary

**Knowledge Base (KB)** — The set of Markdown files in `docs/project-knowledge/` of a target project that persist cross-session understanding of architecture, conventions, and decisions. Not the plugin's own templates. → `docs/project-knowledge/`

**Progressive Loading** — Pattern used by both plugins: inject a lightweight index (names + descriptions + paths) at injection time; the agent loads full content on demand via `Read`. Avoids token bloat from dumping all content into every prompt. → ADR-005, ADR-006

**Hook Runtime** — Node.js entry point for superpowers-memory hooks. Claude `hook-runtime.js`; Codex `codex-runtime.js` (drops `user-prompt-expansion` mode, adds `user-prompt-submit`). → `plugins/superpowers-memory/hooks/hook-runtime.js`

**Trigger Skills** — Upstream `superpowers` skills that plugin hooks intercept. Claude memory hooks 5 skills via PreToolUse:Skill; Codex memory hooks only 2 manually-typed (brainstorming, finishing-a-development-branch) via UserPromptSubmit (ADR-013). → `plugins/*/hooks/`

**Domain Event** — DDD fact recorded inside one bounded context; cross-context contracts must be Integration Messages. → `plugins/superpowers-architect/design-patterns/ddd-core.md`

**Integration Message** — Stable cross-context semantic contract for state propagation; Go guidance uses `ddd/message` as the publish/subscribe port. → `plugins/superpowers-architect/design-patterns/ddd-core.md`

**Canonical Go Component Libraries** — Required Go libraries named by `ddd-golang.md` for DDD concerns; agents should use their public interfaces instead of local substitutes. → `plugins/superpowers-architect/design-patterns/ddd-golang.md`

**KB Write Lock** — File `.git/superpowers-memory.lock` (60-min TTL) granting write access to `docs/project-knowledge/`; acquired/released only by `superpowers-memory:update` and `superpowers-memory:rebuild`. Same lock file used by both tracks (Claude and Codex naturally share when running on same repo). → ADR-010

**Rich Injection** — Hook output pattern: a multi-section `additionalContext` block (diff scope + imperative MUST language + numbered checklist) used in place of `decision: "block"`; designed to make compliance the path of least resistance without forcing a halt. → ADR-011

**Codex Native Hooks** — Manifest-declared lifecycle hooks loaded from each Codex plugin root when `hooks` and `plugin_hooks` are enabled. → `codex-plugins/superpowers-memory/hooks/hooks.json`, ADR-014

**Codex Cleanup Skill** — Per-Codex-plugin migration helper that removes that plugin's old fallback hook entries from `~/.codex/hooks.json` after native Codex hooks are enabled. → `codex-plugins/superpowers-memory/skills/cleanup/SKILL.md`, ADR-014

**Auto Release Pipeline** — GitHub Actions flow that runs after PR merge, bumps path-affected plugin manifests/snippets, pushes a bump commit, tags it, and publishes a release. → `.github/workflows/auto-release.yml`

**Standing Primer** — Always-present text injected at SessionStart by Codex-side hooks to compensate for Codex's lack of per-skill JIT injection. Carries decay-tolerant standing rules ("before X, do Y") instead of just-in-time advisories. → ADR-013

**Prompt Router** — Codex UserPromptSubmit hook path that inspects raw user text and injects focused context for explicit workflow signals; used by memory and architect where skill-call hooks are unavailable. → `codex-plugins/*/hooks/codex-runtime.js`

**DDD Agent Contract** — Agent-behavior layer for DDD work: trigger conditions, task classification, stop protocol, 16 must-not rules, dual-track self-check, compact output template. → `plugins/superpowers-architect/design-patterns/ddd-agent-contract.md`, ADR-015

**Playbook** — Reusable procedural recipe for a recurring class of code change; indexed in `playbooks.md`, detailed in `playbooks/<slug>.md`. Created only when ≥2 concrete instances exist (or an explicit spec/plan directive). → `plugins/superpowers-memory/content-rules.md`
