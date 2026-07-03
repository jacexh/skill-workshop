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
grep -q "phase skill and risk router" <<<"$design_context" || fail "design context should list phase skill plus risk router"
grep -q "ddd-risk-router.md" <<<"$design_context" || fail "risk router missing from design context"
grep -q "DDD Risk Router" <<<"$design_context" || fail "risk router title missing from design context"
grep -q "skills/design/SKILL.md" <<<"$design_context" || fail "design skill missing from design context"
! grep -q "ddd-design-playbook.md" <<<"$design_context" || fail "design context should not include removed design playbook"
! grep -q "Existing model inventory" <<<"$design_context" || fail "design hook should not duplicate design skill details"
! grep -q "Product semantics intake" <<<"$design_context" || fail "design hook should not duplicate design skill details"
! grep -q "Spec trace" <<<"$design_context" || fail "design hook should not duplicate design skill details"
! grep -q "commands, queries, Domain Events, Integration Messages, and state lifecycle" <<<"$design_context" || fail "design hook should not duplicate design skill details"
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
grep -q "phase skill and risk router" <<<"$implement_context" || fail "implement context should list phase skill plus risk router"
grep -q "skills/implement/SKILL.md" <<<"$implement_context" || fail "implement skill missing from implement context"
! grep -q "ddd-implement-playbook.md" <<<"$implement_context" || fail "implement context should not include removed implement playbook"
! grep -q "Repo calibration" <<<"$implement_context" || fail "implement hook should not duplicate skill/reference details"
! grep -q "Design input check" <<<"$implement_context" || fail "implement hook should not duplicate implement skill details"
! grep -q "Model-to-code placement" <<<"$implement_context" || fail "implement hook should not duplicate implement skill details"
! grep -q "Implementation trace" <<<"$implement_context" || fail "implement hook should not duplicate implement skill details"
! grep -q "Place code by layer" <<<"$implement_context" || fail "implement hook should not duplicate implement skill details"
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
grep -q "phase skill and risk router" <<<"$review_context" || fail "review context should list phase skill plus risk router"
grep -q "skills/review/SKILL.md" <<<"$review_context" || fail "review skill missing from review context"
! grep -q "ddd-review-playbook.md" <<<"$review_context" || fail "review context should not include removed review playbook"
! grep -q "Repo calibration" <<<"$review_context" || fail "review hook should not duplicate skill/reference details"
! grep -q "Evidence-to-judgment review" <<<"$review_context" || fail "review hook should not duplicate review skill details"
! grep -q "Expected model vs observed code" <<<"$review_context" || fail "review hook should not duplicate review skill details"
! grep -q "Finding triage" <<<"$review_context" || fail "review hook should not duplicate review skill details"
! grep -q "Find evidence before conclusions" <<<"$review_context" || fail "review hook should not duplicate review skill details"
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
[ ! -e "$CODEX_DDD_ROOT/references/ddd-design-playbook.md" ] || fail "codex design playbook should be merged into design skill"
[ ! -e "$CODEX_DDD_ROOT/references/ddd-implement-playbook.md" ] || fail "codex implement playbook should be merged into implement skill"
[ ! -e "$CODEX_DDD_ROOT/references/ddd-review-playbook.md" ] || fail "codex review playbook should be merged into review skill"
[ ! -e "$CLAUDE_DDD_ROOT/references/ddd-design-playbook.md" ] || fail "claude design playbook should be merged into design skill"
[ ! -e "$CLAUDE_DDD_ROOT/references/ddd-implement-playbook.md" ] || fail "claude implement playbook should be merged into implement skill"
[ ! -e "$CLAUDE_DDD_ROOT/references/ddd-review-playbook.md" ] || fail "claude review playbook should be merged into review skill"
[ ! -e "$CODEX_DDD_ROOT/skills/standards" ] || fail "codex DDD plugin should not expose a standards skill"
[ ! -e "$CLAUDE_DDD_ROOT/skills/standards" ] || fail "claude DDD plugin should not expose a standards skill"
grep -q '../../references/ddd-risk-router.md' "$CODEX_DESIGN_SKILL" || fail "codex design skill should reference risk router"
grep -q '../../references/ddd-risk-router.md' "$CODEX_IMPLEMENT_SKILL" || fail "codex implement skill should reference risk router"
grep -q '../../references/ddd-risk-router.md' "$CODEX_REVIEW_SKILL" || fail "codex review skill should reference risk router"
! grep -q 'ddd-design-playbook.md' "$CODEX_DESIGN_SKILL" || fail "codex design skill should not reference removed design playbook"
! grep -q 'ddd-implement-playbook.md' "$CODEX_IMPLEMENT_SKILL" || fail "codex implement skill should not reference removed implement playbook"
! grep -q 'ddd-review-playbook.md' "$CODEX_REVIEW_SKILL" || fail "codex review skill should not reference removed review playbook"
grep -q 'Do not scan generic `design-patterns/`' "$CODEX_DESIGN_SKILL" || fail "codex design skill should reject dynamic design-patterns scanning"
grep -q 'Existing model inventory' "$CODEX_DESIGN_SKILL" || fail "codex design skill should include existing model inventory output"
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
  local design_skill="$root/skills/design/SKILL.md"
  local implement_skill="$root/skills/implement/SKILL.md"
  local review_skill="$root/skills/review/SKILL.md"

  grep -q "## Minimum Output Contract" "$design_skill" || fail "$label design skill should define a minimum output contract"
  grep -q "Small change" "$design_skill" || fail "$label design skill should distinguish small-change output"
  grep -q "Full design" "$design_skill" || fail "$label design skill should distinguish full-design output"
  grep -q "## Minimum Output Contract" "$implement_skill" || fail "$label implement skill should define a minimum output contract"
  grep -q "Small change" "$implement_skill" || fail "$label implement skill should distinguish small-change output"
  grep -q "Full implementation" "$implement_skill" || fail "$label implement skill should distinguish full-implementation output"
  grep -q "## Minimum Output Contract" "$review_skill" || fail "$label review skill should define a minimum output contract"
  grep -q "Small review" "$review_skill" || fail "$label review skill should distinguish small-review output"
  grep -q "Full review" "$review_skill" || fail "$label review skill should distinguish full-review output"

  grep -q "## Routing Matrix" "$risk_router" || fail "$label risk router should provide a routing matrix"
  grep -q "Required references" "$risk_router" || fail "$label routing matrix should name required references"
  grep -q "Required evidence" "$risk_router" || fail "$label routing matrix should name required evidence"
  grep -q "Allowed exception" "$risk_router" || fail "$label routing matrix should name allowed exceptions"

  grep -q "## Severity Calibration" "$review_skill" || fail "$label review skill should calibrate severity"
  grep -q "Blocker" "$review_skill" || fail "$label review severity should include blocker"
  grep -q "Major" "$review_skill" || fail "$label review severity should include major"
  grep -q "Minor" "$review_skill" || fail "$label review severity should include minor"
  grep -q "Harmless local style" "$review_skill" || fail "$label review severity should identify harmless local style"
}

