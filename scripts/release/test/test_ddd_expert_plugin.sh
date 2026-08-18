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
jq -e '.interface.defaultPrompt | all(.[]; contains("user\u0027s purpose") and contains("falsifiable strategic model") and contains("domain-object responsibilities") and contains("reconcile the evidence") and contains("$ddd-expert:tactical-design") and contains("$ddd-expert:codify"))' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert default prompt should expose purpose-led discovery and falsifiable Tactical Design"
jq -e '.interface.longDescription | contains("user\u0027s purpose") and contains("structural hypotheses") and contains("reversible implementation") and contains("reconciled ready design")' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert manifest should describe the candidate-to-evidence lifecycle"
jq -e '.interface.capabilities | index("Write")' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert manifest should declare artifact writes"
[ ! -e "$CLAUDE_ROOT/hooks" ] || fail "Claude ddd-expert should not ship hooks"
[ ! -e "$CODEX_ROOT/hooks" ] || fail "Codex ddd-expert should not ship hooks"
[ ! -e "$CODEX_ROOT/codex-hooks-snippet.json" ] || fail "Codex ddd-expert should not ship hook snippet"

if rg -n '\$?superpowers(:|-memory|-architect|-ddd-architect)|docs/superpowers' "$CLAUDE_ROOT" "$CODEX_ROOT" >/dev/null; then
  rg -n '\$?superpowers(:|-memory|-architect|-ddd-architect)|docs/superpowers' "$CLAUDE_ROOT" "$CODEX_ROOT" >&2
  fail "ddd-expert should not bind to superpowers plugins, skills, or paths"
fi

# The modeling, implementation, and review skills own judgment and load the
# shared artifact protocol where needed.
for skill in event-storming tactical-design codify guard; do
  claude_skill="$CLAUDE_ROOT/skills/$skill/SKILL.md"
  codex_skill="$CODEX_ROOT/skills/$skill/SKILL.md"
  [ -f "$claude_skill" ] || fail "Claude ddd-expert missing $skill skill"
  [ -f "$codex_skill" ] || fail "Codex ddd-expert missing $skill skill"
  cmp -s "$claude_skill" "$codex_skill" || fail "Claude and Codex $skill skills should match"
  rg -q '^description: Use when ' "$claude_skill" || fail "$skill description should start with Use when"
  assert_references_last "$claude_skill" "$skill"
done

claude_maintainer="$CLAUDE_ROOT/skills/maintain-artifacts/SKILL.md"
codex_maintainer="$CODEX_ROOT/skills/maintain-artifacts/SKILL.md"
[ -f "$claude_maintainer" ] || fail "Claude ddd-expert missing maintain-artifacts skill"
[ -f "$codex_maintainer" ] || fail "Codex ddd-expert missing maintain-artifacts skill"
diff -u \
  <(sed '/^user-invocable: false$/d' "$claude_maintainer") \
  "$codex_maintainer" >/dev/null || fail "Claude and Codex maintain-artifacts skill bodies should match"
rg -q '^description: Use when ' "$claude_maintainer" || fail "maintain-artifacts description should start with Use when"
assert_contains "$claude_maintainer" 'user-invocable: false' "maintain-artifacts should be hidden from Claude's user command menu"
if rg -n '^user-invocable:' "$codex_maintainer" >/dev/null; then
  fail "Codex maintain-artifacts should not contain Claude-only frontmatter"
fi
assert_references_last "$claude_maintainer" "maintain-artifacts"

expected_skill_inventory="$(printf '%s\n' codify event-storming guard maintain-artifacts tactical-design | sort)"
for root in "$CLAUDE_ROOT" "$CODEX_ROOT"; do
  actual_skill_inventory="$(find "$root/skills" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)"
  [ "$actual_skill_inventory" = "$expected_skill_inventory" ] || {
    diff -u <(printf '%s\n' "$expected_skill_inventory") <(printf '%s\n' "$actual_skill_inventory") >&2 || true
    fail "ddd-expert skill inventory should contain modeling, conditional tactical design, codify, guard, and the internal artifact protocol"
  }
done

for template in README architecture artifact-layout context-map event-storming model tactical-design; do
  claude_template="$CLAUDE_ROOT/templates/$template.md"
  codex_template="$CODEX_ROOT/templates/$template.md"
  [ -f "$claude_template" ] || fail "Claude ddd-expert missing $template artifact template"
  [ -f "$codex_template" ] || fail "Codex ddd-expert missing $template artifact template"
  cmp -s "$claude_template" "$codex_template" || fail "Claude and Codex $template artifact templates should match"
done
[ ! -e "$CLAUDE_ROOT/templates/design.md" ] || fail "Claude ddd-expert should not keep a standalone Design artifact template"
[ ! -e "$CODEX_ROOT/templates/design.md" ] || fail "Codex ddd-expert should not keep a standalone Design artifact template"
if rg -n 'codify_ready|design_status|missing_design|evolving_design|stale_design|design-realization|Design Realization' \
  "$CLAUDE_ROOT" "$CODEX_ROOT" >/dev/null; then
  rg -n 'codify_ready|design_status|missing_design|evolving_design|stale_design|design-realization|Design Realization' \
    "$CLAUDE_ROOT" "$CODEX_ROOT" >&2
  fail "ddd-expert should not retain standalone Design readiness states or review authority"
