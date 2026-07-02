#!/usr/bin/env bash
# Validate Codex superpowers-architect is explicit-only after DDD split.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RUNTIME="$ROOT/codex-plugins/superpowers-architect/hooks/codex-runtime.js"
HOOKS="$ROOT/codex-plugins/superpowers-architect/hooks/hooks.json"
SNIPPET="$ROOT/codex-plugins/superpowers-architect/codex-hooks-snippet.json"
STANDARDS_SKILL="$ROOT/codex-plugins/superpowers-architect/skills/standards/SKILL.md"
CLAUDE_STANDARDS_SKILL="$ROOT/plugins/superpowers-architect/skills/standards/SKILL.md"
CODEX_README="$ROOT/codex-plugins/superpowers-architect/README.md"
CLAUDE_README="$ROOT/plugins/superpowers-architect/README.md"
CODEX_PATTERNS="$ROOT/codex-plugins/superpowers-architect/design-patterns"
CLAUDE_PATTERNS="$ROOT/plugins/superpowers-architect/design-patterns"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

[ -f "$STANDARDS_SKILL" ] || fail "codex architect standards skill missing"
[ -f "$CLAUDE_STANDARDS_SKILL" ] || fail "claude architect standards skill missing"

jq -e '.hooks == {}' "$HOOKS" >/dev/null || fail "codex architect native hooks should be empty"
jq -e '.hooks == {}' "$SNIPPET" >/dev/null || fail "codex architect fallback snippet hooks should be empty"
diff -u <(jq -S '.hooks' "$HOOKS") <(jq -S '.hooks' "$SNIPPET") >/dev/null || fail "native hooks and snippet drifted"

session_start="$(printf '{}' | node "$RUNTIME" session-start)"
[ "$session_start" = "{}" ] || fail "stale codex architect session-start hook should be a no-op"
user_prompt="$(
  printf '{"prompt":"Please use $superpowers:writing-plans for this API"}' |
    node "$RUNTIME" user-prompt-submit
)"
[ "$user_prompt" = "{}" ] || fail "stale codex architect user-prompt-submit hook should be a no-op"
stop_output="$(printf '{}' | node "$RUNTIME" stop)"
[ "$stop_output" = "{}" ] || fail "stale codex architect stop hook should be a no-op"

grep -iq 'explicit-only' "$CODEX_README" || fail "codex README should document explicit-only behavior"
grep -iq 'explicit-only' "$CLAUDE_README" || fail "claude README should document explicit-only behavior"
grep -q 'superpowers-ddd-architect' "$CODEX_README" || fail "codex README should point DDD users to new plugin"
grep -q 'superpowers-ddd-architect' "$CLAUDE_README" || fail "claude README should point DDD users to new plugin"
! find "$CODEX_PATTERNS" -maxdepth 1 -name 'ddd-*.md' -print -quit | grep -q . || fail "codex architect should not bundle DDD pattern files"
! find "$CLAUDE_PATTERNS" -maxdepth 1 -name 'ddd-*.md' -print -quit | grep -q . || fail "claude architect should not bundle DDD pattern files"
[ ! -f "$CODEX_PATTERNS/database.md" ] || fail "codex architect should not bundle migrated database reference"
[ ! -f "$CLAUDE_PATTERNS/database.md" ] || fail "claude architect should not bundle migrated database reference"
! grep -q 'superpowers-ddd-architect:standards' "$STANDARDS_SKILL" || fail "codex standards skill should not point to deprecated DDD standards skill"
! grep -q 'superpowers-ddd-architect:standards' "$CLAUDE_STANDARDS_SKILL" || fail "claude standards skill should not point to deprecated DDD standards skill"

echo "  codex architect runtime: explicit-only"
