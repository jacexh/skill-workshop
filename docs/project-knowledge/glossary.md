---
last_updated: 2026-04-26
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-26-codex-marketplace-compat-plan.md"
---

# Glossary

**Knowledge Base (KB)** — The set of Markdown files in `docs/project-knowledge/` of a target project that persist cross-session understanding of architecture, conventions, and decisions. Not the plugin's own templates. → `docs/project-knowledge/`

**Progressive Loading** — Pattern used by both plugins: inject a lightweight index (names + descriptions + paths) at injection time; the agent loads full content on demand via `Read`. Avoids token bloat from dumping all content into every prompt. → ADR-005, ADR-006

**Hook Runtime** — Node.js entry point for superpowers-memory hooks. Claude `hook-runtime.js`; Codex `codex-runtime.js` (drops `user-prompt-expansion` mode, adds `user-prompt-submit`). → `plugins/superpowers-memory/hooks/hook-runtime.js`

**Trigger Skills** — Upstream `superpowers` skills that plugin hooks intercept. Claude memory hooks 5 skills via PreToolUse:Skill; Codex memory hooks only 2 manually-typed (brainstorming, finishing-a-development-branch) via UserPromptSubmit (ADR-013). → `plugins/*/hooks/`

**KB Write Lock** — File `.git/superpowers-memory.lock` (60-min TTL) granting write access to `docs/project-knowledge/`; acquired/released only by `superpowers-memory:update` and `superpowers-memory:rebuild`. Same lock file used by both tracks (Claude and Codex naturally share when running on same repo). → ADR-010

**Rich Injection** — Hook output pattern: a multi-section `additionalContext` block (diff scope + imperative MUST language + numbered checklist) used in place of `decision: "block"`; designed to make compliance the path of least resistance without forcing a halt. → ADR-011

**Codex Setup Skill** — Per-Codex-plugin skill containing agent instructions to merge `codex-hooks-snippet.json` into `~/.codex/hooks.json` with version marker; idempotent and re-runnable after marketplace upgrade. → `codex-plugins/superpowers-memory/skills/setup/SKILL.md`, ADR-013

**Standing Primer** — Always-present text injected at SessionStart by Codex-side hooks to compensate for Codex's lack of per-skill JIT injection. Carries decay-tolerant standing rules ("before X, do Y") instead of just-in-time advisories. → ADR-013
