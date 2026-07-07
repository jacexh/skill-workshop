#!/usr/bin/env bash
# Validate ddd-expert is a standalone DDD/backend plugin with restrained
# workflow-routing hooks.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLAUDE_ROOT="$ROOT/plugins/ddd-expert"
CODEX_ROOT="$ROOT/codex-plugins/ddd-expert"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

extract_context() {
  node -e '
const fs = require("fs");
const raw = fs.readFileSync(0, "utf8");
const data = JSON.parse(raw);
process.stdout.write(data.hookSpecificOutput?.additionalContext || data.additional_context || "");
'
}

claude_skill_context() {
  local skill="$1"
  printf '{"tool_input":{"skill":"%s"}}\n' "$skill" |
    CLAUDE_PLUGIN_ROOT="$CLAUDE_ROOT" "$CLAUDE_ROOT/hooks/pre-tool-use" |
    extract_context
}

codex_prompt_context() {
  local prompt="$1"
  printf '{"prompt":"%s"}\n' "$prompt" |
    node "$CODEX_ROOT/hooks/codex-runtime.js" user-prompt-submit |
    extract_context
}

assert_restrained_hook_context() {
  local context="$1"
  local label="$2"

  [ -n "$context" ] || fail "$label hook should emit reminder context"
  line_count=$(printf '%s\n' "$context" | sed '/^[[:space:]]*$/d' | wc -l)
  [ "$line_count" -le 6 ] || fail "$label hook reminder should stay short"
  grep -q '\$ddd-expert:' <<<"$context" || fail "$label hook should route to ddd-expert skills"
  ! grep -q "Path:" <<<"$context" || fail "$label hook should not inject file paths"
  ! grep -q "references/" <<<"$context" || fail "$label hook should not inject reference paths"
  ! grep -q "ddd-golang" <<<"$context" || fail "$label hook should not inject Go reference names"
  ! grep -q "Architecture Gate" <<<"$context" || fail "$label hook should not inject DDD gate details"
  ! grep -q "Aggregate Root" <<<"$context" || fail "$label hook should not inject tactical DDD details"
  ! grep -q "§" <<<"$context" || fail "$label hook should not inject section anchors"
}

# Users must be able to install ddd-expert independently from both marketplaces.
jq -e '.plugins[] | select(.name == "ddd-expert" and .source == "./plugins/ddd-expert")' \
  "$ROOT/.claude-plugin/marketplace.json" >/dev/null || fail "Claude marketplace missing ddd-expert entry"
jq -e '.plugins[] | select(.name == "ddd-expert" and .source.path == "./codex-plugins/ddd-expert")' \
  "$ROOT/.agents/plugins/marketplace.json" >/dev/null || fail "Codex marketplace missing ddd-expert entry"
jq -e '.plugins[] | select(.name == "superpowers-ddd-architect")' \
  "$ROOT/.claude-plugin/marketplace.json" >/dev/null && fail "Claude marketplace should not publish retired superpowers-ddd-architect"
jq -e '.plugins[] | select(.name == "superpowers-ddd-architect")' \
  "$ROOT/.agents/plugins/marketplace.json" >/dev/null && fail "Codex marketplace should not publish retired superpowers-ddd-architect"
[ ! -e "$ROOT/plugins/superpowers-ddd-architect" ] || fail "Claude superpowers-ddd-architect plugin should be removed"
[ ! -e "$ROOT/codex-plugins/superpowers-ddd-architect" ] || fail "Codex superpowers-ddd-architect plugin should be removed"

[ -f "$CLAUDE_ROOT/.claude-plugin/plugin.json" ] || fail "Claude ddd-expert manifest missing"
[ -f "$CODEX_ROOT/.codex-plugin/plugin.json" ] || fail "Codex ddd-expert manifest missing"
[ "$(jq -r .name "$CLAUDE_ROOT/.claude-plugin/plugin.json")" = "ddd-expert" ] || fail "Claude manifest name should be ddd-expert"
[ "$(jq -r .name "$CODEX_ROOT/.codex-plugin/plugin.json")" = "ddd-expert" ] || fail "Codex manifest name should be ddd-expert"

