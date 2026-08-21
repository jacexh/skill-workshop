#!/usr/bin/env bash
# Validate the standalone ddd-expert plugin, workflow contracts, and reference architecture.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLAUDE_ROOT="$ROOT/plugins/ddd-expert"
CODEX_ROOT="$ROOT/codex-plugins/ddd-expert"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

assert_contains() {
  local file="$1"
  local text="$2"
  local label="$3"
  rg -Fq -- "$text" "$file" || fail "$label"
}

assert_not_contains() {
  local file="$1"
  local text="$2"
  local label="$3"
  if rg -Fq -- "$text" "$file"; then
    fail "$label"
  fi
}

assert_matches() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  rg -q -- "$pattern" "$file" || fail "$label"
}

assert_mermaid_templates_have_no_topology() {
  local file="$1"
  local label="$2"
  local unexpected

  unexpected="$(awk '
    /^```mermaid$/ { in_mermaid = 1; next }
    in_mermaid && /^```$/ { in_mermaid = 0; next }
    in_mermaid {
      line = $0
      sub(/^[[:space:]]+/, "", line)
      sub(/[[:space:]]+$/, "", line)
      if (line == "" || line == "flowchart LR" || line == "classDiagram" || line == "sequenceDiagram" || line ~ /^%%/) next
      print NR ":" $0
    }
  ' "$file")"
  if [ -n "$unexpected" ]; then
    printf '%s\n' "$unexpected" >&2
    fail "$label should contain diagram headers and guidance comments only"
  fi
}

assert_references_last() {
  local file="$1"
  local label="$2"
  local last_heading
  local early_links

  last_heading="$(rg '^## ' "$file" | tail -n 1)"
  [ "$last_heading" = "## References" ] || fail "$label should keep References as its final section"
  early_links="$(awk '$0 == "## References" { exit } { print }' "$file" | rg -n '\]\(\.\./\.\./references/' || true)"
  if [ -n "$early_links" ]; then
    printf '%s\n' "$early_links" >&2
    fail "$label should not link references before the final References section"
  fi
}

check_local_markdown_links() {
  local root="$1"
  local label="$2"
  local file
  local link
  local target
  local resolved

  while IFS= read -r -d '' file; do
    while IFS= read -r link; do
      target="$(printf '%s\n' "$link" | sed -E 's/^\]\(//; s/\)$//; s/#.*$//')"
      case "$target" in
        ""|http://*|https://*|mailto:*) continue ;;
      esac
      if [[ "$file" == "$root/templates/"* && "$target" == *"<"* && "$target" == *">"* ]]; then
        continue
      fi
      resolved="$(realpath -m "$(dirname "$file")/$target")"
      [ -f "$resolved" ] || fail "$label broken Markdown link in ${file#$root/}: $target"
    done < <(rg -o '\]\([^)]*\.md(#[^)]*)?\)' "$file" || true)
  done < <(find "$root" -type f -name '*.md' -print0)
}

# Marketplace identity and standalone runtime surface.
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
[ "$(jq -r .description "$CLAUDE_ROOT/.claude-plugin/plugin.json")" = "$(jq -r .description "$CODEX_ROOT/.codex-plugin/plugin.json")" ] || fail "Claude and Codex manifest descriptions should match"
[ "$(jq -r '.plugins[] | select(.name == "ddd-expert") | .description' "$ROOT/.claude-plugin/marketplace.json")" = "$(jq -r .description "$CLAUDE_ROOT/.claude-plugin/plugin.json")" ] || fail "Claude marketplace and plugin manifest descriptions should match"
[ -z "$(jq -r '.hooks // empty' "$CODEX_ROOT/.codex-plugin/plugin.json")" ] || fail "Codex ddd-expert manifest should not declare hooks"
jq -e '.interface.longDescription | length > 0' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert manifest should describe the complete workflow"
jq -e '.interface.developerName | length > 0' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert manifest should name its developer"
jq -e '.interface.defaultPrompt | length == 1 and all(.[]; contains("$ddd-expert:event-storming"))' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert default prompt should use the single EventStorming modeling entry"
jq -e '.interface.defaultPrompt | all(.[]; contains("user\u0027s purpose") and contains("Bounded Contexts") and contains("Aggregate Roots") and contains("domain objects") and contains("$ddd-expert:tactical-design") and contains("$ddd-expert:codify"))' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert default prompt should expose the sparse modeling workflow"
jq -e '.interface.defaultPrompt | all(.[]; contains("Facts") and contains("Lifecycle State") and (contains("definitions, state") | not))' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert default prompt should expose Facts and Lifecycle State separately"
jq -e '.interface.defaultPrompt | all(.[]; contains("Capability Probe") and contains("Required Capabilities"))' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert default prompt should expose capability modeling"
jq -e '.interface.longDescription | contains("strategic model") and contains("one question at a time") and contains("Capability Probe") and contains("current domain-object design")' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert manifest should describe strategic and tactical authority"
jq -e '.interface.capabilities | index("Write")' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert manifest should declare artifact writes"
[ ! -e "$CLAUDE_ROOT/hooks" ] || fail "Claude ddd-expert should not ship hooks"
[ ! -e "$CODEX_ROOT/hooks" ] || fail "Codex ddd-expert should not ship hooks"
[ ! -e "$CODEX_ROOT/codex-hooks-snippet.json" ] || fail "Codex ddd-expert should not ship hook snippet"

if rg -n '\$?superpowers(:|-memory|-architect|-ddd-architect)|docs/superpowers' "$CLAUDE_ROOT" "$CODEX_ROOT" >/dev/null; then
  rg -n '\$?superpowers(:|-memory|-architect|-ddd-architect)|docs/superpowers' "$CLAUDE_ROOT" "$CODEX_ROOT" >&2
  fail "ddd-expert should not bind to superpowers plugins, skills, or paths"
fi

# The four public skills own the whole workflow. There is no hidden artifact
# state machine and no separate design-document lifecycle.
for skill in event-storming tactical-design codify guard; do
  claude_skill="$CLAUDE_ROOT/skills/$skill/SKILL.md"
  codex_skill="$CODEX_ROOT/skills/$skill/SKILL.md"
  [ -f "$claude_skill" ] || fail "Claude ddd-expert missing $skill skill"
  [ -f "$codex_skill" ] || fail "Codex ddd-expert missing $skill skill"
  cmp -s "$claude_skill" "$codex_skill" || fail "Claude and Codex $skill skills should match"
  rg -q '^description: Use when ' "$claude_skill" || fail "$skill description should start with Use when"
done

for implementation_skill in codify guard; do
  assert_references_last "$CLAUDE_ROOT/skills/$implementation_skill/SKILL.md" "$implementation_skill"
done
for design_skill in event-storming tactical-design; do
  file="$CLAUDE_ROOT/skills/$design_skill/SKILL.md"
  assert_not_contains "$file" '## References' "$design_skill should own its design rules directly"
  if rg -n '\]\(\.\./\.\./references/' "$file" >/dev/null; then
    fail "$design_skill should not load House Style references"
  fi
done

expected_skill_inventory="$(printf '%s\n' codify event-storming guard tactical-design | sort)"
for root in "$CLAUDE_ROOT" "$CODEX_ROOT"; do
  actual_skill_inventory="$(find "$root/skills" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)"
  [ "$actual_skill_inventory" = "$expected_skill_inventory" ] || {
    diff -u <(printf '%s\n' "$expected_skill_inventory") <(printf '%s\n' "$actual_skill_inventory") >&2 || true
    fail "ddd-expert skill inventory should contain only EventStorming, Tactical Design, Codify, and Guard"
  }
done

for template in artifact-layout context-map model domain-objects; do
  claude_template="$CLAUDE_ROOT/templates/$template.md"
  codex_template="$CODEX_ROOT/templates/$template.md"
  [ -f "$claude_template" ] || fail "Claude ddd-expert missing $template artifact template"
  [ -f "$codex_template" ] || fail "Codex ddd-expert missing $template artifact template"
  cmp -s "$claude_template" "$codex_template" || fail "Claude and Codex $template artifact templates should match"