fi

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
tactical_design_template="$CLAUDE_ROOT/templates/tactical-design.md"
event_storming_template="$CLAUDE_ROOT/templates/event-storming.md"
model_template="$CLAUDE_ROOT/templates/model.md"

# Design-quality contracts stay intentionally small. They protect attention,
# authority, and artifact boundaries without encoding one architecture answer.
assert_contains "$event_storming_skill" '## Start with the user' "EventStorming should identify the requested purpose before evaluating"
assert_contains "$event_storming_skill" '**discovery**' "EventStorming should support open discovery"
assert_contains "$event_storming_skill" '**thesis review**' "EventStorming should challenge an existing thesis without replaying discovery mechanically"
assert_contains "$event_storming_skill" '**model challenge**' "EventStorming should accept downstream falsification evidence"
assert_contains "$event_storming_skill" 'Do not turn an observational or explanatory request into a process-compliance audit' "EventStorming should follow the user purpose"
assert_contains "$event_storming_skill" '**confirmed business facts and constraints**' "EventStorming should separate binding facts"
assert_contains "$event_storming_skill" 'current falsifiable structural hypothesis' "EventStorming should keep strategic structure revisable"
assert_contains "$event_storming_skill" 'Code and tests prove current behavior, not business authority' "EventStorming should use code as evidence rather than authority"
assert_contains "$event_storming_skill" 'Ask one question only when its answer could materially change the current model' "EventStorming should spend questions on high-impact uncertainty"
assert_contains "$event_storming_skill" 'Stop when further questioning has diminishing decision value' "EventStorming should avoid exhaustive interviewing"
assert_contains "$event_storming_skill" 'Rebuild the smallest whole hypothesis from the supported facts' "EventStorming should reset after repeated model-level correction"
assert_contains "$event_storming_skill" '## The ten EventStorming lenses' "EventStorming should retain causal discovery lenses"
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
actual_workflow_steps="$(awk '/^## The ten EventStorming lenses$/ { in_workflow = 1; next } /^A \*\*Workshop Event\*\*/ { in_workflow = 0 } in_workflow && /^[0-9]+\. \*\*/ { sub(/:.*/, ""); print }' "$event_storming_skill")"
[ "$actual_workflow_steps" = "$expected_workflow_steps" ] || fail "EventStorming should preserve the ten causal lenses in order"
assert_contains "$event_storming_skill" 'facts it owns, lifecycle and change reasons, rules, semantic result, relationships to other owned objects' "EventStorming should expose core-object responsibility evidence"
assert_contains "$event_storming_skill" 'class shape and call direction belong to Tactical Design' "EventStorming should stop before software design"
assert_contains "$event_storming_skill" 'changes a business right, obligation, value, or required next action' "EventStorming should use a positive adverse-path materiality gate"
assert_contains "$event_storming_skill" 'do not complete generic rejection, failure, retry, or recovery catalogues' "EventStorming should not optimize artifact exhaustiveness"
assert_contains "$event_storming_skill" 'as `ready` for implementation evidence, not as immutable truth' "EventStorming ready should remain falsifiable"
assert_contains "$event_storming_skill" 'write only one `draft` minutes file' "EventStorming should preserve the pre-confirmation write barrier"
assert_contains "$event_storming_skill" 'A Tactical Design Model Challenge is one consolidated batch' "EventStorming should reconsider related counterexamples together"
assert_contains "$event_storming_skill" 'Do not load `maintain-artifacts` while establishing purpose' "EventStorming should not preload artifact mechanics into discovery"
assert_contains "$event_storming_skill" 'Load the internal skill in full only when a coherent candidate needs structural validation or a write' "EventStorming should load artifact mechanics lazily"

assert_contains "$event_storming_template" 'This template intentionally supplies no example topology' "EventStorming template should require evidence-derived topology"
assert_mermaid_templates_have_no_topology "$event_storming_template" "EventStorming template"

assert_contains "$model_template" 'confirmed business facts and the current falsifiable structural model' "Model should distinguish facts from structure"
assert_contains "$model_template" 'owned facts, lifecycle and change reasons, rules, semantic result' "Model should retain core-object responsibility evidence"
assert_contains "$model_template" 'A Root may compose objects with distinct responsibilities' "Model should not make the Root absorb every behavior"
assert_contains "$model_template" '## Material Adverse Semantics' "Model should keep only business-material adverse meaning"
assert_not_contains "$model_template" '## Failure and Recovery Semantics' "Model should not require a generic recovery catalogue"

