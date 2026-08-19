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
jq -e '.interface.longDescription | contains("strategic model") and contains("one question at a time") and contains("current domain-object design")' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert manifest should describe strategic and tactical authority"
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
  assert_references_last "$claude_skill" "$skill"
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
assert_contains "$event_storming_skill" 'compact text timeline, table, or arrow chain' "EventStorming should use a renderer-independent conversational board"
assert_contains "$event_storming_skill" 'Admit a concern only when it changes a business right' "EventStorming should select concerns by business-observable meaning"
assert_contains "$event_storming_skill" 'Each rule is one independently challengeable claim' "EventStorming should write falsifiable Business Rules"
assert_contains "$event_storming_skill" 'without assigning tactical behavior ownership or prescribing an implementation mechanism' "EventStorming Business Rules should not pre-decide object design"
if rg -ni 'mermaid|\b(retry|retries|transaction|transactions|concurrency|concurrent|recovery|deployment|idempotency|idempotent)\b' "$event_storming_skill" "$CLAUDE_ROOT/references/ddd-modeling.md" >/dev/null; then
  rg -ni 'mermaid|\b(retry|retries|transaction|transactions|concurrency|concurrent|recovery|deployment|idempotency|idempotent)\b' "$event_storming_skill" "$CLAUDE_ROOT/references/ddd-modeling.md" >&2
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
# grilling. It produces one sparse current object model after confirmation.
assert_contains "$tactical_design_skill" 'Ask one question at a time' "Tactical Design should keep one design frontier"
assert_contains "$tactical_design_skill" 'recommended answer' "Tactical Design should recommend an answer with each design question"
assert_contains "$tactical_design_skill" 'If a fact can be found in the repository, look it up' "Tactical Design should investigate facts instead of asking the user"
assert_contains "$tactical_design_skill" 'Write one Aggregate Root slice as soon as the user confirms that Root' "Tactical Design should persist confirmed Roots incrementally"
assert_contains "$tactical_design_skill" 'Never write an unconfirmed Aggregate Root' "Tactical Design should preserve a per-Root confirmation barrier"
assert_contains "$tactical_design_skill" 'Do not wait for every Aggregate Root in the Bounded Context' "Tactical Design should avoid whole-context write batching"
assert_contains "$tactical_design_skill" 'Work one Aggregate Root at a time' "Tactical Design should finish one Aggregate before opening the next"
assert_contains "$tactical_design_skill" 'derive the smallest complete set of **essential business pressures** from `model.md`' "Tactical Design should derive design pressure from confirmed authority"
assert_contains "$tactical_design_skill" "working expression of the Root's essential complexity" "Tactical Design should frame inherent domain difficulty explicitly"
assert_contains "$tactical_design_skill" 'Every pressure names the governing Business Rules' "Tactical Design should keep every pressure traceable"
assert_contains "$tactical_design_skill" 'During exploration, vary the Subject' "Tactical Design should use behavior statements to test ownership"
assert_contains "$tactical_design_skill" 'Resolve every material Subject, Object, and Result' "Tactical Design should classify hidden concepts"
assert_contains "$tactical_design_skill" 'including no new split and the strongest relevant split, merge, move, or deletion alternative' "Tactical Design should compare credible object compositions"
assert_contains "$tactical_design_skill" 'compare the design burden it introduces' "Tactical Design should weigh introduced complexity"
assert_contains "$tactical_design_skill" 'accidental complexity introduced by the candidate composition' "Tactical Design should distinguish candidate burden from essential complexity"
assert_contains "$tactical_design_skill" "each retained object's business definition" "Tactical Design should stay at low-resolution object design"
assert_contains "$tactical_design_skill" '<Subject> <acts on object>, producing <result>.' "Tactical behavior descriptions should carry a complete semantic sentence"
assert_contains "$tactical_design_skill" 'becomes the grammatical Subject and behavior owner' "Tactical Design should bind accepted behavior to an object"
assert_not_contains "$tactical_design_skill" 'every Entity inside' "Tactical Design should not interview through an entity checklist"
assert_contains "$tactical_design_skill" '`domain-objects.md`' "Tactical Design should own the current domain-object file"
assert_not_contains "$tactical_design_skill" 'Codify' "Tactical Design should not prescribe implementation workflow"
assert_contains "$tactical_design_skill" 'Carry a realization concern into the design only when a confirmed Business Rule changes the required ownership or guarantee' "Tactical Design should admit realization concerns through business authority"
assert_not_contains "$tactical_design_skill" 'transaction, concurrency, recovery, or call direction' "Tactical Design should not prime speculative system mechanisms"

for heading in '**Definition:**' '**State:**' '**Behavior:**' '**Domain Events:**'; do
  assert_contains "$domain_objects_template" "$heading" "domain-objects template missing $heading"
