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

section_line_count() {
  local file="$1"
  local start="$2"
  local end="$3"

  awk -v start="$start" -v end="$end" '
    $0 == start { in_section = 1; next }
    $0 == end { in_section = 0 }
    in_section && $0 !~ /^[[:space:]]*$/ { count++ }
    END { print count + 0 }
  ' "$file"
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
done
! find "$CLAUDE_ROOT/references" "$CODEX_ROOT/references" -name 'ddd-risk-router.md' | grep -q . || fail "ddd-expert should not ship ddd-risk-router reference"
! rg -ni "ddd-risk-router|risk[- ]?router|risk[- ]?card" "$CLAUDE_ROOT" "$CODEX_ROOT" >/dev/null || fail "ddd-expert should not route through risk-router or risk-card terminology"

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
  grep -q "Normal-shape concepts" "$design_skill" || fail "$label design should state normal-shape concepts before deviations"
  grep -q "Implementation handoff" "$design_skill" || fail "$label design should emit an implementation handoff"
  grep -q "Accepted model source" "$design_skill" || fail "$label design handoff should name accepted model source"
  grep -q "Layer ownership" "$design_skill" || fail "$label design handoff should decide layer ownership"
  grep -q "collaboration model before mechanism" "$design_skill" || fail "$label design should decide collaboration model before mechanism"
  grep -q "If any handoff item is material to implementation and unknown, Stop" "$design_skill" || fail "$label design should stop instead of leaving implement to guess"
  grep -q "Aggregate Boundary Conflict returns to \`domain-modeling\`" "$design_skill" || fail "$label design should route aggregate boundary conflicts to domain-modeling"
  grep -q "Return to domain-modeling for missing model facts" "$design_skill" || fail "$label design should route missing model facts to domain-modeling"
  grep -q "Return to design for placement or mechanism decisions" "$design_skill" || fail "$label design should keep placement/mechanism decisions in design"
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
  grep -q "Normal-shape concepts" "$implement_skill" || fail "$label implement should use normal-shape concepts before deviations"
  grep -q "Surface preflight" "$implement_skill" || fail "$label implement should classify touched surfaces"
  grep -q "collaboration model" "$implement_skill" || fail "$label implement should require accepted collaboration model"
  grep -q "Rules Satisfied / Not Applicable / Return to domain-modeling / Return to design" "$implement_skill" || fail "$label implement output should route modeling/design exceptions upstream"
  grep -q "Changed files by layer" "$implement_skill" || fail "$label implement should report changed files by layer"
  grep -q "Tests / verification" "$implement_skill" || fail "$label implement should report verification"
  grep -q "return to \`domain-modeling\`" "$implement_skill" || fail "$label implement should return missing business facts upstream"
  grep -q "return to \`design\`" "$implement_skill" || fail "$label implement should return missing placement upstream"
  grep -q "review finding includes \`Model correction\`" "$implement_skill" || fail "$label implement should recognize review model corrections"
  grep -q "already accepted by the user or design handoff" "$implement_skill" || fail "$label implement should not apply model corrections without accepted design"
  grep -q "Aggregate Boundary Conflict returns to \`domain-modeling\`" "$implement_skill" || fail "$label implement should route aggregate boundary conflicts upstream"
  grep -q "Return to domain-modeling for aggregate boundary, lifecycle, invariant, fact language, or bounded-context uncertainty" "$implement_skill" || fail "$label implement should route unresolved model facts upstream"
  grep -q "Return to design for layer ownership, CQRS split, port placement, adapter boundary, or repository API shape after the model is accepted" "$implement_skill" || fail "$label implement should route unresolved tactical placement upstream"
  grep -q "Implementation transaction shape is not Repository design evidence" "$implement_skill" || fail "$label implement should reject persistence transaction evidence"
  ! grep -q "documented transaction exception" "$implement_skill" || fail "$label implement should not list documented transaction exception as a collaboration model"
}

check_implement_skill "$CLAUDE_ROOT/skills/implement/SKILL.md" "Claude"
check_implement_skill "$CODEX_ROOT/skills/implement/SKILL.md" "Codex"