assert_contains "$tactical_design_skill" '**user thesis**' "Tactical Design should challenge a user-supplied thesis"
assert_contains "$tactical_design_skill" '**agent proposal**' "Tactical Design should attack its own proposal"
assert_contains "$tactical_design_skill" '### 2. Build the domain-object thesis' "Tactical Design should model objects before layers"
assert_contains "$tactical_design_skill" 'Mermaid `classDiagram`' "Tactical Design should require an entity-level UML view"
assert_contains "$tactical_design_skill" '**state authority**' "Tactical Design should name live and durable authority"
assert_contains "$tactical_design_skill" '**semantic flow**' "Tactical Design should name the minimal result flow"
assert_contains "$tactical_design_skill" 'Domain owns when a business capability is required' "Tactical Design should separate business timing from execution"
assert_contains "$tactical_design_skill" 'Which confirmed responsibility or guarantee becomes impossible if this is removed?' "Tactical Design should require a positive necessity proof"
assert_contains "$tactical_design_skill" 'Rebuild the smallest whole thesis from supported facts' "Tactical Design should reframe repeated ownership mistakes"
assert_contains "$tactical_design_skill" 'Do not write a complete solution artifact before the first design question' "Tactical Design should avoid premature artifact anchoring"
assert_contains "$tactical_design_skill" 'Derive participants and calls from the object thesis' "Tactical Design should not preload a solution topology"
assert_contains "$tactical_design_skill" 'Show the normal path first' "Tactical Design should prioritize the explanatory flow"
assert_contains "$tactical_design_skill" 'Materialize an exploration draft' "Tactical Design should make draft status explicit"
assert_contains "$tactical_design_skill" 'Reconcile implementation evidence' "Tactical Design should revise candidates from code evidence"
assert_contains "$tactical_design_skill" 'unsupported mechanisms are deleted, not retained under a new name' "Tactical Design should prevent semantic renaming"
assert_contains "$tactical_design_skill" 'preserves both the confirmed business facts and the current strategic structure' "Tactical Design should not override Model-owned strategic structure"
assert_contains "$tactical_design_skill" 'later concrete implementation evidence falsifies a candidate while its ready EventStorming facts and strategic model remain unchanged' "Tactical Design should accept same-authority falsification evidence"
assert_contains "$tactical_design_skill" 'Direct retirement points `superseded_by` to that surviving ready EventStorming record' "Tactical Design should retire an unnecessary ready delta without inventing replacement authority"
assert_contains "$tactical_design_skill" 'An unreconciled tactical difference that preserves confirmed facts and current strategic structure' "Tactical Design should not absorb strategic contradictions"
assert_contains "$tactical_design_skill" 'Do not load `maintain-artifacts` while clarifying purpose' "Tactical Design should not preload artifact mechanics into design"
assert_contains "$tactical_design_skill" 'Without implementation evidence it does not become `ready`' "Design-only Tactical Design should remain draft"
assert_contains "$tactical_design_skill" 'Do not add final `TD-NNN` claims or BC Architecture dispositions yet' "Exploration drafts should not become conformance targets"

assert_contains "$tactical_design_template" 'classDiagram' "Tactical Design template should expose the domain-object model"
assert_contains "$tactical_design_template" '## State Authority and Semantic Flow' "Tactical Design template should expose state and call ownership"
assert_contains "$tactical_design_template" '## Necessity Proof' "Tactical Design template should expose deletion evidence"
assert_contains "$tactical_design_template" 'Show the normal path first' "Tactical Design template should not enumerate failures by default"
assert_mermaid_templates_have_no_topology "$tactical_design_template" "Tactical Design template"
assert_contains "$tactical_design_template" '## Reconciliation Evidence' "Tactical Design template should capture implementation falsification"
assert_contains "$tactical_design_template" '## Tactical Design Claims' "Tactical Design template should preserve final semantic claims"
assert_contains "$tactical_design_template" '## BC Architecture Projection' "Tactical Design template should retain sparse durable projection"
assert_contains "$tactical_design_template" 'Ready-only: omit this entire section from the exploration draft' "Final claims should be absent from exploration drafts"

architecture_template="$CLAUDE_ROOT/templates/architecture.md"
assert_contains "$architecture_template" 'architecture_revision: 1' "BC Architecture should use revisioned current authority"
assert_contains "$architecture_template" '# <Bounded Context> Architecture' "architecture template should identify one owning context"
assert_contains "$architecture_template" '## Current Architecture Decisions' "BC Architecture should contain one sparse current-decision section"
assert_contains "$architecture_template" '| Decision ID | Concern | Current BC-specific architecture decision | Source |' "BC Architecture should keep one compact decision ledger"
assert_contains "$architecture_template" '<a id="ARCH-001"></a>ARCH-001' "BC Architecture decision IDs should expose stable fragment anchors"
assert_contains "$architecture_template" 'Create this file only when at least one current row exists' "BC Architecture should be lazy rather than boilerplate"
assert_contains "$architecture_template" 'it may name the just-superseded record solely as removal provenance while no Source points to it' "BC Architecture should distinguish retirement provenance from current claim authority"
assert_contains "$architecture_template" 'Do not repeat canonical Model facts, generic House Style, complete Tactical Design sequences, code structure, or historical rationale' "BC Architecture should preserve one-owner boundaries"
[ "$(rg -c '^## ' "$architecture_template")" -eq 1 ] || fail "BC Architecture should remain a single sparse decision section"
assert_not_contains "$architecture_template" 'sequenceDiagram' "BC Architecture should not duplicate Tactical Design sequences"
assert_not_contains "$architecture_template" '## Decisions and Reasons' "BC Architecture should not duplicate design history"
codify_skill="$CLAUDE_ROOT/skills/codify/SKILL.md"
guard_skill="$CLAUDE_ROOT/skills/guard/SKILL.md"

