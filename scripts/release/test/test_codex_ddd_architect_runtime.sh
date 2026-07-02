#!/usr/bin/env bash
# Validate Codex superpowers-ddd-architect runtime routing and reference behavior.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RUNTIME="$ROOT/codex-plugins/superpowers-ddd-architect/hooks/codex-runtime.js"
HOOKS="$ROOT/codex-plugins/superpowers-ddd-architect/hooks/hooks.json"
SNIPPET="$ROOT/codex-plugins/superpowers-ddd-architect/codex-hooks-snippet.json"
STANDARDS_SKILL="$ROOT/codex-plugins/superpowers-ddd-architect/skills/standards/SKILL.md"
CLAUDE_STANDARDS_SKILL="$ROOT/plugins/superpowers-ddd-architect/skills/standards/SKILL.md"
CODEX_DDD_ROOT="$ROOT/codex-plugins/superpowers-ddd-architect"
CLAUDE_DDD_ROOT="$ROOT/plugins/superpowers-ddd-architect"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() {
  echo "FAIL $1" >&2
  exit 1
}

extract_context() {
  node -e '
const fs = require("fs");
const raw = fs.readFileSync(0, "utf8");
const data = JSON.parse(raw);
process.stdout.write(data.hookSpecificOutput?.additionalContext || "");
'
}

mkdir -p "$TMP/repo" "$TMP/home"
cd "$TMP/repo"
git init -q

session_context="$(
  HOME="$TMP/home" node "$RUNTIME" session-start | extract_context
)"

grep -q "DDD/backend architecture guardrails are available on demand" <<<"$session_context" || fail "session-start missing lightweight DDD reminder"
grep -q '\$superpowers-ddd-architect:standards' <<<"$session_context" || fail "session-start missing DDD standards skill pointer"
! grep -q "DDD Architect Standards" <<<"$session_context" || fail "session-start should not inject DDD reference index"
! grep -q "ddd-risk-router.md" <<<"$session_context" || fail "session-start should not inject risk-router path"

workflow_context="$(
  printf '{"prompt":"Please use $superpowers:writing-plans for this DDD aggregate change"}' |
    HOME="$TMP/home" node "$RUNTIME" user-prompt-submit |
    extract_context
)"

grep -q "DDD Architect Standards" <<<"$workflow_context" || fail "explicit workflow prompt did not trigger DDD context"
grep -q "ddd-risk-router.md" <<<"$workflow_context" || fail "risk router missing from DDD context"
grep -q "DDD Risk Router" <<<"$workflow_context" || fail "risk router title missing from DDD context"
grep -q "database.md" <<<"$workflow_context" || fail "database support reference missing"
! grep -q "REST API Design Standards" <<<"$workflow_context" || fail "DDD plugin should not include REST pattern"
! grep -q "frontend" <<<"$workflow_context" || fail "DDD plugin should not include frontend patterns"

natural_language_ddd="$(
  printf '{"prompt":"Please design the order aggregate following DDD"}' |
    HOME="$TMP/home" node "$RUNTIME" user-prompt-submit
)"
[ "$natural_language_ddd" = "{}" ] || fail "natural-language DDD prompt should return {}"

unrelated="$(
  printf '{"prompt":"hello, summarize this plain text"}' |
    HOME="$TMP/home" node "$RUNTIME" user-prompt-submit
)"
[ "$unrelated" = "{}" ] || fail "unrelated prompt should return {}"

legacy_stop="$(
  printf '{"last_assistant_message":"no-op compatibility"}' |
    HOME="$TMP/home" node "$RUNTIME" stop
)"
[ "$legacy_stop" = "{}" ] || fail "DDD architect stop mode should be a no-op"

jq -e '.hooks.SessionStart and .hooks.UserPromptSubmit and (.hooks.Stop | not)' "$HOOKS" >/dev/null || fail "DDD architect hooks should register SessionStart and UserPromptSubmit only"
diff -u <(jq -S '.hooks' "$HOOKS") <(jq -S '.hooks' "$SNIPPET") >/dev/null || fail "DDD architect native hooks and snippet drifted"

grep -q 'references/ddd-risk-router.md' "$STANDARDS_SKILL" || fail "codex DDD standards skill should reference risk router"
grep -q 'references/ddd-risk-router.md' "$CLAUDE_STANDARDS_SKILL" || fail "claude DDD standards skill should reference risk router"
grep -q 'Do not scan generic `design-patterns/`' "$STANDARDS_SKILL" || fail "codex DDD standards skill should reject dynamic design-patterns scanning"
grep -q 'Do not scan generic `design-patterns/`' "$CLAUDE_STANDARDS_SKILL" || fail "claude DDD standards skill should reject dynamic design-patterns scanning"
[ ! -e "$CODEX_DDD_ROOT/design-patterns" ] || fail "codex DDD plugin should not keep a root design-patterns directory"
[ ! -e "$CLAUDE_DDD_ROOT/design-patterns" ] || fail "claude DDD plugin should not keep a root design-patterns directory"
[ -x "$CLAUDE_DDD_ROOT/hooks/pre-tool-use" ] || fail "claude DDD pre-tool-use hook should be executable"

claude_hook_output="$(
  printf '{"tool_input":{"skill":"superpowers:writing-plans"}}' |
    CLAUDE_PLUGIN_ROOT="$CLAUDE_DDD_ROOT" "$CLAUDE_DDD_ROOT/hooks/run-hook.cmd" pre-tool-use
)"
grep -q "DDD Architect Standards" <<<"$claude_hook_output" || fail "claude DDD hook should inject DDD standards context"
grep -q "ddd-risk-router.md" <<<"$claude_hook_output" || fail "claude DDD hook should include risk router"

echo "  codex DDD architect runtime: routing and references correct"