done
for retired in \
  skills/maintain-artifacts \
  templates/README.md \
  templates/architecture.md \
  templates/design.md \
  templates/event-storming.md \
  templates/tactical-design.md; do
  [ ! -e "$CLAUDE_ROOT/$retired" ] || fail "Claude ddd-expert should remove $retired"
  [ ! -e "$CODEX_ROOT/$retired" ] || fail "Codex ddd-expert should remove $retired"
done

expected_template_inventory="$(printf '%s\n' artifact-layout.md context-map.md domain-objects.md model.md | sort)"
for root in "$CLAUDE_ROOT" "$CODEX_ROOT"; do
  actual_template_inventory="$(find "$root/templates" -mindepth 1 -maxdepth 1 -type f -printf '%f\n' | sort)"
  [ "$actual_template_inventory" = "$expected_template_inventory" ] || {
    diff -u <(printf '%s\n' "$expected_template_inventory") <(printf '%s\n' "$actual_template_inventory") >&2 || true
    fail "ddd-expert templates should contain only current strategic and domain-object artifacts"
  }
done

claude_context_map_validator="$CLAUDE_ROOT/scripts/validate-context-map.mjs"
codex_context_map_validator="$CODEX_ROOT/scripts/validate-context-map.mjs"
[ -f "$claude_context_map_validator" ] || fail "Claude ddd-expert missing Context Map validator"
[ -f "$codex_context_map_validator" ] || fail "Codex ddd-expert missing Context Map validator"
cmp -s "$claude_context_map_validator" "$codex_context_map_validator" ||
  fail "Claude and Codex Context Map validators should match"

for retired_skill in domain-modeling design implement review; do
  [ ! -e "$CLAUDE_ROOT/skills/$retired_skill" ] || fail "Claude should not keep retired $retired_skill alias"
  [ ! -e "$CODEX_ROOT/skills/$retired_skill" ] || fail "Codex should not keep retired $retired_skill alias"
done

event_storming_skill="$CLAUDE_ROOT/skills/event-storming/SKILL.md"
tactical_design_skill="$CLAUDE_ROOT/skills/tactical-design/SKILL.md"
model_template="$CLAUDE_ROOT/templates/model.md"
domain_objects_template="$CLAUDE_ROOT/templates/domain-objects.md"
artifact_layout_template="$CLAUDE_ROOT/templates/artifact-layout.md"
codify_skill="$CLAUDE_ROOT/skills/codify/SKILL.md"
guard_skill="$CLAUDE_ROOT/skills/guard/SKILL.md"

# EventStorming is strategic discovery. Workshop material stays conversational;
# accepted current knowledge is the only persisted output.
assert_contains "$event_storming_skill" '## Start with the user' "EventStorming should identify the requested purpose before evaluating"
assert_contains "$event_storming_skill" 'Ask one question at a time' "EventStorming should keep one decision frontier"
assert_contains "$event_storming_skill" 'recommended answer' "EventStorming should recommend an answer with each decision question"
assert_contains "$event_storming_skill" 'look it up' "EventStorming should investigate repository facts instead of asking the user"
assert_contains "$event_storming_skill" 'Bounded Contexts' "EventStorming should identify Bounded Contexts"
assert_contains "$event_storming_skill" 'Aggregate Roots' "EventStorming should identify Aggregate Roots"
assert_contains "$event_storming_skill" '## The ten EventStorming steps' "EventStorming should preserve the complete discussion method"
expected_workflow_steps="$(printf '%s\n' \
  '1. **Scope**' \
  '2. **Workshop Events**' \
  '3. **Timeline**' \
  '4. **Commands**' \
  '5. **Roles and external authorities**' \
  '6. **Constraints and required next intents**' \
  '7. **Problems and ambiguity**' \
  '8. **Aggregates and core business objects**' \
  '9. **Bounded Contexts**' \
  '10. **Context collaboration**')"
actual_workflow_steps="$(awk '/^## The ten EventStorming steps$/ { in_workflow = 1; next } /^## / { if (in_workflow) exit } in_workflow && /^[0-9]+\. \*\*/ { sub(/:.*/, ""); print }' "$event_storming_skill")"
[ "$actual_workflow_steps" = "$expected_workflow_steps" ] || fail "EventStorming should preserve the ten causal steps in order"
assert_contains "$event_storming_skill" 'Workshop Events stay in the conversation' "EventStorming should not persist workshop minutes"
assert_contains "$event_storming_skill" 'A proposed production Domain Event remains a candidate until the Actual Domain Event rules select it' "EventStorming should defer Domain Event selection to its normative rules"
assert_contains "$event_storming_skill" 'published synchronous command/query when the caller needs an immediate authoritative answer' "EventStorming should own synchronous collaboration selection"
assert_contains "$event_storming_skill" 'producer-owned Published Fact Contract' "EventStorming should own published-fact selection"
assert_contains "$event_storming_skill" 'receiver-owned Asynchronous Intent Contract' "EventStorming should own asynchronous-intent selection"
assert_contains "$event_storming_skill" 'Upstream -> Downstream' "EventStorming should own Context Map direction"
assert_not_contains "$event_storming_skill" 'produces or consumes' "EventStorming should not attach an event to a consumer"
assert_contains "$event_storming_skill" 'compact text timeline, table, or arrow chain' "EventStorming should use a renderer-independent conversational board"
assert_contains "$event_storming_skill" 'Admit a concern only when it changes a business right' "EventStorming should select concerns by business-observable meaning"
assert_contains "$event_storming_skill" 'Each rule is one independently challengeable claim' "EventStorming should write falsifiable Business Rules"
assert_contains "$event_storming_skill" 'without assigning tactical behavior ownership or prescribing an implementation mechanism' "EventStorming Business Rules should not pre-decide object design"
if rg -ni 'mermaid|\b(retry|retries|transaction|transactions|concurrency|concurrent|recovery|deployment|idempotency|idempotent)\b' "$event_storming_skill" >/dev/null; then
  rg -ni 'mermaid|\b(retry|retries|transaction|transactions|concurrency|concurrent|recovery|deployment|idempotency|idempotent)\b' "$event_storming_skill" >&2
  fail "EventStorming guidance should not prime implementation mechanisms"
fi
assert_contains "$event_storming_skill" 'explicitly confirms the integrated strategic model' "EventStorming should require integrated confirmation"
assert_contains "$event_storming_skill" '`context-map.md` and affected `model.md` files' "EventStorming should write only current strategic authority"

assert_contains "$model_template" '## Purpose' "Model should state the Bounded Context purpose"
assert_contains "$model_template" '## Aggregate Roots' "Model should identify Aggregate Roots"
assert_contains "$model_template" '## Business Rules' "Model should retain strategic business rules"
assert_contains "$model_template" '<Governed business concept or collaboration>' "Model Business Rules should state their business scope"
assert_contains "$model_template" '<accepted decision, permission, transition, required outcome, or invariant>' "Model Business Rules should preserve downstream design authority"
assert_not_contains "$model_template" '## Entities' "Model should not duplicate tactical object descriptions"
assert_not_contains "$model_template" '## Domain Events' "Model should not duplicate object-owned Domain Events"

