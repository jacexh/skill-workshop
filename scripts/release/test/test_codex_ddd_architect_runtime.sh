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
CODEX_DESIGN_PLAYBOOK="$CODEX_DDD_ROOT/references/ddd-design-playbook.md"
CODEX_IMPLEMENT_PLAYBOOK="$CODEX_DDD_ROOT/references/ddd-implement-playbook.md"
CODEX_REVIEW_PLAYBOOK="$CODEX_DDD_ROOT/references/ddd-review-playbook.md"
CLAUDE_DESIGN_PLAYBOOK="$CLAUDE_DDD_ROOT/references/ddd-design-playbook.md"
CLAUDE_IMPLEMENT_PLAYBOOK="$CLAUDE_DDD_ROOT/references/ddd-implement-playbook.md"
CLAUDE_REVIEW_PLAYBOOK="$CLAUDE_DDD_ROOT/references/ddd-review-playbook.md"
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
grep -q "ddd-design-playbook.md" <<<"$design_context" || fail "design playbook missing from design context"
! grep -q "references/database.md" <<<"$design_context" || fail "design context should not include database guide by default"
! grep -q "references/ddd-modeling.md" <<<"$design_context" || fail "design context should not include modeling guide by default"
! grep -q "references/ddd-core.md" <<<"$design_context" || fail "design context should not include core guide by default"
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
grep -q "ddd-implement-playbook.md" <<<"$implement_context" || fail "implement playbook missing from implement context"
! grep -q "references/ddd-agent-contract.md" <<<"$implement_context" || fail "implement context should not include agent contract by default"
! grep -q "references/ddd-core.md" <<<"$implement_context" || fail "implement context should not include core guide by default"
! grep -q "references/ddd-golang.md" <<<"$implement_context" || fail "implement context should not include primary Go guide by default"
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
grep -q "ddd-review-playbook.md" <<<"$review_context" || fail "review playbook missing from review context"
! grep -q "references/ddd-agent-contract.md" <<<"$review_context" || fail "review context should not include agent contract by default"
! grep -q "references/ddd-core.md" <<<"$review_context" || fail "review context should not include core guide by default"
! grep -q "references/ddd-golang.md" <<<"$review_context" || fail "review context should not include primary Go guide by default"
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
[ -f "$CODEX_DESIGN_PLAYBOOK" ] || fail "codex design playbook missing"
[ -f "$CODEX_IMPLEMENT_PLAYBOOK" ] || fail "codex implement playbook missing"
[ -f "$CODEX_REVIEW_PLAYBOOK" ] || fail "codex review playbook missing"
[ -f "$CLAUDE_DESIGN_PLAYBOOK" ] || fail "claude design playbook missing"
[ -f "$CLAUDE_IMPLEMENT_PLAYBOOK" ] || fail "claude implement playbook missing"
[ -f "$CLAUDE_REVIEW_PLAYBOOK" ] || fail "claude review playbook missing"
[ ! -e "$CODEX_DDD_ROOT/skills/standards" ] || fail "codex DDD plugin should not expose a standards skill"
[ ! -e "$CLAUDE_DDD_ROOT/skills/standards" ] || fail "claude DDD plugin should not expose a standards skill"
grep -q '../../references/ddd-risk-router.md' "$CODEX_DESIGN_SKILL" || fail "codex design skill should reference risk router"
grep -q '../../references/ddd-risk-router.md' "$CODEX_IMPLEMENT_SKILL" || fail "codex implement skill should reference risk router"
grep -q '../../references/ddd-risk-router.md' "$CODEX_REVIEW_SKILL" || fail "codex review skill should reference risk router"
grep -q '../../references/ddd-design-playbook.md' "$CODEX_DESIGN_SKILL" || fail "codex design skill should reference design playbook"
grep -q '../../references/ddd-implement-playbook.md' "$CODEX_IMPLEMENT_SKILL" || fail "codex implement skill should reference implement playbook"
grep -q '../../references/ddd-review-playbook.md' "$CODEX_REVIEW_SKILL" || fail "codex review skill should reference review playbook"
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

check_phase_contracts() {
  local root="$1"
  local label="$2"
  local risk_router="$root/references/ddd-risk-router.md"
  local design_playbook="$root/references/ddd-design-playbook.md"
  local implement_playbook="$root/references/ddd-implement-playbook.md"
  local review_playbook="$root/references/ddd-review-playbook.md"

  grep -q "## Minimum Output Contract" "$design_playbook" || fail "$label design playbook should define a minimum output contract"
  grep -q "Small change" "$design_playbook" || fail "$label design playbook should distinguish small-change output"
  grep -q "Full design" "$design_playbook" || fail "$label design playbook should distinguish full-design output"
  grep -q "## Minimum Output Contract" "$implement_playbook" || fail "$label implement playbook should define a minimum output contract"
  grep -q "Small change" "$implement_playbook" || fail "$label implement playbook should distinguish small-change output"
  grep -q "Full implementation" "$implement_playbook" || fail "$label implement playbook should distinguish full-implementation output"
  grep -q "## Minimum Output Contract" "$review_playbook" || fail "$label review playbook should define a minimum output contract"
  grep -q "Small review" "$review_playbook" || fail "$label review playbook should distinguish small-review output"
  grep -q "Full review" "$review_playbook" || fail "$label review playbook should distinguish full-review output"

  grep -q "## Routing Matrix" "$risk_router" || fail "$label risk router should provide a routing matrix"
  grep -q "Required references" "$risk_router" || fail "$label routing matrix should name required references"
  grep -q "Required evidence" "$risk_router" || fail "$label routing matrix should name required evidence"
  grep -q "Allowed exception" "$risk_router" || fail "$label routing matrix should name allowed exceptions"

  grep -q "## Severity Calibration" "$review_playbook" || fail "$label review playbook should calibrate severity"
  grep -q "Blocker" "$review_playbook" || fail "$label review severity should include blocker"
  grep -q "Major" "$review_playbook" || fail "$label review severity should include major"
  grep -q "Minor" "$review_playbook" || fail "$label review severity should include minor"
  grep -q "Harmless local style" "$review_playbook" || fail "$label review severity should identify harmless local style"
}