done
assert_contains "$domain_objects_template" '<Subject> <acts on object>, producing <result>.' "domain-object behavior should use a subject-action-result sentence"
assert_contains "$tactical_design_skill" 'Analytical Workshop Events never appear in `domain-objects.md`' "Tactical Design should keep Workshop Events out of domain objects"
assert_not_contains "$domain_objects_template" '**Responsibilities:**' "behavior should own responsibilities"
assert_not_contains "$domain_objects_template" '**Lifecycle:**' "state should own lifecycle"
assert_not_contains "$domain_objects_template" '**Collaboration:**' "behavior and Domain Events should express effects"

assert_contains "$artifact_layout_template" 'domain-objects.md' "artifact layout should include current tactical authority"
assert_not_contains "$artifact_layout_template" 'event-storming/' "artifact layout should not retain meeting minutes"
assert_not_contains "$artifact_layout_template" 'tactical-design/' "artifact layout should not retain design iterations"
assert_not_contains "$artifact_layout_template" 'architecture.md' "artifact layout should not retain BC architecture files"

assert_contains "$codify_skill" '`model.md` and `domain-objects.md`' "Codify should consume strategic and tactical authority"
assert_contains "$codify_skill" 'DDD artifacts are read-only during Codify' "Codify should not revise design while implementing"
assert_contains "$codify_skill" 'semantic constraints, not a complete software design' "Codify should treat sparse design as constraints rather than an inventory"
assert_contains "$codify_skill" 'implementation latitude, not a missing modeling step' "Codify should own unspecified software realization"
assert_contains "$codify_skill" 'applicable House Style' "Codify should resolve realization through House Style"
assert_contains "$codify_skill" 'code surfaces actually touched' "Codify should load House Style only for current work"
assert_contains "$codify_skill" 'Implement the complete requested slice' "Codify should realize the accepted behavior coherently"
assert_contains "$codify_skill" 'tests and checks proportionate to the changed behavior and risk' "Codify should verify proportionately"
assert_not_contains "$codify_skill" 'stop and route' "Codify should not create a modeling return loop"
assert_not_contains "$codify_skill" 'EventStorming' "Codify should not route back to strategic modeling"
assert_not_contains "$codify_skill" 'Tactical Design' "Codify should not route back to tactical modeling"
assert_not_contains "$codify_skill" 'Preflight before edits' "Codify should not impose a preflight checklist"
assert_not_contains "$codify_skill" 'Work from Domain outward' "Codify should not prescribe implementation order"
assert_not_contains "$codify_skill" 'A free function' "Codify should leave detailed realization rules in House Style"
assert_not_contains "$codify_skill" 'Provide Guard with' "Codify should not own a Guard handoff protocol"

assert_contains "$guard_skill" '`docs/ddd-expert/context-map.md`, affected `model.md`, and `domain-objects.md`' "Guard should review the current model"
assert_contains "$guard_skill" 'one fresh, read-only agent context distinct from the implementer' "Guard should remain independent"
assert_contains "$guard_skill" 'Route strategic contradictions to EventStorming' "Guard should route strategic defects"
assert_contains "$guard_skill" 'Route object-definition, state, behavior, or Domain Event contradictions to Tactical Design' "Guard should route tactical defects"
assert_contains "$guard_skill" 'Route implementation drift to Codify' "Guard should route code defects"
assert_contains "$guard_skill" 'Guard never edits DDD artifacts' "Guard should remain read-only over design"
assert_contains "$guard_skill" 'receiver-shaped free function' "Guard should detect behavior displaced from its object"

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
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Load only House Style guidance for the active language and code surfaces actually touched' "codify should apply House Style selectively"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '**Use question-led implementation depth**' "guard should deepen only from a falsifiable architecture question"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '`clear`, `violation`, or `evidence_gap`' "guard should use terminal verdicts"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'keep it read-only' "guard should keep review work read-only"

if rg -n 'ddd-golang-(scaffold|domain|application|transport|cqrs|infrastructure|events-messages|taskqueue|runtime)\.md' \
  "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" >/dev/null; then
  fail "workflow skills should enter Go House Style through its router rather than link implementation leaves directly"
fi
assert_contains "$event_storming_skill" '../../references/ddd-modeling.md' "EventStorming should load strategic modeling guidance"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'For Go, start with' "codify should enter Go guidance through its router"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'For Python or TypeScript, load only the touched surfaces' "codify should load compact language guides selectively"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'For Go, use' "guard should enter Go guidance through its router"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'For Python or TypeScript, load only the sections owning each architecture unit' "guard should load compact language guides selectively"