# Tactical Design uses the same relentless, one-question interview contract as
# grilling. It lands coherent Entities during one Root interview, then reviews
# the integrated Root and affected current authority.
assert_contains "$tactical_design_skill" 'Ask one question at a time' "Tactical Design should keep one design frontier"
assert_contains "$tactical_design_skill" 'recommended answer' "Tactical Design should recommend an answer with each design question"
assert_contains "$tactical_design_skill" 'If a fact can be found in the repository, look it up' "Tactical Design should investigate facts instead of asking the user"
assert_contains "$tactical_design_skill" "When one retained Entity's definition" "Tactical Design should close an Entity before writing it"
assert_contains "$tactical_design_skill" 'An Entity confirmation gathers the decisions that close its responsibility' "Tactical Design should not write every local answer"
assert_contains "$tactical_design_skill" 'integrated compact slice' "Tactical Design should retain integrated Root confirmation"
assert_contains "$tactical_design_skill" 'affected `ddd-expert` current artifacts and relevant project decisions' "Tactical Design should review current authority when the Root lands"
assert_contains "$tactical_design_skill" 'updating only accepted content changed by the completed design' "Tactical Design should leave unaffected authority alone"
assert_contains "$tactical_design_skill" 'resolve it with the user in the current conversation' "Tactical Design should refine strategic authority without a workflow handoff"
assert_not_contains "$tactical_design_skill" 'return the smallest contradiction to EventStorming' "Tactical Design should not force the user back to strategic discovery"
assert_contains "$tactical_design_skill" 'Work one Aggregate Root at a time' "Tactical Design should finish one Aggregate before opening the next"
assert_contains "$tactical_design_skill" 'derive the smallest complete set of **essential business pressures** from `model.md`' "Tactical Design should derive design pressure from confirmed authority"
assert_contains "$tactical_design_skill" "working expression of the Root's essential complexity" "Tactical Design should frame inherent domain difficulty explicitly"
assert_contains "$tactical_design_skill" 'Every pressure names the governing Business Rules' "Tactical Design should keep every pressure traceable"
assert_contains "$tactical_design_skill" 'explain together what it represents and how it operates' "Tactical Design should present What and How together"
assert_contains "$tactical_design_skill" 'introduce its candidate Behaviors immediately' "Tactical Design should name Behavior at the first proposal"
assert_contains "$tactical_design_skill" 'technical placeholder name' "Tactical Design should not defer Domain naming until artifact writing"
assert_contains "$tactical_design_skill" 'How as conversational working reasoning' "Tactical Design should not turn How into a required artifact field"
assert_contains "$tactical_design_skill" 'During exploration, vary the Subject' "Tactical Design should use behavior statements to test ownership"
assert_contains "$tactical_design_skill" 'Resolve every material Subject and Object' "Tactical Design should resolve behavior ownership"
assert_contains "$tactical_design_skill" 'name each Lifecycle State transition explicitly' "Tactical Design should resolve Lifecycle State transitions"
assert_contains "$tactical_design_skill" 'including no new split and the strongest relevant split, merge, move, or deletion alternative' "Tactical Design should compare credible object compositions"
assert_contains "$tactical_design_skill" 'compare the design burden it introduces' "Tactical Design should weigh introduced complexity"
assert_contains "$tactical_design_skill" 'accidental complexity introduced by the candidate composition' "Tactical Design should distinguish candidate burden from essential complexity"
assert_contains "$tactical_design_skill" "each retained object's business definition" "Tactical Design should stay at low-resolution object design"
assert_contains "$tactical_design_skill" '<Subject> <domain verb> <Object>.' "Tactical behavior descriptions should name a Domain action"
assert_contains "$tactical_design_skill" '<Subject> <domain verb> <Object>, transitioning <Lifecycle State name> from <before> to <after>.' "Lifecycle-changing behavior should name its transition"
assert_contains "$tactical_design_skill" '<Root Behavior> — <Root> <domain verb> <Object> by composing <Entity>.<Entity Behavior>.' "Root behavior should reference the Entity behavior it composes"
assert_contains "$tactical_design_skill" 'it does not prescribe a method call' "Root-to-Entity behavior links should remain semantic"
assert_contains "$tactical_design_skill" '### Capability Probe' "Tactical Design should classify external-authority needs inside behavior ownership"
for outcome in '**Supplied Fact**' '**Required Capability**'; do
  assert_contains "$tactical_design_skill" "$outcome" "Capability Probe missing $outcome"
done
assert_contains "$tactical_design_skill" 'Domain input, and result use' "Required Capability should preserve the Behavior-owned decision"
assert_contains "$tactical_design_skill" 'outer composition supplies' "Required Capability should leave realization to composition"
assert_matches "$tactical_design_skill" 'every external-authority need.*Capability Probe classification.*every Required Capability.*invoking Behavior.*business decision point.*Domain question or action.*guarantee' "Capability Probe should have an exhaustive Root completion criterion"
assert_contains "$tactical_design_skill" 'the entry contains no selection reason' "Domain Event entries should point to behavior without carrying rationale"
assert_contains "$tactical_design_skill" '../../templates/domain-objects.md' "Tactical Design should use the domain-object event schema"
assert_not_contains "$tactical_design_skill" '<result>' "Tactical Design should not require a universal result slot"
assert_contains "$tactical_design_skill" 'Facts are the business-significant facts owned by the object' "Tactical Design should define Facts without implying a runtime snapshot"
assert_contains "$tactical_design_skill" 'Lifecycle State records the object' "Tactical Design should record state-machine states separately"
assert_contains "$tactical_design_skill" '`<Object>.State`' "Tactical Design should qualify a generic lifecycle concept with its owner"
assert_not_contains "$tactical_design_skill" '`PlayerState`' "Tactical Design should not hard-code project-specific lifecycle names"
assert_not_contains "$tactical_design_skill" '`HandStatus`' "Tactical Design should not hard-code project-specific lifecycle names"
assert_not_contains "$tactical_design_skill" 'Current Facts' "Tactical Design should not imply runtime snapshot values"
assert_not_contains "$tactical_design_skill" 'state or status' "Tactical Design should not conflate object Facts with Lifecycle State"
assert_contains "$tactical_design_skill" 'becomes the grammatical Subject and behavior owner' "Tactical Design should bind accepted behavior to an object"
assert_not_contains "$tactical_design_skill" 'every Entity inside' "Tactical Design should not interview through an entity checklist"
assert_contains "$tactical_design_skill" '`domain-objects.md`' "Tactical Design should own the current domain-object file"
assert_not_contains "$tactical_design_skill" 'Codify' "Tactical Design should not prescribe implementation workflow"
assert_contains "$tactical_design_skill" 'Carry a realization concern into the design only when a confirmed Business Rule changes the required ownership or guarantee' "Tactical Design should admit realization concerns through business authority"
assert_not_contains "$tactical_design_skill" 'transaction, concurrency, recovery, or call direction' "Tactical Design should not prime speculative system mechanisms"

for heading in '**Definition:**' '**Facts:**' '**Lifecycle State:**' '**Behavior:**' '**Domain Events:**'; do
  assert_contains "$domain_objects_template" "$heading" "domain-objects template missing $heading"
done
assert_contains "$domain_objects_template" '**Required Capabilities:**' "domain-objects template should record Domain-owned capabilities"
for slot in '<Capability name>' '<Domain behavior name>' '<business decision point>' '<Domain question or action>' '<accepted business guarantee>'; do
  assert_contains "$domain_objects_template" "$slot" "domain-object capability entry missing $slot"
done
assert_contains "$domain_objects_template" 'include an essential way it operates only when that changes its meaning' "domain-object Definition should carry only essential How"
assert_not_contains "$domain_objects_template" '**Operating Mechanism:**' "domain objects should not require a separate How field"
assert_contains "$domain_objects_template" '<Root> <domain verb> <Object>[ by composing `<Entity>.<Behavior>`][, transitioning <Lifecycle State name> from <before> to <after>].' "Root behavior should optionally reference a composed Entity behavior"
assert_contains "$domain_objects_template" '<Subject> <domain verb> <Object>[, transitioning <Lifecycle State name> from <before> to <after>].' "Entity behavior should use a Domain action and optional Lifecycle State transition"
assert_contains "$domain_objects_template" '<Event name>` — recorded by `<Producing Domain behavior name>' "domain-object events should point to the behavior that records them"
assert_contains "$domain_objects_template" '**Consumed by:**' "domain-object events should list accepted local reactions"
for slot in '<Event Handler>' '<Domain intent>'; do
  assert_contains "$domain_objects_template" "$slot" "domain-object event reaction missing $slot"
