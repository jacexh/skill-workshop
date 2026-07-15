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
[ -z "$(jq -r '.hooks // empty' "$CODEX_ROOT/.codex-plugin/plugin.json")" ] || fail "Codex ddd-expert manifest should not declare hooks"
jq -e '.interface.longDescription | length > 0' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert manifest should describe the complete workflow"
jq -e '.interface.developerName | length > 0' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert manifest should name its developer"
jq -e '.interface.defaultPrompt | length == 1 and all(.[]; contains("$ddd-expert:event-storming"))' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert default prompt should use the single EventStorming modeling entry"
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
for skill in event-storming codify guard; do
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

expected_skill_inventory="$(printf '%s\n' codify event-storming guard maintain-artifacts | sort)"
for root in "$CLAUDE_ROOT" "$CODEX_ROOT"; do
  actual_skill_inventory="$(find "$root/skills" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)"
  [ "$actual_skill_inventory" = "$expected_skill_inventory" ] || {
    diff -u <(printf '%s\n' "$expected_skill_inventory") <(printf '%s\n' "$actual_skill_inventory") >&2 || true
    fail "ddd-expert skill inventory should contain one modeling skill, codify, guard, and the internal artifact protocol"
  }
done

for template in README artifact-layout context-map model design; do
  claude_template="$CLAUDE_ROOT/templates/$template.md"
  codex_template="$CODEX_ROOT/templates/$template.md"
  [ -f "$claude_template" ] || fail "Claude ddd-expert missing $template artifact template"
  [ -f "$codex_template" ] || fail "Codex ddd-expert missing $template artifact template"
  cmp -s "$claude_template" "$codex_template" || fail "Claude and Codex $template artifact templates should match"
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
assert_contains "$event_storming_skill" '# Event Storming' "EventStorming should be the single modeling skill"
assert_contains "$event_storming_skill" 'Big Picture and Process Modelling feed one convergence loop; Software Design EventStorming is its tactical zoom' "EventStorming should keep standard EventStorming formats in one workflow"
assert_contains "$event_storming_skill" 'The default outcome is a codify-ready design' "EventStorming should default to the complete modeling outcome"
assert_contains "$event_storming_skill" 'Stop after Strategic Modeling only when the original request explicitly asks' "EventStorming should stop early only for an explicit Strategic-only outcome"
assert_contains "$event_storming_skill" "load this plugin's internal \`maintain-artifacts\` skill" "EventStorming should load the artifact protocol"
assert_contains "$event_storming_skill" 'authority `event-storming`' "EventStorming should identify its artifact authority"
assert_contains "$event_storming_skill" 'execute its `inspect`, `apply-model`, or `apply-design` operation' "EventStorming should authorize Model and Design transactions"
assert_contains "$event_storming_skill" 'never writes DDD artifacts directly' "EventStorming should not bypass the artifact executor"
assert_contains "$event_storming_skill" '`apply-model` may contain only accepted business language' "EventStorming should keep Model operations semantic"
assert_contains "$event_storming_skill" '`apply-design` may contain only accepted tactical realizations' "EventStorming should keep Design operations tactical"
assert_contains "$event_storming_skill" '`model_status: evolving` and `design_status: evolving`' "EventStorming should distinguish accepted evolving artifacts"
assert_contains "$event_storming_skill" '`model_status: shape_ready` and `design_status: codify_ready`' "EventStorming should expose both readiness levels"

# These sentinels protect the single EventStorming convergence loop.
assert_contains "$event_storming_skill" '## EventStorming workflow' "EventStorming should own one explicit modeling workflow"
workflow_step_count="$(awk '/^## EventStorming workflow$/ { in_workflow = 1; next } /^## Convergence protocol$/ { in_workflow = 0 } in_workflow && /^[0-9]+\. \*\*/ { count++ } END { print count + 0 }' "$event_storming_skill")"
[ "$workflow_step_count" -eq 7 ] || fail "EventStorming should keep exactly seven modeling actions, found $workflow_step_count"
assert_contains "$event_storming_skill" '**Build the event timeline**' "EventStorming should order business events before design"
assert_contains "$event_storming_skill" '**Add commands, roles, systems, rules, and hotspots**' "EventStorming should enrich the timeline with decision evidence"
assert_contains "$event_storming_skill" '**Discover model boundaries**' "EventStorming should co-evolve provisional objects, Aggregates, and contexts"
assert_contains "$event_storming_skill" 'temporary object, responsibility, and Aggregate candidates' "EventStorming should keep early tactical candidates provisional"
assert_contains "$event_storming_skill" 'feed the result back into object ownership and context boundaries until both cohere' "EventStorming should iterate Aggregate and context boundaries together"
assert_contains "$event_storming_skill" '**Establish context collaboration**' "EventStorming should establish directional context contracts"
assert_contains "$event_storming_skill" '**Run Software Design EventStorming**' "EventStorming should zoom into tactical design"
assert_contains "$event_storming_skill" '**Challenge the Tactical Design**' "EventStorming should test tactical candidates against concrete pressure"
assert_contains "$event_storming_skill" 'return to the relevant earlier step inside this skill' "tactical pressure should reopen discovery inside the same workflow"
assert_contains "$event_storming_skill" 'Events placed during discovery are evidence that something happened' "discovery events should remain evidence before classification"
assert_contains "$event_storming_skill" 'They are not automatically Domain Event types' "EventStorming should not prematurely classify discovery events"
assert_contains "$event_storming_skill" 'For a long evidence set only, keep temporary coverage notes' "EventStorming should add bookkeeping only when scope needs it"
assert_contains "$event_storming_skill" 'Never require or invent Story IDs' "EventStorming should not require source Story IDs"
assert_contains "$event_storming_skill" 'Given <triggering facts and available information>' "EventStorming should define causal Scenario Thread completeness"
assert_contains "$event_storming_skill" 'changed rights, obligations, or value' "EventStorming should trace material stakeholder effects"
assert_contains "$event_storming_skill" 'not every imaginable detail' "EventStorming should keep scenario completeness proportionate"
assert_contains "$event_storming_skill" 'shallow-scan the scoped evidence' "EventStorming should scan the complete source scope before descending"
assert_contains "$event_storming_skill" 'code shows current behavior but is never business authority by itself' "EventStorming should not promote code into business authority"
assert_contains "$event_storming_skill" 'Use a deletion test as a restraint heuristic' "EventStorming should remove names with no independent meaning without making a new gate"
assert_contains "$event_storming_skill" 'runtime request/response does not create a reverse dependency' "EventStorming should distinguish calls from model dependency direction"
assert_contains "$event_storming_skill" "Each context's Local View is one fenced \`text\` ASCII wireframe" "EventStorming should require one Local View wireframe"
assert_contains "$event_storming_skill" 'do not add U/D labels, use Mermaid, or render one relationship per Markdown line' "EventStorming should encode dependency only through Local View arrows"

