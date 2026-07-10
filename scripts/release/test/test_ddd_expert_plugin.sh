#!/usr/bin/env bash
# Validate ddd-expert is a standalone hookless DDD/backend plugin whose skills
# are discoverable from common development workflow trigger descriptions.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLAUDE_ROOT="$ROOT/plugins/ddd-expert"
CODEX_ROOT="$ROOT/codex-plugins/ddd-expert"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

assert_references_last() {
  local file="$1"
  local label="$2"
  local last_heading
  local early_links

  last_heading="$(grep '^## ' "$file" | tail -n 1)"
  [ "$last_heading" = "## References" ] || fail "$label should keep References as its final section"
  early_links="$(awk '$0 == "## References" { exit } { print }' "$file" | rg -n '\]\(\.\./\.\./references/' || true)"
  if [ -n "$early_links" ]; then
    printf '%s\n' "$early_links" >&2
    fail "$label should not link references before the final References section"
  fi
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

# ddd-expert is hookless. Its skills must be discovered from their own common
# development workflow descriptions, not by another workflow plugin.
[ -z "$(jq -r '.hooks // empty' "$CODEX_ROOT/.codex-plugin/plugin.json")" ] || fail "Codex ddd-expert manifest should not declare hooks"
[ ! -e "$CLAUDE_ROOT/hooks" ] || fail "Claude ddd-expert should not ship hooks"
[ ! -e "$CODEX_ROOT/hooks" ] || fail "Codex ddd-expert should not ship hooks"
[ ! -e "$CODEX_ROOT/codex-hooks-snippet.json" ] || fail "Codex ddd-expert should not ship hook snippet"

if rg -n '\$?superpowers(:|-memory|-architect|-ddd-architect)|docs/superpowers' "$CLAUDE_ROOT" "$CODEX_ROOT" >/dev/null; then
  rg -n '\$?superpowers(:|-memory|-architect|-ddd-architect)|docs/superpowers' "$CLAUDE_ROOT" "$CODEX_ROOT" >&2
  fail "ddd-expert should not bind to superpowers plugins, skills, or paths"
fi

for skill in explore shape codify guard; do
  [ -f "$CLAUDE_ROOT/skills/$skill/SKILL.md" ] || fail "Claude ddd-expert missing $skill skill"
  [ -f "$CODEX_ROOT/skills/$skill/SKILL.md" ] || fail "Codex ddd-expert missing $skill skill"
done
for retired_skill in domain-modeling design implement review; do
  [ ! -e "$CLAUDE_ROOT/skills/$retired_skill" ] || fail "Claude ddd-expert should not keep retired $retired_skill alias"
  [ ! -e "$CODEX_ROOT/skills/$retired_skill" ] || fail "Codex ddd-expert should not keep retired $retired_skill alias"
done
! find "$CLAUDE_ROOT/references" "$CODEX_ROOT/references" -name 'ddd-risk-router.md' | grep -q . || fail "ddd-expert should not ship ddd-risk-router reference"
! rg -ni "ddd-risk-router|risk[- ]?router|risk[- ]?card" "$CLAUDE_ROOT" "$CODEX_ROOT" >/dev/null || fail "ddd-expert should not route through risk-router or risk-card terminology"

assert_references_classify_without_phase_returns() {
  local root="$1"
  local label="$2"
  local matches

  matches="$(rg -n 'return(s|ed)? to `?(explore|shape|codify|guard)`?|return-to-(explore|shape|codify|guard)' "$root/references" || true)"
  if [ -n "$matches" ]; then
    printf '%s\n' "$matches" >&2
    fail "$label references should classify gaps instead of returning to phase skills"
  fi
}

assert_references_do_not_link_skill_files() {
  local root="$1"
  local label="$2"
  local matches

  matches="$(rg -n '\.\./skills/|skills/[[:alnum:]-]+/SKILL\.md' "$root/references" || true)"
  if [ -n "$matches" ]; then
    printf '%s\n' "$matches" >&2
    fail "$label references should not link directly to phase skill files"
  fi
}

assert_references_classify_without_phase_returns "$CLAUDE_ROOT" "Claude"
assert_references_classify_without_phase_returns "$CODEX_ROOT" "Codex"
assert_references_do_not_link_skill_files "$CLAUDE_ROOT" "Claude"
assert_references_do_not_link_skill_files "$CODEX_ROOT" "Codex"

check_phase_contracts() {
  local root="$1"
  local label="$2"
  local explore_skill="$root/skills/explore/SKILL.md"
  local shape_skill="$root/skills/shape/SKILL.md"
  local codify_skill="$root/skills/codify/SKILL.md"
  local guard_skill="$root/skills/guard/SKILL.md"

  for skill in "$explore_skill" "$shape_skill" "$codify_skill" "$guard_skill"; do
    grep -q '^description: Use when ' "$skill" || fail "$label skill descriptions should start with Use when"
    assert_references_last "$skill" "$label $(basename "$(dirname "$skill")")"
  done

  grep -Fq 'docs/ddd/model.md' "$explore_skill" || fail "$label explore should own the DDD model artifact"
  grep -Fq 'current accepted state, not a change log' "$explore_skill" || fail "$label explore model should describe terminal state"
  grep -Fq 'Create it lazily' "$explore_skill" || fail "$label explore should bootstrap DDD docs lazily"
  grep -Fq 'Do not copy feature descriptions, ADRs, tickets' "$explore_skill" || fail "$label explore should not duplicate general project knowledge"
  grep -Fq 'do not force every request through an event timeline' "$explore_skill" || fail "$label explore should branch its discovery method"
  grep -Fq 'ask exactly one focused question, and end the turn' "$explore_skill" || fail "$label explore should ask one question per turn"
  grep -Fq 'Do not modify project files while clarification is active' "$explore_skill" || fail "$label explore should hold writes during clarification"
  grep -Fq 'present one integrated proposed model delta and wait for explicit user acceptance' "$explore_skill" || fail "$label explore should confirm the complete delta before writing"
  grep -Fq 'Explore is `shape_ready`' "$explore_skill" || fail "$label explore should define shape-ready completion"
  ! grep -q 'Core Domain' "$explore_skill" || fail "$label explore should not classify subdomain importance"
  ! grep -q 'ddd-core.md).*during `explore`' "$explore_skill" || fail "$label explore should not load tactical core guidance"

  grep -Fq 'docs/ddd/design.md' "$shape_skill" || fail "$label shape should own the Tactical Design artifact"
  grep -Fq 'multiple bounded contexts, keep their tactical designs in explicit context sections' "$shape_skill" || fail "$label shape should keep multi-context design in the canonical artifact"
  grep -Fq 'current accepted target state, not a feature narrative, change log, ADR summary' "$shape_skill" || fail "$label shape design should describe terminal DDD state only"
  grep -Fq 'inspect existing accepted project design evidence to avoid contradiction' "$shape_skill" || fail "$label shape should preserve accepted design during lazy bootstrap"
  grep -Fq 'do not maintain a separate exception ledger' "$shape_skill" || fail "$label shape should not create an exception register"
  grep -Fq 'Aggregate and collaboration choices based on complete facts belong to `shape`' "$shape_skill" || fail "$label shape should own tactical classification"
  grep -Fq 'Ask exactly one focused design question and end the turn' "$shape_skill" || fail "$label shape should ask one tactical question per turn"
  grep -Fq 'present one integrated proposed design delta and wait for explicit user acceptance' "$shape_skill" || fail "$label shape should confirm the complete design before writing"
  grep -Fq 'Codify decides routine scaffold and file placement' "$shape_skill" || fail "$label shape should leave physical mechanics to codify"
  grep -Fq 'The Tactical Design is the Implementation handoff' "$shape_skill" || fail "$label shape design should be the unique implementation handoff"
  grep -Fq 'It is `codify_ready`' "$shape_skill" || fail "$label shape should define codify-ready completion"

  grep -Fq 'working, verified backend code in the `ddd-expert` house style' "$codify_skill" || fail "$label codify should realize house-style code"
  grep -Fq 'Use this order when inputs disagree' "$codify_skill" || fail "$label codify should define authority order"
  grep -Fq 'DDD artifacts may be absent for a purely mechanical change' "$codify_skill" || fail "$label codify should allow lazy DDD documentation"
  grep -Fq '**Preflight before edits**' "$codify_skill" || fail "$label codify should preflight before modifying code"
  grep -Fq 'Routine scaffold, package placement, adopted library, adapter, database, message, and runtime mechanics belong to Codify' "$codify_skill" || fail "$label codify should own routine implementation mechanics"
  grep -Fq 'Design Realization and House-Style Conformance' "$codify_skill" || fail "$label codify should enforce both completion gates"
  grep -Fq 'A Guard finding is evidence, not implementation authority' "$codify_skill" || fail "$label codify should revalidate guard findings"
  grep -Fq 'finish `changed` with route `guard`' "$codify_skill" || fail "$label codify should close the guard remediation loop"
  grep -Fq 'MySQL 8.0' "$codify_skill" || fail "$label codify should use the MySQL 8.0 profile"

  grep -Fq 'Breadth produces falsifiable hypotheses; depth clears or proves them' "$guard_skill" || fail "$label guard should use hypothesis-driven breadth/depth review"
  grep -Fq 'does not redesign or modify project files' "$guard_skill" || fail "$label guard should be read-only"
  grep -Fq 'exact review target, comparison base' "$guard_skill" || fail "$label guard should establish an exact review target"
  grep -Fq '`hypothesis` and `coverage_obligation` entries' "$guard_skill" || fail "$label guard should distinguish smell hypotheses from coverage"
  grep -Fq '`clear`, `violation`, or `evidence_gap`' "$guard_skill" || fail "$label guard should give every hypothesis a terminal verdict"
  grep -Fq 'A smell candidate is innocent until depth evidence proves a violation' "$guard_skill" || fail "$label guard should not presume a smell is guilty"
  grep -q '^## Breadth baseline$' "$guard_skill" || fail "$label guard should keep its breadth baseline inline"
  grep -q '^### Specialized obligations$' "$guard_skill" || fail "$label guard should cover specialized surfaces"
  grep -q '^### Layer signals$' "$guard_skill" || fail "$label guard should scan all layers"
  grep -q '^### Cross-layer sentinels$' "$guard_skill" || fail "$label guard should scan cross-layer model pressure"
  grep -Fq '`violation`, route `codify`' "$guard_skill" || fail "$label guard should route implementation violations to codify"
  grep -Fq 'Report only non-clear outcomes' "$guard_skill" || fail "$label guard should keep clear ledger rows internal"
  grep -Fq 'MySQL 8.0' "$guard_skill" || fail "$label guard should use the MySQL 8.0 profile"
  ! grep -q '^## Calibration$' "$guard_skill" || fail "$label guard should keep calibration outside the runtime skill"
  ! rg -n 'design/spec review|architecture review|value transfer|settlement/closure|known issue or scoring set' "$guard_skill" >/dev/null || fail "$label guard should not contain pre-code or fixture calibration branches"
}

check_phase_contracts "$CLAUDE_ROOT" "Claude"
check_phase_contracts "$CODEX_ROOT" "Codex"

for skill in explore shape codify guard; do
  cmp -s "$CLAUDE_ROOT/skills/$skill/SKILL.md" "$CODEX_ROOT/skills/$skill/SKILL.md" || fail "Claude and Codex $skill skills should match"
done

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
  grep -q "Gap Classification" "$core" || fail "$label core should define gap classification"
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
  grep -q "Exception pressure is a model-fact gap when it concerns model facts" "$core" || fail "$label core should classify exception pressure without routing from references"

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
  fail "ddd-expert should route boundary conflicts to explore instead of naming exception mechanisms"
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
  grep -q "boundary conflict is a model-fact gap" "$gates" || fail "$label modeling gates should classify boundary conflicts as model-fact gaps"
  grep -q "model facts are model-fact gaps; tactical placement uncertainty is a tactical placement gap" "$gates" || fail "$label modeling gates should classify model facts and placement gaps"
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
  grep -q "accepted aggregate is clear but Repository API shape" "$root/references/ddd-golang-domain.md" || fail "$label Go domain repository should classify accepted-model API shape gaps"
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

grep -Fq "/plugin install ddd-expert@skill-workshop" "$ROOT/README.md" || fail "root README missing Claude ddd-expert install command"
grep -Fq "codex plugin add ddd-expert@skill-workshop-codex" "$ROOT/README.md" || fail "root README missing Codex ddd-expert install command"
grep -Fq "explore" "$ROOT/README.md" || fail "root README should list ddd-expert explore capability"
grep -Fq "shape" "$ROOT/README.md" || fail "root README should list ddd-expert shape capability"
grep -Fq "codify" "$ROOT/README.md" || fail "root README should list ddd-expert codify capability"
grep -Fq "guard" "$ROOT/README.md" || fail "root README should list ddd-expert guard capability"

echo "  ddd-expert plugin: standalone hookless phase-skill contract correct"
