---
adr: 12
title: UserPromptExpansion hook for slash-command coverage of finishing-a-development-branch
status: Accepted
date: 2026-04-25
supersedes: null
superseded_by: null
---

# ADR-012: UserPromptExpansion hook for slash-command coverage of finishing-a-development-branch

## Context

ADR-011 introduced architect-style rich-context injection for the `finishing-a-development-branch` hook when the KB is stale. That mechanism is wired into `PreToolUse` with `matcher: "Skill|..."`, which fires when Claude programmatically invokes the `Skill` tool.

In testing immediately after ADR-011 shipped, we observed that typing `/superpowers:finishing-a-development-branch` directly in the CLI did NOT trigger the hook — no rich injection appeared in the prompt context. We verified against official Claude Code documentation:

> "This event covers the path PreToolUse does not: a PreToolUse hook matching the Skill tool fires only when Claude calls the tool, but typing /skillname directly bypasses PreToolUse. UserPromptExpansion fires on that direct path."

Source: https://code.claude.com/docs/en/hooks (UserPromptExpansion section)

So `PreToolUse:Skill` and direct slash-command invocation are two distinct dispatch paths in Claude Code's runtime. Without coverage of the slash-command path, the user's stated requirement ("auto-trigger update before finishing on manual invocation") is unmet — exactly the symptom that motivated ADR-011 in the first place.

## Decision

Register a second hook entry in `plugins/superpowers-memory/hooks/hooks.json`:

```json
"UserPromptExpansion": [
  {
    "matcher": "finishing-a-development-branch",
    "hooks": [
      { "type": "command", "command": "...run-hook.cmd user-prompt-expansion", "async": false }
    ]
  }
]
```

The matcher targets `command_name` from the event payload. Add a `user-prompt-expansion` mode to `hook-runtime.js` whose handler:

1. Defensively confirms `command_name.endsWith("finishing-a-development-branch")` — handles bare, namespaced, and leading-slash variations since the official docs don't pin the exact format for plugin-namespaced skills.
2. Performs the KB-ready precheck (KB-missing → `decision: "block"` with the same wording the PreToolUse path uses).
3. Delegates to a SHARED `classifyFinishingState(eventName)` function — extracted from the previously-inline PreToolUse logic — that runs the 4-way classifier (base-branch no-op / branchMatches+shaMatches soft reminder / KB-only-commits soft reminder / rich injection fallback) and returns the appropriate `hookPayload(eventName, ...)`.

Both PreToolUse:Skill and UserPromptExpansion paths produce byte-identical classifier output, modulo the `hookSpecificOutput.hookEventName` field which correctly reflects the firing event.

The KB-ready precheck lives at each caller boundary (`buildPreToolUseOutput` and `buildUserPromptExpansionOutput`) rather than inside `classifyFinishingState`, so the shared classifier is focused purely on staleness classification.

## Alternatives Rejected

### A. Use `UserPromptSubmit` event with grep on the prompt text

`UserPromptSubmit` fires on every user message and exposes the raw prompt text. We could grep for `/superpowers:finishing-a-development-branch` and react.

Why rejected: fires on every prompt (always-on overhead — every user turn would invoke our script). `UserPromptExpansion` fires only when a slash command is being expanded. Cleaner targeting via `command_name` matcher. Lower runtime cost.

### B. Modify the `superpowers:finishing-a-development-branch` skill body

Make "step 0: invoke superpowers-memory:update" the first instruction in the skill content. Then both invocation paths (Skill tool and slash-command) execute the same skill body, which itself ensures the update.

Why rejected: same reason as ADR-011 — the skill lives in the external `superpowers` plugin, not in this workshop. Editing it requires forking and would create maintenance debt. The user's documented preference is to make changes in this repo's `plugins/`, not in marketplace caches.

## Consequences

### Positive

- Slash-command typed by the user now triggers the same rich-injection / soft-reminder / KB-block behavior as Skill-tool invocation. The user's original "auto-trigger update on manual finishing" goal is achieved (within the constraint that hooks cannot literally invoke other skills — they emit context that strongly nudges).
- The shared `classifyFinishingState()` ensures the two paths cannot drift. Future changes to the classifier automatically apply to both invocation modes.
- KB-ready precheck consolidated at caller boundary — only one logical "where does the KB-missing block live" concept, with two physical caller-side checks instead of duplicated checks inside the classifier.

### Negative

- Two hook entries in `hooks.json` instead of one. Adds surface area; mitigated by the shared classifier.
- The `matcher` value `"finishing-a-development-branch"` is the best available guess for the format Claude Code uses when matching `command_name` for plugin-namespaced skills (documentation is silent on whether the namespace prefix is included). The defensive `endsWith()` check in the script handles false-positive matches; if the matcher itself never fires (false negative), no defense is possible until empirically validated. This is a known unknown documented in the ADR.
- New hook event = new failure mode if Claude Code's UserPromptExpansion event ever changes its payload schema or matcher semantics. Mitigated by defensive parsing (`try/catch` on JSON parse, optional fields default to empty).

### Neutral

- Plugin version bumped 1.10.1 → 1.11.0 (minor: new hook coverage = new feature). Users on 1.10.x will continue to work but won't benefit from the slash-command coverage until they update.
- Cached plugin at `~/.claude/plugins/cache/skill-workshop/superpowers-memory/<version>/` is per-version; this work won't take effect for the user until they reinstall or update the plugin to v1.11.0 in their Claude Code instance.