# Authoritative Model facts and justified Design decisions are incremental, while readiness remains exhaustive.
assert_contains "$event_storming_skill" '**accepted** means authoritative enough to persist' "EventStorming should define acceptance by authority rather than ceremony"
assert_contains "$event_storming_skill" 'not necessarily approved by the user in a separate ceremony' "EventStorming should not require duplicate user approval"
assert_contains "$event_storming_skill" '## Convergence protocol' "EventStorming should separate modeling actions from cross-cutting convergence rules"
convergence_rule_count="$(awk '/^## Convergence protocol$/ { in_protocol = 1; next } /^## Tactical Design artifact$/ { in_protocol = 0 } in_protocol && /^[0-9]+\. \*\*/ { count++ } END { print count + 0 }' "$event_storming_skill")"
[ "$convergence_rule_count" -eq 4 ] || fail "EventStorming should keep exactly four convergence rules, found $convergence_rule_count"
assert_contains "$event_storming_skill" '**Stay proportionate**' "EventStorming should avoid performing a visible checklist"
assert_contains "$event_storming_skill" '**Use questions to advance the model**' "EventStorming questions should close modeling gaps rather than enforce an approval ritual"
assert_contains "$event_storming_skill" 'first apply every independent accepted slice' "EventStorming should persist unblocked decisions before asking"
assert_contains "$event_storming_skill" 'answer belongs to the user or a domain authority and can materially change a scoped Scenario Thread' "EventStorming should ask only authoritative model-changing questions"
assert_contains "$event_storming_skill" 'Focus one coherent Hotspot per turn, not one grammatical interrogative' "EventStorming should group dependent questions by modeling purpose"
assert_contains "$event_storming_skill" 'A **modeling probe**' "EventStorming should support fact and counterexample discovery"
assert_contains "$event_storming_skill" 'Do not manufacture a binary choice or provide a recommendation when discovering what the business does' "EventStorming discovery questions should remain neutral"
assert_contains "$event_storming_skill" 'A **decision proposal**' "EventStorming should distinguish owned tradeoffs from discovery"
assert_contains "$event_storming_skill" 'Do not block merely to obtain approval for a DDD label, Aggregate boundary, lifecycle notation' "EventStorming should own evidence-supported design representation"
assert_contains "$event_storming_skill" 'plausible answers would produce different board or artifact deltas' "EventStorming questions should have discriminating modeling value"
assert_contains "$event_storming_skill" 'do not restate every accepted fact inside the question' "EventStorming should keep accepted meaning in the model rather than question prose"
assert_contains "$event_storming_skill" 'Never hide context needed to understand a proposal only in verification metadata' "EventStorming should not hide decision context from the user"
assert_contains "$event_storming_skill" '**Apply accepted slices immediately**' "EventStorming should persist Model and Design decisions incrementally"
assert_contains "$event_storming_skill" 'run `apply-model` or `apply-design` for its smallest consistency closure' "EventStorming should limit writes to their semantic closure"
assert_contains "$event_storming_skill" 'never wait for unrelated hotspots' "EventStorming should not retain a whole-workflow Model write gate"
assert_contains "$event_storming_skill" '**Loop and prove readiness by replay**' "EventStorming should prove readiness after incremental decisions"
assert_contains "$event_storming_skill" 'promote independent or coupled closures to `codify_ready` only when complete replay adds no new decision' "EventStorming should not repeat accepted decisions at completion"
assert_contains "$event_storming_skill" '## Readiness and modeling conversation' "EventStorming should keep one visible interaction contract"
assert_contains "$event_storming_skill" 'express them naturally; a compact block is optional' "EventStorming should make readiness content visible without fixing its presentation"
assert_contains "$event_storming_skill" 'Applied: <accepted semantic and tactical slices>' "EventStorming should expose applied progress"
assert_contains "$event_storming_skill" 'Active: <one coherent Hotspot or none>' "EventStorming should expose the active hotspot"
assert_contains "$event_storming_skill" 'Remaining: <material semantic/tactical obligations or none>' "EventStorming should expose remaining obligations"
assert_contains "$event_storming_skill" 'State: model_open | model_ready | design_open | codify_ready' "EventStorming should expose strategic and tactical readiness"
assert_contains "$event_storming_skill" 'There is no required punctuation, heading sequence, or number of subordinate questions' "EventStorming should not reduce model discovery to a question format"
assert_contains "$event_storming_skill" 'A short exchange may report readiness in one sentence' "EventStorming should keep simple exchanges proportionate"
assert_not_contains "$event_storming_skill" 'one interrogative sentence' "EventStorming should not require one-question-mark choreography"
assert_not_contains "$event_storming_skill" 'defer that choice to the next turn instead of appending it' "EventStorming should not split one causal Hotspot mechanically"
assert_contains "$event_storming_skill" '`codify_ready` requires every material Model obligation to be accounted for' "EventStorming should define exhaustive design readiness"
assert_contains "$event_storming_skill" 'every applicable design choice resolved and justified under the authority rule above' "EventStorming should own evidence-supported tactical choices"
assert_contains "$event_storming_skill" 'resolving them cannot change the handoff' "EventStorming should not exclude material handoff work"
assert_contains "$event_storming_skill" 'declare `context_map_migration: true`' "EventStorming should keep whole-set legacy migration explicit"
assert_contains "$CLAUDE_ROOT/templates/model.md" '# <Bounded Context> Domain Model' "model template should identify its bounded context"
assert_contains "$CLAUDE_ROOT/templates/model.md" 'model_revision: 1' "model template should start revision tracking"
assert_contains "$CLAUDE_ROOT/templates/model.md" 'model_status: evolving' "model template should start as accepted but evolving"
assert_contains "$CLAUDE_ROOT/templates/model.md" '## Failure and Recovery Semantics' "model template should preserve failure semantics"
assert_contains "$CLAUDE_ROOT/templates/design.md" '# <Bounded Context> Tactical Design' "design template should identify its bounded context"
assert_contains "$CLAUDE_ROOT/templates/design.md" 'based_on_model_revision: 1' "design template should bind to a model revision"
assert_contains "$CLAUDE_ROOT/templates/design.md" 'design_status: evolving' "design template should start as accepted but evolving"
assert_contains "$CLAUDE_ROOT/templates/design.md" '## Model Realization' "design template should trace material Model obligations"
assert_contains "$CLAUDE_ROOT/templates/design.md" '## Aggregate Designs' "design template should center Aggregate reasoning"
assert_contains "$CLAUDE_ROOT/templates/design.md" '#### Boundary Thesis' "design template should state Aggregate boundary evidence"
assert_contains "$CLAUDE_ROOT/templates/design.md" '#### Entities' "design template should define owned Entities"
assert_contains "$CLAUDE_ROOT/templates/design.md" '#### Value Objects' "design template should define owned Value Objects"
assert_contains "$CLAUDE_ROOT/templates/design.md" '| From | Intent | Authority | Guard | To | Established Fact |' "design template should make discrete lifecycle semantics reviewable"
assert_contains "$CLAUDE_ROOT/templates/design.md" 'fact timeline, lineage, derivation rule' "design template should not force every lifecycle into an FSM"
assert_contains "$CLAUDE_ROOT/templates/design.md" '## Context Dependencies and Contracts' "design template should have one context-contract section"
assert_contains "$CLAUDE_ROOT/templates/design.md" 'not a database ERD' "design template should distinguish Aggregate Map from ERD"
assert_not_contains "$CLAUDE_ROOT/templates/design.md" '## Application Responsibilities' "design template should omit formulaic Application inventory"
assert_not_contains "$CLAUDE_ROOT/templates/design.md" '## Boundary Contracts' "design template should not duplicate contract sections"
assert_not_contains "$CLAUDE_ROOT/templates/design.md" '## Persistence and Consistency' "design template should make persistence conditional and local"
assert_not_contains "$CLAUDE_ROOT/templates/design.md" '## Runtime Ownership' "design template should not keep a fixed runtime chapter"
assert_not_contains "$CLAUDE_ROOT/templates/design.md" '## Verification Seams' "design template should attach verification to material risk"
assert_not_contains "$CLAUDE_ROOT/templates/design.md" '## Cross-Context Collaboration' "design template should not duplicate context collaboration"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'docs/ddd-expert/' "artifact layout should own the documentation root"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" '|-- README.md' "artifact layout should require a root README"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" '|-- context-map.md' "artifact layout should require a Context Map"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'context/<context-slug>/model.md' "artifact layout should own per-context model placement"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'context/<context-slug>/design.md' "artifact layout should own per-context design placement"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" '`model_status: shape_ready` plus a revision-matched `design_status: codify_ready`' "artifact layout should define the Codify readiness gate"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'one global Mermaid `graph LR`' "artifact layout should require one global Context Map view"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'upstream (`U`) to downstream (`D`)' "artifact layout should define Context Map arrow direction"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" '## Global View' "Context Map template should expose one global view"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'Arrow direction: `U -> D` (Upstream model/published-contract influence -> Downstream model).' "Context Map template should define arrow semantics visibly"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'It does not describe runtime call flow' "Context Map template should distinguish model dependencies from calls"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" '```mermaid' "Context Map template should use an inline Mermaid diagram"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'graph LR' "Context Map template should use a graph layout"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'unique lower_snake_case Mermaid identifier' "Context Map template should require document-local unique lower_snake_case node identifiers"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'need not duplicate the context directory slug' "Context Map node identifiers should remain document syntax"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'upstream_context --> downstream_context' "Context Map template should keep edges unlabeled"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" '#### Local View' "Context Map template should project direct neighbors locally"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'fenced `text` wireframe' "Context Map Local View should be an ASCII wireframe"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'Dependency arrows point from upstream to downstream, so do not add U/D labels' "Context Map Local View arrows should carry dependency direction without U/D labels"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'one connected fan-in/fan-out drawing rather than one relationship per Markdown line' "Context Map Local View should be one connected drawing"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" '| <Upstream Context> | ----> | <Downstream Context> |' "Context Map Local View should show boxed contexts joined by an arrow"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'Local Views never use Mermaid' "Context Map should reserve Mermaid for the Global View"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" '#### Upstream Dependencies' "Context Map template should expose downstream acceptance"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" '#### Downstream Contracts' "Context Map template should expose upstream publication"
assert_not_contains "$CLAUDE_ROOT/templates/context-map.md" '## Relationships' "Context Map template should not keep a detached relationship inventory"
assert_contains "$CLAUDE_ROOT/templates/README.md" '[<Bounded Context>](context/<context-slug>/model.md)' "artifact README should use real context links"
assert_contains "$CLAUDE_ROOT/templates/README.md" '[context-map.md](context-map.md)' "artifact README should link the Context Map"
assert_contains "$CLAUDE_ROOT/templates/README.md" '`design.md` lives beside' "artifact README should locate each Tactical Design"
assert_contains "$CLAUDE_ROOT/templates/README.md" 'may be absent before EventStorming applies the first accepted tactical slice' "artifact README should explain the pre-checkpoint Design state"
assert_contains "$CLAUDE_ROOT/templates/README.md" 'remains `evolving`' "artifact README should explain Design readiness"
assert_not_contains "$CLAUDE_ROOT/templates/README.md" '## Structure' "artifact README should not duplicate the canonical structure"
assert_not_contains "$CLAUDE_ROOT/templates/README.md" '|--' "artifact README should not maintain a dynamic directory tree"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" "load this plugin's internal \`maintain-artifacts\` skill" "codify should load the artifact protocol"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'execute only its `inspect` operation' "codify should request read-only artifact inspection"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'never request or perform an apply operation' "codify should never authorize artifact writes"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" '`evolving_model`' "codify should reject evolving Models"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" '`evolving_design`' "codify should reject evolving Designs"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" '`stale_design`' "codify should reject stale designs"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'route semantic or tactical gaps to `event-storming`' "codify should route all modeling work through EventStorming"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'verdicts belong to Guard and are not Codify output' "codify should route artifact feedback without Guard verdicts"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'multi-label realization map' "codify should classify one obligation across every touched surface"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Runtime/platform label never suppresses an applicable flow label' "codify should not let Runtime classification hide an applicable flow"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" "periodic, polling, and deferred-recovery work also follows the router's taskqueue branch" "codify should route periodic recovery through taskqueue guidance"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'in the same task' "codify should hand changed implementations to Guard before task completion"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'does not self-certify' "codify should leave the independent review verdict to Guard"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'fresh read-only Guard coordinator in a distinct agent context' "codify should isolate Guard from the implementer"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'either immutable base/target identifiers or an immutable base plus a complete worktree snapshot' "codify should hand Guard a complete stable code surface"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'A route to a future Guard is not a substitute' "codify should not defer the independent review gate"
assert_not_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" '**Verify both gates**' "codify should not retain its retired self-certification step"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'clear over the final source snapshot' "codify should complete only against the stable source snapshot"
assert_not_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'clear over the final diff' "codify should not narrow Guard back to a diff that can omit new paths"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" "load this plugin's internal \`maintain-artifacts\` skill" "guard should load the artifact protocol"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'execute only its `inspect` operation' "guard should request read-only artifact inspection"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'never request or perform an apply operation' "guard should never authorize artifact writes"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'An `evolving_model`, `evolving_design`, `stale_design`, or `pending_design_reconciliation` result' "guard should report non-ready designs"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Route missing or contradictory business authority to `event-storming`' "guard should route modeling gaps through EventStorming"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Design Realization and House-Style Conformance' "guard should define two required review axes"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '**Freeze one Review Envelope**' "guard should freeze shared review inputs before dispatch"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'launch two independent read-only workers concurrently' "guard should launch both axes concurrently"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Dispatch both initial workers before accepting or awaiting either completion' "guard should dispatch both axes before either completes"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'exact roles `design-realization` and `house-style-conformance`' "guard should assign exact axis roles"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'one worker or attempt cannot serve both roles' "guard should require distinct axis workers"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'distinct agent contexts' "guard axis workers should remain independent"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'The coordinator performs neither complete axis' "guard coordinator should not duplicate an axis"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'cannot delegate further' "guard axis workers should not create nested fan-out"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'never launch one worker per smell or allow recursive fan-out' "guard should bound optional depth cost"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'cannot be launched, fails, or returns unusable output, retry it once' "guard should retry an unusable required worker once"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'at most two attempts total' "guard should cap required-axis retries"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'stop as an incomplete Guard execution' "guard should stop when a required axis cannot complete"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Do not substitute a main-thread axis' "guard should not silently degrade worker isolation"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '`realized`, `missing_realization`, `partial_realization`, `incorrect_realization`, `unverifiable`, or `not_applicable`' "guard should classify every scoped Design obligation"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Proving `missing_realization` requires' "guard should hold missing realization to a positive proof bar"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Missing a searched name is not proof' "guard should not infer absence from name search"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Vague waiver language and local convention cannot override' "guard should keep accepted authority above ambiguous waivers"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'an absent layer or surface that the request does not claim is neither a coverage gap nor a violation' "guard should not expand narrow scope into project completeness"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'For every merged family still marked `needs_depth`, launch one bounded falsification worker' "guard should close every unresolved depth family"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Each family is dispatched at most once' "guard should cap depth fan-out by merged family"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'returns exactly one JSON object with no surrounding prose' "guard workers should return a machine-checkable envelope"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '"inventory_ids": ["design:payment-capture"]' "guard worker envelopes should map coverage to frozen inventory"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Set `status` to `completed` only after every row is worker-terminal' "guard worker completion should mean terminal coverage"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '`coverage` must be nonempty and use unique row identifiers' "guard worker coverage should be nonempty and unambiguous"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Every `candidates` row is an object with `coverage_id`' "guard should define candidate row structure"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Every `gaps` row is an object with `coverage_id`' "guard should define gap row structure"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Each `coverage_id` must name a row in `coverage`' "guard should correlate worker rows to coverage"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'frozen specialized-surface inventory' "guard should freeze the specialized surfaces that require coverage"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'every frozen changed-file, required-path, layer, mechanism, and specialized-surface ID' "guard should reconcile conformance coverage with every frozen inventory item"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'no missing or unknown IDs' "guard should reject incomplete or invented inventory coverage"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'every frozen surface' "guard should make reconciled surface coverage a completion gate"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'staged, unstaged, and untracked paths' "guard should inventory a complete mutable worktree"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'pin an immutable base and either an immutable target or a complete worktree snapshot' "guard should keep both sides of a change review stable"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'fingerprint their contents' "guard should make a mutable worktree snapshot drift-detectable"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'source snapshot did not drift' "guard should revalidate the reviewed code before clearing"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'it cannot return `needs_depth`' "guard depth workers should return terminal states"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Keep citations, evidence, and detail for clear/not-applicable rows internal' "guard workers should not spend output tokens on clear evidence"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'A depth worker must return a terminal' "guard should require terminal depth results"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'stop as incomplete without redispatching that family' "guard should bound depth failure without silent fallback"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'include the missing proof in that violation instead of duplicating it as an `evidence_gap`' "guard should merge verification symptoms into proven violations"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '`[Realization]`, `[Conformance]`, or `[Both]` provenance' "guard should preserve axis provenance during synthesis"
if rg -n '(Agent tool|Task tool|general-purpose|spawn_agent|subagent_type|run_in_background)' \
  "$CLAUDE_ROOT/skills/guard/SKILL.md" "$CODEX_ROOT/skills/guard/SKILL.md" >/dev/null; then
  fail "shared guard skill should describe delegation without platform-specific agent APIs"