# Canonical reference inventory. Go uses a baseline/router plus focused leaves;
# lower-frequency Python and TypeScript each use one compact language guide.
references=(
  ddd-modeling.md
  ddd-core.md
  ddd-collaboration.md
  ddd-golang.md
  ddd-golang-scaffold.md
  ddd-golang-domain.md
  ddd-golang-application.md
  ddd-golang-transport.md
  ddd-golang-cqrs.md
  ddd-golang-infrastructure.md
  ddd-golang-events-messages.md
  ddd-golang-taskqueue.md
  ddd-golang-runtime.md
  database.md
  ddd-python.md
  ddd-typescript.md
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

for retired_reference in ddd-agent-contract.md ddd-modeling-gates.md mysql.md; do
  [ ! -e "$CLAUDE_ROOT/references/$retired_reference" ] || fail "Claude should not keep $retired_reference"
  [ ! -e "$CODEX_ROOT/references/$retired_reference" ] || fail "Codex should not keep $retired_reference"
done

if rg -n 'ddd-agent-contract\.md|ddd-modeling-gates\.md|mysql\.md' \
  "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" \
  "$CLAUDE_ROOT/references" "$CODEX_ROOT/references" >/dev/null; then
  fail "skills and references should not load retired reference files"
fi

check_local_markdown_links "$CLAUDE_ROOT" "Claude"
check_local_markdown_links "$CODEX_ROOT" "Codex"

common_refs=(
  "$CLAUDE_ROOT/references/ddd-modeling.md"
  "$CLAUDE_ROOT/references/ddd-core.md"
  "$CLAUDE_ROOT/references/ddd-collaboration.md"
  "$CLAUDE_ROOT/references/database.md"
)
language_refs=(
  "$CLAUDE_ROOT"/references/ddd-golang*.md
  "$CLAUDE_ROOT/references/ddd-python.md"
  "$CLAUDE_ROOT/references/ddd-typescript.md"
)
optimized_refs=(
  "${common_refs[@]}"
  "${language_refs[@]}"
)

for reference in ddd-modeling.md ddd-core.md ddd-collaboration.md; do
  file="$CLAUDE_ROOT/references/$reference"
  assert_contains "$file" '[DDD Principle]' "$reference should distinguish DDD principles"
  assert_contains "$file" '[House Rule]' "$reference should distinguish house rules"
  assert_contains "$file" '[Heuristic]' "$reference should distinguish heuristics"
done
assert_contains "$CLAUDE_ROOT/references/ddd-modeling.md" 'The Root composes their responsibilities; it does not have to absorb every behavior.' "strategic modeling should expose intra-Aggregate object responsibility"
assert_contains "$CLAUDE_ROOT/references/ddd-modeling.md" 'Identity or a distinct lifecycle alone may instead reveal an owned Entity' "strategic modeling should not equate lifecycle difference with an Aggregate split"

if rg -ni 'evaluation evidence|evaluation fixture|eval fixture|scoring fixture|known evaluation' "${optimized_refs[@]}" >/dev/null; then
  rg -ni 'evaluation evidence|evaluation fixture|eval fixture|scoring fixture|known evaluation' "${optimized_refs[@]}" >&2
  fail "references should not contain evaluation-fixture material"
fi

if rg -ni 'return(s|ed)? to `?(event-storming|codify|guard)`?|return-to-(event-storming|codify|guard)' "${optimized_refs[@]}" >/dev/null; then
  rg -ni 'return(s|ed)? to `?(event-storming|codify|guard)`?|return-to-(event-storming|codify|guard)' "${optimized_refs[@]}" >&2
  fail "references should expose missing authority while workflow skills own routing"
fi

if rg -n '\.\./skills/|skills/[[:alnum:]-]+/SKILL\.md' "${optimized_refs[@]}" >/dev/null; then
  fail "references should not link directly to workflow skill files"
fi

if rg -ni '^#{1,4}[[:space:]]+.*(Planning Workflow|Architecture Gate|Level [123]|Boundary Checklist|Mechanized Review Checks|DDD Tactical Design Reference|Key Principles Summary)' \
  "$CLAUDE_ROOT/references/ddd-python.md" "$CLAUDE_ROOT/references/ddd-typescript.md" >/dev/null; then
  rg -ni '^#{1,4}[[:space:]]+.*(Planning Workflow|Architecture Gate|Level [123]|Boundary Checklist|Mechanized Review Checks|DDD Tactical Design Reference|Key Principles Summary)' \
    "$CLAUDE_ROOT/references/ddd-python.md" "$CLAUDE_ROOT/references/ddd-typescript.md" >&2
  fail "language references should not retain planning workflows or review-checklist sediment"
fi

if rg -ni 'active DDD workflow|workflow skill|workflow route|plan/spec must|apply the gates' \
  "$CLAUDE_ROOT/references/ddd-python.md" "$CLAUDE_ROOT/references/ddd-typescript.md" >/dev/null; then
  rg -ni 'active DDD workflow|workflow skill|workflow route|plan/spec must|apply the gates' \
    "$CLAUDE_ROOT/references/ddd-python.md" "$CLAUDE_ROOT/references/ddd-typescript.md" >&2
  fail "language references should not duplicate workflow contracts"
fi

if rg -ni '\b(FastAPI|Uvicorn|Pydantic|SQLAlchemy|Celery|Structlog|Fastify|TypeBox|Kysely|BullMQ|XState|Pino)\b' \
  "${common_refs[@]}" >/dev/null; then
  rg -ni '\b(FastAPI|Uvicorn|Pydantic|SQLAlchemy|Celery|Structlog|Fastify|TypeBox|Kysely|BullMQ|XState|Pino)\b' \
    "${common_refs[@]}" >&2
  fail "common DDD and persistence references should not own language-framework choices"
fi

# The primary Go router reaches every layer, flow, and platform guide.
go_router="$CLAUDE_ROOT/references/ddd-golang.md"
assert_contains "$go_router" 'Go House Style never chooses Aggregate boundaries, resident versus request-scoped state, business sequencing, or failure policy' "Go House Style should not make modeling decisions"
assert_contains "$go_router" 'a resident Aggregate remains the live authority and persists snapshots/checkpoints' "Go router should expose conditional resident persistence"
for leaf in "$CLAUDE_ROOT"/references/ddd-golang-*.md; do
  basename="$(basename "$leaf")"
  assert_contains "$go_router" "$basename" "Go router missing $basename"
done
if rg -n 'SchemaRegistry' "$CLAUDE_ROOT"/references/ddd-golang*.md >/dev/null; then
  fail "Go references should keep one explicit task construction style"
fi
if rg -n 'SimpleStateContext' "$CLAUDE_ROOT"/references/ddd-golang*.md >/dev/null; then
  fail "Go references should use the current FSM StateContext API"
fi

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

python_guide="$CLAUDE_ROOT/references/ddd-python.md"
assert_contains "$python_guide" 'Accepted project authority or Tactical Design selects the lifecycle' "Python guide should defer lifecycle selection"
assert_contains "$python_guide" 'resident Aggregate' "Python guide should admit resident authority"
for adopted in \
  'FastAPI' \
  'Uvicorn' \
  'Pydantic' \
  'pydantic-settings' \
  'SQLAlchemy' \
  'mysqlclient' \
  'grpcio' \
  'confluent-kafka' \
  'Celery' \
  'OpenTelemetry Python SDK'
do
  assert_contains "$python_guide" "$adopted" "Python guide missing adopted stack entry $adopted"
done

typescript_guide="$CLAUDE_ROOT/references/ddd-typescript.md"
for adopted in \
  'Fastify' \
  '@fastify/type-provider-typebox' \
  '@connectrpc/connect-fastify' \
  'typebox' \
  'Kysely' \
  'mysql2' \
  '@confluentinc/kafka-javascript' \
  'BullMQ' \
  'XState' \
  'OpenTelemetry JS'
do
  assert_contains "$typescript_guide" "$adopted" "TypeScript guide missing adopted stack entry $adopted"
done

# High-value Go boundaries, intentionally sparse and independent of section numbers.
core="$CLAUDE_ROOT/references/ddd-core.md"
assert_contains "$core" 'It implements an already selected model; it does not create a Domain concept or choose lifecycle, state authority, business sequencing, or failure policy' "House Style should realize rather than model the system"
assert_contains "$core" 'Apply a House Rule only after accepted project authority or Tactical Design has' "House Rules should be conditional on selected design"
assert_contains "$core" '| Domain | Business language, behavior, invariants, lifecycle, policies, business sequencing' "Domain should own business sequencing"
assert_contains "$core" '| Application | Use-case coordination, required context' "Application should own use-case coordination"
assert_contains "$core" 'the invoked collaborator contract belongs to the Domain in Domain language' "Core guidance should keep domain-timed capability ownership inward"
assert_contains "$core" 'When Application itself owns a use-case continuation, it may own a semantic outbound port' "Core guidance should distinguish Application-owned continuation"
assert_contains "$core" 'The Root composes their collaboration and invariant boundary; it need not absorb every behavior' "Aggregate guidance should allow owned objects with distinct responsibilities"
assert_contains "$core" 'resident Aggregate with checkpoint persistence may instead expose a snapshot/checkpoint contract selected by Tactical Design or project authority' "Repository guidance should not assume request-scoped persistence"
assert_contains "$core" 'Only a confirmed Model may authorize one Application use case to save several independent Aggregate Roots atomically, and only within one Bounded Context and one local transactional resource.' "multi-Aggregate transactions should require confirmed Model authority and one local consistency scope"
assert_contains "$core" '## Model-to-code Projection' "core guidance should own the shared semantic projection rules"
assert_contains "$core" 'Projection preserves semantic ownership across abstraction levels. It is traceability, not name matching or one-to-one generation' "projection should be many-to-many rather than code generation"
assert_contains "$core" 'An IAM principal or transport claim is not itself the Role' "projection should distinguish business authorization from identity mechanisms"
assert_contains "$core" 'External authority may issue Command' "projection should preserve accepted non-human command sources"
assert_contains "$core" 'A Command does not require a same-named class, handler, or Aggregate method' "projection should not force Command naming into code structure"
assert_contains "$core" 'Keep its Integration Message and adapter realization distinct from the local Domain Event type' "projection should preserve local facts and wire contracts separately"
assert_contains "$core" 'It creates no production event type, persistence, dispatch, or lasting artifact' "projection should leave analytical Workshop Events out of production code"
assert_contains "$core" 'Do not create an exhaustive permanent projection' "implementation trace should remain sparse"
assert_contains "$core" 'Keep this trace as temporary task evidence outside DDD artifacts' "implementation trace should not become authority"

scaffold="$CLAUDE_ROOT/references/ddd-golang-scaffold.md"
assert_contains "$scaffold" 'internal/business/' "Go scaffold should support multiple bounded contexts"
assert_contains "$scaffold" 'application.go' "Go scaffold should require application.go"
assert_contains "$scaffold" 'assembler.go' "Go scaffold should require assembler.go"
assert_contains "$scaffold" 'messagesubscriber/' "Go scaffold should separate message subscribers"
assert_contains "$scaffold" 'taskprocessor/' "Go scaffold should separate task processors"
assert_contains "$scaffold" 'convert.go' "Go scaffold should use convert.go for persistence mapping"
assert_contains "$scaffold" 'gen/' "Go scaffold should place generated stubs under gen"
assert_contains "$scaffold" 'private/v1/' "Go scaffold should separate deployment-private RPC contracts"
assert_contains "$scaffold" 'public/v1/' "Go scaffold should separate externally supported RPC contracts"
assert_contains "$scaffold" 'integration/v1/' "Go scaffold should separate Integration Message contracts"
assert_contains "$scaffold" 'task/v1/' "Go scaffold should place durable Task schemas under proto"
assert_contains "$scaffold" 'migrations/' "Go scaffold should use the canonical migration directory"
assert_contains "$scaffold" 'internal/pkg/transaction' "Go scaffold should place the conditional transaction contract outside individual bounded contexts"

application="$CLAUDE_ROOT/references/ddd-golang-application.md"
assert_contains "$application" 'type Application struct' "Go Application should expose a grouped registry"
assert_contains "$application" 'Commands Commands' "Go Application should group Command handlers"
assert_matches "$application" '^[[:space:]]+Queries[[:space:]]+Queries' "Go Application should group Query handlers"
assert_contains "$application" 'func AssembleUserDTO' "Go Application should define DTO-to-Entity mapping"
assert_contains "$application" 'func AssembleUserEntity' "Go Application should define Entity-to-DTO mapping"
assert_contains "$application" 'domain.NewUser' "new Domain objects should use a Domain Factory"
assert_contains "$application" 'Only a confirmed Model may authorize one Application use case to save several independent Aggregate Roots atomically, and only within one bounded context and one local transactional resource.' "multi-Aggregate transactions should require confirmed Model authority and one local consistency scope"
assert_contains "$application" 'Application defines the transaction scope; Infrastructure owns begin, enlistment, commit, and rollback.' "Application should own use-case scope without owning transaction machinery"
assert_contains "$application" 'internal/pkg/transaction/transactor.go' "Go Application should share one project-local provider-neutral Transactor contract"
assert_contains "$application" 'Within(context.Context, func(context.Context) error) error' "Go Transactor should expose only a context-propagating callback"
assert_contains "$application" 'Only when an accepted request-scoped post-commit dispatch flow exists' "Go Application tests should not invent event-dispatch paths"

domain="$CLAUDE_ROOT/references/ddd-golang-domain.md"
assert_contains "$domain" 'github.com/go-playground/validator/v10' "Go Domain should own business-data validation"
assert_contains "$domain" 'It does not need to span multiple Aggregates' "Domain Service should not require cross-Aggregate work"
assert_contains "$domain" 'does not save, control transactions' "Domain Services should neither persist Aggregates nor control transactions"
assert_contains "$domain" 'Select one lifecycle from accepted project authority or Tactical Design. Persistence does not select it.' "Go Domain should defer lifecycle selection to design authority"
assert_contains "$domain" '### Request-scoped Aggregate' "Go Domain should retain the scoped stale branch"
assert_contains "$domain" '### Resident Aggregate with checkpoint persistence' "Go Domain should support resident runtime authority"
assert_contains "$domain" 'failed checkpoint does not implicitly roll back or overwrite its live state' "Resident checkpoint failure should not redefine live authority"
assert_contains "$domain" 'In an accepted request-scoped post-commit flow, only Application drains the collection' "Go Domain should scope persistence-gated event draining"
assert_contains "$domain" 'House Style does not make checkpoint success the precondition for Domain sequencing or live-state event handling' "Go Domain should leave resident event timing to accepted design"
assert_contains "$domain" 'Domain owner or Domain Service may invoke a narrow Domain-owned collaborator' "Go Domain should preserve business timing with an inward-owned contract"
assert_contains "$domain" 'core model is state polymorphism' "Go FSM guidance should model polymorphic state behavior"
assert_contains "$domain" '*fsm.SimpleState' "Go FSM guidance should use the component base state"
assert_contains "$domain" "current state's behavior" "Go FSM guidance should delegate business behavior to the current state"
assert_contains "$domain" 'HasTransition' "Go FSM guidance should reject transition lookup as the behavior permission check"
assert_contains "$domain" 'RegisterStateBuilder' "Go FSM guidance should require builders for transition targets"

cqrs="$CLAUDE_ROOT/references/ddd-golang-cqrs.md"
assert_contains "$cqrs" 'Do not create a QueryRepository merely because an endpoint or method is named `Get`' "CQRS should not force focused Get reads through QueryRepository"
assert_contains "$cqrs" 'Lists, pages, history, reports, statistics' "CQRS should route distinct read models through QueryRepository"

transport="$CLAUDE_ROOT/references/ddd-golang-transport.md"
assert_contains "$transport" 'transport/connectrpc' "Go Transport should own ConnectRPC adapters"
assert_contains "$transport" 'transport/messagesubscriber' "Go Transport should own Integration Message subscribers"
assert_contains "$transport" 'transport/taskprocessor' "Go Transport should own task processors"
assert_contains "$transport" 'message.Subscriber.Subscribe' "Go Transport should separate subscriber registration"
assert_contains "$transport" 'message.Runner.Run' "Go Runtime should own the message runner lifecycle"
assert_contains "$transport" 'app.Commands' "Go Transport adapters should delegate through the Application registry"
assert_contains "$transport" 'gen/user/public/v1' "Go Transport should use the external RPC contract namespace"

events="$CLAUDE_ROOT/references/ddd-golang-events-messages.md"
assert_contains "$events" 'Published Fact Contract' "Go messaging should define producer-owned facts"
assert_contains "$events" 'It is an Integration Message contract' "Go messaging should classify published facts as Integration Messages"
assert_contains "$events" 'Asynchronous Intent Contract' "Go messaging should define receiver-owned intents"
assert_contains "$events" 'Use outbox only when confirmed recovery semantics or accepted project constraints require' "Go messaging should keep outbox conditional without a separate design gate"
assert_contains "$events" 'does not supply an xorm Store' "Go messaging should not invent missing outbox adapters"
assert_contains "$events" 'app.Commands' "Go message subscribers should delegate through the Application registry"

taskqueue="$CLAUDE_ROOT/references/ddd-golang-taskqueue.md"
assert_contains "$taskqueue" 'application/task' "Go taskqueue should own task contracts in Application"
assert_contains "$taskqueue" 'transport/taskprocessor' "Go taskqueue should own processors in Transport"
assert_contains "$taskqueue" 'internal/pkg/taskqueue' "Go taskqueue should keep Asynq runtime technical"
assert_contains "$taskqueue" 'app.Commands' "Go task processors should delegate through the Application registry"
assert_contains "$taskqueue" 'proto/<context>/task/v1' "Go taskqueue should protect durable payload schemas with protobuf"
assert_contains "$taskqueue" 'taskqueue.NewProtoTask' "Go task contracts should use the protobuf constructor"
assert_contains "$taskqueue" 'taskqueue.DecodeProto' "Go task processors should use the protobuf decoder"
assert_contains "$taskqueue" 'taskqueue.ProtoCodec' "Go task tests should verify codec metadata"
assert_contains "$taskqueue" 'NewEnqueueOptions(options...).Validate()' "Go taskqueue guidance should validate provider-facing policy"
if rg -n 'taskqueue\.(NewJSONTask|DecodeJSON)' "$CLAUDE_ROOT"/references/ddd-golang*.md >/dev/null; then
  fail "Go taskqueue house style should not retain JSON task construction or decoding"
fi

infrastructure="$CLAUDE_ROOT/references/ddd-golang-infrastructure.md"
assert_contains "$infrastructure" 'infrastructure/convert.go' "Go Infrastructure should own DO/Domain conversion"
assert_contains "$infrastructure" 'xorm.io/xorm' "Go Infrastructure should use the adopted ORM"
assert_contains "$infrastructure" 'Prefer small Aggregates' "Go Infrastructure should keep small Aggregates as the default"
assert_contains "$infrastructure" 'mutation journal keyed by Entity kind and identity' "Go Infrastructure should expose optional Aggregate change tracking"
assert_contains "$infrastructure" 'If a context still carries a transaction declaration but its session is missing, mismatched, expired, or already closed, resolution returns a stable error and never falls back to the engine.' "marked invalid transactions should fail closed instead of falling back"
assert_contains "$infrastructure" 'WithinOrJoin(context.Context, func(xorm.Interface) error) error' "multi-statement Repository operations should join or own a transaction without lifecycle ambiguity"
assert_contains "$infrastructure" 'a present but invalid declaration returns the stable participation error without invoking the callback or writing' "join-or-own transaction helpers should reject marked invalid state"
assert_contains "$infrastructure" 'Prove commit and rollback with the real Repository adapters and MySQL, observing durable state from a fresh observer after the transaction boundary; static checks and fake Repository tests do not prove atomicity or enlistment.' "multi-Aggregate transaction guidance should require real-adapter integration evidence"
assert_contains "$infrastructure" 'Do not log and return the same error' "Go Infrastructure should avoid duplicate error logs"

runtime="$CLAUDE_ROOT/references/ddd-golang-runtime.md"
assert_contains "$runtime" 'Execution Completion Log' "Go Runtime should define completion-log ownership"
assert_contains "$runtime" 'trace_id' "Go Runtime should define trace correlation fields"
assert_contains "$runtime" 'request_id' "Go Runtime should define request correlation fields"

# Sparse compact-guide ownership sentinels. These protect architectural
# boundaries and adopted entry points without snapshotting prose or line counts.
assert_contains "$python_guide" 'application/application.py' "Python guide should expose the Application registry"
assert_contains "$python_guide" 'application/assembler.py' "Python guide should own Application mapping"
assert_contains "$python_guide" 'messagesubscriber/' "Python guide should separate message subscribers"
assert_contains "$python_guide" 'taskprocessor/' "Python guide should separate task processors"
assert_contains "$python_guide" 'gen/' "Python guide should isolate generated contracts"

assert_contains "$typescript_guide" 'application/application.ts' "TypeScript guide should expose the Application registry"
assert_contains "$typescript_guide" 'src/business/' "TypeScript guide should organize bounded contexts before layers"
assert_contains "$typescript_guide" 'transport/' "TypeScript guide should keep inbound adapters in Transport"
assert_contains "$typescript_guide" 'infrastructure/persistence/convert.ts' "TypeScript guide should own persistence conversion"
assert_contains "$typescript_guide" 'gen/' "TypeScript guide should isolate generated contracts"
assert_contains "$typescript_guide" 'This example uses the request-scoped optimistic lifecycle' "TypeScript guide should scope stale behavior"
assert_contains "$typescript_guide" 'resident Aggregate' "TypeScript guide should admit resident authority"

database="$CLAUDE_ROOT/references/database.md"
assert_contains "$database" 'Every table governed by this profile' "database profile should define standard columns"
for column in '`id` varchar(36)' '`version` int unsigned' '`created_at` bigint' '`updated_at` bigint' '`deleted_at` bigint'; do
  assert_contains "$database" "$column" "database profile missing standard column $column"
done
assert_contains "$database" 'new in-memory Aggregate has version `0`' "database profile should define initial versions"
assert_contains "$database" '### Request-scoped Optimistic Aggregate Lifecycle' "database profile should scope optimistic stale behavior"
assert_contains "$database" 'Database House Style does not choose it over a resident Aggregate' "database profile should not make lifecycle decisions"
assert_contains "$database" '### Resident Aggregate Checkpoints' "database profile should implement resident checkpoints conditionally"
assert_contains "$database" 'checkpoint write never makes the resident instance stale' "database profile should preserve live authority"
assert_contains "$database" 'Every participating one-Root Repository joins the same physical transaction so all writes commit or roll back together' "database guidance should require one physical transaction for the confirmed exception"
if rg -n 'xorm|go-sql-driver|github\.com/google/uuid|convert\.go|\*xorm' "$database" >/dev/null; then
  rg -n 'xorm|go-sql-driver|github\.com/google/uuid|convert\.go|\*xorm' "$database" >&2
  fail "shared database profile should not own Go adapter choices"
fi

# Public documentation exposes the same final reference catalog.
claude_reference_section="$(sed -n '/^## References$/,$p' "$CLAUDE_ROOT/README.md")"
codex_reference_section="$(sed -n '/^## References$/,$p' "$CODEX_ROOT/README.md")"
[ "$claude_reference_section" = "$codex_reference_section" ] || fail "Claude and Codex README reference catalogs should match"
for reference in "${references[@]}"; do
  assert_contains "$CLAUDE_ROOT/README.md" "\`$reference\`" "plugin README missing $reference"
done
for retired_reference in ddd-agent-contract.md ddd-modeling-gates.md mysql.md; do
  ! rg -Fq -- "\`$retired_reference\`" "$CLAUDE_ROOT/README.md" || fail "plugin README lists retired $retired_reference"
done

assert_contains "$ROOT/README.md" '/plugin install ddd-expert@skill-workshop' "root README missing Claude ddd-expert install command"
assert_contains "$ROOT/README.md" 'codex plugin add ddd-expert@skill-workshop-codex' "root README missing Codex ddd-expert install command"
assert_contains "$ROOT/README.md" 'Domain/Application/Interface/Infrastructure/Runtime' "root README should expose every architecture responsibility"
assert_contains "$ROOT/README.md" 'Go names the physical Interface package `transport`' "root README should map Go transport to the shared Interface vocabulary"
assert_contains "$ROOT/README.md" 'complete ten-step discussion method' "root README should preserve EventStorming discussion depth"
assert_contains "$ROOT/README.md" 'derives essential business pressures from confirmed rules' "root README should expose Tactical Design inputs"
assert_contains "$ROOT/README.md" 'compares credible object compositions by pressure coverage and accidental design burden' "root README should expose Tactical Design tradeoffs"
assert_contains "$ROOT/README.md" 'actual Domain Events' "root README should distinguish production events"
assert_contains "$ROOT/README.md" 'receiver-shaped free functions require a concrete ownership reason' "root README should bind behavior to methods"
assert_contains "$ROOT/README.md" 'Codify treats the strategic model and domain-object slices as read-only semantic constraints, not a complete software design' "root README should define Codify implementation latitude"

sparse_adr="$ROOT/docs/adr/0009-sparse-current-ddd-artifacts.md"
[ -f "$sparse_adr" ] || fail "sparse DDD workflow ADR missing"
assert_contains "$sparse_adr" 'Status: Accepted' "sparse DDD workflow ADR should be accepted"
assert_contains "$sparse_adr" 'EventStorming keeps all ten discussion steps' "ADR should preserve EventStorming discussion"
assert_contains "$sparse_adr" '`docs/ddd-expert/context-map.md`' "ADR should define current Context Map authority"
assert_contains "$sparse_adr" '`docs/ddd-expert/context/<context-slug>/model.md`' "ADR should define current Model authority"
assert_contains "$sparse_adr" 'Business Rules' "ADR should define pressure-led Tactical Design authority"
assert_contains "$sparse_adr" '-> essential business pressures' "ADR should define pressure-led Tactical Design order"
assert_contains "$sparse_adr" 'writes or replaces that section in `domain-objects.md` immediately' "ADR should define per-Root writes"
assert_contains "$sparse_adr" 'definition;' "ADR should define object descriptions"
assert_contains "$sparse_adr" 'actual Domain Events.' "ADR should define production events"
assert_contains "$sparse_adr" 'A behavior listed under a Root or Entity is normally realized as a method on that object' "ADR should define method ownership"
assert_contains "$sparse_adr" 'Codify realizes the model through House Style' "ADR should define House Style realization"
assert_contains "$sparse_adr" 'There are no UML or sequence diagrams' "ADR should remove diagram artifacts"
assert_contains "$sparse_adr" 'no such lifecycle exists' "ADR should remove artifact state machinery"

for superseded_adr in \
  0003-event-storming-whole-model-confirmation.md \
  0004-model-ready-enters-codify-directly.md \
  0005-event-storming-minutes-and-current-models.md \
  0007-conditional-tactical-design-and-claims.md \
  0008-design-artifacts-are-falsifiable-candidates.md; do
  assert_contains "$ROOT/docs/adr/$superseded_adr" 'Status: Superseded by [ADR 0009]' "$superseded_adr should no longer be current authority"
done

assert_contains "$ROOT/CONTEXT.md" '**Strategic Model**:' "shared vocabulary should define strategic authority"
assert_contains "$ROOT/CONTEXT.md" '**Strategic Business Rule**:' "shared vocabulary should define downstream business authority"
assert_contains "$ROOT/CONTEXT.md" '**Domain Object Slice**:' "shared vocabulary should define tactical authority"
assert_contains "$ROOT/CONTEXT.md" '**Pressure-led Tactical Design**:' "shared vocabulary should define discussion order"
assert_contains "$ROOT/CONTEXT.md" '**Per-Root Confirmation**:' "shared vocabulary should define write granularity"
assert_contains "$ROOT/CONTEXT.md" '**Behavior Description**:' "shared vocabulary should define behavior sentences"
assert_contains "$ROOT/CONTEXT.md" '**Actual Domain Event**:' "shared vocabulary should distinguish production events"
assert_contains "$ROOT/CONTEXT.md" 'the grammatical subject is the owning Root or Entity and normally maps to a method on that object' "shared vocabulary should bind accepted behavior to methods"
assert_not_contains "$ROOT/CONTEXT.md" '**Modeling Contradiction**:' "shared vocabulary should not preserve a Codify return loop"
assert_not_contains "$ROOT/CONTEXT.md" '**Bounded Context Architecture**:' "shared vocabulary should remove architecture artifact authority"
assert_not_contains "$ROOT/CONTEXT.md" '**Tactical Design Claim**:' "shared vocabulary should remove claims machinery"

echo "  ddd-expert plugin: sparse strategic and tactical contracts correct"