# ddd-expert owns only restrained workflow-routing hooks. Hooks remind agents
# which ddd-expert skill to invoke; they must not inject reference content.
[ "$(jq -r '.hooks // empty' "$CODEX_ROOT/.codex-plugin/plugin.json")" = "./hooks/hooks.json" ] || fail "Codex ddd-expert manifest should declare hooks"
[ -f "$CLAUDE_ROOT/hooks/hooks.json" ] || fail "Claude ddd-expert should register hooks"
[ -f "$CLAUDE_ROOT/hooks/pre-tool-use" ] || fail "Claude ddd-expert pre-tool-use hook missing"
[ -f "$CLAUDE_ROOT/hooks/run-hook.cmd" ] || fail "Claude ddd-expert run-hook wrapper missing"
[ -f "$CODEX_ROOT/hooks/hooks.json" ] || fail "Codex ddd-expert should register hooks"
[ -f "$CODEX_ROOT/hooks/codex-runtime.js" ] || fail "Codex ddd-expert runtime missing"
[ -f "$CODEX_ROOT/codex-hooks-snippet.json" ] || fail "Codex ddd-expert should ship hook snippet"

jq -e '.hooks.PreToolUse[] | select(.matcher == "Skill")' "$CLAUDE_ROOT/hooks/hooks.json" >/dev/null || fail "Claude ddd-expert should intercept Skill invocations"
jq -e '.hooks.UserPromptSubmit | type == "array"' "$CODEX_ROOT/hooks/hooks.json" >/dev/null || fail "Codex ddd-expert should register UserPromptSubmit"
diff -u <(jq -S '.hooks' "$CODEX_ROOT/hooks/hooks.json") <(jq -S '.hooks' "$CODEX_ROOT/codex-hooks-snippet.json") >/dev/null || fail "Codex ddd-expert hooks should match fallback snippet"

writing_context="$(claude_skill_context superpowers:writing-plans)"
assert_restrained_hook_context "$writing_context" "Claude writing-plans"
grep -q '\$ddd-expert:domain-modeling' <<<"$writing_context" || fail "Claude writing-plans should require domain-modeling when absent"
grep -q '\$ddd-expert:design' <<<"$writing_context" || fail "Claude writing-plans should route accepted model to design"
grep -qi "accepted domain model" <<<"$writing_context" || fail "Claude writing-plans should mention accepted domain model condition"

codex_writing_context="$(codex_prompt_context 'Please use $superpowers:writing-plans for this backend plan')"
assert_restrained_hook_context "$codex_writing_context" "Codex writing-plans"
grep -q '\$ddd-expert:domain-modeling' <<<"$codex_writing_context" || fail "Codex writing-plans should require domain-modeling when absent"
grep -q '\$ddd-expert:design' <<<"$codex_writing_context" || fail "Codex writing-plans should route accepted model to design"

for skill in superpowers:executing-plans superpowers:subagent-driven-development; do
  context="$(claude_skill_context "$skill")"
  assert_restrained_hook_context "$context" "Claude $skill"
  grep -q '\$ddd-expert:implement' <<<"$context" || fail "Claude $skill should route to implement"
done

for prompt in 'Please use $superpowers:executing-plans for this task' 'Please use $superpowers:subagent-driven-development for this task'; do
  context="$(codex_prompt_context "$prompt")"
  assert_restrained_hook_context "$context" "Codex $prompt"
  grep -q '\$ddd-expert:implement' <<<"$context" || fail "Codex development prompt should route to implement"
done

for skill in superpowers:requesting-code-review superpowers:receiving-code-review; do
  context="$(claude_skill_context "$skill")"
  assert_restrained_hook_context "$context" "Claude $skill"
  grep -q '\$ddd-expert:review' <<<"$context" || fail "Claude $skill should route to review"
done

for prompt in 'Please use $superpowers:requesting-code-review on this branch' 'Please use $superpowers:receiving-code-review for this feedback'; do
  context="$(codex_prompt_context "$prompt")"
  assert_restrained_hook_context "$context" "Codex $prompt"
  grep -q '\$ddd-expert:review' <<<"$context" || fail "Codex review prompt should route to review"
done

brainstorming_context="$(claude_skill_context superpowers:brainstorming)"
[ -z "$brainstorming_context" ] || fail "Claude ddd-expert should not trigger on brainstorming"
[ "$(printf '{"prompt":"Please use $superpowers:brainstorming"}\n' | node "$CODEX_ROOT/hooks/codex-runtime.js" user-prompt-submit)" = "{}" ] || fail "Codex ddd-expert should not trigger on brainstorming"