fi
assert_contains "$claude_maintainer" 'Codify and Guard can never run an apply operation' "artifact maintainer should reject downstream writes"
assert_contains "$claude_maintainer" '`apply-model` | `event-storming`' "artifact maintainer should authorize Model writes only from EventStorming"
assert_contains "$claude_maintainer" '`apply-design` | `event-storming`' "artifact maintainer should authorize Design writes only from EventStorming"
assert_contains "$claude_maintainer" 'An `inspect` operation needs no expected revision' "artifact inspection should discover revisions"
assert_contains "$claude_maintainer" 'consistency set' "artifact apply operations should declare their read-only consistency set"
assert_contains "$claude_maintainer" 'read dependencies' "artifact consistency sets should cover accepted inputs outside the write set"
assert_contains "$claude_maintainer" 'write set is a subset of the consistency set' "artifact writes should be covered by the consistency set"
assert_contains "$claude_maintainer" 'exact accepted decision slice and its evidence' "artifact writes should identify their accepted decision"
assert_contains "$claude_maintainer" 'require every expected path pre-state in the consistency set to match' "artifact apply should reject stale semantic inputs"
assert_contains "$claude_maintainer" 'A stale or missing Design is a valid pre-state for `apply-design`' "artifact maintainer should repair stale Designs"
assert_contains "$claude_maintainer" 'Preserve accepted wording and distinctions' "artifact maintainer should not make semantic edits"
assert_contains "$claude_maintainer" 'Reject absolute slugs, path separators, `.` or `..` segments' "artifact maintainer should reject unsafe context paths"
assert_contains "$claude_maintainer" 'returns `changed` with a `pending_design_reconciliation` observation' "artifact maintainer should support two-operation context topology changes"
assert_contains "$claude_maintainer" 'increment each changed Model at most once for the accepted decision slice' "artifact maintainer should advance Model revisions once per accepted slice"
assert_contains "$claude_maintainer" 'status-only readiness invalidation or promotion does not increment the revision or alter accepted prose' "Model readiness changes should not create semantic revision noise"
assert_contains "$claude_maintainer" 'set each retained Design' "artifact maintainer should bind Designs to Models"
assert_contains "$claude_maintainer" 'set `design_status` to the authorized target' "artifact maintainer should persist Design readiness"
assert_contains "$claude_maintainer" '**Prepare the smallest consistency transaction**' "artifact maintainer should avoid workflow-wide transactions"
assert_contains "$claude_maintainer" 'never derive or enlarge semantic scope on the executor' "artifact maintainer should validate rather than decide semantic closure"
assert_contains "$claude_maintainer" 'validate those references mechanically without deciding semantic completeness' "artifact maintainer should not own readiness judgment"
assert_contains "$claude_maintainer" 'Independent contexts and unrelated decisions never need a workflow-wide transaction' "artifact maintainer should keep transaction scope semantic"
assert_contains "$claude_maintainer" '`evolving_model`' "artifact inspection should expose evolving Models"
assert_contains "$claude_maintainer" '`evolving_design`' "artifact inspection should expose evolving Designs"
assert_contains "$claude_maintainer" 'never return this observation for an `evolving` artifact' "artifact ready and evolving observations should not overlap"
assert_contains "$claude_maintainer" 'legacy Model with no explicit status' "artifact inspection should fail closed on statusless Model readiness"
assert_contains "$claude_maintainer" 'legacy Design with no explicit status' "artifact inspection should fail closed on statusless Design readiness"
assert_contains "$claude_maintainer" 'only legacy frontmatter compatibility exception' "artifact inspection should distinguish statusless legacy files from invalid layout"
assert_contains "$claude_maintainer" 'do not mutate the legacy file during inspection' "legacy readiness inspection should remain read-only"
assert_contains "$claude_maintainer" 'This is a shared in-process workflow, not a separate agent' "artifact maintainer should not imply sub-agent delegation"
assert_contains "$claude_maintainer" "Do not replace that workflow's completion response" "artifact maintainer should resume its workflow"
assert_contains "$claude_maintainer" '../../templates/artifact-layout.md' "artifact maintainer should load the canonical layout"
assert_contains "$claude_maintainer" '../../templates/README.md' "artifact maintainer should load the root README template"
assert_contains "$claude_maintainer" '../../templates/context-map.md' "artifact maintainer should load the Context Map template"
assert_contains "$claude_maintainer" '../../templates/model.md' "artifact maintainer should load the Model template"
assert_contains "$claude_maintainer" '../../templates/design.md' "artifact maintainer should load the Design template"
assert_contains "$claude_maintainer" 'Global View is a mechanical projection' "artifact maintainer should keep the diagram synchronized with accepted facts"
assert_contains "$claude_maintainer" 'every accepted project Bounded Context exactly once' "artifact maintainer should keep isolated contexts in the global diagram"
assert_contains "$claude_maintainer" 'document-local unique `lower_snake_case` Mermaid identifier' "artifact maintainer should require only document-local node identity"
assert_not_contains "$claude_maintainer" 'lower-snake-case stable identifier' "artifact maintainer should not claim cross-revision node identity stability"
assert_contains "$claude_maintainer" 'unlabeled edge from upstream to downstream' "artifact maintainer should forbid ambiguous diagram edge labels"
assert_contains "$claude_maintainer" 'one non-Mermaid `text` wireframe containing itself and exactly its direct neighbors' "artifact maintainer should require one Local View wireframe"
assert_contains "$claude_maintainer" 'arrow direction expressing dependency and no U/D labels' "artifact maintainer should derive Local View dependency direction from arrows"
assert_contains "$claude_maintainer" 'Keep the workspace working directory unchanged' "artifact maintainer should not change cwd to invoke the Context Map validator"
assert_contains "$claude_maintainer" '`node <absolute-validator-path> <absolute-context-map-path>`' "artifact maintainer should invoke the validator with absolute paths"
assert_contains "$claude_maintainer" '`context_map_migration: true`' "artifact maintainer should expose an explicit legacy Context Map migration flag"
assert_contains "$claude_maintainer" 'unscoped inspection of the complete DDD artifact root' "legacy Context Map migration should use a complete-root snapshot"
assert_contains "$claude_maintainer" 'A legacy Model or README with those markers cannot be omitted as "unrelated"' "legacy Context Map migration should fail closed on omitted legacy artifacts"
assert_contains "$claude_maintainer" 'exact observed fingerprint and bytes' "legacy Context Map migration should reject stale source bytes"
assert_contains "$claude_maintainer" 'exact observed fingerprint and bytes of each still match' "coordinated legacy migration should reject stale source bytes"
assert_contains "$claude_maintainer" 'complete accepted terminal Context Map, exact terminal content for every semantically affected Model, and exact terminal README content' "legacy Context Map migration should require a complete accepted target"
assert_contains "$claude_maintainer" 'Replace the complete Context Map, every coordinated legacy Model, and any coordinated legacy README in the same atomic transaction' "legacy Context Map migration should be a whole-artifact atomic replacement"
assert_contains "$claude_maintainer" 'outside it but preventing validation of that set' "legacy Context Map migration should block only relevant invalid layouts"
assert_contains "$claude_maintainer" 'other invalid artifacts remain unchanged and reported' "legacy Context Map migration should not absorb unrelated repairs"
assert_contains "$claude_maintainer" 'never infers a dependency direction, contract, authority, translation, or other semantic repair' "artifact maintainer should not decide legacy-map migration semantics"
assert_contains "$claude_maintainer" 'inside the declared consistency closure or a required structural counterpart aborts' "artifact maintainer should fail closed inside the accepted slice"
assert_contains "$claude_maintainer" 'outside that closure without expanding or blocking the apply' "artifact maintainer should not couple independent invalid artifacts"
assert_contains "$claude_maintainer" 'self-loops, reciprocal edges, longer cycles' "artifact maintainer should enforce the Context Map DAG"
assert_contains "$claude_maintainer" 'runtime request and response may use one owned contract without creating a reverse dependency' "artifact maintainer should separate runtime interaction from dependency direction"
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
assert_contains "$CLAUDE_ROOT/README.md" 'Use EventStorming as the single modeling path' "Claude README should expose one modeling workflow"
assert_contains "$CODEX_ROOT/README.md" 'Use EventStorming as the single modeling path' "Codex README should expose one modeling workflow"
assert_contains "$CLAUDE_ROOT/README.md" 'same skill loops between business discovery and software design' "Claude README should hide modeling choreography"
assert_contains "$CODEX_ROOT/README.md" 'same skill loops between business discovery and software design' "Codex README should hide modeling choreography"
assert_contains "$CLAUDE_ROOT/README.md" 'uses proportionate Big Picture and Process Modelling' "Claude README should put strategic EventStorming before Tactical Design"
assert_contains "$CODEX_ROOT/README.md" 'Software Design EventStorming assigns Aggregate decisions' "Codex README should distinguish tactical EventStorming"
assert_contains "$CLAUDE_ROOT/README.md" 'does not force a new repository-wide Big Picture' "Claude README should keep EventStorming proportionate"
assert_contains "$CODEX_ROOT/README.md" 'codex plugin marketplace upgrade skill-workshop-codex' "Codex README should upgrade by marketplace name"
assert_contains "$CLAUDE_ROOT/README.md" 'clear independent Guard in the same task' "Claude README should expose the Codify completion gate"
assert_contains "$CODEX_ROOT/README.md" 'clear independent Guard in the same task' "Codex README should expose the Codify completion gate"
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
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'The task is complete only when Guard returns clear' "codify should require Guard completion for changed behavior"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'A route to a future Guard is not a substitute' "codify should not replace Guard execution with a route-only handoff"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Breadth produces falsifiable hypotheses; depth clears or proves them' "guard should retain breadth/depth discipline"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '`clear`, `violation`, or `evidence_gap`' "guard should use terminal verdicts"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Guard is read-only' "guard should remain read-only"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'route `codify`' "guard should route implementation violations to codify"