done
assert_contains "$domain_objects_template" 'No explicit Lifecycle State' "domain objects without a state machine should say so"
assert_not_contains "$domain_objects_template" '**State:**' "domain-object Facts and Lifecycle State should remain distinct"
assert_not_contains "$domain_objects_template" 'Current Facts' "domain-object Facts should describe owned meaning rather than runtime snapshots"
assert_not_contains "$domain_objects_template" '<result>' "domain-object behavior should not require a universal result slot"
assert_not_contains "$domain_objects_template" 'required domain reaction or durable evidence' "domain-object event entries should not carry their selection reason"
assert_contains "$tactical_design_skill" 'Analytical Workshop Events never appear in `domain-objects.md`' "Tactical Design should keep Workshop Events out of domain objects"
assert_not_contains "$domain_objects_template" '**Responsibilities:**' "behavior should own responsibilities"
assert_not_contains "$domain_objects_template" '**Lifecycle:**' "Lifecycle State should own lifecycle"
assert_not_contains "$domain_objects_template" '**Collaboration:**' "named behaviors and capabilities should replace a generic collaboration section"

assert_contains "$artifact_layout_template" 'domain-objects.md' "artifact layout should include current tactical authority"
assert_contains "$artifact_layout_template" 'Required Capabilities where present' "artifact layout should include conditional Domain-owned capabilities"
assert_contains "$artifact_layout_template" 'after its Entity confirmation' "artifact layout should expose Entity-level writes"
assert_contains "$artifact_layout_template" 'after Root confirmation' "artifact layout should expose integrated Root writes"
assert_not_contains "$artifact_layout_template" 'event-storming/' "artifact layout should not retain meeting minutes"
assert_not_contains "$artifact_layout_template" 'tactical-design/' "artifact layout should not retain design iterations"
assert_not_contains "$artifact_layout_template" 'architecture.md' "artifact layout should not retain BC architecture files"

assert_contains "$codify_skill" '`model.md` and `domain-objects.md`' "Codify should consume strategic and tactical authority"
assert_contains "$codify_skill" 'DDD artifacts are read-only during Codify' "Codify should not revise design while implementing"
assert_contains "$codify_skill" 'semantic constraints, not a complete software design' "Codify should treat sparse design as constraints rather than an inventory"
assert_contains "$codify_skill" 'implementation latitude, not a missing modeling step' "Codify should own unspecified software realization"
assert_contains "$codify_skill" 'applicable House Style' "Codify should resolve realization through House Style"
assert_contains "$codify_skill" 'every code surface actually touched' "Codify should load House Style only for current work"
assert_contains "$codify_skill" 'Implement the complete requested slice' "Codify should realize the accepted behavior coherently"
assert_contains "$codify_skill" 'tests and checks proportionate to the changed behavior and risk' "Codify should verify proportionately"
assert_not_contains "$codify_skill" 'stop and route' "Codify should not create a modeling return loop"
assert_not_contains "$codify_skill" 'EventStorming' "Codify should not route back to strategic modeling"
assert_not_contains "$codify_skill" 'Tactical Design' "Codify should not route back to tactical modeling"
assert_not_contains "$codify_skill" 'Preflight before edits' "Codify should not impose a preflight checklist"
assert_not_contains "$codify_skill" 'Work from Domain outward' "Codify should not prescribe implementation order"
assert_not_contains "$codify_skill" 'A free function' "Codify should leave detailed realization rules in House Style"
assert_not_contains "$codify_skill" 'Provide Guard with' "Codify should not own a Guard handoff protocol"

assert_contains "$guard_skill" 'affected `model.md` and `domain-objects.md`, `docs/ddd-expert/context-map.md` when Context ownership or collaboration changes' "Guard should review only applicable current model authority"
assert_contains "$guard_skill" 'one fresh, read-only agent context distinct from the implementer' "Guard should remain independent"
assert_contains "$guard_skill" 'they are not a complete software design' "Guard should not treat sparse models as software inventories"
assert_contains "$guard_skill" 'implementation latitude judged through project constraints and House Style, not missing authority' "Guard should judge unmodeled structure through House Style"
assert_contains "$guard_skill" 'non-Domain abstraction introduced, materially changed, or required by the affected behavior' "Guard should review software abstractions in the changed realization"
assert_contains "$guard_skill" 'whether deleting it would redistribute that complexity or simply remove it' "Guard should apply the deletion test"
assert_contains "$guard_skill" 'whether a small stable interface creates leverage and locality' "Guard should judge abstraction depth"
assert_contains "$guard_skill" 'indirection, mapping, configuration, lifecycle, and test cost are justified' "Guard should weigh accidental abstraction cost"
assert_contains "$guard_skill" 'CQRS, Repository, or Job neither require nor justify an abstraction' "Guard should not infer abstraction quality from pattern names"
assert_contains "$guard_skill" 'Review only: do not edit source, DDD artifacts, tests, or project state' "Guard should remain read-only over the reviewed change"
assert_not_contains "$guard_skill" 'EventStorming' "Guard should not create a strategic workflow route"
assert_not_contains "$guard_skill" 'Tactical Design' "Guard should not create a tactical workflow route"
assert_not_contains "$guard_skill" 'Codify' "Guard should not create an implementation workflow route"
assert_not_contains "$guard_skill" 'receiver-shaped free function' "Guard should leave detailed object-shape rules in House Style"

if rg -n 'maintain-artifacts|architecture\.md|classDiagram|sequenceDiagram|model_revision|last_changed_by|draft fingerprint|SHA-256 fingerprint|draft -> ready|reconcil' \
  "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" "$CLAUDE_ROOT/templates" "$CODEX_ROOT/templates" >/dev/null; then
  rg -n 'maintain-artifacts|architecture\.md|classDiagram|sequenceDiagram|model_revision|last_changed_by|draft fingerprint|SHA-256 fingerprint|draft -> ready|reconcil' \
    "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" "$CLAUDE_ROOT/templates" "$CODEX_ROOT/templates" >&2
  fail "ddd-expert should not retain the old artifact lifecycle or diagram workflow"
fi

if rg -n '(\$|/)ddd-expert:' "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" >/dev/null; then
  rg -n '(\$|/)ddd-expert:' "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" >&2
  fail "shared SKILL contracts should not contain platform-specific invocation syntax"
fi
assert_contains "$CLAUDE_ROOT/README.md" '/ddd-expert:event-storming' "Claude README should use the EventStorming slash invocation"
assert_contains "$CODEX_ROOT/README.md" '$ddd-expert:event-storming' "Codex README should use the EventStorming dollar invocation"
assert_contains "$CLAUDE_ROOT/README.md" '/ddd-expert:tactical-design' "Claude README should expose conditional Tactical Design"
assert_contains "$CODEX_ROOT/README.md" '$ddd-expert:tactical-design' "Codex README should expose conditional Tactical Design"
assert_contains "$CLAUDE_ROOT/README.md" 'EventStorming -> current strategic model' "Claude README should expose the sparse workflow"
assert_contains "$CODEX_ROOT/README.md" 'EventStorming -> current strategic model' "Codex README should expose the sparse workflow"
assert_contains "$CLAUDE_ROOT/README.md" 'Tactical Design -> current domain objects' "Claude README should expose tactical authority"
assert_contains "$CODEX_ROOT/README.md" 'Tactical Design -> current domain objects' "Codex README should expose tactical authority"
assert_contains "$CLAUDE_ROOT/README.md" 'one question at a time' "Claude README should expose the interview contract"
assert_contains "$CODEX_ROOT/README.md" 'one question at a time' "Codex README should expose the interview contract"
assert_contains "$CODEX_ROOT/README.md" 'codex plugin marketplace upgrade skill-workshop-codex' "Codex README should upgrade by marketplace name"
assert_contains "$CLAUDE_ROOT/README.md" 'verified implementation checkpoint' "Claude README should expose the Codify checkpoint"
assert_contains "$CODEX_ROOT/README.md" 'verified implementation checkpoint' "Codex README should expose the Codify checkpoint"
assert_contains "$CLAUDE_ROOT/README.md" 'House Style owns realization choices left open by the model' "Claude README should make House Style the realization default"
assert_contains "$CODEX_ROOT/README.md" 'House Style owns realization choices left open by the model' "Codex README should make House Style the realization default"
if rg -n -F 'docs/ddd/' "$CLAUDE_ROOT" "$CODEX_ROOT" >/dev/null; then
  rg -n -F 'docs/ddd/' "$CLAUDE_ROOT" "$CODEX_ROOT" >&2
  fail "ddd-expert should use docs/ddd-expert rather than the retired docs/ddd path"