for skill in domain-modeling design implement review; do
  [ -f "$CLAUDE_ROOT/skills/$skill/SKILL.md" ] || fail "Claude ddd-expert missing $skill skill"
  [ -f "$CODEX_ROOT/skills/$skill/SKILL.md" ] || fail "Codex ddd-expert missing $skill skill"
  grep -q '../../references/ddd-risk-router.md' "$CLAUDE_ROOT/skills/$skill/SKILL.md" || fail "Claude $skill skill should route through ddd-risk-router"
  grep -q '../../references/ddd-risk-router.md' "$CODEX_ROOT/skills/$skill/SKILL.md" || fail "Codex $skill skill should route through ddd-risk-router"
done

check_domain_modeling_skill() {
  local modeling_skill="$1"
  local label="$2"

  grep -q "ddd-modeling-gates.md" "$modeling_skill" || fail "$label domain-modeling should load modeling gates"
  grep -q "one-question-at-a-time" "$modeling_skill" || fail "$label domain-modeling should advertise one-question interview"
  grep -q "Ask exactly one high-fidelity question at a time" "$modeling_skill" || fail "$label domain-modeling should force one high-fidelity question"
  grep -q "Avoid low-fidelity questions" "$modeling_skill" || fail "$label domain-modeling should reject low-fidelity questions"
  grep -q "Domain Modeling Brief" "$modeling_skill" || fail "$label domain-modeling should emit a Domain Modeling Brief"
  grep -q "Model Decisions" "$modeling_skill" || fail "$label domain-modeling should emit material model decisions"
  grep -q "event-storming timeline" "$modeling_skill" || fail "$label domain-modeling should reconstruct an event-storming timeline"
  grep -q "past-tense business facts" "$modeling_skill" || fail "$label domain-modeling should start from past-tense business facts"
  grep -q "Do not write \`docs/superpowers/memory/\` directly" "$modeling_skill" || fail "$label domain-modeling should not write memory directly"
  grep -q "Memory candidates" "$modeling_skill" || fail "$label domain-modeling should emit memory candidates"
}

check_domain_modeling_skill "$CLAUDE_ROOT/skills/domain-modeling/SKILL.md" "Claude"
check_domain_modeling_skill "$CODEX_ROOT/skills/domain-modeling/SKILL.md" "Codex"

check_design_skill() {
  local design_skill="$1"
  local label="$2"

  grep -q "ddd-modeling-gates.md" "$design_skill" || fail "$label design should load modeling gates"
  grep -q "before naming Aggregates" "$design_skill" || fail "$label design should gate tactical objects before naming aggregates"
  grep -q "Default-first key concepts" "$design_skill" || fail "$label design should use default-first key concept discipline"
  grep -q "Implementation handoff" "$design_skill" || fail "$label design should emit an implementation handoff"
  grep -q "Accepted model source" "$design_skill" || fail "$label design handoff should name accepted model source"
  grep -q "Layer ownership" "$design_skill" || fail "$label design handoff should decide layer ownership"
  grep -q "collaboration model before mechanism" "$design_skill" || fail "$label design should decide collaboration model before mechanism"
  grep -q "If any handoff item is material to implementation and unknown, Stop" "$design_skill" || fail "$label design should stop instead of leaving implement to guess"
  grep -q "Aggregate Boundary Conflict returns to \`domain-modeling\`" "$design_skill" || fail "$label design should route aggregate boundary conflicts to domain-modeling"
  grep -q "Implementation transaction shape is not model evidence" "$design_skill" || fail "$label design should reject implementation transaction evidence"
  ! grep -q "documented transaction exception" "$design_skill" || fail "$label design should not list documented transaction exception as a collaboration model"
}

check_design_skill "$CLAUDE_ROOT/skills/design/SKILL.md" "Claude"
check_design_skill "$CODEX_ROOT/skills/design/SKILL.md" "Codex"

