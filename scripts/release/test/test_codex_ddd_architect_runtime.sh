#!/usr/bin/env bash
# Validate Codex superpowers-ddd-architect runtime routing and reference behavior.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RUNTIME="$ROOT/codex-plugins/superpowers-ddd-architect/hooks/codex-runtime.js"
HOOKS="$ROOT/codex-plugins/superpowers-ddd-architect/hooks/hooks.json"
SNIPPET="$ROOT/codex-plugins/superpowers-ddd-architect/codex-hooks-snippet.json"
CODEX_DDD_ROOT="$ROOT/codex-plugins/superpowers-ddd-architect"
CLAUDE_DDD_ROOT="$ROOT/plugins/superpowers-ddd-architect"
CODEX_DESIGN_SKILL="$CODEX_DDD_ROOT/skills/design/SKILL.md"
CODEX_IMPLEMENT_SKILL="$CODEX_DDD_ROOT/skills/implement/SKILL.md"
CODEX_REVIEW_SKILL="$CODEX_DDD_ROOT/skills/review/SKILL.md"
CLAUDE_DESIGN_SKILL="$CLAUDE_DDD_ROOT/skills/design/SKILL.md"
CLAUDE_IMPLEMENT_SKILL="$CLAUDE_DDD_ROOT/skills/implement/SKILL.md"
CLAUDE_REVIEW_SKILL="$CLAUDE_DDD_ROOT/skills/review/SKILL.md"
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
grep -q '\$superpowers-ddd-architect:design' <<<"$session_context" || fail "session-start missing DDD design skill pointer"
grep -q '\$superpowers-ddd-architect:implement' <<<"$session_context" || fail "session-start missing DDD implement skill pointer"
grep -q '\$superpowers-ddd-architect:review' <<<"$session_context" || fail "session-start missing DDD review skill pointer"
! grep -q '\$superpowers-ddd-architect:standards' <<<"$session_context" || fail "session-start should not mention deprecated standards skill"
! grep -q "DDD Architect Standards" <<<"$session_context" || fail "session-start should not inject DDD reference index"
! grep -q "ddd-risk-router.md" <<<"$session_context" || fail "session-start should not inject risk-router path"

design_context="$(
  printf '{"prompt":"Please use $superpowers:writing-plans for this DDD aggregate change"}' |
    HOME="$TMP/home" node "$RUNTIME" user-prompt-submit |
    extract_context
)"

grep -q "DDD Design Guidance" <<<"$design_context" || fail "writing-plans prompt did not trigger design context"
grep -q "Reference budget: design" <<<"$design_context" || fail "design context should declare design reference budget"
grep -q "Repo calibration" <<<"$design_context" || fail "design context should require repo calibration before probes"
grep -q "Product semantics intake" <<<"$design_context" || fail "design context should require product semantics intake"
grep -q "Spec trace" <<<"$design_context" || fail "design context should require spec-to-model traceability"
grep -q "commands, queries, Domain Events, Integration Messages, and state lifecycle" <<<"$design_context" || fail "design context should model commands queries events and lifecycle"
grep -q "bounded context" <<<"$design_context" || fail "design context should emphasize modeling boundaries"
grep -q "ddd-risk-router.md" <<<"$design_context" || fail "risk router missing from design context"
grep -q "DDD Risk Router" <<<"$design_context" || fail "risk router title missing from design context"
! grep -q "references/database.md" <<<"$design_context" || fail "design context should not include database guide by default"
grep -q "ddd-modeling.md" <<<"$design_context" || fail "modeling reference missing from design context"
grep -q "ddd-core.md" <<<"$design_context" || fail "core reference missing from design context"
! grep -q "references/ddd-agent-contract.md" <<<"$design_context" || fail "design context should not include implementation agent contract by default"
! grep -q "references/ddd-golang-runtime.md" <<<"$design_context" || fail "design context should not include Go runtime guide by default"
! grep -q "references/ddd-golang-taskqueue.md" <<<"$design_context" || fail "design context should not include Go taskqueue guide by default"
! grep -q "REST API Design Standards" <<<"$design_context" || fail "DDD plugin should not include REST pattern"
! grep -q "frontend" <<<"$design_context" || fail "DDD plugin should not include frontend patterns"