check_phase_contracts "$CODEX_DDD_ROOT" "codex"
check_phase_contracts "$CLAUDE_DDD_ROOT" "claude"

check_generated_rpc_placement_contracts() {
  local root="$1"
  local label="$2"
  local core="$root/references/ddd-core.md"
  local golang="$root/references/ddd-golang.md"
  local implement_skill="$root/skills/implement/SKILL.md"
  local risk_router="$root/references/ddd-risk-router.md"

  # The language-neutral rule is repository calibration first; Go shortcut
  # guidance is only one language-specific instance of that rule.
  grep -q "Generated IDL/RPC adapter placement is repository-calibrated" "$core" || fail "$label core guide should make generated adapter placement repository-calibrated"

  # Generated Go RPC handler placement must remain repo-calibrated so generic
  # layer examples do not cause agents to create interface packages by default.
  grep -q "Generated Go RPC handler placement is repo-calibrated" "$golang" || fail "$label Go guide should make generated RPC handler placement repo-calibrated"
  grep -q "default to the existing application/application.go shortcut" "$golang" || fail "$label Go guide should default generated RPC handlers to the application shortcut"
  grep -q "Do not create interfaces/grpc, interfaces/connectrpc, or interfaces/runtime packages solely to house generated ConnectRPC/gRPC handlers" "$golang" || fail "$label Go guide should reject generated RPC-only interfaces packages"

  # Language-neutral directory examples must yield to language and repository
  # placement rules instead of forcing a physical Interface directory.
  grep -q "Physical Interface directories are optional and language/repo-specific" "$core" || fail "$label core guide should mark physical Interface directories as optional"

  # Implementation planning must choose RPC handler placement before proposing
  # new files, otherwise agents can follow the generic Interface layer mapping.
  grep -q "For generated IDL/RPC adapters, first record the calibrated adapter placement" "$implement_skill" || fail "$label implement skill should require generated adapter placement calibration"

  # The fat adapter card should flag bloated generated adapter methods, not a
  # calibrated repo convention for where the generated adapter lives.
  grep -q "Fat Generated RPC Adapter" "$risk_router" || fail "$label risk router should use a language-neutral generated RPC card"
  grep -q "The smell is a fat generated RPC adapter body, not the calibrated placement itself" "$risk_router" || fail "$label risk router should not discourage calibrated generated adapter placement"
}