check_implement_skill() {
  local implement_skill="$1"
  local label="$2"

  line_count=$(wc -l <"$implement_skill")
  [ "$line_count" -le 110 ] || fail "$label implement skill should stay concise"
  grep -q "Implementation handoff" "$implement_skill" || fail "$label implement should consume design handoff"
  grep -q "Handoff check" "$implement_skill" || fail "$label implement should verify handoff before code"
  grep -q "modeling evidence" "$implement_skill" || fail "$label implement should verify modeling evidence"
  grep -q "Accepted model source" "$implement_skill" || fail "$label implement should name accepted model source"
  grep -q "Object shape routing" "$implement_skill" || fail "$label implement should route confirmed objects"
  grep -q "Default-first key concepts" "$implement_skill" || fail "$label implement should use default-first key concept discipline"
  grep -q "Surface preflight" "$implement_skill" || fail "$label implement should classify touched surfaces"
  grep -q "collaboration model" "$implement_skill" || fail "$label implement should require accepted collaboration model"
  grep -q "Rules Satisfied / Not Applicable / Return to domain-modeling" "$implement_skill" || fail "$label implement output should route modeling exceptions upstream"
  grep -q "Changed files by layer" "$implement_skill" || fail "$label implement should report changed files by layer"
  grep -q "Tests / verification" "$implement_skill" || fail "$label implement should report verification"
  grep -q "return to \`domain-modeling\`" "$implement_skill" || fail "$label implement should return missing business facts upstream"
  grep -q "return to \`design\`" "$implement_skill" || fail "$label implement should return missing placement upstream"
  grep -q "review finding includes \`Model correction\`" "$implement_skill" || fail "$label implement should recognize review model corrections"
  grep -q "already accepted by the user or design handoff" "$implement_skill" || fail "$label implement should not apply model corrections without accepted design"
  grep -q "Aggregate Boundary Conflict returns to \`domain-modeling\`" "$implement_skill" || fail "$label implement should route aggregate boundary conflicts upstream"
  grep -q "Implementation transaction shape is not Repository design evidence" "$implement_skill" || fail "$label implement should reject persistence transaction evidence"
  ! grep -q "documented transaction exception" "$implement_skill" || fail "$label implement should not list documented transaction exception as a collaboration model"
}

check_implement_skill "$CLAUDE_ROOT/skills/implement/SKILL.md" "Claude"
check_implement_skill "$CODEX_ROOT/skills/implement/SKILL.md" "Codex"

check_review_evidence_gate() {
  local review_skill="$1"
  local label="$2"

  line_count=$(wc -l <"$review_skill")
  [ "$line_count" -le 105 ] || fail "$label review skill should stay concise"
  grep -q "Expected model sources" "$review_skill" || fail "$label review should reconstruct expected model from upstream outputs"
  grep -q "model evidence" "$review_skill" || fail "$label review should reconstruct model evidence"
  grep -q "Domain Modeling Brief" "$review_skill" || fail "$label review should read Domain Modeling Brief"
  grep -q "Implementation handoff" "$review_skill" || fail "$label review should read implementation handoff"
  grep -q "Evidence gate" "$review_skill" || fail "$label review skill should define an evidence gate"
  grep -q "Rules Satisfied / Not Applicable / Return to domain-modeling / Evidence gap" "$review_skill" || fail "$label review output should route modeling exceptions upstream"
  grep -q "Evidence gap, not finding" "$review_skill" || fail "$label review skill should separate evidence gaps from findings"
  grep -q "Checked flows" "$review_skill" || fail "$label review should expose checked lifecycle flows"
  grep -q "Tactical drift reading" "$review_skill" || fail "$label review should read tactical drift as model pressure"
  grep -q "Default-first key concept check" "$review_skill" || fail "$label review should use default-first key concept checks"
  grep -q "collaboration model" "$review_skill" || fail "$label review should reconstruct collaboration model"
  grep -q "business facts before code shape" "$review_skill" || fail "$label review should reason from business facts before code shape"
  grep -q "upstream model" "$review_skill" || fail "$label review should identify upstream model pressure before cleanup"
  grep -q "pressure before suggesting cleanup" "$review_skill" || fail "$label review should identify model pressure before cleanup"
  grep -q "semantic repository methods are evidence, not proof" "$review_skill" || fail "$label review should not accept semantic repository method names as proof"
  grep -q "Aggregate Boundary Conflict" "$review_skill" || fail "$label review should name aggregate boundary conflict as the symptom"
  grep -q "Return to domain-modeling cannot be classified as Rules Satisfied" "$review_skill" || fail "$label review should not mark modeling returns as satisfied"
  grep -q "Local convention is evidence to" "$review_skill" || fail "$label review should not treat local convention as a waiver"
  grep -q "inspect, not a waiver" "$review_skill" || fail "$label review should inspect local convention instead of waiving"
  grep -q "Do not reduce finding count" "$review_skill" || fail "$label review should not suppress findings for template cost"
  grep -q "Model correction" "$review_skill" || fail "$label review should put model correction before mechanism"
  grep -q "Implementation mechanism" "$review_skill" || fail "$label review should separate implementation mechanism"
  grep -q "Evidence needed" "$review_skill" || fail "$label review should use evidence-needed for gaps"
  grep -q "Test / verification needed" "$review_skill" || fail "$label review should use verification-needed for test gaps"
  grep -q "Lead with findings" "$review_skill" || fail "$label review should lead with findings"
  grep -q "No DDD findings" "$review_skill" || fail "$label review should define no-finding output"
}