implement_context="$(
  printf '{"prompt":"Please use $superpowers:executing-plans for this DDD aggregate change"}' |
    HOME="$TMP/home" node "$RUNTIME" user-prompt-submit |
    extract_context
)"
grep -q "DDD Implementation Guardrails" <<<"$implement_context" || fail "executing-plans prompt did not trigger implement context"
grep -q "Reference budget: implement" <<<"$implement_context" || fail "implement context should declare implement reference budget"
grep -q "Repo calibration" <<<"$implement_context" || fail "implement context should require repo calibration before probes"
grep -q "Design input check" <<<"$implement_context" || fail "implement context should require design input check"
grep -q "Model-to-code placement" <<<"$implement_context" || fail "implement context should require model-to-code placement"
grep -q "Implementation trace" <<<"$implement_context" || fail "implement context should require implementation trace"
grep -q "Place code by layer" <<<"$implement_context" || fail "implement context should emphasize code placement"
grep -q "ddd-agent-contract.md" <<<"$implement_context" || fail "implement context should include agent contract"
grep -q "ddd-golang.md" <<<"$implement_context" || fail "implement context should include primary Go implementation guide"
! grep -q "references/ddd-golang-runtime.md" <<<"$implement_context" || fail "implement context should not include Go runtime guide by default"
! grep -q "references/ddd-golang-taskqueue.md" <<<"$implement_context" || fail "implement context should not include Go taskqueue guide by default"

review_context="$(
  printf '{"prompt":"Please use $superpowers:requesting-code-review for this DDD aggregate change"}' |
    HOME="$TMP/home" node "$RUNTIME" user-prompt-submit |
    extract_context
)"
grep -q "DDD Boundary Review" <<<"$review_context" || fail "code-review prompt did not trigger review context"
grep -q "Reference budget: review" <<<"$review_context" || fail "review context should declare review reference budget"
grep -q "Repo calibration" <<<"$review_context" || fail "review context should require repo calibration before probes"
grep -q "Evidence-to-judgment review" <<<"$review_context" || fail "review context should require evidence-to-judgment framework"
grep -q "Expected model vs observed code" <<<"$review_context" || fail "review context should compare expected model to observed code"
grep -q "Finding triage" <<<"$review_context" || fail "review context should require finding triage"
grep -q "Find evidence before conclusions" <<<"$review_context" || fail "review context should emphasize evidence"
grep -q "ddd-agent-contract.md" <<<"$review_context" || fail "review context should include agent contract"
! grep -q "references/database.md" <<<"$review_context" || fail "review context should not include database guide by default"

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

[ -f "$CODEX_DESIGN_SKILL" ] || fail "codex DDD design skill missing"
[ -f "$CODEX_IMPLEMENT_SKILL" ] || fail "codex DDD implement skill missing"
[ -f "$CODEX_REVIEW_SKILL" ] || fail "codex DDD review skill missing"
[ -f "$CLAUDE_DESIGN_SKILL" ] || fail "claude DDD design skill missing"
[ -f "$CLAUDE_IMPLEMENT_SKILL" ] || fail "claude DDD implement skill missing"
[ -f "$CLAUDE_REVIEW_SKILL" ] || fail "claude DDD review skill missing"
[ ! -e "$CODEX_DDD_ROOT/skills/standards" ] || fail "codex DDD plugin should not expose a standards skill"
[ ! -e "$CLAUDE_DDD_ROOT/skills/standards" ] || fail "claude DDD plugin should not expose a standards skill"
grep -q '../../references/ddd-risk-router.md' "$CODEX_DESIGN_SKILL" || fail "codex design skill should reference risk router"
grep -q '../../references/ddd-risk-router.md' "$CODEX_IMPLEMENT_SKILL" || fail "codex implement skill should reference risk router"
grep -q '../../references/ddd-risk-router.md' "$CODEX_REVIEW_SKILL" || fail "codex review skill should reference risk router"
grep -q 'Do not scan generic `design-patterns/`' "$CODEX_DESIGN_SKILL" || fail "codex design skill should reject dynamic design-patterns scanning"
grep -q 'Repo calibration' "$CODEX_DESIGN_SKILL" || fail "codex design skill should include repo calibration output"
grep -q 'Product semantics intake' "$CODEX_DESIGN_SKILL" || fail "codex design skill should include product semantics intake"
grep -q 'Spec trace' "$CODEX_DESIGN_SKILL" || fail "codex design skill should include spec trace output"
grep -q 'Commands / queries / events' "$CODEX_DESIGN_SKILL" || fail "codex design skill should include command query event modeling"
grep -q 'Repo calibration' "$CODEX_IMPLEMENT_SKILL" || fail "codex implement skill should include repo calibration output"
grep -q 'Design input check' "$CODEX_IMPLEMENT_SKILL" || fail "codex implement skill should include design input check"
grep -q 'Model-to-code placement' "$CODEX_IMPLEMENT_SKILL" || fail "codex implement skill should include model-to-code placement"
grep -q 'Implementation trace' "$CODEX_IMPLEMENT_SKILL" || fail "codex implement skill should include implementation trace"
grep -q 'Repo calibration' "$CODEX_REVIEW_SKILL" || fail "codex review skill should include repo calibration output"
grep -q 'Evidence map' "$CODEX_REVIEW_SKILL" || fail "codex review skill should include evidence map"
grep -q 'Expected model vs observed code' "$CODEX_REVIEW_SKILL" || fail "codex review skill should compare expected model to observed code"
grep -q 'Finding triage' "$CODEX_REVIEW_SKILL" || fail "codex review skill should include finding triage"
[ -d "$CODEX_DDD_ROOT/references" ] || fail "codex DDD shared references should live at plugin root"
[ -d "$CLAUDE_DDD_ROOT/references" ] || fail "claude DDD shared references should live at plugin root"
[ -f "$CODEX_DDD_ROOT/references/ddd-python.md" ] || fail "codex python DDD reference missing"
[ -f "$CODEX_DDD_ROOT/references/ddd-typescript.md" ] || fail "codex typescript DDD reference missing"
[ -f "$CLAUDE_DDD_ROOT/references/ddd-python.md" ] || fail "claude python DDD reference missing"
[ -f "$CLAUDE_DDD_ROOT/references/ddd-typescript.md" ] || fail "claude typescript DDD reference missing"
[ ! -e "$CODEX_DDD_ROOT/design-patterns" ] || fail "codex DDD plugin should not keep a root design-patterns directory"
[ ! -e "$CLAUDE_DDD_ROOT/design-patterns" ] || fail "claude DDD plugin should not keep a root design-patterns directory"
[ -x "$CLAUDE_DDD_ROOT/hooks/pre-tool-use" ] || fail "claude DDD pre-tool-use hook should be executable"