assert_contains "$codify_skill" 'execute only `inspect` with authority `codify`' "Codify should keep artifacts read-only"
assert_contains "$codify_skill" '**exploration**' "Codify should support reversible draft exploration"
assert_contains "$codify_skill" '**final realization**' "Codify should distinguish final ready realization"
assert_contains "$codify_skill" 'The draft is a candidate, not authority' "Codify should not promote a draft through implementation"
assert_contains "$codify_skill" 'Do not perform irreversible external actions' "Codify exploration should stay reversible"
assert_contains "$codify_skill" 'smallest reversible tactical alternative that preserves confirmed business facts and strategic structure' "Codify should use code to falsify tactical structure"
assert_contains "$codify_skill" 'every obsolete semantic responsibility actually deleted' "Codify should delete rather than rename mechanisms"
assert_contains "$codify_skill" '`design_evidence`' "Codify should return design evidence for reconciliation"
assert_contains "$codify_skill" 'Compare responsibilities, not names' "Codify should detect semantic renaming"
assert_contains "$codify_skill" 'Apply only House Rules whose lifecycle and design conditions are established' "Codify should not let House Style make modeling decisions"
assert_contains "$codify_skill" 'Model-owned Bounded Context, Aggregate, capability, or core-object structure' "Codify should return strategic-structure falsification to EventStorming"
assert_contains "$codify_skill" 'tactical alternative that preserves confirmed business facts and strategic structure' "Codify should keep Tactical Design alternatives below the strategic boundary"
assert_contains "$codify_skill" 'exploration stops with `design_evidence`' "Codify exploration should route back to Tactical Design"
assert_contains "$codify_skill" 'producer checkpoint remains `incomplete`' "Codify should not hand an unreconciled draft to Guard"
assert_contains "$codify_skill" 'Never run Guard against a Tactical Design `draft`' "Codify should guard only reconciled authority"
assert_not_contains "$codify_skill" 'codify_ready' "Codify should not add another readiness state"

assert_contains "$guard_skill" 'reconciled design' "Guard should review the final design rather than an initial candidate"
assert_contains "$guard_skill" 'does not certify that an early design candidate was wise' "Guard should not pretend fidelity proves design quality"
assert_contains "$guard_skill" 'A Tactical Design `draft` may have guided reversible exploration but cannot seed Guard' "Guard should reject unreconciled draft authority"
assert_contains "$guard_skill" 'live state authority, business sequencing' "Guard should inspect the missing system-design responsibilities"
assert_contains "$guard_skill" 'invoked Domain-language collaborator contract also belongs inward' "Guard should keep domain-timed capability ownership inward"
assert_contains "$guard_skill" 'Application supplies execution' "Guard should distinguish Application coordination"
assert_contains "$guard_skill" 'unreconciled tactical difference that preserves that structure' "Guard should route tactical drift to Tactical Design"
assert_contains "$guard_skill" 'Guard does not force code back to a structural hypothesis merely because it is currently recorded' "Guard should treat Model structure as falsifiable"
assert_contains "$guard_skill" 'concrete evidence against Model-owned Bounded Context, Aggregate, capability, or core-object structure' "Guard should route strategic falsification to EventStorming"
assert_contains "$guard_skill" 'concrete tactical evidence under the same ready authority routes to Tactical Design' "Guard should reopen an evidence-falsified ready tactical design"
assert_contains "$guard_skill" 'plain failure to realize an already reconciled ready claim remains a `violation`' "Guard should keep implementation drift in Codify"
assert_contains "$guard_skill" 'one fresh agent context distinct from the implementer' "Guard should remain independent"
assert_contains "$guard_skill" 'Do not run producer tests' "Guard should consume rather than repeat producer verification"
assert_contains "$guard_skill" 'mark-iteration-implemented' "Guard should retain narrow iteration closure"

assert_contains "$claude_maintainer" 'codify` may use `inspect` only' "Artifact maintenance should keep Codify read-only"
assert_contains "$claude_maintainer" '**structural** readiness' "Artifact maintenance should label what validation proves"
assert_contains "$claude_maintainer" 'Never describe structural validity as design validation' "Artifact maintenance should not imply design correctness"
assert_contains "$claude_maintainer" 'It may be reported to Codify only as an exploration candidate' "Artifact inspection should expose draft exploration without authority"
assert_contains "$claude_maintainer" 'one derived domain-object `classDiagram`' "Tactical validation should require an evidence-derived object model"
assert_contains "$claude_maintainer" 'state authority, semantic flow, necessity proof' "Tactical validation should cover the generative thesis"
assert_contains "$claude_maintainer" 'do not require a fixed Interface/Application/Repository topology' "Tactical validation should avoid a template answer"
assert_contains "$claude_maintainer" 'do not require a fixed Interface/Application/Repository topology or a diagram for every technical error' "Tactical validation should avoid exhaustive failure paths"
assert_contains "$claude_maintainer" 'Do not require or synthesize final `TD-NNN` claims' "Exploration validation should not preload final claims"
assert_contains "$claude_maintainer" 'Never write it before the first design question' "Artifact maintenance should avoid premature draft anchoring"
assert_contains "$claude_maintainer" 'Require the Reconciliation Evidence section' "Ready transition should account for implementation evidence"
assert_contains "$claude_maintainer" 'A design-only request stops at `draft`' "Artifact maintenance should require implementation evidence for ready"
assert_contains "$claude_maintainer" 'unresolved implementation/design deviation blocks the transition' "Artifact maintenance should prevent silent drift"
assert_contains "$claude_maintainer" '## Discard Tactical Design draft' "Artifact maintenance should retain candidate cleanup"
assert_contains "$claude_maintainer" '## Supersede ready Tactical Design' "Artifact maintenance should retain invalidated-history closure"
assert_contains "$claude_maintainer" 'implementation evidence reconciled under the same current ready authority' "Artifact maintenance should discard evidence-falsified drafts under unchanged business authority"
assert_contains "$claude_maintainer" 'implementation evidence under the same current ready authority invalidates an unimplemented `ready` Tactical Design' "Artifact maintenance should retire evidence-falsified ready designs under unchanged business authority"
assert_contains "$claude_maintainer" 'the `superseded_by` link names the authority now sufficient for realization' "Artifact maintenance should make same-authority retirement lineage explicit"
assert_contains "$claude_maintainer" 'whose section at the adverse-semantics position is still named `## Failure and Recovery Semantics`' "Artifact inspection should accept the prior Model adverse-semantics heading"
assert_contains "$claude_maintainer" 'Selected Domain Events table still ends with `Business failure or recovery`' "Artifact inspection should accept the prior Domain Event consequence column"
assert_contains "$claude_maintainer" 'never perform a format-only Model revision' "Legacy Model layout should migrate only with semantic authority"
assert_contains "$claude_maintainer" '## Mark iteration implemented' "Artifact maintenance should retain Guard closure"
assert_contains "$claude_maintainer" 'Never create `docs/ddd-expert/architecture.md`' "Artifact maintenance should reject a root architecture catch-all"
assert_not_contains "$claude_maintainer" '../../templates/design.md' "Artifact maintenance should not restore a standalone Design artifact"

