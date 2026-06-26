#!/usr/bin/env bash
# Validate Codex superpowers-architect runtime routing and pattern priority.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RUNTIME="$ROOT/codex-plugins/superpowers-architect/hooks/codex-runtime.js"
SNIPPET="$ROOT/codex-plugins/superpowers-architect/codex-hooks-snippet.json"
STANDARDS_SKILL="$ROOT/codex-plugins/superpowers-architect/skills/standards/SKILL.md"
CLAUDE_STANDARDS_SKILL="$ROOT/plugins/superpowers-architect/skills/standards/SKILL.md"
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

# Intent: SessionStart must stay lightweight. Full pattern indexes and gates are injected
# through explicit prompt triggers or the standards skill.
grep -q "Architecture standards are available on demand" <<<"$session_context" || fail "session-start missing lightweight architect reminder"
grep -q '\$superpowers-architect:standards' <<<"$session_context" || fail "session-start missing standards skill pointer"
! grep -q "Project Database" <<<"$session_context" || fail "session-start should not inject project pattern index"
! grep -q "Project Only" <<<"$session_context" || fail "session-start should not inject project-only pattern index"
! grep -q "Architecture Gate" <<<"$session_context" || fail "session-start should not inject architecture gate"
! grep -q "Read ddd-modeling first" <<<"$session_context" || fail "session-start should not inject DDD addendum"

no_defaults_context="$(
  HOME="$TMP/home" SPA_DEFAULTS=false node "$RUNTIME" session-start | extract_context
)"

# Intent: disabling bundled defaults should not affect the lightweight SessionStart reminder.
grep -q "Architecture standards are available on demand" <<<"$no_defaults_context" || fail "lightweight session-start reminder missing with SPA_DEFAULTS=false"
! grep -q "Project Database" <<<"$no_defaults_context" || fail "session-start should not inject project pattern index with SPA_DEFAULTS=false"
! grep -q "DDD + Clean Architecture" <<<"$no_defaults_context" || fail "bundled defaults included despite SPA_DEFAULTS=false"
! grep -q "Read ddd-modeling first" <<<"$no_defaults_context" || fail "DDD-specific gate injected without DDD patterns"
! grep -q "Architecture Gate workflow" <<<"$no_defaults_context" || fail "session-start should not inject generic gate workflow"

project_ddd_dir="$TMP/repo_project_ddd"
mkdir -p "$project_ddd_dir/docs/design-patterns"
(
  cd "$project_ddd_dir"
  git init -q
)
cat > "$project_ddd_dir/docs/design-patterns/ddd-modeling.md" <<'MD'
---
name: Project DDD Modeling
description: Project-supplied DDD modeling rules. Filename matches the bundled trigger so the DDD addendum should still fire.
---

# Project DDD Modeling
MD

project_ddd_context="$(
  cd "$project_ddd_dir"
  printf '{"prompt":"Please use $superpowers:writing-plans for this DDD modeling change"}' |
    HOME="$TMP/home" SPA_DEFAULTS=false node "$RUNTIME" user-prompt-submit |
    extract_context
)"

# Intent: just-in-time prompt guidance is triggered by the filename `ddd-modeling.md`, but a
# project-supplied pattern without the bundled §0 block must not be described as having that contract.
grep -q "Project DDD Modeling" <<<"$project_ddd_context" || fail "project-supplied ddd-modeling pattern missing"
grep -q "Read ddd-modeling first" <<<"$project_ddd_context" || fail "DDD addendum missing for project-supplied ddd-modeling.md"
grep -q "follow its own gate" <<<"$project_ddd_context" || fail "project-supplied DDD path missing own-gate instruction"
! grep -q "ddd-modeling §0" <<<"$project_ddd_context" || fail "project-supplied DDD path should not reference missing §0"

empty_context="$(
  mkdir -p "$TMP/empty"
  cd "$TMP/empty"
  HOME="$TMP/home" SPA_DEFAULTS=false node "$RUNTIME" session-start | extract_context
)"

# Intent: without any configured patterns, the runtime should still inject only the static lightweight reminder.
grep -q "Architecture standards are available on demand" <<<"$empty_context" || fail "empty pattern set should still inject lightweight reminder"
! grep -q "Architecture Gate" <<<"$empty_context" || fail "empty pattern set should not inject stale gate guidance"

writing_plans_context="$(
  printf '{"prompt":"Please use $superpowers:writing-plans for this REST API and database schema change"}' |
    HOME="$TMP/home" node "$RUNTIME" user-prompt-submit |
    extract_context
)"