check_review_evidence_gate() {
  local review_skill="$1"
  local label="$2"
  local line_count
  local output_lines

  line_count=$(wc -l < "$review_skill")
  [ "$line_count" -le 280 ] || fail "$label review should keep merged review guidance concise"
  output_lines=$(section_line_count "$review_skill" "## Output" "Severity is about architectural impact")
  [ "$output_lines" -le 25 ] || fail "$label review output should stay concise and avoid field-heavy templates"

  grep -q "Expected model sources" "$review_skill" || fail "$label review should reconstruct expected model from upstream outputs"
  grep -q "model evidence" "$review_skill" || fail "$label review should reconstruct model evidence"
  grep -q "Domain Modeling Brief" "$review_skill" || fail "$label review should read Domain Modeling Brief"
  grep -q "Implementation handoff" "$review_skill" || fail "$label review should read implementation handoff"
  grep -q "Evidence gate" "$review_skill" || fail "$label review skill should define an evidence gate"
  grep -q "First read \\[../../references/ddd-core.md\\]" "$review_skill" || fail "$label review should load core baseline directly"
  grep -q "This skill owns the workflow and layer baseline" "$review_skill" || fail "$label review should own workflow and layer baseline"
  ! grep -q "ddd-review-smell-protocol.md" "$review_skill" || fail "$label review should not depend on a separate smell protocol reference"
  ! rg -ni "risk[- ]?router|risk[- ]?card|Risk-Card" "$review_skill" >/dev/null || fail "$label review should not contain risk-router/risk-card vocabulary"
  grep -q "Build/runtime blockers only block executable verification" "$review_skill" || fail "$label review should not let build blockers stop static model review"
  grep -q "independent static model review still runs" "$review_skill" || fail "$label review should require an independent static modeling pass"
  grep -q "Compile blockers are never positive model signals" "$review_skill" || fail "$label review should reject compile blockers as positive model evidence"
  grep -q "absence of forbidden nouns is not model proof" "$review_skill" || fail "$label review should reject absence-of-nouns as model proof"
  grep -q "command -> past-tense fact -> invariant owner -> reaction/process -> failure tolerance -> implementation mechanism" "$review_skill" || fail "$label review should prescribe fact-first review order"
  grep -q "Compare touched code against the layer baseline" "$review_skill" || fail "$label review should use layer-baseline shape checks"
  grep -q "Use references only to explain triggered smells, not to enumerate findings" "$review_skill" || fail "$label review should not enumerate findings from references"
  grep -q "Missing proof is an evidence gap unless concrete evidence proves a violation" "$review_skill" || fail "$label review skill should separate evidence gaps from findings"
  grep -q "Object splitting, package names, generated DTO mapping, and QueryRepository presence are not enough to clear a triggered smell family" "$review_skill" || fail "$label review should not clear triggered families from structural presence alone"
  grep -q "Scope narrows files to inspect; it does not remove required lifecycle/repository/event/CQRS family rows" "$review_skill" || fail "$label review should not narrow away required family rows by scope"

  ! grep -q "Triggered axes become depth tasks" "$review_skill" || fail "$label review should not delegate by broad triggered axes"
  ! grep -q "Mandatory-axis completion preflight" "$review_skill" || fail "$label review should not keep mandatory-ledger preflight in hot path"
  ! grep -q "First emit the exact lifecycle sections" "$review_skill" || fail "$label review should not force exact lifecycle sections in hot path"
  ! grep -q "Checked row admission control" "$review_skill" || fail "$label review should not expose checked-row admission control in hot path"
  ! grep -q "Smell Queue appendix is mandatory before Findings" "$review_skill" || fail "$label review should not require smell queue appendix by default"
  ! grep -q "Smell queue" "$review_skill" || fail "$label review should use Smell List terminology, not smell queue"
  ! grep -q "Ledger appendix: <mandatory" "$review_skill" || fail "$label review should not require ledger appendix by default"
  ! grep -q "final-output ledger dump" "$review_skill" || fail "$label review should not use ledger-dump language"

  ! grep -q "## Checklist" "$review_skill" || fail "$label review should not keep a checklist that duplicates workflow"
  ! grep -q "## Review Loop" "$review_skill" || fail "$label review should not keep a separate Review Loop section"
  ! grep -q "Depth is axis-specific investigation" "$review_skill" || fail "$label review should not make axes the depth unit"
  ! grep -q "First-hop completion" "$review_skill" || fail "$label review should not keep first-hop micro-protocol wording"
  ! grep -q "Expand siblings" "$review_skill" || fail "$label review should not keep expand-siblings micro-protocol wording"
  ! grep -q "Close the list" "$review_skill" || fail "$label review should not keep close-list micro-protocol wording"
  ! grep -q "## No-Finding Admission" "$review_skill" || fail "$label review should not keep a separate no-finding protocol section"
  ! grep -q "## Review axes" "$review_skill" || fail "$label review should not keep separate review axes section"
  ! grep -q "## Fix direction ordering" "$review_skill" || fail "$label review should not keep separate fix-direction section"
  grep -q "## Workflow" "$review_skill" || fail "$label review should define workflow inline"
  grep -q "\\*\\*Breadth scan\\*\\*: compare touched code shape against the layer baseline\\. Output: Smell List rows" "$review_skill" || fail "$label review workflow should output smell rows from breadth"
  grep -q "durable-fact command admission, terminal/execution split, repository/API candidate owner, collaboration mechanism, parent state vocabulary, accepted-design waiver, and CQRS inventory" "$review_skill" || fail "$label review workflow should seed required family rows"
  grep -q "\\*\\*Merge same-shape smells\\*\\*: group rows by owner, lifecycle, boundary, state vocabulary, collaboration mechanism" "$review_skill" || fail "$label review workflow should merge same-shape smell families"
  grep -q "preserving every trigger and every required family row" "$review_skill" || fail "$label review workflow should preserve required family rows during merge"
  grep -q "\\*\\*Explain each family\\*\\*: assume the smell is wrong until" "$review_skill" || fail "$label review workflow should explain each smell family with guilty-presumption shape"
  grep -q "Output: violation, return-to-domain-modeling, return-to-design, evidence-gap, or adjacent-smell" "$review_skill" || fail "$label review workflow should output constrained verdicts"
  grep -q "\\*\\*Follow related evidence\\*\\*: for each adjacent smell, inspect the nearest sibling methods" "$review_skill" || fail "$label review workflow should follow adjacent smell evidence"
  grep -q "Output: updated Smell List with any new family rows" "$review_skill" || fail "$label review workflow should output updated smell list rows"
  grep -q "\\*\\*Synthesize root cause\\*\\*: combine family verdicts\\. Output: shared wrong model, boundary, lifecycle" "$review_skill" || fail "$label review workflow should output root synthesis"
  grep -q "\\*\\*Report\\*\\*: turn the synthesized verdicts into findings, evidence gaps / returns, non-required positive notes, verification, and residual risk\\. Output: final review judgment that places every triggered required family row under Findings or Evidence gaps / returns" "$review_skill" || fail "$label review workflow should output final review judgment"
  grep -Fxq "Smell explanation stays local by default. Use subagents only when the user explicitly asks." "$review_skill" || fail "$label review should make subagents explicit opt-in"
  ! grep -q "or a smell family is independently large" "$review_skill" || fail "$label review should not add an implicit subagent escape hatch"

  grep -q "## Layer Baseline" "$review_skill" || fail "$label review should define layer baseline"
  grep -q "which required shapes are missing, and which forbidden shapes appear" "$review_skill" || fail "$label review should derive smells from missing-required and present-forbidden shapes"
  grep -q "### Domain Layer" "$review_skill" || fail "$label review should define domain layer shape"
  grep -q "### Application Layer" "$review_skill" || fail "$label review should define application layer shape"
  grep -q "### Infrastructure Layer" "$review_skill" || fail "$label review should define infrastructure layer shape"
  grep -q "### Interface Layer" "$review_skill" || fail "$label review should define interface layer shape"
  grep -q "### Runtime Layer" "$review_skill" || fail "$label review should define runtime layer shape"
  grep -q "Required shape:" "$review_skill" || fail "$label review should define required shape lists"
  grep -q "Forbidden shape:" "$review_skill" || fail "$label review should define forbidden shape lists"
  grep -q "Domain owns business facts, invariants, lifecycle states, transitions, policies, Domain errors, and Domain Events" "$review_skill" || fail "$label review should require domain business ownership"
  grep -q "Aggregate Roots are the sole write entrypoint for their invariant boundary" "$review_skill" || fail "$label review should require aggregate write entrypoint shape"
  grep -q "Write Repository interfaces represent one Aggregate Root collection and normally expose only \`Get\` and \`Save\`" "$review_skill" || fail "$label review should require repository Get/Save shape"
  grep -q "Domain must not persist, dispatch, publish, enqueue, start goroutines, read config, or log" "$review_skill" || fail "$label review should reject domain side effects"
  grep -q "Application accepts command/query DTOs and returns DTOs" "$review_skill" || fail "$label review should require application DTO boundaries"
  grep -q "Application drains and dispatches Domain Events exactly once after successful persistence" "$review_skill" || fail "$label review should require application event dispatch timing"
  grep -q "Application emits one completion log when it is the active execution boundary" "$review_skill" || fail "$label review should require application completion logging"
  grep -q "Application must not implement business rules by branching on Aggregate or Entity state" "$review_skill" || fail "$label review should reject application business state branching"
  grep -q "Application must not rely on one transaction across several independent Aggregate Roots" "$review_skill" || fail "$label review should reject cross-aggregate same-transaction correctness"
  grep -q "Infrastructure implements Domain Repositories, Application QueryRepositories/read facades" "$review_skill" || fail "$label review should require infrastructure adapter ownership"
  grep -q "Infrastructure must not own business decisions, invariants, lifecycle admission, or state transition authority" "$review_skill" || fail "$label review should reject infrastructure-owned business decisions"
  grep -q "Interface delegates once to an Application command/query handler or thin read shortcut" "$review_skill" || fail "$label review should require thin interface delegation"
  grep -q "Runtime loads configuration, supplies component options, assembles modules, registers routes/subscribers/processors/schedules" "$review_skill" || fail "$label review should require runtime wiring shape"
  grep -q "Hidden manual loops, schedulers, or reconcilers without task/runtime ownership are smells" "$review_skill" || fail "$label review should reject hidden runtime loops"
  grep -q "Aggregate lifecycle: one Aggregate Root owns one lifecycle and invariant boundary" "$review_skill" || fail "$label review should whitelist aggregate lifecycle shape"
  grep -q 'Repository/API: one Repository normally exposes `Get` and `Save` for one Aggregate Root plus owned children/value objects' "$review_skill" || fail "$label review should whitelist repository Get/Save shape"
  grep -q "Cross-aggregate coordination: independent Aggregate Roots do not need the same transaction for business correctness" "$review_skill" || fail "$label review should reject cross-aggregate same-transaction correctness"
  grep -q "Durable-fact command admission: when a durable child fact can precede parent state reflection" "$review_skill" || fail "$label review should inspect durable fact command admission"
  grep -q "recovery reachability alone does not clear admission" "$review_skill" || fail "$label review should not let recovery clear command admission"
  grep -q "CQRS: write repositories serve command-side aggregate facts" "$review_skill" || fail "$label review should whitelist CQRS shape"
  grep -q "Required family rows: payment/delivery/refund/dispute/settlement scope keeps durable-fact command admission" "$review_skill" || fail "$label review should require separate family rows for lifecycle scopes"
  grep -q "Repository/API inventory: inspect Domain Repository interfaces, Application repository calls, Infrastructure store methods" "$review_skill" || fail "$label review should require repository/API inventory rows"
  grep -Fq 'classify each extra `List*`, read-shaped, semantic, or coordinated-object method' "$review_skill" || fail "$label review should classify List/read-shaped repository methods"
  grep -q "Accepted-design waiver inventory: when spec/design/local convention accepts semantic repository transactions" "$review_skill" || fail "$label review should require accepted-design waiver inventory"
  grep -q "CQRS inventory: inspect write repositories and shared adapters for list/detail/history/summary/read-shaped methods before clearing CQRS shape" "$review_skill" || fail "$label review should require CQRS inventory rows"
  grep -q "Payment parent-state vocabulary: when Payment exists beside TaskAgreement payment states" "$review_skill" || fail "$label review should require payment parent-state vocabulary rows"
  grep -q "Final answer is concise" "$review_skill" || fail "$label review output should be explicitly concise"
  grep -q "Do not print the full working-evidence set by default" "$review_skill" || fail "$label review output should not print every working evidence row by default"
  grep -q "complete and merge smell verdicts before the final answer" "$review_skill" || fail "$label review should complete smell verdicts before final output"
  grep -q "Working evidence stays internal unless it is needed to understand a judgment" "$review_skill" || fail "$label review should keep working evidence internal by default"
  grep -q "Required family-row verdicts are not working evidence and cannot stay internal" "$review_skill" || fail "$label review should not keep required verdicts internal"
  grep -q "If a smell family cannot be explained from available evidence, report an evidence gap, not a positive claim" "$review_skill" || fail "$label review should not claim unresolved smell families as positive"
  ! grep -q "A missing depth decision" "$review_skill" || fail "$label review should not use old depth-decision wording"
  grep -q "cite triggered required family rows only in Findings or Evidence gaps / returns" "$review_skill" || fail "$label review should cite required family rows only in decisions"
  grep -q "Every triggered required family row and every explained smell-family verdict lands in Findings or Evidence gaps / returns" "$review_skill" || fail "$label review should not drop required family rows"
  grep -q "Positive, coverage, and residual notes are only for surfaces that were not smell rows" "$review_skill" || fail "$label review should keep smell rows out of positive notes"
  grep -q "Do not suppress findings for template cost" "$review_skill" || fail "$label review should not suppress findings for template cost"
  grep -q "Do not collapse production wiring, durable-fact command admission, collaboration mechanism, candidate-owner, state vocabulary, or CQRS method-inventory decisions into a broader claim" "$review_skill" || fail "$label review should not hide smell-family decisions behind broader findings"
  grep -q "If a required row was inspected, name its verdict family in the final answer even when detailed evidence stays internal" "$review_skill" || fail "$label review should final-output inspected required row verdicts"
  grep -q "Report in this order when present: scope/model evidence, findings, evidence gaps / returns, positive notes for non-smell surfaces, verification, residual risk" "$review_skill" || fail "$label review output should define concise report order"
  ! grep -q "depth execution" "$review_skill" || fail "$label review output should not use old depth-execution wording"
  grep -q "No-finding, coverage, positive, and residual notes are only for surfaces outside required family rows" "$review_skill" || fail "$label review output should keep required rows out of no-finding notes"
  grep -q "Required family rows never go to No-Finding Notes or Coverage Notes" "$review_skill" || fail "$label review output should forbid required row no-finding notes"
  grep -q "Repository/API smells need method inventory and candidate-owner classification" "$review_skill" || fail "$label review output should require repository candidate-owner inventory before no-finding"
  grep -q "accepted-design waiver smells need explicit model ownership and failure-tolerance evidence" "$review_skill" || fail "$label review output should require accepted-design waiver evidence before no-finding"
  grep -q "collaboration smells need named event/process/recovery mechanism" "$review_skill" || fail "$label review output should require collaboration mechanism before no-finding"
  grep -q "terminal/execution smells need separate execution and closure facts" "$review_skill" || fail "$label review output should require terminal/execution separation before no-finding"
  grep -q "parent-state vocabulary smells need parent lifecycle fact language" "$review_skill" || fail "$label review output should require parent-state vocabulary proof before no-finding"
  grep -q "CQRS smells need write-repository and shared-adapter read/write method inventory" "$review_skill" || fail "$label review output should require CQRS method inventory before no-finding"
  grep -q "If the positive proof is only package names, object splitting, accepted design, DTO presence, QueryRepository presence, command-side fact lookup, or passing tests, report an evidence gap" "$review_skill" || fail "$label review output should downgrade weak no-finding proof to evidence gap"
  ! grep -q "Keep small reviews small" "$review_skill" || fail "$label review should not keep small-review escape hatch for lifecycle output"
  ! grep -q "Finding: <severity>" "$review_skill" || fail "$label review should not force a heavy finding template"
  ! grep -q "Axis coverage: Axis" "$review_skill" || fail "$label review should not force axis coverage table"
  ! grep -q "Selected working evidence:" "$review_skill" || fail "$label review should not force selected evidence section"
  grep -q "Post-review calibration" "$review_skill" || fail "$label review should support post-review calibration against known issue sets"
  grep -q "known issue or scoring set" "$review_skill" || fail "$label review should accept known issue sets after the initial conclusion"
  grep -q "reflect why each issue was missed or shallowly found" "$review_skill" || fail "$label review should reflect on missed findings after scoring feedback"
  grep -q "collaboration model" "$review_skill" || fail "$label review should reconstruct collaboration model"
  ! grep -q "Default-first key concept check" "$review_skill" || fail "$label review should not keep default-first separate from baseline"
  grep -q "Accepted design and local convention are evidence to inspect, not waivers" "$review_skill" || fail "$label review should reject accepted design/local convention as waivers"
  grep -q "Implementation transaction shape is not model evidence and cannot satisfy Repository design" "$review_skill" || fail "$label review should reject transaction-shaped repository satisfaction"
  grep -q "No DDD findings: say that directly only when no concrete violation/return was found" "$review_skill" || fail "$label review should define no-finding output"
}