fi
for retired_artifact in 'docs/ddd-expert/model.md' 'docs/ddd-expert/design.md'; do
  if rg -n -F "$retired_artifact" "$CLAUDE_ROOT" "$CODEX_ROOT" >/dev/null; then
    rg -n -F "$retired_artifact" "$CLAUDE_ROOT" "$CODEX_ROOT" >&2
    fail "ddd-expert should keep artifacts under per-context directories rather than shared root files"
  fi
done
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Their silence about remaining software structure is implementation latitude' "codify should own design gaps outside the Domain contract"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'smallest complete House Style leaf set' "codify should apply House Style selectively"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Use question-led depth' "guard should deepen only from a concrete structural question"
assert_not_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '`clear`, `violation`, or `evidence_gap`' "guard should not maintain terminal-state accounting"
assert_not_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'review unit' "guard should not maintain review-unit machinery"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'fresh, read-only agent context' "guard should keep review work independent and read-only"

if rg -n 'ddd-golang-[[:alnum:]-]+\.md' \
  "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" >/dev/null; then
  fail "workflow skills should enter Go House Style through its router rather than link implementation leaves directly"
fi
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Start with the active-language router' "codify should enter language guidance through its router"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'every touched code surface' "codify should route to a complete leaf set"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Start with the active-language router' "guard should enter language guidance through its router"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'affected code surfaces' "guard should route to affected leaves"

# Canonical reference inventory. Every language uses a router plus focused
# layer/flow/mechanism leaves.
references=(
  ddd-core.md
  ddd-collaboration.md
  database.md
  ddd-golang.md
  ddd-golang-scaffold.md
  ddd-golang-domain.md
  ddd-golang-application.md
  ddd-golang-transport.md
  ddd-golang-cqrs.md
  ddd-golang-infrastructure.md
  ddd-golang-events.md
  ddd-golang-messages.md
  ddd-golang-taskqueue.md
  ddd-golang-fsm.md
  ddd-golang-kafka.md
  ddd-golang-asynq.md
  ddd-golang-observability.md
  ddd-golang-runtime.md
  ddd-python.md
  ddd-python-domain.md
  ddd-python-application.md
  ddd-python-transport.md
  ddd-python-infrastructure.md
  ddd-python-events-messages.md
  ddd-python-taskqueue.md
  ddd-python-fsm.md
  ddd-python-runtime.md
  ddd-typescript.md
  ddd-typescript-domain.md
  ddd-typescript-application.md
  ddd-typescript-transport.md
  ddd-typescript-infrastructure.md
  ddd-typescript-events-messages.md
  ddd-typescript-taskqueue.md
  ddd-typescript-fsm.md
  ddd-typescript-runtime.md
)

expected_inventory="$(printf '%s\n' "${references[@]}" | sort)"
for root in "$CLAUDE_ROOT" "$CODEX_ROOT"; do
  actual_inventory="$(find "$root/references" -maxdepth 1 -type f -name '*.md' -printf '%f\n' | sort)"
  [ "$actual_inventory" = "$expected_inventory" ] || {
    diff -u <(printf '%s\n' "$expected_inventory") <(printf '%s\n' "$actual_inventory") >&2 || true
    fail "reference inventory does not match the canonical architecture"
  }
done

for reference in "${references[@]}"; do
  claude_ref="$CLAUDE_ROOT/references/$reference"
  codex_ref="$CODEX_ROOT/references/$reference"
  cmp -s "$claude_ref" "$codex_ref" || fail "Claude and Codex $reference references should match"
done

for retired_reference in ddd-agent-contract.md ddd-modeling.md ddd-modeling-gates.md ddd-golang-events-messages.md mysql.md; do
  [ ! -e "$CLAUDE_ROOT/references/$retired_reference" ] || fail "Claude should not keep $retired_reference"
  [ ! -e "$CODEX_ROOT/references/$retired_reference" ] || fail "Codex should not keep $retired_reference"
done

if rg -n 'ddd-agent-contract\.md|ddd-modeling(-gates)?\.md|ddd-golang-events-messages\.md|mysql\.md' \
  "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" \
  "$CLAUDE_ROOT/references" "$CODEX_ROOT/references" >/dev/null; then
  fail "skills and references should not load retired reference files"
fi

check_local_markdown_links "$CLAUDE_ROOT" "Claude"
check_local_markdown_links "$CODEX_ROOT" "Codex"

common_refs=(
  "$CLAUDE_ROOT/references/ddd-core.md"
  "$CLAUDE_ROOT/references/ddd-collaboration.md"
  "$CLAUDE_ROOT/references/database.md"
)
language_refs=(
  "$CLAUDE_ROOT"/references/ddd-golang*.md
  "$CLAUDE_ROOT"/references/ddd-python*.md
  "$CLAUDE_ROOT"/references/ddd-typescript*.md
)
optimized_refs=(
  "${common_refs[@]}"
  "${language_refs[@]}"
)

# House Style references keep ordinary implementation salient and do not
# advertise uncommon coordination/recovery mechanisms.
uncommon_reference_mechanism_pattern='\b(outbox|inbox|sagas?)\b|process[ -]manager|process[ -](crash|restart|failure)|transaction[ -]failure|(commit|rollback)[ -]failure|crash[ -](gap|loss|recovery)|panic[ -]recovery|durable[ -](handoff|delivery|progress|coordination)|recovery[ -](semantics|policy|mechanism|protocol)|reconciliation|manual repair|compensation'
if rg -ni "$uncommon_reference_mechanism_pattern" "${optimized_refs[@]}" >/dev/null; then
  rg -ni "$uncommon_reference_mechanism_pattern" "${optimized_refs[@]}" >&2
  fail "references should not advertise uncommon coordination and recovery mechanisms"
fi

# References are implementation House Style, never another DDD design workflow.
for reference in "${references[@]}"; do
  file="$CLAUDE_ROOT/references/$reference"
  assert_contains "$file" '## Applies When' "$reference should state its applicability"
done
if rg -n '\[DDD Principle\]|\[Heuristic\]|^## (The ten EventStorming steps|Probe behavior ownership|Compare object compositions|Relentless interview contract)' \
  "${optimized_refs[@]}" >/dev/null; then
  rg -n '\[DDD Principle\]|\[Heuristic\]|^## (The ten EventStorming steps|Probe behavior ownership|Compare object compositions|Relentless interview contract)' \
    "${optimized_refs[@]}" >&2
  fail "House Style references should not contain DDD selection or interview guidance"
fi
if rg -n '\.\./skills/|skills/[[:alnum:]-]+/SKILL\.md' "${optimized_refs[@]}" >/dev/null; then
  fail "references should not link directly to workflow skill files"
fi
if rg -ni 'evaluation evidence|evaluation fixture|eval fixture|scoring fixture|known evaluation' "${optimized_refs[@]}" >/dev/null; then
  fail "references should not contain evaluation-fixture material"
fi
if rg -ni '\b(FastAPI|Uvicorn|Pydantic|SQLAlchemy|Celery|Structlog|Fastify|TypeBox|Kysely|BullMQ|XState|Pino)\b' \
  "${common_refs[@]}" >/dev/null; then
  fail "common references should not own language-framework choices"
fi

core="$CLAUDE_ROOT/references/ddd-core.md"
assert_contains "$core" 'The accepted strategic model and domain-object' "core should realize rather than select design"
assert_contains "$core" 'design decide what exists and who owns it' "core should defer existence and ownership to accepted design"
assert_contains "$core" '## Model-to-code Projection' "core should own implementation projection"
assert_contains "$core" 'A public Domain method on the accepted owner' "core should realize accepted capability ownership"
assert_contains "$core" 'Application defines the transaction scope' "core should preserve Application transaction ownership"
assert_contains "$core" 'Domain code remains transaction-unaware' "core should keep transactions out of Domain"