claude_hook_output="$(
  printf '{"tool_input":{"skill":"superpowers:writing-plans"}}' |
    CLAUDE_PLUGIN_ROOT="$CLAUDE_DDD_ROOT" "$CLAUDE_DDD_ROOT/hooks/run-hook.cmd" pre-tool-use
)"
grep -q "DDD Design Guidance" <<<"$claude_hook_output" || fail "claude DDD hook should inject design context"
grep -q "ddd-risk-router.md" <<<"$claude_hook_output" || fail "claude DDD hook should include risk router"
grep -q "Reference budget: design" <<<"$claude_hook_output" || fail "claude DDD hook should declare design budget"
grep -q "Product semantics intake" <<<"$claude_hook_output" || fail "claude DDD hook should require product semantics intake"
grep -q "Spec trace" <<<"$claude_hook_output" || fail "claude DDD hook should require spec traceability"
! grep -q "references/database.md" <<<"$claude_hook_output" || fail "claude design hook should not include database guide by default"
! grep -q "ddd-golang-runtime.md" <<<"$claude_hook_output" || fail "claude design hook should not include runtime guide by default"

claude_implement_hook_output="$(
  printf '{"tool_input":{"skill":"superpowers:executing-plans"}}' |
    CLAUDE_PLUGIN_ROOT="$CLAUDE_DDD_ROOT" "$CLAUDE_DDD_ROOT/hooks/run-hook.cmd" pre-tool-use
)"
grep -q "DDD Implementation Guardrails" <<<"$claude_implement_hook_output" || fail "claude DDD hook should inject implement context"
grep -q "Design input check" <<<"$claude_implement_hook_output" || fail "claude implement hook should require design input check"
grep -q "Model-to-code placement" <<<"$claude_implement_hook_output" || fail "claude implement hook should require model-to-code placement"
grep -q "Implementation trace" <<<"$claude_implement_hook_output" || fail "claude implement hook should require implementation trace"

claude_review_hook_output="$(
  printf '{"tool_input":{"skill":"superpowers:requesting-code-review"}}' |
    CLAUDE_PLUGIN_ROOT="$CLAUDE_DDD_ROOT" "$CLAUDE_DDD_ROOT/hooks/run-hook.cmd" pre-tool-use
)"
grep -q "DDD Boundary Review" <<<"$claude_review_hook_output" || fail "claude DDD hook should inject review context"
grep -q "Evidence-to-judgment review" <<<"$claude_review_hook_output" || fail "claude review hook should require evidence-to-judgment framework"
grep -q "Expected model vs observed code" <<<"$claude_review_hook_output" || fail "claude review hook should compare expected model to observed code"
grep -q "Finding triage" <<<"$claude_review_hook_output" || fail "claude review hook should require finding triage"

echo "  codex DDD architect runtime: routing and references correct"