if rg -n 'ddd-golang-(scaffold|domain|application|transport|cqrs|infrastructure|events-messages|taskqueue|runtime)\.md' \
  "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" >/dev/null; then
  fail "workflow skills should enter Go House Style through its router rather than link implementation leaves directly"
fi
assert_contains "$event_storming_skill" 'For Go, start with' "EventStorming should enter Go guidance through its router"
assert_contains "$event_storming_skill" 'For Python or TypeScript, load only the relevant compact language section' "EventStorming should load compact language guides selectively"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'For Go, start with' "codify should enter Go guidance through its router"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'For Python or TypeScript, load only the sections for touched surfaces' "codify should load compact language guides selectively"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'For triggered Go code, start with' "guard should enter Go guidance through its router during depth"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'For triggered Python or TypeScript code, load only the relevant section' "guard should load compact language guides selectively"

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
for leaf in "$CLAUDE_ROOT"/references/ddd-golang-*.md; do
  basename="$(basename "$leaf")"
  assert_contains "$go_router" "$basename" "Go router missing $basename"
done

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
scaffold="$CLAUDE_ROOT/references/ddd-golang-scaffold.md"
assert_contains "$scaffold" 'internal/business/' "Go scaffold should support multiple bounded contexts"
assert_contains "$scaffold" 'application.go' "Go scaffold should require application.go"
assert_contains "$scaffold" 'assembler.go' "Go scaffold should require assembler.go"
assert_contains "$scaffold" 'messagesubscriber/' "Go scaffold should separate message subscribers"
assert_contains "$scaffold" 'taskprocessor/' "Go scaffold should separate task processors"
assert_contains "$scaffold" 'convert.go' "Go scaffold should use convert.go for persistence mapping"
assert_contains "$scaffold" 'gen/' "Go scaffold should place generated stubs under gen"
assert_contains "$scaffold" 'migrations/' "Go scaffold should use the canonical migration directory"