check_generated_rpc_placement_contracts "$CODEX_DDD_ROOT" "codex"
check_generated_rpc_placement_contracts "$CLAUDE_DDD_ROOT" "claude"

check_implement_hot_path_guardrail_contracts() {
  local root="$1"
  local label="$2"
  local implement_skill="$root/skills/implement/SKILL.md"

  # Implement translates an accepted model to code. It must not invent model
  # decisions while choosing files.
  grep -q "## Placement Translation Gates" "$implement_skill" || fail "$label implement skill should expose placement translation gates"
  grep -q "Accepted model source" "$implement_skill" || fail "$label implement skill should record accepted model source"
  grep -q "implements an accepted model decision" "$implement_skill" || fail "$label implement skill should only implement accepted model decisions"
  grep -q "If implementation exposes a missing or contradictory model decision, stop and return to design" "$implement_skill" || fail "$label implement skill should route material model gaps back to design"
  ! grep -q "implements a new model decision" "$implement_skill" || fail "$label implement skill should not let implementation invent model decisions"

  grep -q "Run Placement Translation Gates before choosing files" "$implement_skill" || fail "$label implement skill should run placement translation gates before file placement"
  grep -q "Accepted model source" "$implement_skill" || fail "$label implement skill should expose accepted model source"
}

check_implement_hot_path_guardrail_contracts "$CODEX_DDD_ROOT" "codex"
check_implement_hot_path_guardrail_contracts "$CLAUDE_DDD_ROOT" "claude"

check_design_review_hot_path_guardrail_contracts() {
  local root="$1"
  local label="$2"
  local design_skill="$root/skills/design/SKILL.md"
  local review_skill="$root/skills/review/SKILL.md"

  # Design is strategic-first: problem space and context map precede tactical
  # Aggregate/port/layer decisions.
  grep -q "## Strategic Model Gate" "$design_skill" || fail "$label design skill should expose a strategic model gate"
  grep -q "problem space before solution model" "$design_skill" || fail "$label design skill should make problem space precede solution model"
  grep -q "subdomain and business capability" "$design_skill" || fail "$label design skill should require subdomain and business capability"
  grep -q "context-map relationship" "$design_skill" || fail "$label design skill should require context-map relationship"
  grep -q "## Tactical Model Gate" "$design_skill" || fail "$label design skill should expose a tactical model gate"
  grep -q "Existing model inventory" "$design_skill" || fail "$label design skill should use existing model inventory instead of repo calibration"
  ! grep -q "Generated IDL/RPC contract gate" "$design_skill" || fail "$label design skill should not duplicate generated adapter risk cards"
  grep -q "Run Strategic Model Gate before tactical modeling" "$design_skill" || fail "$label design skill should run strategic gate before tactical modeling"
  grep -q "Existing model inventory" "$design_skill" || fail "$label design skill should expose existing model inventory"

  # Review needs evidence preconditions so findings are based on calibrated
  # proof, not generic directory/style expectations or probe hits.
  grep -q "## Evidence Preconditions" "$review_skill" || fail "$label review skill should expose evidence preconditions"
  grep -q "Use the risk router's Required evidence and Allowed exception columns" "$review_skill" || fail "$label review skill should lean on router evidence contracts"
  grep -q "Evidence gaps are not findings" "$review_skill" || fail "$label review skill should separate evidence gaps from findings"
  grep -q "Do not redesign in review" "$review_skill" || fail "$label review skill should prevent redesign during review"
  grep -q "Run Evidence Preconditions before reporting findings" "$review_skill" || fail "$label review skill should run evidence preconditions before findings"
  grep -q "Risk cards from ddd-risk-router.md, plus evidence gaps and severity calibration" "$review_skill" || fail "$label review skill should avoid duplicating the router risk inventory"
}

check_design_review_hot_path_guardrail_contracts "$CODEX_DDD_ROOT" "codex"
check_design_review_hot_path_guardrail_contracts "$CLAUDE_DDD_ROOT" "claude"