assert_contains "$ROOT/scripts/eval/ddd-expert.js" 'put every source assertion and its frozen unit judgment in architecture_ledger' "Guard eval should retain its terminal ledger"
assert_contains "$ROOT/evals/ddd-expert/result.schema.json" '"architecture_ledger"' "Guard eval result should expose the architecture ledger"

if rg -n '../../templates/' \
  "$CLAUDE_ROOT/skills/event-storming/SKILL.md" \
  "$CLAUDE_ROOT/skills/codify/SKILL.md" \
  "$CLAUDE_ROOT/skills/guard/SKILL.md" \
  "$CODEX_ROOT/skills/event-storming/SKILL.md" \
  "$CODEX_ROOT/skills/codify/SKILL.md" \
  "$CODEX_ROOT/skills/guard/SKILL.md" >/dev/null; then
  fail "workflow skills should load template mechanics through maintain-artifacts"
fi
if rg -n '(\$|/)ddd-expert:' "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" >/dev/null; then
  rg -n '(\$|/)ddd-expert:' "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" >&2
  fail "shared SKILL contracts should not contain platform-specific invocation syntax"
fi
assert_contains "$CLAUDE_ROOT/README.md" '/ddd-expert:event-storming' "Claude README should use the EventStorming slash invocation"
assert_contains "$CODEX_ROOT/README.md" '$ddd-expert:event-storming' "Codex README should use the EventStorming dollar invocation"
assert_contains "$CLAUDE_ROOT/README.md" '/ddd-expert:tactical-design' "Claude README should expose conditional Tactical Design"
assert_contains "$CODEX_ROOT/README.md" '$ddd-expert:tactical-design' "Codex README should expose conditional Tactical Design"
assert_contains "$CLAUDE_ROOT/README.md" 'Use EventStorming as the single modeling path' "Claude README should expose one modeling workflow"
assert_contains "$CODEX_ROOT/README.md" 'Use EventStorming as the single modeling path' "Codex README should expose one modeling workflow"
assert_contains "$CLAUDE_ROOT/README.md" 'confirmed business facts + current falsifiable Models' "Claude README should distinguish facts from structural hypotheses"
assert_contains "$CODEX_ROOT/README.md" 'confirmed business facts + current falsifiable Models' "Codex README should distinguish facts from structural hypotheses"
assert_contains "$CLAUDE_ROOT/README.md" 'domain-object thesis + draft collaboration candidate' "Claude README should expose the system-thesis bridge"
assert_contains "$CODEX_ROOT/README.md" 'domain-object thesis + draft collaboration candidate' "Codex README should expose the system-thesis bridge"
assert_contains "$CLAUDE_ROOT/README.md" 'reversible exploration' "Claude README should expose implementation falsification"
assert_contains "$CODEX_ROOT/README.md" 'reversible exploration' "Codex README should expose implementation falsification"
assert_contains "$CLAUDE_ROOT/README.md" 'reconciled ready design' "Claude README should expose reconciliation before Guard"
assert_contains "$CODEX_ROOT/README.md" 'reconciled ready design' "Codex README should expose reconciliation before Guard"
assert_contains "$CODEX_ROOT/README.md" 'codex plugin marketplace upgrade skill-workshop-codex' "Codex README should upgrade by marketplace name"
assert_contains "$CLAUDE_ROOT/README.md" 'verified implementation checkpoint' "Claude README should expose the Codify checkpoint"
assert_contains "$CODEX_ROOT/README.md" 'verified implementation checkpoint' "Codex README should expose the Codify checkpoint"
assert_contains "$CLAUDE_ROOT/README.md" 'House Style supplies conditional realization rules' "Claude README should bound House Style ownership"
assert_contains "$CODEX_ROOT/README.md" 'House Style supplies conditional realization rules' "Codex README should bound House Style ownership"
if rg -n -F '$ddd-expert:maintain-artifacts' "$CODEX_ROOT/README.md" >/dev/null; then
  fail "Codex README should not expose the internal artifact protocol as a user command"