application="$CLAUDE_ROOT/references/ddd-golang-application.md"
assert_contains "$application" 'type Application struct' "Go Application should expose a grouped registry"
assert_contains "$application" 'Commands Commands' "Go Application should group Command handlers"
assert_matches "$application" '^[[:space:]]+Queries[[:space:]]+Queries' "Go Application should group Query handlers"
assert_contains "$application" 'func AssembleUserDTO' "Go Application should define DTO-to-Entity mapping"
assert_contains "$application" 'func AssembleUserEntity' "Go Application should define Entity-to-DTO mapping"
assert_contains "$application" 'domain.NewUser' "new Domain objects should use a Domain Factory"

domain="$CLAUDE_ROOT/references/ddd-golang-domain.md"
assert_contains "$domain" 'github.com/go-playground/validator/v10' "Go Domain should own business-data validation"
assert_contains "$domain" 'It does not need to span multiple Aggregates' "Domain Service should not require cross-Aggregate work"
assert_contains "$domain" 'After a successful `Save`, that Aggregate instance is stale' "Go Domain should define the post-Save lifecycle"

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

events="$CLAUDE_ROOT/references/ddd-golang-events-messages.md"
assert_contains "$events" 'Published Fact Contract' "Go messaging should define producer-owned facts"
assert_contains "$events" 'Asynchronous Intent Contract' "Go messaging should define receiver-owned intents"
assert_contains "$events" 'Use outbox only after the design accepts' "Go messaging should keep outbox conditional"
assert_contains "$events" 'does not supply an xorm Store' "Go messaging should not invent missing outbox adapters"
assert_contains "$events" 'app.Commands' "Go message subscribers should delegate through the Application registry"