check_phase_contracts "$CODEX_DDD_ROOT" "codex"
check_phase_contracts "$CLAUDE_DDD_ROOT" "claude"

check_phase_routed_references() {
  local root="$1"
  local label="$2"
  local doc
  for doc in \
    ddd-modeling.md \
    ddd-core.md \
    ddd-agent-contract.md \
    ddd-golang.md \
    ddd-python.md \
    ddd-typescript.md \
    ddd-golang-events-messages.md \
    ddd-golang-runtime.md \
    ddd-golang-taskqueue.md
  do
    local path="$root/references/$doc"
    [ -f "$path" ] || fail "$label reference $doc missing"
    ! grep -q "Code agents must read this first" "$path" || fail "$label reference $doc should not claim agent contract is the first entrypoint"
    ! grep -q "Agents — read this first" "$path" || fail "$label reference $doc should not declare an old first-read agent block"
    ! grep -q "Agent execution contract (read first)" "$path" || fail "$label reference $doc should not list agent contract as read-first"
    ! grep -q "Use BEFORE reading ddd-modeling" "$path" || fail "$label reference $doc should not route through the old agent-contract entrypoint"
  done
  ! grep -q "Read this file first" "$root/references/ddd-risk-router.md" || fail "$label risk router should be paired with the active phase playbook, not claim to be the sole first read"
  ! grep -q "Read first for DDD backend" "$root/references/ddd-risk-router.md" || fail "$label risk router frontmatter should not claim a risk-router-first workflow"
  ! grep -R -q "ddd-risk-router.md.*first" "$root/skills" || fail "$label phase skills should read the phase playbook and risk router as a pair"
}

check_phase_routed_references "$CODEX_DDD_ROOT" "codex"
check_phase_routed_references "$CLAUDE_DDD_ROOT" "claude"

claude_hook_output="$(
  printf '{"tool_input":{"skill":"superpowers:writing-plans"}}' |
    CLAUDE_PLUGIN_ROOT="$CLAUDE_DDD_ROOT" "$CLAUDE_DDD_ROOT/hooks/run-hook.cmd" pre-tool-use
)"
grep -q "DDD Design Guidance" <<<"$claude_hook_output" || fail "claude DDD hook should inject design context"
grep -q "ddd-risk-router.md" <<<"$claude_hook_output" || fail "claude DDD hook should include risk router"
grep -q "Reference budget: design" <<<"$claude_hook_output" || fail "claude DDD hook should declare design budget"
grep -q "ddd-design-playbook.md" <<<"$claude_hook_output" || fail "claude design hook should include design playbook"
grep -q "Product semantics intake" <<<"$claude_hook_output" || fail "claude DDD hook should require product semantics intake"
grep -q "Spec trace" <<<"$claude_hook_output" || fail "claude DDD hook should require spec traceability"
! grep -q "references/database.md" <<<"$claude_hook_output" || fail "claude design hook should not include database guide by default"
! grep -q "references/ddd-modeling.md" <<<"$claude_hook_output" || fail "claude design hook should not include modeling guide by default"
! grep -q "references/ddd-core.md" <<<"$claude_hook_output" || fail "claude design hook should not include core guide by default"
! grep -q "ddd-golang-runtime.md" <<<"$claude_hook_output" || fail "claude design hook should not include runtime guide by default"

claude_implement_hook_output="$(
  printf '{"tool_input":{"skill":"superpowers:executing-plans"}}' |
    CLAUDE_PLUGIN_ROOT="$CLAUDE_DDD_ROOT" "$CLAUDE_DDD_ROOT/hooks/run-hook.cmd" pre-tool-use
)"
grep -q "DDD Implementation Guardrails" <<<"$claude_implement_hook_output" || fail "claude DDD hook should inject implement context"
grep -q "ddd-implement-playbook.md" <<<"$claude_implement_hook_output" || fail "claude implement hook should include implement playbook"
grep -q "Design input check" <<<"$claude_implement_hook_output" || fail "claude implement hook should require design input check"
grep -q "Model-to-code placement" <<<"$claude_implement_hook_output" || fail "claude implement hook should require model-to-code placement"
grep -q "Implementation trace" <<<"$claude_implement_hook_output" || fail "claude implement hook should require implementation trace"

claude_review_hook_output="$(
  printf '{"tool_input":{"skill":"superpowers:requesting-code-review"}}' |
    CLAUDE_PLUGIN_ROOT="$CLAUDE_DDD_ROOT" "$CLAUDE_DDD_ROOT/hooks/run-hook.cmd" pre-tool-use
)"
grep -q "DDD Boundary Review" <<<"$claude_review_hook_output" || fail "claude DDD hook should inject review context"
grep -q "ddd-review-playbook.md" <<<"$claude_review_hook_output" || fail "claude review hook should include review playbook"
grep -q "Evidence-to-judgment review" <<<"$claude_review_hook_output" || fail "claude review hook should require evidence-to-judgment framework"
grep -q "Expected model vs observed code" <<<"$claude_review_hook_output" || fail "claude review hook should compare expected model to observed code"
grep -q "Finding triage" <<<"$claude_review_hook_output" || fail "claude review hook should require finding triage"

echo "  codex DDD architect runtime: routing and references correct"