fi
if rg -n -F 'docs/ddd-expert/context/' "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" >/dev/null; then
  rg -n -F 'docs/ddd-expert/context/' "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" >&2
  fail "workflow skills should resolve artifact paths through the central layout contract"
fi
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
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Use this order when inputs disagree' "codify should define authority order"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" '**Preflight before edits**' "codify should preflight before modifying code"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Verify implementation evidence' "codify should produce local evidence before independent review"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'leave every `ready` iteration open' "codify should preserve iteration state when Guard is deferred"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'The later Guard reviews the cumulative change from an immutable base' "codify should retain deferred changes for later certification"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '**Use question-led implementation depth**' "guard should deepen only from a falsifiable architecture question"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '`clear`, `violation`, or `evidence_gap`' "guard should use terminal verdicts"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'keep it read-only' "guard should keep review work read-only"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'For a clear reviewed `ready` iteration' "guard should close only an iteration covered by its clear review"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Route to `codify`' "guard should route implementation violations to codify"

if rg -n 'ddd-golang-(scaffold|domain|application|transport|cqrs|infrastructure|events-messages|taskqueue|runtime)\.md' \
  "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" >/dev/null; then
  fail "workflow skills should enter Go House Style through its router rather than link implementation leaves directly"
fi
event_reference_links="$(awk '$0 == "## References" { in_refs = 1; next } in_refs && /^- Load / { print }' "$event_storming_skill")"
[ "$(printf '%s\n' "$event_reference_links" | sed '/^$/d' | wc -l)" -eq 1 ] || fail "EventStorming should load only its strategic modeling reference"
assert_contains "$event_storming_skill" '../../references/ddd-modeling.md' "EventStorming should load strategic modeling guidance"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'For Go, start with' "codify should enter Go guidance through its router"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'For Python or TypeScript, load only the sections for touched surfaces' "codify should load compact language guides selectively"
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
assert_contains "$core" 'It requires no production event type, persistence, or dispatch unless the Model separately selects stronger semantics' "projection should leave analytical Workshop Events out of production code"
assert_contains "$core" 'Keep it outside `model.md`, BC Architecture, ADRs, and implementation code' "projection should remain transient task evidence"

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
assert_contains "$ROOT/README.md" 'Go names its physical package `transport`' "root README should map Go transport to the shared Interface vocabulary"
assert_contains "$ROOT/README.md" 'confirmed business facts from a current falsifiable structural model' "root README should expose layered artifact authority"
assert_contains "$ROOT/README.md" 'domain-object UML, responsibilities, state authority, semantic flow, and necessity proof' "root README should expose the system thesis"
assert_contains "$ROOT/README.md" 'Codify may test it through reversible implementation' "root README should expose implementation evidence"
assert_contains "$ROOT/README.md" 'only the resulting `ready` design can enter final verification and Guard' "root README should expose reconciliation before certification"
assert_contains "$ROOT/README.md" 'House Style supplies conditional realization rules' "root README should bound House Style ownership"
assert_contains "$ROOT/README.md" 'link their latest minutes through `last_changed_by`' "root README should expose current Model provenance"
confirmation_adr="$ROOT/docs/adr/0003-event-storming-whole-model-confirmation.md"
direct_codify_adr="$ROOT/docs/adr/0004-model-ready-enters-codify-directly.md"
iteration_minutes_adr="$ROOT/docs/adr/0005-event-storming-minutes-and-current-models.md"
guard_review_adr="$ROOT/docs/adr/0006-guard-is-a-semantic-structure-review.md"
tactical_design_adr="$ROOT/docs/adr/0007-conditional-tactical-design-and-claims.md"
design_candidate_adr="$ROOT/docs/adr/0008-design-artifacts-are-falsifiable-candidates.md"
[ -f "$confirmation_adr" ] || fail "whole-model EventStorming ADR missing"
[ -f "$direct_codify_adr" ] || fail "direct model_ready-to-Codify ADR missing"
[ -f "$iteration_minutes_adr" ] || fail "EventStorming iteration-minutes ADR missing"
[ -f "$guard_review_adr" ] || fail "bounded Guard review ADR missing"
[ -f "$tactical_design_adr" ] || fail "conditional Tactical Design ADR missing"
[ -f "$design_candidate_adr" ] || fail "falsifiable design-artifact ADR missing"
assert_contains "$ROOT/docs/adr/0001-ddd-expert-reference-architecture.md" 'Status: Accepted' "historical DDD ADR should retain still-current architecture authority"
assert_contains "$ROOT/docs/adr/0001-ddd-expert-reference-architecture.md" 'EventStorming modeling and artifact-write decisions superseded by' "historical DDD ADR should narrow its superseded decision scope"
assert_contains "$ROOT/docs/adr/0001-ddd-expert-reference-architecture.md" 'Guard review topology and coverage decisions superseded by' "historical DDD ADR should link the bounded Guard replacement"
assert_contains "$confirmation_adr" 'temporary EventStorming Board' "new DDD ADR should preserve the pre-confirmation write barrier"
assert_contains "$confirmation_adr" 'only one frontier decision to the user per turn' "new DDD ADR should preserve the HITP conversation contract"
assert_contains "$confirmation_adr" 'steelmans the strongest credible alternative' "new DDD ADR should preserve constructive challenge"
assert_contains "$confirmation_adr" 'EventStorming diagram' "new DDD ADR should persist an EventStorming view"
assert_contains "$confirmation_adr" 'does not contain a per-file Documentation Impact Set' "new DDD ADR should keep file planning out of confirmation"
assert_contains "$confirmation_adr" 'Pre-confirmation Model materialization, Strategic-stop, separate Tactical Design authority, and downstream realization-axis decisions superseded by' "whole-model ADR should link every superseded workflow decision"
assert_contains "$confirmation_adr" 'Automated checks remain limited to deterministic workflow and artifact invariants' "new DDD ADR should bound automated evaluation"
assert_contains "$direct_codify_adr" 'A canonical `model_ready` Model is sufficient implementation authority and enters Codify directly' "direct Codify ADR should remove the intermediate readiness gate"
assert_contains "$direct_codify_adr" 'There is no standalone Design artifact, `codify_ready` status, or tactical-design workflow stage' "direct Codify ADR should retire the standalone design phase"
assert_contains "$direct_codify_adr" 'Guard two-axis topology superseded by' "direct Codify ADR should link the bounded Guard replacement"
assert_contains "$direct_codify_adr" 'replaces each affected canonical `model.md` with an incremented `model_status: draft` revision' "direct Codify ADR should define file-backed Model approval"
assert_contains "$confirmation_adr" 'EventStorming artifact placement and per-Model diagram persistence superseded by' "whole-model ADR should link the iteration-minutes replacement"
assert_contains "$direct_codify_adr" 'EventStorming artifact placement, Model status, and implementation closure superseded by' "direct Codify ADR should link the iteration-minutes replacement"
assert_contains "$iteration_minutes_adr" 'Guard review and closure preconditions superseded by' "iteration-minutes ADR should link the bounded Guard closure replacement"
assert_contains "$iteration_minutes_adr" '`draft -> ready -> implemented`' "iteration-minutes ADR should define the complete iteration lifecycle"
assert_contains "$iteration_minutes_adr" '`ready -> superseded`' "iteration-minutes ADR should preserve challenged ready history without false implementation"
assert_contains "$iteration_minutes_adr" 'regardless of whether the correcting evidence came from Tactical Design, the user, or another source' "iteration-minutes ADR should make correction lineage source-independent"
assert_not_contains "$iteration_minutes_adr" 'atomically changes it to `ready`' "iteration-minutes ADR should not promise filesystem-level atomicity"
assert_contains "$iteration_minutes_adr" 'one staged consistency write' "iteration-minutes ADR should describe the actual guarded write protocol"
assert_contains "$iteration_minutes_adr" '`model_revision` and `last_changed_by`, but no iteration status or complete EventStorming diagram' "iteration-minutes ADR should keep Models as current-state authority"
assert_contains "$guard_review_adr" 'one fresh, read-only agent context distinct from the implementer' "Guard ADR should preserve reviewer independence without fan-out"
assert_contains "$guard_review_adr" 'finite unit set from only two seeds' "Guard ADR should bound review breadth by architecture responsibilities"
assert_contains "$guard_review_adr" 'Every source assertion and governing reference remains represented in the child union' "Guard ADR should preserve atomic responsibility coverage"
assert_contains "$guard_review_adr" 'does not rerun tests, builds, migrations' "Guard ADR should separate structural review from producer verification"
assert_contains "$guard_review_adr" '607.320 seconds' "Guard ADR should record the accepted evaluation result"
assert_contains "$tactical_design_adr" 'Tactical Design is conditional on a real Design Delta' "Tactical Design ADR should define the invocation threshold"
assert_contains "$tactical_design_adr" 'no format-only Model revision is created' "Tactical Design ADR should preserve lazy capability-table migration"
assert_contains "$tactical_design_adr" 'No Design Delta creates no Tactical Design artifact' "Tactical Design ADR should reject empty ceremony"
assert_contains "$tactical_design_adr" '`model.md` owns current Bounded Context business authority, Role-to-Command permissions, Aggregate Capabilities, and event-triggered Commands' "Tactical Design ADR should preserve Model ownership"
assert_contains "$tactical_design_adr" 'optional `docs/ddd-expert/context/<context-slug>/architecture.md`' "Tactical Design ADR should place current architecture under its owning context"
assert_contains "$tactical_design_adr" 'Every Tactical Design Claim is accounted for exactly once as `projected` or `iteration-only`' "Tactical Design ADR should make claim disposition exhaustive"
assert_contains "$tactical_design_adr" 'No root `docs/ddd-expert/architecture.md` is introduced' "Tactical Design ADR should reject a root architecture catch-all"
assert_contains "$tactical_design_adr" 'one connected design revision batch' "Tactical Design ADR should batch related tactical clarification before redrawing"
assert_contains "$tactical_design_adr" 'one temporary Model Review Batch' "Tactical Design ADR should consolidate related Model contradictions before handback"
assert_contains "$tactical_design_adr" 'creates at most one correction draft' "Tactical Design ADR should prevent one EventStorming file per question"
assert_contains "$tactical_design_adr" 'Model Challenge' "Tactical Design ADR should define its falsification handback to EventStorming"
assert_contains "$tactical_design_adr" 'Evidence against Model-owned business meaning or Bounded Context, Aggregate, capability, or core-object strategic structure returns to EventStorming' "Tactical Design ADR should route strategic falsification to EventStorming"
assert_contains "$tactical_design_adr" 'only when it preserves that strategic structure' "Tactical Design ADR should keep tactical alternatives below the strategic boundary"
assert_contains "$tactical_design_adr" '`ready -> superseded`' "Tactical Design ADR should retire invalidated ready design without false implementation"
assert_contains "$tactical_design_adr" 'Ordinary `no_design_change` is a zero-write result' "Tactical Design ADR should separate no-change from cleanup outcomes"
assert_contains "$tactical_design_adr" 'Either path requires concrete evidence and replaces or removes every BC Architecture source from the stale claims' "Tactical Design ADR should close stale current architecture authority"
assert_contains "$tactical_design_adr" 'Guard does not parse every Mermaid arrow' "Tactical Design ADR should keep Guard claim-led"
assert_contains "$tactical_design_adr" 'including the direct EventStorming-to-Codify path' "Tactical Design ADR should retain projection on the low-cost direct path"
assert_contains "$tactical_design_adr" 'temporary scoped `model_projection_map`' "Tactical Design ADR should define transient code traceability"
assert_contains "$tactical_design_adr" 'independently reconstructs the scoped Model projection' "Tactical Design ADR should keep Guard independent of producer claims"
assert_contains "$tactical_design_adr" 'closes every reviewed ready EventStorming and Tactical Design record together' "Tactical Design ADR should define joint closure"
assert_contains "$design_candidate_adr" 'The workflow distinguishes three kinds of conclusion' "design-artifact ADR should separate business facts, strategic hypotheses, and tactical candidates"
assert_contains "$design_candidate_adr" 'means reviewed and usable, not proven or immune to later counterexamples' "ready EventStorming should remain falsifiable"
assert_contains "$design_candidate_adr" 'only when it preserves both confirmed business facts and that strategic structure' "design-artifact ADR should keep Tactical Design below Model-owned structure"
assert_contains "$design_candidate_adr" 'while a strategic contradiction routes to EventStorming' "design-artifact ADR should route strategic evidence to EventStorming"
assert_contains "$design_candidate_adr" 'It persists a draft only after that conversational candidate is coherent' "Tactical Design should not prewrite the review answer"
assert_contains "$design_candidate_adr" 'Codify may consume a scoped Tactical Design `draft` for reversible exploration' "Codify should be able to test a candidate reversibly"
assert_contains "$design_candidate_adr" 'cannot request Guard or claim iteration completion until Tactical Design reconciles concrete implementation evidence' "unreconciled exploration should not enter Guard"
assert_contains "$design_candidate_adr" 'House Style owns realization rules only' "House Style should not own modeling choices"
assert_contains "$design_candidate_adr" 'No new permanent artifact, architecture ledger, or system-design skill is introduced' "the redesign should not add more workflow surface"
assert_contains "$design_candidate_adr" 'absence of a prewritten solution topology' "verification should reject template-driven architecture anchoring"
assert_contains "$iteration_minutes_adr" 'closed process history, not authority that future work must reconstruct' "iteration-minutes ADR should keep completed minutes out of future authority"
assert_contains "$iteration_minutes_adr" 'Guard gains one narrowly mechanical post-clear write; its review remains read-only' "iteration-minutes ADR should bound Guard mutation"
assert_contains "$ROOT/CONTEXT.md" 'persisted unchanged in the confirmed iteration minutes and projected into the affected current Models' "shared vocabulary should match the iteration-minutes authority split"
assert_contains "$ROOT/CONTEXT.md" '**Aggregate Capability**:' "shared vocabulary should define Aggregate behavior authority"
assert_contains "$ROOT/CONTEXT.md" '**Event-triggered Command**:' "shared vocabulary should define business-required event-to-intent causality"
assert_contains "$ROOT/CONTEXT.md" '**Bounded Context Architecture**:' "shared vocabulary should define current context-owned software authority"
assert_contains "$ROOT/CONTEXT.md" 'Every confirmed Tactical Design Claim has an explicit disposition' "shared vocabulary should distinguish an optional file from mandatory claim accounting"
assert_contains "$ROOT/CONTEXT.md" '**Design Delta**:' "shared vocabulary should define the conditional Tactical Design threshold"
assert_contains "$ROOT/CONTEXT.md" '**Tactical Design Claim**:' "shared vocabulary should define Guard-facing design assertions"
assert_contains "$ROOT/CONTEXT.md" 'It does not select domain concepts, object boundaries, state lifecycle, business sequencing, or failure policy.' "shared House Style vocabulary should exclude modeling decisions"
assert_contains "$ROOT/CONTEXT.md" 'An explicitly authorized, bounded, reversible implementation exploration may test its draft candidate first.' "shared escalation vocabulary should permit evidence-producing exploration"
assert_contains "$ROOT/CONTEXT.md" 'A resident Aggregate with checkpoint persistence remains the live authority and is outside this term.' "shared stale-Aggregate vocabulary should be lifecycle-conditional"
assert_contains "$ROOT/CONTEXT.md" 'A minimal material path derived from the domain-object thesis.' "shared collaboration vocabulary should prefer thesis-derived minimal paths"
assert_not_contains "$ROOT/CONTEXT.md" 'diagram source unchanged in a `model_ready` Model artifact' "shared vocabulary should not preserve superseded per-Model diagrams"
assert_contains "$claude_maintainer" 'A new Model starts at `model_revision: 1`' "artifact maintainer should define the first greenfield Model revision"

echo "  ddd-expert plugin: workflow contracts and reference architecture correct"