check_review_evidence_gate "$CLAUDE_ROOT/skills/review/SKILL.md" "Claude"
check_review_evidence_gate "$CODEX_ROOT/skills/review/SKILL.md" "Codex"

check_risk_router_reference() {
  local root="$1"
  local label="$2"
  local router="$root/references/ddd-risk-router.md"

  grep -q "Awkward tactical structures are evidence, not diagnosis" "$router" || fail "$label risk router should treat tactical structures as evidence"
  grep -q "upstream model pressure" "$router" || fail "$label risk router should route tactical drift through model pressure"
  grep -q "CQRS/read-model split" "$router" || fail "$label risk router should include CQRS pressure without a dedicated rule card"
  grep -q "Aggregate Boundary Conflict" "$router" || fail "$label risk router should route aggregate boundary conflicts"
  grep -q "semantic repository methods are evidence, not proof" "$router" || fail "$label risk router should reject semantic repository names as proof"
  grep -q "Default rule" "$router" || fail "$label risk router should lead with default rules"
  grep -q "Default-first concept discipline" "$router" || fail "$label risk router should define default-first concept discipline"
  grep -q "Return to domain-modeling" "$router" || fail "$label risk router should return boundary conflicts to domain-modeling"
  grep -q "implementation transaction evidence is not model evidence" "$router" || fail "$label risk router should reject implementation transaction evidence"
  grep -q "cannot be marked Rules Satisfied" "$router" || fail "$label risk router should not mark modeling returns satisfied"
  ! grep -q "Allowed exception" "$router" || fail "$label risk router should not frame risk cards around allowed exceptions"
}

check_risk_router_reference "$CLAUDE_ROOT" "Claude"
check_risk_router_reference "$CODEX_ROOT" "Codex"

check_core_default_first_reference() {
  local root="$1"
  local label="$2"
  local core="$root/references/ddd-core.md"

  grep -q "Default-First Concept Map" "$core" || fail "$label core should define a default-first concept map"
  grep -q "Aggregate default" "$core" || fail "$label core should state aggregate default"
  grep -q "Repository default" "$core" || fail "$label core should state repository default"
  grep -q "Domain Event default" "$core" || fail "$label core should state domain event default"
  grep -q "Integration Message default" "$core" || fail "$label core should state integration message default"
  grep -q "Application Port default" "$core" || fail "$label core should state application port default"
  grep -q "CQRS default" "$core" || fail "$label core should state CQRS default"
  grep -q "Bounded Context default" "$core" || fail "$label core should state bounded context default"
  grep -q "Aggregate Boundary Conflict" "$core" || fail "$label core should name aggregate boundary conflict"
  grep -q "Implementation transaction shape is not Repository design evidence" "$core" || fail "$label core should reject transaction shape as repository design evidence"
  grep -q "Exception pressure returns to domain-modeling" "$core" || fail "$label core should route exception pressure to domain-modeling"
}

check_core_default_first_reference "$CLAUDE_ROOT" "Claude"
check_core_default_first_reference "$CODEX_ROOT" "Codex"