collaboration="$CLAUDE_ROOT/references/ddd-collaboration.md"
assert_contains "$collaboration" 'EventStorming and Tactical Design decide which' "collaboration reference should defer selection to Skills"
assert_contains "$collaboration" 'collaboration exists and what it means' "collaboration reference should not own collaboration selection"
assert_contains "$collaboration" 'Record the event in the same Domain operation that establishes the fact' "collaboration reference should define event code shape"
assert_contains "$collaboration" 'The producer owns the schema and generated namespace' "collaboration reference should define published-fact ownership"
assert_contains "$collaboration" 'The receiver owns the schema and generated namespace' "collaboration reference should define asynchronous-intent ownership"

# Every language router reaches every leaf.
go_router="$CLAUDE_ROOT/references/ddd-golang.md"
python_guide="$CLAUDE_ROOT/references/ddd-python.md"
typescript_guide="$CLAUDE_ROOT/references/ddd-typescript.md"
for leaf in "$CLAUDE_ROOT"/references/ddd-golang-*.md; do
  assert_contains "$go_router" "$(basename "$leaf")" "Go router missing $(basename "$leaf")"
done
for leaf in "$CLAUDE_ROOT"/references/ddd-python-*.md; do
  assert_contains "$python_guide" "$(basename "$leaf")" "Python router missing $(basename "$leaf")"
done
for leaf in "$CLAUDE_ROOT"/references/ddd-typescript-*.md; do
  assert_contains "$typescript_guide" "$(basename "$leaf")" "TypeScript router missing $(basename "$leaf")"
done
assert_contains "$go_router" 'smallest complete set of leaves' "Go router should require progressive disclosure"
assert_contains "$python_guide" 'smallest complete set of leaves' "Python router should require progressive disclosure"
assert_contains "$typescript_guide" 'smallest complete set of leaves' "TypeScript router should require progressive disclosure"

for adopted in \
  'go.uber.org/fx' \
  'connectrpc.com/connect' \
  'github.com/go-chi/chi/v5' \
  'github.com/go-playground/validator/v10' \
  'xorm.io/xorm' \
  'github.com/go-sql-driver/mysql' \
  'github.com/google/uuid' \
  'github.com/go-jimu/components/ddd/event' \
  'github.com/go-jimu/components/ddd/message' \
  'github.com/go-jimu/components/taskqueue' \
  'github.com/go-jimu/components/fsm' \
  'github.com/go-jimu/components/sloghelper' \
  'github.com/samber/oops' \
  'github.com/go-jimu/components/config/loader' \
  'connectrpc.com/otelconnect'
do
  assert_contains "$go_router" "$adopted" "Go router missing adopted stack entry $adopted"
done
for adopted in \
  'FastAPI' 'Uvicorn' 'Pydantic' 'pydantic-settings' 'SQLAlchemy' \
  'mysqlclient' 'grpcio' 'confluent-kafka' 'Celery' 'OpenTelemetry Python SDK'
do
  assert_contains "$python_guide" "$adopted" "Python router missing adopted stack entry $adopted"
done
for adopted in \
  'Fastify' '@fastify/type-provider-typebox' '@connectrpc/connect-fastify' \
  'typebox' 'Kysely' 'mysql2' '@confluentinc/kafka-javascript' \
  'BullMQ' 'XState' 'OpenTelemetry JS'
do
  assert_contains "$typescript_guide" "$adopted" "TypeScript router missing adopted stack entry $adopted"
done

scaffold="$CLAUDE_ROOT/references/ddd-golang-scaffold.md"
assert_contains "$scaffold" 'internal/business/' "Go scaffold should support multiple bounded contexts"
assert_contains "$scaffold" 'application.go' "Go scaffold should require application.go"
assert_contains "$scaffold" 'assembler.go' "Go scaffold should require assembler.go"
assert_contains "$scaffold" 'messagesubscriber/' "Go scaffold should separate message subscribers"
assert_contains "$scaffold" 'taskprocessor/' "Go scaffold should separate task processors"
assert_contains "$scaffold" 'gen/' "Go scaffold should place generated code under gen"
assert_contains "$scaffold" 'migrations/' "Go scaffold should use the canonical migration directory"

application="$CLAUDE_ROOT/references/ddd-golang-application.md"
assert_contains "$application" 'type Application struct' "Go Application should expose a grouped registry"
assert_contains "$application" 'func AssembleUserDTO' "Go Application should define DTO-to-Entity mapping"
assert_contains "$application" 'func AssembleUserEntity' "Go Application should define Entity-to-DTO mapping"
assert_contains "$application" 'Application defines the transaction scope; Infrastructure owns begin, enlistment, commit, and rollback.' "Go Application should own transaction scope"
assert_contains "$application" 'Within(context.Context, func(context.Context) error) error' "Go Transactor should expose a context callback"

domain="$CLAUDE_ROOT/references/ddd-golang-domain.md"
assert_contains "$domain" 'github.com/go-playground/validator/v10' "Go Domain should own business-data validation"
assert_contains "$domain" '### Request-scoped Aggregate' "Go Domain should retain request-scoped realization"
assert_contains "$domain" '### Resident Aggregate with checkpoint persistence' "Go Domain should retain resident realization"
assert_contains "$domain" 'ddd-golang-fsm.md' "Go Domain should route accepted FSM code to its leaf"

fsm="$CLAUDE_ROOT/references/ddd-golang-fsm.md"
assert_contains "$fsm" '*fsm.SimpleState' "Go FSM should use the component base state"
assert_contains "$fsm" 'RegisterStateBuilder' "Go FSM should register transition targets"
assert_contains "$fsm" 'Application calls Domain methods' "Go FSM should keep the library behind Domain behavior"

cqrs="$CLAUDE_ROOT/references/ddd-golang-cqrs.md"
assert_contains "$cqrs" 'leaf fixes Go placement and code shape; it does not decide whether a separate' "Go read-side reference should not select CQRS"
assert_contains "$cqrs" 'type QueryRepository interface' "Go read side should define the Application port"
assert_contains "$cqrs" 'Map query rows' "Go read side should map read rows directly"
assert_contains "$cqrs" 'directly into Application read DTOs' "Go read side should return Application read DTOs"

transport="$CLAUDE_ROOT/references/ddd-golang-transport.md"
assert_contains "$transport" 'transport/connectrpc' "Go Transport should own ConnectRPC adapters"
assert_contains "$transport" 'transport/messagesubscriber' "Go Transport should own message subscribers"
assert_contains "$transport" 'transport/taskprocessor' "Go Transport should own task processors"
assert_contains "$transport" 'h.application.Commands' "Go Transport should delegate through Application"

events="$CLAUDE_ROOT/references/ddd-golang-events.md"
messages="$CLAUDE_ROOT/references/ddd-golang-messages.md"
kafka="$CLAUDE_ROOT/references/ddd-golang-kafka.md"
assert_contains "$events" 'Repository.Save -> Aggregate.Events.Drain -> Dispatcher.DispatchAll' "Go events should expose accepted dispatch order"
assert_contains "$events" 'application/eventhandler/' "Go events should place same-context handlers"
assert_contains "$messages" 'Published Fact Handler' "Go messages should define producer mapping"
assert_contains "$messages" 'message.KindOf(payload)' "Go messages should use the adopted kind"
assert_contains "$messages" 'transport/messagesubscriber/' "Go messages should place consumers in Transport"
assert_contains "$kafka" 'jimukafka.NewConsumer' "Go Kafka should use the adopted adapter"
assert_contains "$kafka" 'message.Runner' "Go Kafka should make runner ownership explicit"