check_phase_card_usage_contracts() {
  local root="$1"
  local label="$2"
  local risk_router="$root/references/ddd-risk-router.md"

  grep -q "## How Phases Use Cards" "$risk_router" || fail "$label risk router should explain phase-specific card usage"
  grep -q "Design uses cards to surface modeling questions" "$risk_router" || fail "$label risk router should define design card usage"
  grep -q "Implement uses cards to translate accepted model decisions into code placement" "$risk_router" || fail "$label risk router should define implement card usage"
  grep -q "Review uses cards to demand evidence before findings" "$risk_router" || fail "$label risk router should define review card usage"
}

check_phase_card_usage_contracts "$CODEX_DDD_ROOT" "codex"
check_phase_card_usage_contracts "$CLAUDE_DDD_ROOT" "claude"

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
  ! grep -q "Read this file first" "$root/references/ddd-risk-router.md" || fail "$label risk router should be paired with the active phase skill, not claim to be the sole first read"
  ! grep -q "Read first for DDD backend" "$root/references/ddd-risk-router.md" || fail "$label risk router frontmatter should not claim a risk-router-first workflow"
  ! grep -R -q "ddd-risk-router.md.*first" "$root/skills" || fail "$label phase skills should not make the risk router the first-read entrypoint"
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
grep -q "skills/design/SKILL.md" <<<"$claude_hook_output" || fail "claude design hook should include design skill"
! grep -q "ddd-design-playbook.md" <<<"$claude_hook_output" || fail "claude design hook should not include removed design playbook"
! grep -q "Product semantics intake" <<<"$claude_hook_output" || fail "claude design hook should not duplicate design skill details"
! grep -q "Spec trace" <<<"$claude_hook_output" || fail "claude design hook should not duplicate design skill details"
! grep -q "references/database.md" <<<"$claude_hook_output" || fail "claude design hook should not include database guide by default"
! grep -q "references/ddd-modeling.md" <<<"$claude_hook_output" || fail "claude design hook should not include modeling guide by default"
! grep -q "references/ddd-core.md" <<<"$claude_hook_output" || fail "claude design hook should not include core guide by default"
! grep -q "ddd-golang-runtime.md" <<<"$claude_hook_output" || fail "claude design hook should not include runtime guide by default"

claude_implement_hook_output="$(
  printf '{"tool_input":{"skill":"superpowers:executing-plans"}}' |
    CLAUDE_PLUGIN_ROOT="$CLAUDE_DDD_ROOT" "$CLAUDE_DDD_ROOT/hooks/run-hook.cmd" pre-tool-use
)"
grep -q "DDD Implementation Guardrails" <<<"$claude_implement_hook_output" || fail "claude DDD hook should inject implement context"
grep -q "skills/implement/SKILL.md" <<<"$claude_implement_hook_output" || fail "claude implement hook should include implement skill"
! grep -q "ddd-implement-playbook.md" <<<"$claude_implement_hook_output" || fail "claude implement hook should not include removed implement playbook"
! grep -q "Design input check" <<<"$claude_implement_hook_output" || fail "claude implement hook should not duplicate implement skill details"
! grep -q "Model-to-code placement" <<<"$claude_implement_hook_output" || fail "claude implement hook should not duplicate implement skill details"
! grep -q "Implementation trace" <<<"$claude_implement_hook_output" || fail "claude implement hook should not duplicate implement skill details"

claude_review_hook_output="$(
  printf '{"tool_input":{"skill":"superpowers:requesting-code-review"}}' |
    CLAUDE_PLUGIN_ROOT="$CLAUDE_DDD_ROOT" "$CLAUDE_DDD_ROOT/hooks/run-hook.cmd" pre-tool-use
)"
grep -q "DDD Boundary Review" <<<"$claude_review_hook_output" || fail "claude DDD hook should inject review context"
grep -q "skills/review/SKILL.md" <<<"$claude_review_hook_output" || fail "claude review hook should include review skill"
! grep -q "ddd-review-playbook.md" <<<"$claude_review_hook_output" || fail "claude review hook should not include removed review playbook"
! grep -q "Evidence-to-judgment review" <<<"$claude_review_hook_output" || fail "claude review hook should not duplicate review skill details"
! grep -q "Expected model vs observed code" <<<"$claude_review_hook_output" || fail "claude review hook should not duplicate review skill details"
! grep -q "Finding triage" <<<"$claude_review_hook_output" || fail "claude review hook should not duplicate review skill details"

echo "  codex DDD architect runtime: routing and references correct"
