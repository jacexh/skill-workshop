---
last_updated: 2026-04-25
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-25-finishing-rich-injection.md"
---

# Glossary

**Knowledge Base (KB)** — The set of Markdown files in `docs/project-knowledge/` of a target project that persist cross-session understanding of architecture, conventions, and decisions. Not the plugin's own templates. → `docs/project-knowledge/`

**Progressive Loading** — Pattern used by both plugins: inject a lightweight index (names + descriptions + paths) at skill invocation time; the agent loads full content on demand via `Read`. Avoids token bloat from dumping all content into every prompt. → ADR-005, ADR-006

**Hook Runtime** — The `hook-runtime.js` Node.js file that handles all superpowers-memory hook modes (`session-start`, `pre-tool-use`, `stop`, `verify`, `analyze`). Thin bash wrapper scripts delegate to it. → `plugins/superpowers-memory/hooks/hook-runtime.js`

**Evidence Paths** — File paths detected by the stop hook as changed outside `docs/project-knowledge/`. Used to determine whether KB might be stale, replacing the earlier commit-message-pattern approach. → ADR-008

**Trigger Skills** — The specific superpowers skills that each plugin's PreToolUse hook intercepts. Memory plugin: 5 skills (brainstorming, writing-plans, executing-plans, subagent-driven-development, finishing-a-development-branch). Architect plugin: 5 skills (writing-plans, executing-plans, subagent-driven-development, requesting-code-review, receiving-code-review). → `plugins/*/hooks/`

**KB Write Lock** — File `.git/superpowers-memory.lock` (60-min TTL) granting write access to `docs/project-knowledge/`; acquired/released only by `superpowers-memory:update` and `superpowers-memory:rebuild`. → ADR-010

**Rich Injection** — Hook output pattern: a multi-section `additionalContext` block (diff scope + imperative MUST language + numbered checklist + escape hatch) used in place of `decision: "block"`; designed to make compliance the path of least resistance without forcing a halt. → ADR-011