taskqueue="$CLAUDE_ROOT/references/ddd-golang-taskqueue.md"
asynq="$CLAUDE_ROOT/references/ddd-golang-asynq.md"
assert_contains "$taskqueue" 'application/task' "Go taskqueue should own contracts in Application"
assert_contains "$taskqueue" 'transport/taskprocessor' "Go taskqueue should own processors in Transport"
assert_contains "$taskqueue" 'taskqueue.NewProtoTask' "Go taskqueue should use protobuf tasks"
assert_contains "$taskqueue" 'taskqueue.DecodeProto' "Go taskqueue should decode protobuf tasks"
assert_contains "$taskqueue" 'ddd-golang-asynq.md' "Go taskqueue should route provider runtime separately"
assert_contains "$asynq" 'taskasynq.NewRedisWorker' "Go Asynq should use the adopted worker"
assert_contains "$asynq" 'lifecycle hooks' "Go Asynq should own lifecycle wiring"
if rg -n 'taskqueue\.(NewJSONTask|DecodeJSON)' "$CLAUDE_ROOT"/references/ddd-golang*.md >/dev/null; then
  fail "Go taskqueue House Style should retain one protobuf construction style"
fi

infrastructure="$CLAUDE_ROOT/references/ddd-golang-infrastructure.md"
assert_contains "$infrastructure" 'infrastructure/convert.go' "Go Infrastructure should own conversion"
assert_contains "$infrastructure" 'xorm.io/xorm' "Go Infrastructure should use the adopted ORM"
assert_contains "$infrastructure" 'WithinOrJoin(context.Context, func(xorm.Interface) error) error' "Go Infrastructure should join the accepted local transaction"

runtime="$CLAUDE_ROOT/references/ddd-golang-runtime.md"
observability="$CLAUDE_ROOT/references/ddd-golang-observability.md"
assert_contains "$runtime" 'Execution Completion Log' "Go Runtime should define completion-log ownership"
assert_contains "$runtime" 'ddd-golang-observability.md' "Go Runtime should route OpenTelemetry separately"
assert_contains "$observability" 'otelconnect.NewInterceptor' "Go observability should use the adopted Connect interceptor"
assert_contains "$observability" 'TracerProvider.Shutdown' "Go observability should own provider shutdown"

python_domain="$CLAUDE_ROOT/references/ddd-python-domain.md"
python_application="$CLAUDE_ROOT/references/ddd-python-application.md"
python_transport="$CLAUDE_ROOT/references/ddd-python-transport.md"
python_infrastructure="$CLAUDE_ROOT/references/ddd-python-infrastructure.md"
python_events="$CLAUDE_ROOT/references/ddd-python-events-messages.md"
python_taskqueue="$CLAUDE_ROOT/references/ddd-python-taskqueue.md"
python_fsm="$CLAUDE_ROOT/references/ddd-python-fsm.md"
assert_contains "$python_domain" 'class UserRepository(Protocol)' "Python Domain should define Repository Protocols"
assert_contains "$python_domain" 'resident lifecycle' "Python Domain should realize resident authority conditionally"
assert_contains "$python_domain" 'def name(self) -> str:' "Python Domain sample should expose the state used by its assembler"
assert_contains "$python_application" 'class Application' "Python Application should expose a registry"
assert_contains "$python_application" 'assemble_user_dto' "Python Application should own DTO mapping"
assert_contains "$python_transport" 'def create_router' "Python Transport should expose router factories"
assert_contains "$python_infrastructure" 'class UserRepositoryAdapter' "Python Infrastructure should own persistence adapters"
assert_contains "$python_infrastructure" 'Testcontainers' "Python persistence should require real provider evidence"
assert_contains "$python_events" 'class PrepareProfileOnUserRegistered' "Python events should show one typed handler"
assert_contains "$python_taskqueue" 'class SendWelcomeProcessor' "Python tasks should show one typed processor"
assert_contains "$python_fsm" 'class OrderLifecycle(StateChart)' "Python FSM should show the adopted 3.2 API"
assert_contains "$python_fsm" 'state_field="_status"' "Python FSM should bind the accepted Domain state field"

typescript_domain="$CLAUDE_ROOT/references/ddd-typescript-domain.md"
typescript_application="$CLAUDE_ROOT/references/ddd-typescript-application.md"
typescript_transport="$CLAUDE_ROOT/references/ddd-typescript-transport.md"
typescript_infrastructure="$CLAUDE_ROOT/references/ddd-typescript-infrastructure.md"
typescript_events="$CLAUDE_ROOT/references/ddd-typescript-events-messages.md"
typescript_taskqueue="$CLAUDE_ROOT/references/ddd-typescript-taskqueue.md"
typescript_fsm="$CLAUDE_ROOT/references/ddd-typescript-fsm.md"
assert_contains "$typescript_domain" 'export class User' "TypeScript Domain should expose behavior-rich classes"
assert_contains "$typescript_domain" 'static reconstitute' "TypeScript Domain should distinguish existing state"
assert_contains "$typescript_domain" 'state.version < 1' "TypeScript reconstitution should require persisted state"
assert_contains "$typescript_application" 'export class Application' "TypeScript Application should expose a registry"
assert_contains "$typescript_application" 'interface UserUnitOfWork' "TypeScript Application should own transaction scope"
assert_contains "$typescript_transport" 'createUserConnectRoutes' "TypeScript Transport should own Connect routes"
assert_contains "$typescript_infrastructure" 'type Executor = Kysely<Database> | Transaction<Database>' "TypeScript Infrastructure should bind repositories to the current executor"
assert_contains "$typescript_events" 'class PrepareProfileOnUserRegistered' "TypeScript events should show one typed handler"
assert_contains "$typescript_taskqueue" 'class SendWelcomeProcessor' "TypeScript tasks should show one typed processor"
assert_contains "$typescript_fsm" 'setup({' "TypeScript FSM should show the adopted XState setup"
assert_contains "$typescript_fsm" 'transition(orderLifecycle, current' "TypeScript FSM should keep machine transitions inside Domain"

database="$CLAUDE_ROOT/references/database.md"
assert_contains "$database" 'Every table governed by this profile' "database profile should define standard columns"
assert_contains "$database" 'new in-memory Aggregate has version' "database profile should define initial versions"
assert_contains "$database" '### Request-scoped Optimistic Aggregate Lifecycle' "database profile should scope optimistic lifecycle"
assert_contains "$database" '### Resident Aggregate Checkpoints' "database profile should implement resident checkpoints conditionally"
assert_contains "$database" 'Every participating one-Root Repository joins the same physical transaction' "database guidance should require one physical local transaction"
if rg -n 'xorm|go-sql-driver|github\.com/google/uuid|convert\.go|\*xorm' "$database" >/dev/null; then
  fail "shared database profile should not own Go adapter choices"
fi
# Public documentation exposes the same final reference catalog.
claude_reference_section="$(sed -n '/^## References$/,$p' "$CLAUDE_ROOT/README.md")"
codex_reference_section="$(sed -n '/^## References$/,$p' "$CODEX_ROOT/README.md")"
[ "$claude_reference_section" = "$codex_reference_section" ] || fail "Claude and Codex README reference catalogs should match"
for router in ddd-golang.md ddd-python.md ddd-typescript.md; do
  assert_contains "$CLAUDE_ROOT/README.md" "\`$router\`" "plugin README missing $router"
done
assert_contains "$CLAUDE_ROOT/README.md" 'References are House Style only' "plugin README should define reference ownership"
assert_contains "$CLAUDE_ROOT/README.md" 'EventStorming and Tactical Design remain the authorities' "plugin README should keep design in Skills"
for retired_reference in ddd-agent-contract.md ddd-modeling.md ddd-modeling-gates.md ddd-golang-events-messages.md mysql.md; do
  ! rg -Fq -- "\`$retired_reference\`" "$CLAUDE_ROOT/README.md" || fail "plugin README lists retired $retired_reference"
done