if rg -n "multi-aggregate|High-risk deviation|High-risk Deviation|transaction exception|documented transaction exception|exception gate|multi-object Save|Multi-Object Repository Save" "$CLAUDE_ROOT/skills" "$CLAUDE_ROOT/references" "$CODEX_ROOT/skills" "$CODEX_ROOT/references" >/dev/null; then
  rg -n "multi-aggregate|High-risk deviation|High-risk Deviation|transaction exception|documented transaction exception|exception gate|multi-object Save|Multi-Object Repository Save" "$CLAUDE_ROOT/skills" "$CLAUDE_ROOT/references" "$CODEX_ROOT/skills" "$CODEX_ROOT/references" >&2
  fail "ddd-expert should route boundary conflicts to domain-modeling instead of naming exception mechanisms"
fi

for reference in \
  database.md \
  ddd-agent-contract.md \
  ddd-core.md \
  ddd-golang-application.md \
  ddd-golang-cqrs.md \
  ddd-golang-domain.md \
  ddd-golang-events-messages.md \
  ddd-golang-infrastructure.md \
  ddd-golang-runtime.md \
  ddd-golang-scaffold.md \
  ddd-golang-taskqueue.md \
  ddd-golang.md \
  ddd-modeling-gates.md \
  ddd-modeling.md \
  ddd-python.md \
  ddd-risk-router.md \
  ddd-typescript.md
do
  [ -f "$CLAUDE_ROOT/references/$reference" ] || fail "Claude ddd-expert missing reference $reference"
  [ -f "$CODEX_ROOT/references/$reference" ] || fail "Codex ddd-expert missing reference $reference"
done

check_modeling_gates_reference() {
  local root="$1"
  local label="$2"
  local gates="$root/references/ddd-modeling-gates.md"

  grep -q "Story Before Nouns" "$gates" || fail "$label modeling gates missing Story Before Nouns"
  grep -q "Event Timeline Before Objects" "$gates" || fail "$label modeling gates missing Event Timeline Before Objects"
  grep -q "Authority Before Ownership" "$gates" || fail "$label modeling gates missing Authority Before Ownership"
  grep -q "Lifecycle Before Type" "$gates" || fail "$label modeling gates missing Lifecycle Before Type"
  grep -q "Invariant Before Aggregate" "$gates" || fail "$label modeling gates missing Invariant Before Aggregate"
  grep -q "Failure Tolerance Before Transaction" "$gates" || fail "$label modeling gates missing Failure Tolerance Before Transaction"
  grep -q "Language Before Integration" "$gates" || fail "$label modeling gates missing Language Before Integration"
  grep -q "Coordination Before Abstraction" "$gates" || fail "$label modeling gates missing Coordination Before Abstraction"

  grep -q "Forward-Test Principles" "$gates" || fail "$label modeling gates should define forward-test principles"
  grep -q "Avoid project-specific scenario names" "$gates" || fail "$label modeling gates should avoid project-specific scenario names in hot path"
  grep -q "transaction shape a peer of model correction" "$gates" || fail "$label modeling gates should prevent transaction-first fixes"
  grep -q "semantic repository transaction as a peer alternative" "$gates" || fail "$label modeling gates should reject repository-transaction peer alternatives"
  grep -q "Default path is one aggregate per command" "$gates" || fail "$label modeling gates should lead multi-object coordination with the default path"
  grep -q "boundary conflict returns to domain-modeling" "$gates" || fail "$label modeling gates should route boundary conflicts back into modeling"
}

check_modeling_gates_reference "$CLAUDE_ROOT" "Claude"
check_modeling_gates_reference "$CODEX_ROOT" "Codex"
cmp -s "$CLAUDE_ROOT/references/ddd-modeling-gates.md" "$CODEX_ROOT/references/ddd-modeling-gates.md" || fail "ddd-modeling-gates should be identical across plugin tracks"

grep -q "implementation/review risk router" "$CLAUDE_ROOT/references/ddd-risk-router.md" || fail "Claude risk router should state implementation/review role"
grep -q "implementation/review risk router" "$CODEX_ROOT/references/ddd-risk-router.md" || fail "Codex risk router should state implementation/review role"
grep -q "ddd-modeling-gates.md" "$CLAUDE_ROOT/references/ddd-risk-router.md" || fail "Claude risk router should route modeling ambiguity to modeling gates"
grep -q "ddd-modeling-gates.md" "$CODEX_ROOT/references/ddd-risk-router.md" || fail "Codex risk router should route modeling ambiguity to modeling gates"
grep -q "FSM state polymorphism bypass" "$CLAUDE_ROOT/references/ddd-agent-contract.md" || fail "Claude agent contract should reject FSM state polymorphism bypass"
grep -q "FSM state polymorphism bypass" "$CODEX_ROOT/references/ddd-agent-contract.md" || fail "Codex agent contract should reject FSM state polymorphism bypass"

