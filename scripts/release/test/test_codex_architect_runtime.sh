#!/usr/bin/env bash
# Validate Codex superpowers-architect runtime routing and pattern priority.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RUNTIME="$ROOT/codex-plugins/superpowers-architect/hooks/codex-runtime.js"
SNIPPET="$ROOT/codex-plugins/superpowers-architect/codex-hooks-snippet.json"
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

mkdir -p "$TMP/repo/docs/design-patterns" "$TMP/global"
mkdir -p "$TMP/home"
cd "$TMP/repo"
git init -q

cat > "$TMP/global/database.md" <<'MD'
---
name: Global Database
description: Global database rules should override bundled defaults.
---

# Global Database
MD

cat > "$TMP/repo/docs/design-patterns/database.md" <<'MD'
---
name: Project Database
description: Project database rules should override global and bundled defaults.
---

# Project Database
MD

cat > "$TMP/repo/docs/design-patterns/project-only.md" <<'MD'
---
name: Project Only
description: Project-only rules should be included in the index.
---

# Project Only
MD

session_context="$(
  HOME="$TMP/home" SPA_GLOBAL="$TMP/global" node "$RUNTIME" session-start | extract_context
)"

# Intent: project-level design patterns must override global and bundled patterns.
grep -q "Project Database" <<<"$session_context" || fail "project database pattern missing"
! grep -q "Global Database" <<<"$session_context" || fail "global database pattern was not overridden"
grep -q "Project Only" <<<"$session_context" || fail "project-only pattern missing"

no_defaults_context="$(
  HOME="$TMP/home" SPA_DEFAULTS=false node "$RUNTIME" session-start | extract_context
)"

# Intent: disabling bundled defaults should leave only explicit global/project patterns.
grep -q "Project Database" <<<"$no_defaults_context" || fail "project pattern missing with SPA_DEFAULTS=false"
! grep -q "DDD + Clean Architecture" <<<"$no_defaults_context" || fail "bundled defaults included despite SPA_DEFAULTS=false"

empty_context="$(
  mkdir -p "$TMP/empty"
  cd "$TMP/empty"
  HOME="$TMP/home" SPA_DEFAULTS=false node "$RUNTIME" session-start | extract_context
)"

# Intent: without any configured patterns, the runtime should not inject stale bundled guidance.
[ -z "$empty_context" ] || fail "empty pattern set should inject empty context"

architect_context="$(
  printf '{"prompt":"Please design the REST API and database schema for orders"}' |
    HOME="$TMP/home" node "$RUNTIME" user-prompt-submit |
    extract_context
)"

# Intent: architecture-shaped user prompts should receive just-in-time architect guidance.
grep -q "Architect Standards" <<<"$architect_context" || fail "architect prompt did not trigger context"
grep -q "REST API Design Standards" <<<"$architect_context" || fail "REST API pattern missing from prompt context"
grep -q "database" <<<"$architect_context" || fail "database pattern missing from prompt context"

chinese_architect_context="$(
  printf '{"prompt":"请设计订单接口和数据库表结构"}' |
    HOME="$TMP/home" node "$RUNTIME" user-prompt-submit |
    extract_context
)"

# Intent: Chinese architecture-shaped prompts should receive the same just-in-time guidance.
grep -q "Architect Standards" <<<"$chinese_architect_context" || fail "Chinese architect prompt did not trigger context"
grep -q "REST API Design Standards" <<<"$chinese_architect_context" || fail "REST API pattern missing from Chinese prompt context"
grep -q "database" <<<"$chinese_architect_context" || fail "database pattern missing from Chinese prompt context"

unrelated="$(
  printf '{"prompt":"hello, summarize this plain text"}' |
    HOME="$TMP/home" node "$RUNTIME" user-prompt-submit
)"

# Intent: unrelated prompts should stay quiet to avoid hook noise.
[ "$unrelated" = "{}" ] || fail "unrelated prompt should return {}"

SNIPPET="$SNIPPET" node <<'NODE'
const fs = require("fs");
const snippet = JSON.parse(fs.readFileSync(process.env.SNIPPET, "utf8"));
function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}
if (!snippet.hooks || !Array.isArray(snippet.hooks.SessionStart)) {
  fail("missing SessionStart hook");
}
if (!Array.isArray(snippet.hooks.UserPromptSubmit)) {
  fail("missing UserPromptSubmit hook");
}
const commands = Object.values(snippet.hooks).flat().flatMap((entry) =>
  (entry.hooks || []).map((hook) => hook.command)
);
if (!commands.includes('node "${PLUGIN_ROOT}/hooks/codex-runtime.js" user-prompt-submit')) {
  fail("missing architect user-prompt-submit command");
}
NODE

echo "  codex architect runtime: routing and pattern priority correct"