assert_contains "$ROOT/README.md" '/plugin install ddd-expert@skill-workshop' "root README missing Claude ddd-expert install command"
assert_contains "$ROOT/README.md" 'codex plugin add ddd-expert@skill-workshop-codex' "root README missing Codex ddd-expert install command"
assert_contains "$ROOT/README.md" 'Domain/Application/Interface/Infrastructure/Runtime' "root README should expose every architecture responsibility"
assert_contains "$ROOT/README.md" 'Go names the physical Interface package `transport`' "root README should map Go transport to the shared Interface vocabulary"
assert_contains "$ROOT/README.md" 'complete ten-step discussion method' "root README should preserve EventStorming discussion depth"
assert_contains "$ROOT/README.md" 'derives essential business pressures from confirmed rules' "root README should expose Tactical Design inputs"
assert_contains "$ROOT/README.md" 'Capability Probe' "root README should expose capability discovery"
assert_contains "$ROOT/README.md" '<Subject> <domain verb> <Object>.' "root README should expose the current Behavior contract"
assert_contains "$ROOT/README.md" 'definition, Facts, Lifecycle State, behavior, Required Capabilities where present, and actual Domain Events' "root README should expose the current domain-object artifact"
assert_not_contains "$ROOT/README.md" 'subject-action-object-result' "root README should not advertise the removed result contract"
assert_not_contains "$ROOT/README.md" "definition, state, behavior" "root README should distinguish Facts from Lifecycle State"
assert_contains "$ROOT/README.md" 'compares credible object compositions by pressure coverage and accidental design burden' "root README should expose Tactical Design tradeoffs"
assert_contains "$ROOT/README.md" 'actual Domain Events' "root README should distinguish production events"
assert_contains "$ROOT/README.md" 'receiver-shaped free functions require a concrete ownership reason' "root README should bind behavior to methods"
assert_contains "$ROOT/README.md" 'Codify treats the strategic model and domain-object slices as read-only semantic constraints, not a complete software design' "root README should define Codify implementation latitude"
assert_contains "$ROOT/README.md" 'whether changed non-Domain abstractions earn their cost by reducing overall complexity under House Style' "root README should expose Guard abstraction review"

sparse_adr="$ROOT/docs/adr/0009-sparse-current-ddd-artifacts.md"
[ -f "$sparse_adr" ] || fail "sparse DDD workflow ADR missing"
assert_contains "$sparse_adr" 'Status: Accepted' "sparse DDD workflow ADR should be accepted"
assert_contains "$sparse_adr" 'EventStorming keeps all ten discussion steps' "ADR should preserve EventStorming discussion"
assert_contains "$sparse_adr" '`docs/ddd-expert/context-map.md`' "ADR should define current Context Map authority"
assert_contains "$sparse_adr" '`docs/ddd-expert/context/<context-slug>/model.md`' "ADR should define current Model authority"
assert_contains "$sparse_adr" 'Business Rules' "ADR should define pressure-led Tactical Design authority"
assert_contains "$sparse_adr" '-> essential business pressures' "ADR should define pressure-led Tactical Design order"
assert_contains "$sparse_adr" 'what the object represents and how it operates' "ADR should require complete Entity proposals"
assert_contains "$sparse_adr" 'at that first proposal' "ADR should require early Behavior naming"
assert_contains "$sparse_adr" '<Root Behavior> — <Root> <domain verb> <Object> by composing <Entity>.<Entity Behavior>.' "ADR should define Root-to-Entity behavior links"
for term in 'Capability Probe' 'Required Capability'; do
  assert_contains "$sparse_adr" "$term" "ADR missing $term"
done
assert_contains "$sparse_adr" 'This How remains conversational reasoning' "ADR should keep How out of the artifact schema"
assert_contains "$sparse_adr" 'in the current conversation' "ADR should allow tactical refinement of strategic authority"
assert_contains "$sparse_adr" '`<Object>.State`' "ADR should use owner-qualified generic lifecycle naming"
assert_contains "$sparse_adr" 'After the user confirms that Entity' "ADR should define Entity writes"
assert_contains "$sparse_adr" 'Once the user confirms the integrated Root slice' "ADR should retain integrated Root confirmation"
assert_contains "$sparse_adr" 'revisits affected current DDD artifacts and relevant project decisions' "ADR should define the Root-level authority review"
assert_contains "$sparse_adr" 'definition;' "ADR should define object descriptions"
assert_contains "$sparse_adr" 'actual Domain Events.' "ADR should define production events"
assert_contains "$sparse_adr" 'A behavior listed under a Root or Entity is normally realized as a method on that object' "ADR should define method ownership"
assert_contains "$sparse_adr" 'Codify realizes the model through House Style' "ADR should define House Style realization"
assert_contains "$sparse_adr" 'An abstraction earns its cost when it hides present complexity' "ADR should define Guard abstraction quality"
assert_contains "$sparse_adr" 'There are no UML or sequence diagrams' "ADR should remove diagram artifacts"
assert_contains "$sparse_adr" 'no such lifecycle exists' "ADR should remove artifact state machinery"

for superseded_adr in \
  0003-event-storming-whole-model-confirmation.md \
  0004-model-ready-enters-codify-directly.md \
  0005-event-storming-minutes-and-current-models.md \
  0006-guard-is-a-semantic-structure-review.md \
  0007-conditional-tactical-design-and-claims.md \
  0008-design-artifacts-are-falsifiable-candidates.md; do
  assert_contains "$ROOT/docs/adr/$superseded_adr" 'Status: Superseded by [ADR 0009]' "$superseded_adr should no longer be current authority"
done

assert_contains "$ROOT/CONTEXT.md" '**Strategic Model**:' "shared vocabulary should define strategic authority"
assert_contains "$ROOT/CONTEXT.md" '**Strategic Business Rule**:' "shared vocabulary should define downstream business authority"
assert_contains "$ROOT/CONTEXT.md" '**Domain Object Slice**:' "shared vocabulary should define tactical authority"
assert_contains "$ROOT/CONTEXT.md" '**Object Facts**:' "shared vocabulary should distinguish object Facts from fields and events"
assert_contains "$ROOT/CONTEXT.md" '**Lifecycle State**:' "shared vocabulary should define state-machine state"
assert_contains "$ROOT/CONTEXT.md" '`<Object>.State`' "shared vocabulary should qualify generic lifecycle state with its owner"
assert_contains "$ROOT/CONTEXT.md" '**Pressure-led Tactical Design**:' "shared vocabulary should define discussion order"
assert_contains "$ROOT/CONTEXT.md" '**Entity Confirmation**:' "shared vocabulary should define Entity write granularity"
assert_contains "$ROOT/CONTEXT.md" '**Per-Root Confirmation**:' "shared vocabulary should define write granularity"
assert_contains "$ROOT/CONTEXT.md" '**Behavior Description**:' "shared vocabulary should define behavior sentences"
assert_contains "$ROOT/CONTEXT.md" '<Root Behavior> — <Root> <domain verb> <Object> by composing <Entity>.<Entity Behavior>.' "shared vocabulary should define Root-to-Entity behavior links"
assert_contains "$ROOT/CONTEXT.md" '**Domain-owned Required Capability**:' "shared vocabulary should define behavior-owned external capability contracts"
assert_contains "$ROOT/CONTEXT.md" '**Actual Domain Event**:' "shared vocabulary should distinguish production events"
assert_contains "$ROOT/CONTEXT.md" 'the grammatical subject is the owning Root or Entity and normally maps to a method on that object' "shared vocabulary should bind accepted behavior to methods"
assert_not_contains "$ROOT/CONTEXT.md" '**Modeling Contradiction**:' "shared vocabulary should not preserve a Codify return loop"
assert_not_contains "$ROOT/CONTEXT.md" '**Bounded Context Architecture**:' "shared vocabulary should remove architecture artifact authority"
assert_not_contains "$ROOT/CONTEXT.md" '**Tactical Design Claim**:' "shared vocabulary should remove claims machinery"
assert_not_contains "$ROOT/CONTEXT.md" '**Guard Review Unit**:' "shared vocabulary should remove Guard state machinery"

echo "  ddd-expert plugin: sparse strategic and tactical contracts correct"