check_review_evidence_gate "$CLAUDE_ROOT/skills/review/SKILL.md" "Claude"
check_review_evidence_gate "$CODEX_ROOT/skills/review/SKILL.md" "Codex"

check_core_normal_shape_reference() {
  local root="$1"
  local label="$2"
  local core="$root/references/ddd-core.md"

  grep -q "Normal Shape Map" "$core" || fail "$label core should define a normal shape map"
  grep -q "Aggregate: one Aggregate owns one consistency boundary" "$core" || fail "$label core should state aggregate normal shape"
  grep -q "Repository: one Repository is a collection for one write-side Aggregate Root" "$core" || fail "$label core should state repository normal shape"
  grep -q 'Repository: one Repository is a collection for one write-side Aggregate Root, normally with only `Get` and `Save`' "$core" || fail "$label core should default Repository APIs to Get/Save"
  grep -q "Independent Aggregate Roots must not require the same transaction for business correctness" "$core" || fail "$label core should reject cross-aggregate same-transaction correctness"
  grep -q "Domain Event: same bounded-context" "$core" || fail "$label core should state domain event normal shape"
  grep -q "Integration Message: stable cross-context contract" "$core" || fail "$label core should state integration message normal shape"
  grep -q "Application Port: QueryRepository/read facade" "$core" || fail "$label core should state application port normal shape"
  grep -q "CQRS: commands mutate Domain aggregates" "$core" || fail "$label core should state CQRS normal shape"
  grep -q "Bounded Context: product language, authority, lifecycle" "$core" || fail "$label core should state bounded context normal shape"
  grep -q "Aggregate Boundary Conflict" "$core" || fail "$label core should name aggregate boundary conflict"
  grep -q "Return Routing" "$core" || fail "$label core should define return routing"
  grep -q "Accepted design is evidence to inspect, not a waiver" "$core" || fail "$label core should reject accepted design as waiver"
  grep -q "Build/runtime blockers only block executable verification" "$core" || fail "$label core should keep static review after blockers"
  grep -q "Compile blockers are never positive model signals" "$core" || fail "$label core should reject compile blockers as positive model evidence"
  grep -q "Production wiring visibility matters" "$core" || fail "$label core should require production wiring visibility"
  grep -q "lacks production entrypoint or runtime registration" "$core" || fail "$label core should expose unwired recovery separately"
  grep -q 'Repository/API methods outside `Get`/`Save`' "$core" || fail "$label core should default-deny repository API smells"
  grep -q "Candidate classification asks whether each coordinated object is the same Aggregate Root" "$core" || fail "$label core should classify repository/API candidates"
  grep -q "Linked lifecycle behavior must classify its mechanism as Domain Event, process manager, reconciler, task processor, Integration Message, or evidence gap" "$core" || fail "$label core should classify collaboration mechanisms"
  grep -q "synchronous command path and command transaction are evidence, not a collaboration model" "$core" || fail "$label core should reject command transaction as collaboration model"
  grep -q "Parent state words that look like child process outcomes" "$core" || fail "$label core should inspect parent state vocabulary"
  grep -q "CQRS proof comes from caller semantics, returned model family, write-side influence, storage/adapter overlap, and read-facade ownership" "$core" || fail "$label core should require CQRS semantic evidence"
  grep -q "Terminal lifecycle facts and terminal events must be checked against required execution facts" "$core" || fail "$label core should separate terminal lifecycle and execution facts"
  grep -q "Irreversible Fact Precedence Rule" "$core" || fail "$label core should define irreversible fact precedence"
  grep -q "CQRS Read/Write Split Rule" "$core" || fail "$label core should define CQRS read/write split rule"
  grep -q "Implementation transaction shape is not Repository design evidence" "$core" || fail "$label core should reject transaction shape as repository design evidence"
  grep -q "Exception pressure returns to domain-modeling" "$core" || fail "$label core should route exception pressure to domain-modeling"

  ! grep -q "Counterfactual Review Gateway" "$core" || fail "$label core should not contain review gateway protocol"
  ! grep -q "positive-shape" "$core" || fail "$label core should not contain positive-shape proof protocol"
  ! grep -q "depth-axis" "$core" || fail "$label core should not contain depth-axis protocol"
  ! grep -q "Depth coverage matrix" "$core" || fail "$label core should not contain depth coverage matrix"
  ! grep -q "Evidence Matrix prohibition" "$core" || fail "$label core should not contain matrix proof protocol"
  ! grep -q "proof artifact" "$core" || fail "$label core should not contain proof-artifact protocol"
  ! grep -q "Family proof tuple" "$core" || fail "$label core should not contain family proof tuple protocol"
  ! grep -q "Parallel depth-axis review" "$core" || fail "$label core should not contain parallel depth-axis protocol"
  ! grep -q "not claimed cannot be a final depth decision" "$core" || fail "$label core should not contain not-claimed depth protocol"
  ! grep -q "Rules Satisfied entry" "$core" || fail "$label core should not contain final-output admission protocol"
}