# Intent: explicit superpowers planning skill mentions should receive just-in-time architect guidance.
grep -q "Architect Standards" <<<"$writing_plans_context" || fail "writing-plans prompt did not trigger context"
grep -q "REST API Design Standards" <<<"$writing_plans_context" || fail "REST API pattern missing from writing-plans context"
grep -q "Project Database" <<<"$writing_plans_context" || fail "project database pattern missing from writing-plans context"
grep -q "Project Only" <<<"$writing_plans_context" || fail "dynamic project-only pattern missing from writing-plans context"
grep -q "Architecture Gate" <<<"$writing_plans_context" || fail "writing-plans prompt missing architecture gate"
grep -q "Read ddd-modeling first" <<<"$writing_plans_context" || fail "writing-plans prompt missing ddd-modeling-first rule"
grep -q "technical capability classification" <<<"$writing_plans_context" || fail "writing-plans prompt missing technical capability classification"

review_context="$(
  printf '{"prompt":"Please run $superpowers:requesting-code-review on this branch"}' |
    HOME="$TMP/home" node "$RUNTIME" user-prompt-submit |
    extract_context
)"

# Intent: explicit superpowers review skill mentions should receive review-time architect guidance.
grep -q "Architect Standards" <<<"$review_context" || fail "requesting-code-review prompt did not trigger context"
grep -q "Project Only" <<<"$review_context" || fail "dynamic project-only pattern missing from review context"

natural_language_architecture="$(
  printf '{"prompt":"Please design the REST API and database schema for orders"}' |
    HOME="$TMP/home" node "$RUNTIME" user-prompt-submit
)"

# Intent: natural-language architecture discussion without a superpowers skill mention should stay quiet.
[ "$natural_language_architecture" = "{}" ] || fail "natural-language architecture prompt should return {}"

natural_language_ddd="$(
  printf '{"prompt":"Please design the order aggregate following DDD"}' |
    HOME="$TMP/home" node "$RUNTIME" user-prompt-submit
)"

# Intent: natural-language DDD vocabulary alone must not widen the trigger surface — only explicit
# superpowers skill mentions are allowed to fire user-prompt-submit context.
[ "$natural_language_ddd" = "{}" ] || fail "natural-language DDD prompt should return {}"

unrelated="$(
  printf '{"prompt":"hello, summarize this plain text"}' |
    HOME="$TMP/home" node "$RUNTIME" user-prompt-submit
)"

# Intent: unrelated prompts should also stay quiet to avoid hook noise.
[ "$unrelated" = "{}" ] || fail "unrelated prompt should return {}"

legacy_stop="$(
  printf '{"last_assistant_message":"## Implementation\nChanged codex-plugins/superpowers-architect/hooks/codex-runtime.js and verified node --check passes. This intentionally looks like an implementation artifact that the old Stop gate would have blocked when no standards note was present."}' |
    HOME="$TMP/home" node "$RUNTIME" stop
)"

# Intent: Stop mode is kept only as a compatibility no-op; it must never block turns.
[ "$legacy_stop" = "{}" ] || fail "architect stop mode should be a no-op"

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
if (snippet.hooks.Stop) {
  fail("architect snippet should not register a Stop hook");
}
const commands = Object.values(snippet.hooks).flat().flatMap((entry) =>
  (entry.hooks || []).map((hook) => hook.command)
);
if (!commands.includes('node "${PLUGIN_ROOT}/hooks/codex-runtime.js" user-prompt-submit')) {
  fail("missing architect user-prompt-submit command");
}
if (commands.some((command) => command.endsWith(" stop"))) {
  fail("architect snippet should not install a stop command");
}
NODE

# Intent: the standards skill must not require ddd-modeling.md when a dynamic pattern set only
# provides other DDD or layered-architecture standards.
grep -q 'If `ddd-modeling.md` is present' "$STANDARDS_SKILL" || fail "standards skill should key ddd-modeling-first on ddd-modeling.md presence"
grep -q 'If `ddd-modeling.md` is absent' "$STANDARDS_SKILL" || fail "standards skill should define fallback for DDD/layered patterns without ddd-modeling.md"

# Intent: the Claude Code plugin should expose the same explicit standards skill without changing hooks.
[ -f "$CLAUDE_STANDARDS_SKILL" ] || fail "claude architect standards skill missing"
grep -q 'If `ddd-modeling.md` is present' "$CLAUDE_STANDARDS_SKILL" || fail "claude standards skill should key ddd-modeling-first on ddd-modeling.md presence"
grep -q 'If `ddd-modeling.md` is absent' "$CLAUDE_STANDARDS_SKILL" || fail "claude standards skill should define fallback for DDD/layered patterns without ddd-modeling.md"

echo "  codex architect runtime: routing and pattern priority correct"