taskqueue="$CLAUDE_ROOT/references/ddd-golang-taskqueue.md"
assert_contains "$taskqueue" 'application/task' "Go taskqueue should own task contracts in Application"
assert_contains "$taskqueue" 'transport/taskprocessor' "Go taskqueue should own processors in Transport"
assert_contains "$taskqueue" 'internal/pkg/taskqueue' "Go taskqueue should keep Asynq runtime technical"
assert_contains "$taskqueue" 'app.Commands' "Go task processors should delegate through the Application registry"

infrastructure="$CLAUDE_ROOT/references/ddd-golang-infrastructure.md"
assert_contains "$infrastructure" 'infrastructure/convert.go' "Go Infrastructure should own DO/Domain conversion"
assert_contains "$infrastructure" 'xorm.io/xorm' "Go Infrastructure should use the adopted ORM"
assert_contains "$infrastructure" 'Prefer small Aggregates' "Go Infrastructure should keep small Aggregates as the default"
assert_contains "$infrastructure" 'mutation journal keyed by Entity kind and identity' "Go Infrastructure should expose optional Aggregate change tracking"
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
assert_contains "$typescript_guide" 'A saved Aggregate is stale' "TypeScript guide should define the post-Save lifecycle"

database="$CLAUDE_ROOT/references/database.md"
assert_contains "$database" 'Every table governed by this profile' "database profile should define standard columns"
for column in '`id` varchar(36)' '`version` int unsigned' '`created_at` bigint' '`updated_at` bigint' '`deleted_at` bigint'; do
  assert_contains "$database" "$column" "database profile missing standard column $column"