check_core_normal_shape_reference "$CLAUDE_ROOT" "Claude"
check_core_normal_shape_reference "$CODEX_ROOT" "Codex"

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
  grep -q "model facts return to domain-modeling; tactical placement gaps return to design" "$gates" || fail "$label modeling gates should route model facts and placement gaps to the right phase"
  grep -q "Event Timeline Reconciliation" "$gates" || fail "$label modeling gates should reconcile event timeline to artifacts"
}

check_modeling_gates_reference "$CLAUDE_ROOT" "Claude"
check_modeling_gates_reference "$CODEX_ROOT" "Codex"
cmp -s "$CLAUDE_ROOT/references/ddd-modeling-gates.md" "$CODEX_ROOT/references/ddd-modeling-gates.md" || fail "ddd-modeling-gates should be identical across plugin tracks"

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
  grep -q "candidate classification table" "$root/references/ddd-golang-domain.md" || fail "$label Go domain repository should require candidate classification table"
  grep -q "aggregate root candidate | owned child | decision record | execution record | domain event reaction | read model" "$root/references/ddd-golang-domain.md" || fail "$label Go domain repository should classify candidate roles"
  grep -q "Repository red-flag evidence" "$root/references/ddd-golang-domain.md" || fail "$label Go domain repository should name red-flag evidence"
  grep -q "semantic repository transaction" "$root/references/ddd-golang-domain.md" || fail "$label Go domain repository should reject semantic repository transaction evidence"
  grep -q "cross-table transaction" "$root/references/ddd-golang-domain.md" || fail "$label Go domain repository should reject cross-table transaction evidence"
  grep -q "Return to design when the accepted aggregate is clear" "$root/references/ddd-golang-domain.md" || fail "$label Go domain repository should route accepted-model API shape gaps to design"
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
  grep -q "Event Timeline Reconciliation" "$root/references/ddd-golang-events-messages.md" || fail "$label Go events reference should require event timeline reconciliation"
  grep -q "spec/design fact | Domain Event type | handler/reconciler/process manager" "$root/references/ddd-golang-events-messages.md" || fail "$label Go events reference should define reconciliation columns"
  grep -q "A repository transaction is not a substitute for a missing same-BC Domain Event reaction" "$root/references/ddd-golang-events-messages.md" || fail "$label Go events reference should not let repositories replace event reactions"
  grep -q "Recovery reachability proof" "$root/references/ddd-golang-events-messages.md" || fail "$label Go events reference should require production recovery reachability proof"
  grep -q "handler/reconciler/process manager must be wired" "$root/references/ddd-golang-events-messages.md" || fail "$label Go events reference should require wired reactions"
  grep -q "handler registration alone is not recovery reachability proof" "$root/references/ddd-golang-events-messages.md" || fail "$label Go events reference should reject handler registration as recovery proof"
  grep -q "callable command is not recovery reachability proof" "$root/references/ddd-golang-events-messages.md" || fail "$label Go events reference should reject callable commands as recovery proof"
  grep -q "swallowed or logged dispatch failure after a durable fact" "$root/references/ddd-golang-events-messages.md" || fail "$label Go events reference should inspect swallowed dispatch failures after durable facts"
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