check_go_reference_reorg() {
  local root="$1"
  local label="$2"

  grep -q "Go / go-jimu Reference Router" "$root/references/ddd-golang.md" || fail "$label Go guide should be a reference router"
  grep -q "Layer Reference Map" "$root/references/ddd-golang.md" || fail "$label Go guide should include a layer reference map"
  grep -q "ddd-golang-domain.md" "$root/references/ddd-golang.md" || fail "$label Go router should point to domain reference"
  grep -q "ddd-golang-application.md" "$root/references/ddd-golang.md" || fail "$label Go router should point to application reference"
  grep -q "ddd-golang-infrastructure.md" "$root/references/ddd-golang.md" || fail "$label Go router should point to infrastructure reference"
  grep -q "ddd-golang-cqrs.md" "$root/references/ddd-golang.md" || fail "$label Go router should point to CQRS reference"
  grep -q "ddd-golang-scaffold.md" "$root/references/ddd-golang.md" || fail "$label Go router should point to scaffold reference"

  grep -q "## 0. Go / go-jimu Domain Building Block Lookup" "$root/references/ddd-golang-domain.md" || fail "$label Go domain reference should include building block lookup"
  grep -q "### 0.1 Aggregate Root Card" "$root/references/ddd-golang-domain.md" || fail "$label Go domain reference should include aggregate root card"
  grep -q "### 0.4 Repository Interface Card" "$root/references/ddd-golang-domain.md" || fail "$label Go domain reference should include repository interface card"
  grep -q "Save(ctx, aggregate) is one mutable Aggregate Root" "$root/references/ddd-golang-domain.md" || fail "$label Go domain repository should reject multi-aggregate Save methods"
  grep -q "semantic repository method name is not proof" "$root/references/ddd-golang-domain.md" || fail "$label Go domain repository should not accept semantic Save method names as proof"
  grep -q "Aggregate Boundary Conflict" "$root/references/ddd-golang-domain.md" || fail "$label Go domain repository should name aggregate boundary conflict"
  grep -q "Implementation transaction shape is not Repository design evidence" "$root/references/ddd-golang-domain.md" || fail "$label Go domain repository should reject transaction evidence"
  grep -q "Prefer one aggregate boundary or Domain Event" "$root/references/ddd-golang-domain.md" || fail "$label Go domain repository should prefer aggregate redesign or domain events"
  grep -q "Read-only product models belong to QueryRepository/read facade" "$root/references/ddd-golang-domain.md" || fail "$label Go domain repository should route product reads to CQRS"
  grep -q "State Pattern + transition table" "$root/references/ddd-golang-domain.md" || fail "$label Go FSM reference should teach state polymorphism"
  grep -q "State-specific behavior lives in polymorphic State methods" "$root/references/ddd-golang-domain.md" || fail "$label Go FSM reference should put behavior in state methods"
  grep -q "Aggregate business method delegates to current State" "$root/references/ddd-golang-domain.md" || fail "$label Go FSM reference should route aggregate methods through current state"
  grep -q "SetState(next fsm.State)" "$root/references/ddd-golang-domain.md" || fail "$label Go FSM reference should use v0.10 StateContext SetState"
  grep -q "fsm.Transit" "$root/references/ddd-golang-domain.md" || fail "$label Go FSM reference should use v0.10 Transit"
  grep -q "StateMachine.Transitions" "$root/references/ddd-golang-domain.md" || fail "$label Go FSM reference should mention v0.10 transition edges"
  grep -q "Do not reimplement Transit" "$root/references/ddd-golang-domain.md" || fail "$label Go FSM reference should avoid custom transition loops"
  grep -q "same business method behaves differently across states" "$root/references/ddd-golang-domain.md" || fail "$label Go FSM reference should require polymorphic state behavior tests"
  ! grep -q "TransitionTo is an FSM callback" "$root/references/ddd-golang-domain.md" || fail "$label Go FSM reference should not teach pre-v0.10 TransitionTo callback"

  grep -q "## 0. Go / go-jimu Application Building Block Lookup" "$root/references/ddd-golang-application.md" || fail "$label Go application reference should include building block lookup"
  grep -q "### 0.1 Command Handler Card" "$root/references/ddd-golang-application.md" || fail "$label Go application reference should include command handler card"

  grep -q "## 0. Go / go-jimu Infrastructure Building Block Lookup" "$root/references/ddd-golang-infrastructure.md" || fail "$label Go infrastructure reference should include building block lookup"
  grep -q "### 0.1 Repository Implementation / DO / Converter Card" "$root/references/ddd-golang-infrastructure.md" || fail "$label Go infrastructure reference should include repository implementation card"

  grep -q "## 0. Go / go-jimu CQRS Building Block Lookup" "$root/references/ddd-golang-cqrs.md" || fail "$label Go CQRS reference should include building block lookup"
  grep -q "### 0.1 QueryRepository Card" "$root/references/ddd-golang-cqrs.md" || fail "$label Go CQRS reference should include QueryRepository card"
  grep -q "mixed read/write repository is CQRS split pressure" "$root/references/ddd-golang-cqrs.md" || fail "$label Go CQRS reference should flag mixed read/write repositories"
  grep -q "not one interface per query method" "$root/references/ddd-golang-cqrs.md" || fail "$label Go CQRS reference should avoid one-query-one-interface splits"

  grep -q "## 0. Go / go-jimu Scaffold Building Block Lookup" "$root/references/ddd-golang-scaffold.md" || fail "$label Go scaffold reference should include building block lookup"
  grep -q "### 0.1 Project Layout Card" "$root/references/ddd-golang-scaffold.md" || fail "$label Go scaffold reference should include project layout card"
  grep -q "ddd-golang-events-messages.md §0.1" "$root/references/ddd-golang.md" || fail "$label Go router should route Domain Event type to event card"
  grep -q "ddd-golang-events-messages.md §0.2" "$root/references/ddd-golang.md" || fail "$label Go router should route event collection to event card"
  grep -q "ddd-golang-events-messages.md §0.3" "$root/references/ddd-golang.md" || fail "$label Go router should route Domain Event Handler to event card"
  grep -q "ddd-golang-events-messages.md §0.4" "$root/references/ddd-golang.md" || fail "$label Go router should route Boundary Publisher to event card"
  grep -q "ddd-golang-events-messages.md §0.5" "$root/references/ddd-golang.md" || fail "$label Go router should route Integration Message Handler to event card"
  grep -q "ddd-golang-application.md §0.7" "$root/references/ddd-golang.md" || fail "$label Go router should route generated RPC to Go application card"
  grep -q "ddd-golang-scaffold.md §0.4" "$root/references/ddd-golang.md" || fail "$label Go router should route generated RPC layout to Go scaffold card"

  if grep -R -n -E 'ddd-golang\.md[^`]*§[0-9]|golang §[0-9]' "$root/references" "$root/skills" >/dev/null; then
    grep -R -n -E 'ddd-golang\.md[^`]*§[0-9]|golang §[0-9]' "$root/references" "$root/skills" >&2
    fail "$label ddd-expert should not reference obsolete ddd-golang section anchors"
  fi
}

check_go_reference_reorg "$CLAUDE_ROOT" "Claude"
check_go_reference_reorg "$CODEX_ROOT" "Codex"

# The standalone plugin should not route users back to the retired Superpowers
# DDD plugin.
if grep -R -n -i 'superpowers-ddd-architect' "$CLAUDE_ROOT" "$CODEX_ROOT" >/dev/null; then
  grep -R -n -i 'superpowers-ddd-architect' "$CLAUDE_ROOT" "$CODEX_ROOT" >&2
  fail "ddd-expert should not reference retired superpowers-ddd-architect"
fi

grep -Fq "/plugin install ddd-expert@skill-workshop" "$ROOT/README.md" || fail "root README missing Claude ddd-expert install command"
grep -Fq "codex plugin add ddd-expert@skill-workshop-codex" "$ROOT/README.md" || fail "root README missing Codex ddd-expert install command"
grep -Fq "domain-modeling" "$ROOT/README.md" || fail "root README should list ddd-expert domain-modeling capability"

echo "  ddd-expert plugin: standalone routing-hook contract correct"