done
assert_contains "$database" 'new in-memory Aggregate has version `0`' "database profile should define initial versions"
assert_contains "$database" 'After a successful save, the instance is stale' "database profile should align post-save behavior"
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
assert_contains "$ROOT/README.md" 'Domain/Application/Transport/Infrastructure' "root README should expose the separated Transport layer"
assert_contains "$ROOT/README.md" 'clear independent Guard in the same task' "root README should expose the Codify completion gate"
assert_contains "$ROOT/docs/adr/0001-ddd-expert-reference-architecture.md" 'fresh read-only coordinator distinct from the implementer' "DDD ADR should preserve independent Guard topology"
assert_contains "$ROOT/docs/adr/0001-ddd-expert-reference-architecture.md" 'no missing or unknown inventory IDs' "DDD ADR should preserve exhaustive Guard coverage reconciliation"
assert_contains "$ROOT/docs/adr/0001-ddd-expert-reference-architecture.md" 'layer, mechanism, or specialized-surface label' "DDD ADR should preserve additive mechanism coverage"
assert_contains "$ROOT/docs/adr/0001-ddd-expert-reference-architecture.md" 'immutable base/target identifiers' "DDD ADR should preserve stable committed Guard inputs"
assert_contains "$ROOT/docs/adr/0001-ddd-expert-reference-architecture.md" 'immutable base plus a complete fingerprinted worktree snapshot' "DDD ADR should preserve stable worktree Guard inputs"

echo "  ddd-expert plugin: workflow contracts and reference architecture correct"
