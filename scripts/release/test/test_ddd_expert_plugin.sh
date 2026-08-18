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
jq -e '.interface.defaultPrompt | all(.[]; contains("one frontier decision at a time") and contains("strongest credible alternative") and contains("status: ready") and contains("$ddd-expert:tactical-design") and contains("$ddd-expert:codify"))' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert default prompt should preserve HITP modeling and conditional Tactical Design handoff"
jq -e '.interface.longDescription | contains("one frontier decision at a time") and contains("explicit model confirmation") and contains("Design Delta")' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null || fail "Codex ddd-expert manifest should describe adversarial HITP EventStorming and conditional Tactical Design"
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
assert_contains "$event_storming_skill" '# Event Storming' "EventStorming should be the single modeling skill"
assert_contains "$event_storming_skill" "Load this plugin's internal \`maintain-artifacts\` skill" "EventStorming should load the artifact protocol"
assert_contains "$event_storming_skill" '`validate-proposed-model` after adversarial review, `write-event-storming-draft` to materialize the minutes, and `apply-ready-event-storming` only after the user confirms that exact draft' "EventStorming should phase minutes materialization, approval, and synchronization explicitly"
assert_contains "$event_storming_skill" '**Supported Modeling Fact**' "EventStorming should distinguish evidence support"
assert_contains "$event_storming_skill" '**Working Confirmation**' "EventStorming should keep local decisions revisable"
assert_contains "$event_storming_skill" '**Integrated Model Confirmation**' "EventStorming should define integrated user confirmation"
assert_contains "$event_storming_skill" 'Before the ten steps and adversarial review produce one complete candidate, keep every project file byte-identical' "EventStorming should keep project files unchanged during discovery"
assert_contains "$event_storming_skill" 'write only the `draft` EventStorming minutes and its unchecked README entry; keep every canonical Model byte-identical' "EventStorming should keep canonical Models unchanged before approval"
assert_contains "$event_storming_skill" 'In the console, summarize the scope, draft minutes path' "EventStorming should summarize the file-backed approval candidate"
assert_contains "$event_storming_skill" 'transition the exact displayed minutes to `ready` and synchronize the affected canonical Models' "EventStorming should apply the approved iteration and expected Models together"
assert_contains "$event_storming_skill" 'The terminal outcome is a confirmed Model ready for a Design Delta check' "EventStorming should produce confirmed business authority before implementation design"
assert_contains "$event_storming_skill" 'A `ready` result proceeds to Tactical Design only when a real Design Delta remains; otherwise it is ready for Codify' "EventStorming should route conditional tactical design without making it universal"
assert_contains "$event_storming_skill" 'Tactical Design Model Challenge' "EventStorming should accept falsification evidence from downstream design"
assert_contains "$event_storming_skill" 'reopen the earliest affected EventStorming step' "EventStorming should resume from the challenged model seam"
assert_contains "$event_storming_skill" 'transition each replaced `ready` minutes record to `superseded`' "EventStorming should close replaced pre-implementation authority honestly"
assert_contains "$event_storming_skill" 'not by where the correcting evidence originated' "EventStorming should supersede any replaced ready authority, not only Tactical Design challenges"
assert_contains "$event_storming_skill" 'route to Tactical Design to replace or retire that invalidated authority and its Architecture sources before Codify' "EventStorming should hand invalidated ready tactical authority back cleanly"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'one or more scoped EventStorming minutes with `status: ready`' "Codify should consume the ready iteration handoff"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'a `superseded` record is history and cannot satisfy readiness' "Codify should ignore corrected EventStorming history"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'every required scoped Tactical Design is `ready`' "Codify should consume confirmed tactical authority when the change requires it"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'A Tactical Design with `status: superseded` or a superseded governing link is history, not Codify authority' "Codify should reject invalidated tactical authority"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'A `ready` Tactical Design whose governing EventStorming link became superseded is invalidated' "Guard should refuse stale tactical authority before review closure"

# These sentinels protect the ten EventStorming steps and their order.
assert_contains "$event_storming_skill" '## The ten EventStorming steps' "EventStorming should own one explicit modeling workflow"
expected_workflow_steps="$(printf '%s\n' \
  '1. **Clarify the modeling scope**' \
  '2. **Place Workshop Events first**' \
  '3. **Arrange events on the timeline**' \
  '4. **Find Commands**' \
  '5. **Add Roles and external authorities**' \
  '6. **Capture constraints and event-triggered Commands**' \
  '7. **Mark problems and ambiguities**' \
  '8. **Identify Aggregates and core business objects**' \
  '9. **Identify Bounded Contexts**' \
  '10. **Establish context collaboration**')"
actual_workflow_steps="$(awk '/^## The ten EventStorming steps$/ { in_workflow = 1; next } /^## Constructive challenge$/ { in_workflow = 0 } in_workflow && /^[0-9]+\. \*\*/ { sub(/:.*/, ""); print }' "$event_storming_skill")"
[ "$actual_workflow_steps" = "$expected_workflow_steps" ] || {
  diff -u <(printf '%s\n' "$expected_workflow_steps") <(printf '%s\n' "$actual_workflow_steps") >&2 || true
  fail "EventStorming should preserve the exact ten-step workflow and order"
}
# Static sentinels protect the reusable process contract without pretending to
# score the wisdom of a particular domain-model answer.
assert_contains "$event_storming_skill" 'shared domain mechanism' "EventStorming should test shared domain ownership"
assert_contains "$event_storming_skill" 'Apply DRY to duplicated knowledge rather than repeated syntax' "EventStorming should ground abstraction pressure in general design principles"
assert_contains "$event_storming_skill" 'Software-design principles help find a seam' "EventStorming should keep design principles from deciding Bounded Contexts"
assert_contains "$event_storming_skill" 'shared technical Module' "EventStorming should distinguish technical reuse"
assert_contains "$event_storming_skill" 'distinct local semantics with translations' "EventStorming should preserve distinct local meanings"
assert_contains "$event_storming_skill" 'one coherent language, business authority, lifecycle, policy, and model purpose' "EventStorming should derive contexts from business evidence"
assert_contains "$event_storming_skill" 'Model Dependency View' "EventStorming should name semantic Context Map direction"
assert_not_contains "$event_storming_skill" 'Interaction View' "EventStorming should not add a runtime interaction projection to the Context Map"
assert_contains "$event_storming_skill" 'connected scenario interactions in the minutes' "EventStorming should keep complete iteration flow out of per-context Models"
assert_contains "$event_storming_skill" "A **Workshop Event** is this workflow's distinguishing label" "EventStorming should distinguish workshop facts from retained event contracts"
assert_contains "$event_storming_skill" 'analytical by default' "EventStorming should keep Workshop Events analytical until the model selects stronger semantics"
assert_contains "$event_storming_skill" 'every included success scenario establishes at least one supported Workshop Event' "EventStorming should define when success-path event discovery covers the scoped scenarios"
assert_contains "$event_storming_skill" 'every Workshop Event belongs to at least one replayable business-time thread' "EventStorming should not leave Workshop Events as disconnected notes"
assert_contains "$event_storming_skill" 'connected `Role or external authority -- Command --> Aggregate Capability or explicit coordination --> Workshop Event` thread' "EventStorming should connect normalized intent through Root-owned behavior without duplicate Command nodes"
assert_contains "$event_storming_skill" 'selected Domain Event or Published Fact Contract -- Command --> Aggregate Capability or explicit coordination' "EventStorming should preserve required event-to-intent causality"
assert_contains "$event_storming_skill" 'without a fake Role or standalone Reaction Policy node' "EventStorming should connect fact-triggered intent without invented participants or policy nodes"
assert_contains "$event_storming_skill" 'Preserve the event-triggered Command in the reacting Model' "EventStorming should not promote implementation-only event wiring into the Model"
assert_contains "$event_storming_skill" "single source of truth for the iteration's Workshop Events" "EventStorming should keep its diagram threads as the event inventory"
assert_contains "$event_storming_skill" 'Do not add a parallel manual Event Index' "EventStorming should not duplicate Workshop Events in a manual catalog"
assert_contains "$event_storming_skill" 'apply the Domain Event and Published Fact selection rules routed by `ddd-modeling`' "EventStorming should use the canonical event-selection authority"
assert_contains "$event_storming_skill" 'separate producer-owned `Published Fact Contract: <name>` node' "EventStorming should select published cross-context meaning explicitly"
assert_contains "$event_storming_skill" 'Unannotated Workshop Events remain analytical' "EventStorming should avoid bloating every analytical event node"
assert_contains "$CLAUDE_ROOT/references/ddd-modeling.md" '| A |--+----->| B |' "DDD reference should show a canonical Local View fan-out"
assert_contains "$CLAUDE_ROOT/references/ddd-modeling.md" '**Workshop Event**' "DDD modeling guidance should name the workflow's analytical event role"
assert_contains "$CLAUDE_ROOT/references/ddd-modeling.md" 'A **Role** is a named business participant whose decision rights are defined in one Bounded Context' "DDD modeling guidance should distinguish business Roles from generic actors"
assert_contains "$CLAUDE_ROOT/references/ddd-modeling.md" 'Normalize Commands by the intent chosen by the initiating Role or required by an established fact' "DDD modeling guidance should normalize repeated scenario commands before capability projection"
assert_contains "$CLAUDE_ROOT/references/ddd-modeling.md" 'express a Command as the labeled arrow' "DDD modeling guidance should separate incoming intent from Root-owned Capability nodes"
assert_contains "$CLAUDE_ROOT/references/ddd-modeling.md" 'Project Aggregate Capabilities from normalized Commands' "DDD modeling guidance should assign normalized business intent to roots"
assert_contains "$CLAUDE_ROOT/references/ddd-modeling.md" 'Do not split it by pre-state, success branch, rejection branch, timing case, or other scenario variation' "DDD modeling guidance should not turn state branches into methods"
assert_contains "$CLAUDE_ROOT/references/ddd-modeling.md" "A capability guides the Root's intention-revealing Domain method surface but is not a signature or a method-count rule" "DDD modeling guidance should guide methods without forcing cardinality"
assert_contains "$CLAUDE_ROOT/references/ddd-modeling.md" 'load [ddd-collaboration.md](ddd-collaboration.md) and apply its selection rules' "DDD modeling guidance should route event selection to one authority"
assert_contains "$CLAUDE_ROOT/references/ddd-collaboration.md" 'the occurrence itself, not merely the resulting state, as durable domain evidence' "DDD collaboration guidance should own the Domain Event selection rule"
assert_contains "$CLAUDE_ROOT/references/ddd-collaboration.md" 'represent its Published Fact Contract as a separate producer-owned node before the downstream Command' "DDD collaboration guidance should keep Domain Events distinct from cross-context contracts"
assert_contains "$CLAUDE_ROOT/references/ddd-collaboration.md" 'while an Integration Message realizes the consumer-visible contract across the boundary' "DDD collaboration guidance should distinguish Domain Events from Integration Messages"
assert_contains "$ROOT/CONTEXT.md" '**Workshop Event**:' "project language should define the workflow-specific event term"

# The EventStorming Board remains private until one integrated model is ready.
assert_contains "$event_storming_skill" '## EventStorming Board' "EventStorming should separate conversation state from domain artifacts"
assert_contains "$event_storming_skill" 'separate from any Aggregate, Bounded Context, or Context Map' "EventStorming should not confuse its board with a domain model"
assert_contains "$event_storming_skill" 'Show only the board delta during ordinary turns' "EventStorming should keep routine communication compact"
assert_contains "$event_storming_skill" 'Show the complete low-resolution board when changing steps' "EventStorming should show full state at decision boundaries"

# These assertions specify the facilitation process, not a fixture answer.
assert_contains "$event_storming_skill" 'only one frontier question to the user per turn' "EventStorming should resolve one user decision at a time"
assert_contains "$event_storming_skill" 'highest downstream impact and information gain' "EventStorming should choose the next useful question"
assert_contains "$event_storming_skill" 'For a **fact probe**' "EventStorming should keep business facts open"
assert_contains "$event_storming_skill" 'without recommending what the business truth should be' "EventStorming should not anchor fact discovery"
assert_contains "$event_storming_skill" 'For a **design decision**' "EventStorming should distinguish design judgment"
assert_contains "$event_storming_skill" 'steelman the strongest credible alternative' "EventStorming should create constructive opposition"
assert_contains "$event_storming_skill" '### ✅ Recommendation — <short name>' "EventStorming should make the recommendation the primary visual path"
assert_contains "$event_storming_skill" '> **🔀 Alternative — <short name>**' "EventStorming should visually subordinate the credible alternative"
assert_contains "$event_storming_skill" '**👉 Decision:** <one frontier question>' "EventStorming should separate the decision prompt from both options"
assert_contains "$event_storming_skill" 'Fact probes do not use a Decision Frame' "EventStorming should reserve decision formatting for design choices"
assert_contains "$event_storming_skill" 'The informed user has final decision authority' "EventStorming should preserve HITP authority"
assert_contains "$event_storming_skill" 'Stop challenging when further cases have diminishing decision value' "EventStorming should bound adversarial exploration"
assert_contains "$event_storming_skill" 'Conflicting project sources are evidence, not an automatic precedence rule' "EventStorming should surface source conflicts"

assert_contains "$event_storming_skill" '## Integrated model and confirmation' "EventStorming should own one integrated confirmation gate"
assert_contains "$event_storming_skill" 'complete EventStorming diagram for every affected Aggregate or Bounded Context' "EventStorming should show the complete scoped model"
assert_contains "$event_storming_skill" 'Resolve it or narrow the scope before confirmation' "EventStorming should not confirm a model-level ambiguity"
assert_contains "$event_storming_skill" 'The user confirms the domain model, not a per-file change plan' "EventStorming should keep file planning out of confirmation"
assert_contains "$event_storming_skill" 'Determine the minimal semantic consistency closure after confirmation' "EventStorming should synchronize documents after model confirmation"
assert_contains "$event_storming_skill" 'If document synchronization requires a semantic decision absent from the confirmed model' "EventStorming should return new meaning to HITP"
assert_contains "$event_storming_skill" 'superseding ADR' "EventStorming should preserve historical decisions"
assert_contains "$event_storming_skill" 'Do not create Tactical Design merely because implementation follows' "EventStorming should keep tactical design conditional"
assert_not_contains "$event_storming_skill" 'codify_ready' "EventStorming should not recreate a separate design readiness state"
assert_not_contains "$event_storming_skill" 'Documentation Impact Set' "EventStorming confirmation should not expose a file-impact inventory"
assert_not_contains "$event_storming_skill" 'semantic_delta' "EventStorming should not expose a semantic-delta schema"
assert_not_contains "$event_storming_skill" 'package fingerprint' "EventStorming should not optimize for content-addressed confirmation machinery"
assert_contains "$CLAUDE_ROOT/templates/event-storming.md" 'status: draft' "EventStorming minutes should begin as a draft"
assert_contains "$CLAUDE_ROOT/templates/event-storming.md" 'status: superseded' "EventStorming minutes should expose the pre-implementation correction branch"
assert_contains "$CLAUDE_ROOT/templates/tactical-design.md" 'status: superseded' "Tactical Design should expose its invalidated pre-implementation branch"
assert_contains "$CLAUDE_ROOT/templates/event-storming.md" '## EventStorming Model' "EventStorming minutes should preserve the complete integrated diagram"
assert_not_contains "$CLAUDE_ROOT/templates/event-storming.md" '## Command-to-Capability Projection' "EventStorming minutes should not duplicate Command-to-Capability traceability outside the diagram"
assert_not_contains "$CLAUDE_ROOT/templates/event-storming.md" '## Aggregate Capabilities' "EventStorming minutes should not duplicate the Model's full capability authority"
assert_not_contains "$CLAUDE_ROOT/templates/event-storming.md" '## Required Reactions' "EventStorming minutes should not duplicate event-to-Command traceability outside the diagram"
assert_contains "$CLAUDE_ROOT/templates/event-storming.md" 'Role: <Initiating business role>' "EventStorming diagrams should use Bounded Context-local Roles"
assert_contains "$CLAUDE_ROOT/templates/event-storming.md" 'different Roles may use the same normalized Command label and target' "EventStorming diagrams should preserve shared intent without multiplying Commands or capabilities"
assert_contains "$CLAUDE_ROOT/templates/event-storming.md" 'Capability: <Root-owned operation>' "EventStorming diagrams should visualize the Root-owned behavior"
assert_contains "$CLAUDE_ROOT/templates/event-storming.md" 'role -- "Command: <Business intent>" --> sourceCapability --> sourceEvent' "EventStorming diagrams should encode Command as the edge into its Capability"
assert_contains "$CLAUDE_ROOT/templates/event-storming.md" 'Published Fact Contract:<br/><Published contract name>' "EventStorming diagrams should keep a producer-owned cross-context contract distinct from its Domain Event"
assert_contains "$CLAUDE_ROOT/templates/event-storming.md" 'published -- "Command: <Downstream business intent>" --> targetCapability' "EventStorming diagrams should encode fact-triggered downstream intent without a fake Role"
assert_not_contains "$CLAUDE_ROOT/templates/event-storming.md" 'command["Command:' "EventStorming diagrams should not duplicate Command and Capability as adjacent nodes"
assert_not_contains "$CLAUDE_ROOT/templates/event-storming.md" 'Policy: <Decision rule>' "EventStorming diagrams should keep constraints in Model authority rather than generic Policy nodes"
assert_not_contains "$CLAUDE_ROOT/templates/event-storming.md" 'Given fact: <Pre-existing authority or state>' "EventStorming diagrams should keep preconditions out of the low-resolution view"
assert_not_contains "$CLAUDE_ROOT/templates/event-storming.md" 'No-new-fact result: <Rejected or unchanged>' "EventStorming diagrams should keep generic rejected or unchanged branches out of the low-resolution view"
assert_not_contains "$CLAUDE_ROOT/templates/event-storming.md" '| Bounded Context | Aggregate Root | Source Command(s) | Capability | Required authoritative facts | Guaranteed business result | Stable rejection |' "EventStorming minutes should not copy full capability contracts"
assert_contains "$CLAUDE_ROOT/templates/event-storming.md" 'Workshop Event: <Past-tense business fact>' "EventStorming minutes should label analytical event nodes unambiguously"
assert_contains "$CLAUDE_ROOT/templates/event-storming.md" 'Domain Event: <Canonical past-tense fact>' "EventStorming minutes should show selected Domain Event annotation syntax"
assert_contains "$CLAUDE_ROOT/templates/event-storming.md" 'single source of truth for the iteration' "EventStorming minutes should not duplicate the scenario-thread inventory"
assert_not_contains "$CLAUDE_ROOT/templates/event-storming.md" '## Event Index' "EventStorming minutes should not add a parallel event catalog"
assert_contains "$CLAUDE_ROOT/templates/event-storming.md" '## Affected Models' "EventStorming minutes should link every affected canonical Model"
assert_contains "$CLAUDE_ROOT/templates/event-storming.md" '## Decisions and Reasons' "EventStorming minutes should preserve confirmed decisions and their reasons"
assert_contains "$CLAUDE_ROOT/templates/event-storming.md" '## Assumptions and Hotspots' "EventStorming minutes should preserve non-blocking uncertainty"
assert_contains "$CLAUDE_ROOT/templates/model.md" '# <Bounded Context> Domain Model' "model template should identify its bounded context"
assert_contains "$CLAUDE_ROOT/templates/model.md" 'model_revision: 1' "model template should start revision tracking"
assert_contains "$CLAUDE_ROOT/templates/model.md" 'last_changed_by: "../../event-storming/<event-storming-slug>.md"' "model template should link the EventStorming minutes that produced its current revision"
assert_not_contains "$CLAUDE_ROOT/templates/model.md" 'model_status:' "canonical Models should not carry iteration status"
assert_not_contains "$CLAUDE_ROOT/templates/model.md" '## EventStorming Model' "canonical Models should not duplicate iteration diagrams"
assert_contains "$CLAUDE_ROOT/templates/model.md" '## Aggregates and Core Business Objects' "model template should record step-eight conclusions"
assert_contains "$CLAUDE_ROOT/templates/model.md" 'Preserve each confirmed Bounded Context-local Role-to-Command permission in compact business language, grouping Roles that share a permission' "model template should retain permission authority without document sprawl"
assert_contains "$event_storming_skill" "Preserve confirmed Role-to-Command permissions compactly in the affected Model's Authority and Ownership section, grouping Roles that share the same permission" "EventStorming should project permissions into current Model authority compactly"
assert_contains "$CLAUDE_ROOT/templates/model.md" 'identity and continuity when present, ownership, lifecycle, validity, equality, normalization or units' "model template should preserve core-object semantics Codify needs for tactical choices"
assert_contains "$CLAUDE_ROOT/templates/model.md" '## Aggregate Capabilities' "model template should assign business behavior to Aggregate Roots"
assert_contains "$CLAUDE_ROOT/templates/model.md" '| Source Command(s) | Capability | Required authoritative facts | Guaranteed business result | Stable rejection |' "model template should make Command-to-Capability mappings checkable"
assert_contains "$CLAUDE_ROOT/templates/model.md" 'sole current authority for each supported Aggregate Root' "model template should own the full capability contract once"
assert_contains "$CLAUDE_ROOT/templates/model.md" "One row guides the Root's Domain method surface" "model template should connect business capability to code without prescribing signatures"
assert_contains "$event_storming_skill" 'Project each normalized state-changing Command onto one or more owned Aggregate Root capabilities or explicit Application/cross-Aggregate coordination' "EventStorming step eight should close behavior ownership gaps without forcing one Root"
assert_contains "$event_storming_skill" 'every in-scope Command edge reaches a capability or explicit coordination, every new or changed capability has a source Command edge' "EventStorming should validate Command-to-Capability coverage in both directions"
assert_contains "$event_storming_skill" 'Do not split capabilities by pre-state or scenario branch' "EventStorming should keep Aggregate capabilities at stable operation granularity"
assert_contains "$CLAUDE_ROOT/templates/model.md" 'without prescribing a Process Manager, message topology, transaction, or runtime mechanism' "model template should preserve coordination meaning without predesigning its realization"
assert_contains "$CLAUDE_ROOT/templates/model.md" '## Domain Events and Event-triggered Commands' "model template should project only selected durable local event meaning"
assert_contains "$CLAUDE_ROOT/templates/model.md" '### Selected Domain Events' "model template should keep selected event evidence compact"
assert_contains "$CLAUDE_ROOT/templates/model.md" '### Event-triggered Commands' "model template should retain business-required event-to-intent causality"
assert_contains "$CLAUDE_ROOT/templates/model.md" '| Triggering Domain Event or Published Fact Contract | Command | Target Aggregate Capability or coordination | Required business outcome |' "model template should connect facts to owned Aggregate behavior"
assert_contains "$CLAUDE_ROOT/templates/model.md" 'selects no Domain Events and owns no event-triggered Commands' "model template should not force an empty event or Command catalog"
assert_contains "$CLAUDE_ROOT/templates/model.md" 'Do not copy analytical-only Workshop Events' "model template should not duplicate every workshop fact"
assert_contains "$CLAUDE_ROOT/templates/model.md" 'Do not prescribe handlers, dispatch, transport, transactions, or retry mechanisms' "model event-triggered Commands should remain business authority rather than software wiring"
assert_contains "$CLAUDE_ROOT/templates/model.md" 'Required when this context participates in a Context Map dependency' "model template should carry each participating context dependency into Codify authority"
assert_contains "$CLAUDE_ROOT/templates/model.md" 'permitted downstream reliance, local translation' "model template should preserve contract reliance and translation"
assert_contains "$CLAUDE_ROOT/templates/model.md" '- **No supported Aggregate:** <evidence-based reason>' "model template should permit an evidence-based BC result without inventing an Aggregate"
assert_contains "$CLAUDE_ROOT/templates/model.md" '## Failure and Recovery Semantics' "model template should preserve failure semantics"
assert_contains "$CLAUDE_ROOT/templates/model.md" '## Hotspots and Open Questions' "model template should preserve visible unresolved scope"
assert_contains "$claude_maintainer" 'selected Domain Event semantics and event-triggered Commands when present' "artifact maintenance should preserve implementation-shaping event semantics in canonical Models"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'docs/ddd-expert/' "artifact layout should own the documentation root"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" '|-- README.md' "artifact layout should require a root README"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" '|-- context-map.md' "artifact layout should require a Context Map"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'event-storming/' "artifact layout should preserve one meeting-minutes file per EventStorming iteration"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'tactical-design/' "artifact layout should preserve one file per confirmed Design Delta"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'context/<context-slug>/model.md' "artifact layout should own per-context model placement"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'context/<context-slug>/architecture.md' "artifact layout should colocate current architecture with its owning context"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'Create it lazily only when that context has at least one durable, context-specific architecture decision' "artifact layout should keep BC Architecture optional"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'Project each cross-context decision once into the context that owns the responsibility' "artifact layout should prevent duplicated cross-context architecture authority"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'Do not create a root `docs/ddd-expert/architecture.md` catch-all' "artifact layout should reject a root architecture catch-all"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'An identity-preserving context rename mechanically moves its Architecture without changing decision rows or revision' "artifact layout should preserve current architecture through a pure context rename"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'A split, merge, or removal deletes the retired context Architecture from the current set without reassigning any row' "artifact layout should fail closed instead of silently reassigning architecture authority"
if awk '/^```text$/ { in_tree = 1; next } in_tree && /^```$/ { exit } in_tree { print }' \
  "$CLAUDE_ROOT/templates/artifact-layout.md" | rg -q '^\|-- architecture\.md'; then
  fail "artifact layout should place Architecture only below a Bounded Context"
fi
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" '`draft -> ready -> implemented`' "artifact layout should define the iteration lifecycle once"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" '`ready -> superseded`' "artifact layout should close a challenged ready iteration without claiming implementation"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'remove an unconfirmed Tactical Design draft and its README entry' "artifact layout should not retain a draft whose Design Delta disappeared"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'Replace an invalidated unimplemented `ready` record with a new confirmed Tactical Design when a material delta remains, or retire it directly when no replacement delta remains' "artifact layout should retire stale ready tactical authority without discarding history"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'remove every current BC Architecture source from its claims in the same consistency write' "artifact layout should not leave architecture sourced by superseded tactical claims"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'Ordinary `no_design_change` is a separate zero-write result' "artifact layout should distinguish no-change from lifecycle cleanup"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'matching producer checkpoint was complete' "artifact layout should require producer completion before closure"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'Models remain the current domain authority' "artifact layout should keep iteration minutes subordinate to canonical Models"
assert_not_contains "$CLAUDE_ROOT/templates/artifact-layout.md" '[design.md](design.md)' "artifact layout should not define a standalone Design artifact"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'No Design Delta means no Tactical Design file' "artifact layout should not create empty design ceremony"
assert_not_contains "$CLAUDE_ROOT/templates/artifact-layout.md" '`model_status: model_ready`' "artifact layout should keep iteration status out of canonical Models"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'one global Mermaid `graph LR`' "artifact layout should require one global Context Map view"
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'upstream (`U`) to downstream (`D`)' "artifact layout should define Context Map arrow direction"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" '## Global View' "Context Map template should expose one global view"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'Arrow direction: `U -> D` (Upstream model/published-contract influence -> Downstream model).' "Context Map template should define arrow semantics visibly"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'It does not describe runtime call flow' "Context Map template should distinguish model dependencies from calls"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" '```mermaid' "Context Map template should use an inline Mermaid diagram"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'graph LR' "Context Map template should use a graph layout"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'unique lower_snake_case Mermaid identifier' "Context Map template should require document-local unique lower_snake_case node identifiers"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'need not duplicate the context directory slug' "Context Map node identifiers should remain document syntax"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'context_a --> context_b' "Context Map template should keep dependency edges unlabeled"
assert_not_contains "$CLAUDE_ROOT/templates/context-map.md" '## Interaction View' "Context Map template should not carry a runtime interaction projection"
assert_not_contains "$CLAUDE_ROOT/templates/context-map.md" 'initiator -> receiver' "Context Map template should not model runtime call direction"
[ "$(rg -Fc 'context_a["<Context A>"]' "$CLAUDE_ROOT/templates/context-map.md")" -eq 1 ] ||
  fail "Context Map template should declare Context A once in the Global View"
[ "$(rg -Fc 'context_b["<Context B>"]' "$CLAUDE_ROOT/templates/context-map.md")" -eq 1 ] ||
  fail "Context Map template should declare Context B once in the Global View"
assert_not_contains "$CLAUDE_ROOT/templates/context-map.md" 'upstream_context[' "Context Map diagram node identifiers should not encode dependency roles"
assert_not_contains "$CLAUDE_ROOT/templates/context-map.md" 'initiating_context[' "Context Map diagram node identifiers should not encode interaction roles"
assert_not_contains "$CLAUDE_ROOT/templates/context-map.md" '## Interaction Details' "Context Map template should not duplicate scenario interaction details"
assert_not_contains "$CLAUDE_ROOT/templates/context-map.md" '#### Interactions' "Context Map template should not duplicate interactions under each Bounded Context"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" '## Model Dependency Contracts' "Context Map template should record each semantic contract once"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" '- **Downstream reliance:**' "Context Map contract details should capture downstream reliance once"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" '- **Local translation:**' "Context Map contract details should preserve downstream language protection"
assert_not_contains "$CLAUDE_ROOT/templates/context-map.md" '#### Upstream Dependencies' "Context Map template should not duplicate dependency details under downstream contexts"
assert_not_contains "$CLAUDE_ROOT/templates/context-map.md" '#### Downstream Contracts' "Context Map template should not duplicate contract details under upstream contexts"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" '#### Local View' "Context Map template should support focused direct-neighbor views"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'Optional. Include a Local View only when focusing on this context materially improves readability' "Context Map Local Views should be optional rather than duplicated mechanically"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'fenced `text` wireframe' "Context Map Local View should be an ASCII wireframe"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'Dependency arrows point from upstream to downstream, so do not add U/D labels' "Context Map Local View arrows should carry dependency direction without U/D labels"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'one connected fan-in/fan-out drawing rather than one relationship per Markdown line' "Context Map Local View should be one connected drawing"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" '| <Upstream Context> |-->| <Downstream Context> |' "Context Map Local View should use a validator-compatible attached arrow"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" 'Local Views never use Mermaid' "Context Map should reserve Mermaid for the Global View"
assert_contains "$CLAUDE_ROOT/templates/README.md" '[<Bounded Context>](context/<context-slug>/model.md)' "artifact README should use real context links"
assert_contains "$CLAUDE_ROOT/templates/README.md" 'optional [Architecture](context/<context-slug>/architecture.md)' "artifact README should link BC Architecture only when present"
assert_not_contains "$CLAUDE_ROOT/templates/README.md" '[architecture.md](architecture.md)' "artifact README should not advertise a root architecture file"
assert_contains "$CLAUDE_ROOT/templates/README.md" '[context-map.md](context-map.md)' "artifact README should link the Context Map"
assert_contains "$CLAUDE_ROOT/templates/README.md" '## EventStorming Iterations' "artifact README should index EventStorming minutes"
assert_contains "$CLAUDE_ROOT/templates/README.md" '- [ ] [<EventStorming scope>](event-storming/<event-storming-slug>.md)' "artifact README should expose the current iteration as a TODO"
assert_contains "$CLAUDE_ROOT/templates/README.md" '`[x]` only when its minutes use `status: implemented`' "artifact README should mirror implemented status in its TODO"
assert_contains "$CLAUDE_ROOT/templates/README.md" 'superseded by' "artifact README should distinguish corrected minutes from implemented work"
assert_contains "$CLAUDE_ROOT/templates/README.md" '## Tactical Design Deltas' "artifact README should index material tactical design records"
assert_contains "$CLAUDE_ROOT/templates/README.md" '- [ ] [<Design Delta>](tactical-design/<tactical-design-slug>.md)' "artifact README should expose ready Tactical Design work"
assert_not_contains "$CLAUDE_ROOT/templates/README.md" 'design.md' "artifact README should not advertise a standalone Design artifact"
assert_not_contains "$CLAUDE_ROOT/templates/README.md" '## Structure' "artifact README should not duplicate the canonical structure"
assert_not_contains "$CLAUDE_ROOT/templates/README.md" '|--' "artifact README should not maintain a dynamic directory tree"

tactical_design_skill="$CLAUDE_ROOT/skills/tactical-design/SKILL.md"
assert_contains "$tactical_design_skill" '# Tactical Design' "Tactical Design should be the DDD-native design workflow"
assert_contains "$tactical_design_skill" 'real **Design Delta**' "Tactical Design should have a material invocation threshold"
assert_contains "$tactical_design_skill" 'falsification power, not Model write authority' "Tactical Design should challenge EventStorming without silently overriding it"
assert_contains "$tactical_design_skill" '`no_design_change` and write no Tactical Design file' "Tactical Design should leave no artifact for ordinary reversible work"
assert_contains "$tactical_design_skill" 'Do not return `no_design_change` while an unconfirmed draft or invalidated ready record still requires discard, replacement, or retirement' "Tactical Design should resolve stale lifecycle state before ordinary no-change"
assert_contains "$tactical_design_skill" 'keep every project artifact byte-identical' "ordinary no-design-change should be a strict zero-write result"
assert_contains "$tactical_design_skill" 'complete typed collaboration sequences' "Tactical Design should close the coordination gap with typed sequence diagrams"
assert_contains "$tactical_design_skill" 'only persisted Model-to-design projection' "Tactical Design sequences should be the single persisted projection"
assert_contains "$tactical_design_skill" '`Role`, `External Authority`, `Command`, `Aggregate`, `Capability`, `Domain Event`, `Published Fact Contract`, `Integration Message`, `Coordination`, or `Workshop Event`' "Tactical Design should preserve accepted Model kinds in its sequence labels"
assert_contains "$tactical_design_skill" 'keep the producing Domain Event, producer translation, Integration Message, consumer translation, event-triggered Command, and target Capability distinct' "Tactical Design should preserve the cross-context semantic chain"
assert_contains "$tactical_design_skill" 'Show an analytical Workshop Event only as an outcome note; it never requires a software participant, message, or event type' "Tactical Design should not turn analytical events into production types"
assert_contains "$tactical_design_skill" 'Give a path its own diagram only when responsibility, guarantee, durable state/checkpoint, or externally visible outcome differs' "Tactical Design should not multiply diagrams for mechanical variants"
assert_contains "$tactical_design_skill" 'combine mechanically equivalent variants in one `alt` branch or note' "Tactical Design should keep complete paths reviewable"
assert_contains "$tactical_design_skill" 'fewest scenario-focused diagrams that remain readable' "Tactical Design should resist sequence-diagram sprawl"
assert_contains "$tactical_design_skill" 'add no parallel Model-to-design mapping table' "Tactical Design should avoid a duplicate projection artifact"
assert_contains "$tactical_design_skill" 'If two legacy rows appear to be pre-state variants of one normalized Command' "Tactical Design should challenge ambiguous legacy capability granularity"
assert_contains "$tactical_design_skill" 'transaction, state, concurrency, event publication, failure, and recovery ownership' "Tactical Design should make implementation-shaping ownership explicit"
assert_contains "$tactical_design_skill" 'write the complete initial draft before asking the first design question' "Tactical Design should give the user one complete editor canvas before review"
assert_contains "$tactical_design_skill" 'one frontier question per turn' "Tactical Design review should advance one material question at a time"
assert_contains "$tactical_design_skill" 'Treat a user challenge as a hypothesis, not an accepted correction' "Tactical Design should not absorb user proposals uncritically"
assert_contains "$tactical_design_skill" 'trace at least one credible consequence or counterexample' "Tactical Design should adversarially test user proposals"
assert_contains "$tactical_design_skill" 'Change the recommendation only when the evidence warrants it' "Tactical Design should preserve evidence-backed professional judgment"
assert_contains "$tactical_design_skill" 'open one temporary **Model Review Batch** instead of returning on the first question' "Tactical Design should collect related Model contradictions before handback"
assert_contains "$tactical_design_skill" 'one consolidated **Model Challenge**' "Tactical Design should hand the settled business-model problem back once"
assert_contains "$tactical_design_skill" 'conversation state, not another project artifact' "Tactical Design should connect workflows without creating handoff-file sprawl"
assert_contains "$tactical_design_skill" 'originating draft path and fingerprint' "Tactical Design should bind a Model Challenge to its review canvas"
assert_contains "$tactical_design_skill" 'every challenged Model path, revision, and section' "Tactical Design should identify the exact business authority under challenge"
assert_contains "$tactical_design_skill" 'all known concrete business scenarios or counterexamples in the batch' "Tactical Design should hand EventStorming complete falsification evidence"
assert_contains "$tactical_design_skill" 'Leave the complete Tactical Design draft byte-identical' "Tactical Design should freeze design while business authority is reviewed"
assert_contains "$tactical_design_skill" 'Sweep every existing sequence, claim, proposed Architecture decision' "Tactical Design should find dependent Model contradictions before returning"
assert_contains "$tactical_design_skill" 'a tactical challenge starts or extends one design revision batch; it never triggers an immediate draft write' "Tactical Design should clarify a connected design concern before redrawing"
assert_contains "$tactical_design_skill" 'Close the revision batch only after every affected success, rejection, failure, timeout, retry, and recovery path' "Tactical Design should resolve the whole affected scenario chain"
assert_contains "$tactical_design_skill" 'rewrite the complete draft once' "Tactical Design should apply one coherent revision instead of conversational patches"
assert_contains "$tactical_design_skill" 'rebase the same draft as one complete design revision batch' "Tactical Design should resume coherently after EventStorming changes"
assert_contains "$tactical_design_skill" 'EventStorming works through that one batch and creates at most one correction draft' "Tactical Design should prevent one EventStorming record per challenge question"
assert_contains "$tactical_design_skill" '`discard-tactical-design-draft`' "Tactical Design should remove an unconfirmed draft when its delta disappears"
assert_contains "$tactical_design_skill" '`discarded`: cite the removed unconfirmed draft' "Tactical Design should report draft cleanup separately from zero-write no-change"
assert_contains "$tactical_design_skill" '`supersede-ready-tactical-design`' "Tactical Design should retire confirmed but invalidated pre-implementation authority"
assert_contains "$tactical_design_skill" 'A `ready` Tactical Design whose governing EventStorming record was superseded is no longer Codify authority and is never rewritten or discarded' "Tactical Design should preserve confirmed history while replacing stale authority"
assert_contains "$tactical_design_skill" 'Do not route to Codify until an invalidated ready record is replaced or retired' "Tactical Design should close the authority gap before implementation"
assert_contains "$tactical_design_skill" '`reviewing`' "Tactical Design should expose its draft-led interaction outcome"
assert_contains "$tactical_design_skill" '`awaiting_confirmation`: no frontier question, design revision batch, or Model Review Batch remains' "Tactical Design should reserve final confirmation for a settled draft"
assert_contains "$tactical_design_skill" 'small `Tactical Design Claims` set' "Tactical Design should expose stable review assertions"
assert_contains "$tactical_design_skill" 'Do not create one claim per Mermaid arrow, file, method, or layer' "Tactical Design should keep claims semantic and bounded"
assert_contains "$tactical_design_skill" 'canonical claim key is `<record-path>#TD-NNN`' "Tactical Design should disambiguate local claim IDs across records"
assert_contains "$tactical_design_skill" 'matching explicit HTML anchor in the claim ID cell' "Tactical Design should make every canonical claim key navigable"
assert_contains "$tactical_design_skill" 'project only durable, context-specific decisions into each owning `context/<context-slug>/architecture.md`' "Tactical Design should retain current architecture without a root catch-all"
assert_contains "$tactical_design_skill" 'An `implemented` Tactical Design record is history; current BC Architecture carries its surviving decisions' "Tactical Design should separate design history from current authority"
assert_contains "$tactical_design_skill" 'Do not copy complete sequences, generic House Style, Model facts, code structure, or decision history into BC Architecture' "Tactical Design should keep BC Architecture sparse"
assert_contains "$tactical_design_skill" 'explicit user confirmation of the exact draft path and fingerprint' "Tactical Design should use one integrated confirmation gate"
assert_contains "$tactical_design_skill" 'ADRs own hard-to-reverse decisions and rationale' "Tactical Design should preserve ADR ownership"
assert_contains "$CLAUDE_ROOT/templates/tactical-design.md" 'status: draft' "Tactical Design records should begin as drafts"
assert_contains "$CLAUDE_ROOT/templates/tactical-design.md" '## Critical Collaboration Sequences' "Tactical Design template should require sequence diagrams"
assert_contains "$CLAUDE_ROOT/templates/tactical-design.md" 'sequenceDiagram' "Tactical Design template should use Mermaid sequence diagrams"
assert_contains "$CLAUDE_ROOT/templates/tactical-design.md" 'only persisted Model-to-design projection' "Tactical Design template should keep projection in sequences only"
assert_contains "$CLAUDE_ROOT/templates/tactical-design.md" 'actor Role as Role: <Business Role>' "Tactical Design template should distinguish a business Role from technical participants"
assert_contains "$CLAUDE_ROOT/templates/tactical-design.md" 'Role->>Interface: Command: <Business intent>' "Tactical Design template should carry normalized Commands into the Interface seam"
assert_contains "$CLAUDE_ROOT/templates/tactical-design.md" 'Application->>Root: Capability: <Stable Root operation>' "Tactical Design template should connect Application to the accepted Aggregate Capability"
assert_contains "$CLAUDE_ROOT/templates/tactical-design.md" 'Note over Role,Root: Workshop Event: <Past-tense business outcome>' "Tactical Design template should render analytical outcomes as notes"
assert_contains "$CLAUDE_ROOT/templates/tactical-design.md" 'Published Fact Contract, Integration Message' "Tactical Design template should keep cross-context fact and wire concepts separate"
assert_contains "$CLAUDE_ROOT/templates/tactical-design.md" '## Tactical Design Claims' "Tactical Design template should expose immutable claim IDs"
assert_contains "$CLAUDE_ROOT/templates/tactical-design.md" '| Claim ID | Responsibility | Accepted assertion |' "Tactical Design claims should be compact and reviewable"
assert_contains "$CLAUDE_ROOT/templates/tactical-design.md" '<a id="TD-001"></a>TD-001' "Tactical Design claim IDs should expose stable fragment anchors"
assert_contains "$CLAUDE_ROOT/templates/tactical-design.md" '## BC Architecture Projection' "Tactical Design should expose the exact current-authority projection for confirmation"
assert_contains "$CLAUDE_ROOT/templates/tactical-design.md" 'Omit this section when no accepted claim must survive as a current BC-specific architecture decision' "Tactical Design should not force architecture writes"
assert_contains "$CLAUDE_ROOT/templates/tactical-design.md" '## Codify Discretion' "Tactical Design should leave reversible choices to Codify"
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
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" "load this plugin's internal \`maintain-artifacts\` skill" "codify should load the artifact protocol"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'execute only its `inspect` operation' "codify should request read-only artifact inspection"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'never request or perform an apply operation' "codify should never authorize artifact writes"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'canonical Models own current business meaning' "codify should consume canonical Models as domain authority"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" '`legacy_model_ready`' "codify should accept legacy confirmed Models during migration"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'An inspected `legacy_capability_projection` remains readable authority while its Model is unchanged' "codify should migrate old capability tables lazily"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'overlapping state-qualified rows or missing source intent to `event-storming`' "codify should not realize legacy table cardinality blindly"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Reversible choices inside accepted seams remain Codify decisions' "codify should retain ordinary engineering discretion"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'each scoped EventStorming file is `ready`' "codify should reject unconfirmed iteration minutes"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Route `draft` minutes' "codify should return unconfirmed iterations to EventStorming"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Do not autonomously choose destructive data/schema change' "codify should bound irreversible engineering commitments"
assert_not_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'codify_ready' "codify should not require a second readiness status"
assert_not_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'missing_design' "codify should not block on a standalone Design artifact"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Route an absent, draft, stale, or contradictory required design to `tactical-design`' "codify should not invent missing collaboration design"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" '`tactical_claim_map`' "codify handoff should map accepted design claims to changed symbols"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'relevant current BC Architecture' "codify should consume current context-owned design authority"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" '`implemented` Tactical Design is provenance, not current authority' "codify should not treat closed design history as a living constraint ledger"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'must not rewrite a claim or prewrite its verdict' "codify should keep the review handoff neutral"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'verdicts belong to Guard and are not Codify output' "codify should route artifact feedback without Guard verdicts"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'multi-label realization map' "codify should classify one obligation across every touched surface"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'including the direct EventStorming-to-Codify path, build a temporary scoped `model_projection_map`' "codify should preserve Model traceability even without Tactical Design"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'start the `model_projection_map` with every scoped Role- or external-authority-to-Command permission, Command-to-Capability or explicit-coordination thread' "codify should realize the accepted typed Model relationships"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Keep the map many-to-many and semantic: it is not a class, handler, or method inventory' "codify should not turn Model concepts into mechanical symbol cardinality"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Record an analytical Workshop Event as requiring no production projection' "codify should not generate code from analytical events"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'One symbol may satisfy several entries and one entry may require several symbols' "codify should reconcile projection without forced name matching"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Keep this task evidence outside DDD artifacts and code' "codify projection should not become another durable authority"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" "do not expose pre-state variants as separate public operations or make Application reproduce the Root's decision" "codify should keep state-dependent decisions in the Aggregate"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Runtime/platform label never suppresses an applicable flow label' "codify should not let Runtime classification hide an applicable flow"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" "periodic, polling, and deferred-recovery work also follows the router's taskqueue branch" "codify should route periodic recovery through taskqueue guidance"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" '**Run producer conformance**' "codify should check applicable house style before its implementation checkpoint"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Routine, reversible, Model-preserving implementation work may finish at a Codify checkpoint' "codify should not require Guard after every implementation edit"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Default to this checkpoint for an implementation-only request' "codify should make the lightweight checkpoint its normal implementation outcome"
assert_not_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'After a non-mechanical `changed` implementation' "codify should not trigger Guard for every non-mechanical change"
assert_not_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Only a purely mechanical change' "codify should not limit checkpoints to mechanical changes"
assert_not_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'in the same task' "codify should not force Guard into every implementation task"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'does not self-certify' "codify should leave the independent review verdict to Guard"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'fresh read-only Guard reviewer in a distinct agent context' "codify should isolate Guard from the implementer"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'neutral architecture review unit per atomic responsibility assertion' "codify should prepare atomic architecture navigation"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Review Handoff path' "codify should pass the neutral navigation handoff"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" '`architecture_review_units`' "codify should describe architecture review units"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" '`producer_checkpoint`' "codify should bind producer completion to the reviewed snapshot"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Do not put `clear`, `violation`, `evidence_gap`' "codify handoff should not anchor Guard judgments"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'either immutable base/target identifiers or an immutable base plus a complete worktree snapshot' "codify should hand Guard a complete stable code surface"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Run Guard once over the stable snapshot rather than after each edit' "codify should batch independent review at a certification boundary"
assert_not_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" '**Verify both gates**' "codify should not retain its retired self-certification step"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'clear over that snapshot and the producer checkpoint is complete' "codify should require both independent review and producer completion"
assert_not_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'clear over the final diff' "codify should not narrow Guard back to a diff that can omit new paths"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" "load this plugin's internal \`maintain-artifacts\` skill" "guard should load the artifact protocol"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'execute only its `inspect` operation' "guard should request read-only artifact inspection"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'independent **semantic-structure review**' "guard should state its bounded review purpose"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'not a comprehensive code review, bug hunt, verification campaign, or file-by-file conformance audit' "guard should not become a general code review"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'one fresh agent context distinct from the implementer' "guard should preserve producer-reviewer independence"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'do not delegate or create recursive review fan-out' "guard should remain a single-reviewer workflow"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '`maintain-artifacts.mark-iteration-implemented`' "guard should expose one narrow joint closure transition"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'A `draft` iteration is not implementation authority' "guard should require confirmed iteration authority"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'a `superseded` EventStorming record is correction history, not review authority' "guard should ignore corrected EventStorming history"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'affected canonical Models own current business meaning' "guard should keep Models above implementation evidence"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'An inspected `legacy_capability_projection` remains readable authority while its Model is unchanged' "guard should preserve compatibility with prior capability tables"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '`Interface` is the language-neutral responsibility name' "guard should use the shared Interface vocabulary"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Go calls the same layer `transport`' "guard should map Go transport to Interface without creating another layer"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '**Domain is primary**' "guard should prioritize Domain-owned structure"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '**Application is primary**' "guard should prioritize Application-owned structure"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Trace normalized Commands to their accepted capabilities' "guard should review the semantic Domain method surface"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'do not infer a violation from method count alone' "guard should review ownership rather than method cardinality"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '**Infrastructure is a structural seam**' "guard should review Infrastructure at its architecture boundary"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '**Interface is a structural seam**' "guard should review Interface at its architecture boundary"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '**Runtime is a structural seam when affected**' "guard should review Runtime composition without operational probing"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Test bodies and frontend behavior are producer-verification evidence' "guard should not search tests or frontend for backend findings"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '`claim_sources`' "guard handoff should pin governing sources"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '`model_projection_map`' "guard handoff should expose producer projection navigation"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '`tactical_claim_map`' "guard handoff should preserve immutable Tactical Design claim IDs"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '`architecture_review_units`' "guard handoff should provide atomic architecture navigation"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '`producer_checkpoint`' "guard should consume the producer checkpoint"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'one atomic responsibility assertion' "guard should review independently falsifiable responsibilities"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'scoped Tactical Design Claims' "guard should seed bounded units from accepted tactical claims"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'DDD-significant declarations or wiring edges' "guard should seed bounded units from changed architecture"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'source-backed architecture responsibilities from every governing authority' "guard should not omit Model or project-constraint responsibilities"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'current BC Architecture decisions' "guard should review context-owned current architecture"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'independently reconstruct the scoped Model-to-code projection' "guard should verify projection without trusting the producer map"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'never as an automatic finding or one-unit-per-entry rule' "guard should not equate projection entries with review findings"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Do not parse every Mermaid arrow or create a unit per projection entry' "guard should judge responsibilities instead of mechanically auditing diagrams or mappings"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'explicit crosswalk from each source-unit assertion' "guard should preserve assertions while atomizing units"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'adapter fidelity cannot clear a mechanism-shaped or over-broad inner capability' "guard should judge inner contracts independently from working adapters"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Do not run producer tests, builds, migrations, query experiments, environment probes, Docker, live databases, networks, deployment checks, or external services' "guard should consume producer evidence without reverification"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'every frozen unit ID to have exactly one state' "guard should finish every architecture unit"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'source unit/assertion, frozen ID, responsibility, and state' "guard should expose its terminal architecture ledger"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'producer checkpoint is also `complete`' "guard should close an iteration only after producer completion"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'close every reviewed `ready` EventStorming and Tactical Design record together' "guard should close both confirmed iteration authorities"
assert_not_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'launch two independent read-only workers' "guard should not restore the retired parallel axes"
assert_not_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '"inventory_ids"' "guard should not restore changed-path coverage envelopes"
assert_not_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '`needs_depth`' "guard should not restore recursive depth dispatch"
assert_contains "$ROOT/scripts/eval/ddd-expert.js" 'put every source assertion and its frozen unit judgment in architecture_ledger' "guard eval prompt should request the terminal ledger"
assert_contains "$ROOT/scripts/eval/ddd-expert.js" 'link every non-clear frozen_id to exactly one verdict through unit_ids' "guard eval prompt should preserve finding-to-unit linkage"
assert_contains "$ROOT/evals/ddd-expert/result.schema.json" '"architecture_ledger"' "guard eval result should expose the architecture ledger"
assert_contains "$ROOT/evals/ddd-expert/result.schema.json" '"unit_ids"' "guard eval verdicts should identify contributing frozen units"
assert_not_contains "$ROOT/scripts/eval/ddd-expert.js" 'required workers cannot complete' "guard eval prompt should not restore worker completion"
if rg -n '(Agent tool|Task tool|general-purpose|spawn_agent|subagent_type|run_in_background)' \
  "$CLAUDE_ROOT/skills/guard/SKILL.md" "$CODEX_ROOT/skills/guard/SKILL.md" >/dev/null; then
  fail "shared guard skill should describe delegation without platform-specific agent APIs"
fi
assert_contains "$claude_maintainer" 'event-storming` may use `inspect`, `validate-proposed-model`, `write-event-storming-draft`, and `apply-ready-event-storming' "artifact maintainer should authorize EventStorming operations"
assert_contains "$claude_maintainer" 'tactical-design` may use `inspect`, `validate-proposed-tactical-design`, `write-tactical-design-draft`, `discard-tactical-design-draft`, `supersede-ready-tactical-design`, and `apply-ready-tactical-design' "artifact maintainer should authorize phased Tactical Design operations"
assert_contains "$claude_maintainer" 'codify` may use `inspect` only' "artifact maintainer should keep Codify read-only"
assert_contains "$claude_maintainer" 'guard` may use `inspect` and, after a clear review, `mark-iteration-implemented`' "artifact maintainer should give Guard one narrow joint closure operation"
assert_contains "$claude_maintainer" 'clear semantic-structure review over one unchanged snapshot' "artifact closure should consume the new Guard verdict"
assert_contains "$claude_maintainer" 'snapshot-bound producer checkpoint is complete' "artifact closure should require producer completion"
assert_contains "$claude_maintainer" 'Own no domain decision' "artifact maintainer should remain mechanical"
assert_contains "$claude_maintainer" 'explicit user-confirmation evidence' "artifact writes should prove integrated-model authority"
assert_contains "$claude_maintainer" 'The user confirms the integrated domain model, not this internal file inventory' "artifact writes should not expose a document-impact approval"
assert_contains "$claude_maintainer" 'complete consistency read set' "artifact apply should protect semantic inputs"
assert_contains "$claude_maintainer" 'Stage the complete rendered terminal set outside the project workspace' "artifact maintainer should validate before writing"
assert_contains "$claude_maintainer" 'immediately before the first project mutation' "artifact apply should recheck stale pre-state"
assert_contains "$claude_maintainer" 'Any drift returns `revision_conflict` with zero writes' "artifact apply should fail closed on drift"
assert_contains "$claude_maintainer" 'Reject input that requires inventing a term, rule, boundary, collaboration, lifecycle decision, or document meaning' "artifact maintainer should not make semantic edits"
assert_contains "$claude_maintainer" 'updates `last_changed_by` to the ready minutes' "artifact maintainer should link each changed Model to the current iteration"
assert_contains "$claude_maintainer" '`draft_event_storming`' "artifact inspection should expose unconfirmed iteration minutes"
assert_contains "$claude_maintainer" '`ready_event_storming`' "artifact inspection should expose the Codify handoff"
assert_contains "$claude_maintainer" '`implemented_event_storming`' "artifact inspection should expose closed iteration minutes"
assert_contains "$claude_maintainer" '`superseded_event_storming`' "artifact inspection should expose corrected pre-implementation history"
assert_contains "$claude_maintainer" '`draft_tactical_design`, `ready_tactical_design`, or `implemented_tactical_design`' "artifact inspection should expose Tactical Design lifecycle"
assert_contains "$claude_maintainer" '`superseded_tactical_design`' "artifact inspection should expose invalidated pre-implementation tactical history"
assert_contains "$claude_maintainer" 'A `ready` record whose governing EventStorming link became `superseded` is invalidated' "artifact inspection should reject stale ready tactical authority"
assert_contains "$claude_maintainer" 'claim IDs are unique within each record and canonical claim keys use `<record-path>#TD-NNN`' "artifact inspection should prevent cross-record claim ambiguity"
assert_contains "$claude_maintainer" 'matching explicit HTML anchor' "artifact inspection should reject dangling canonical keys"
assert_contains "$claude_maintainer" '`context_architecture`' "artifact inspection should expose current BC Architecture"
assert_contains "$claude_maintainer" 'BC Architecture decision IDs are unique within each file' "artifact inspection should keep current architecture decisions addressable"
assert_contains "$claude_maintainer" 'canonical architecture keys use `<architecture-path>#ARCH-NNN`' "artifact inspection should disambiguate architecture decisions across contexts"
assert_contains "$claude_maintainer" 'mechanically renamed or removed BC Architecture paths' "EventStorming closure should keep Architecture lifecycle aligned with confirmed context changes"
assert_contains "$claude_maintainer" 'Never create `docs/ddd-expert/architecture.md`' "artifact maintenance should reject a root architecture catch-all"
assert_contains "$claude_maintainer" '`legacy_model_ready`' "artifact inspection should preserve compatibility with confirmed status-bearing Models"
assert_contains "$claude_maintainer" 'accepted `legacy_capability_projection`, not `invalid_layout`' "artifact inspection should preserve prior capability tables during lazy migration"
assert_contains "$claude_maintainer" 'never perform a format-only Model revision' "artifact maintenance should avoid migration-only document churn"
assert_contains "$claude_maintainer" '`legacy_context_map`' "artifact inspection should expose Global-only Context Maps as migration inputs"
assert_not_contains "$claude_maintainer" '`stale_design`' "artifact inspection should not expose a standalone Design readiness state"
assert_not_contains "$claude_maintainer" '../../templates/design.md' "artifact maintainer should not load a standalone Design template"
assert_contains "$claude_maintainer" '../../templates/artifact-layout.md' "artifact maintainer should load the canonical layout"
assert_contains "$claude_maintainer" '../../templates/README.md' "artifact maintainer should load the root README template"
assert_contains "$claude_maintainer" '../../templates/context-map.md' "artifact maintainer should load the Context Map template"
assert_contains "$claude_maintainer" '../../templates/event-storming.md' "artifact maintainer should load the EventStorming minutes template"
assert_contains "$claude_maintainer" '../../templates/model.md' "artifact maintainer should load the Model template"
assert_contains "$claude_maintainer" '../../templates/architecture.md' "artifact maintainer should load the BC Architecture template"
assert_contains "$claude_maintainer" '../../templates/tactical-design.md' "artifact maintainer should load the Tactical Design template"
assert_contains "$claude_maintainer" '`validate-proposed-model`' "artifact maintainer should expose a read-only proposal preflight"
assert_contains "$claude_maintainer" 'New draft minutes express Command-to-Capability and event-to-Command traceability only through connected diagram edges' "proposal validation should keep iteration traceability in the diagram"
assert_contains "$claude_maintainer" "every projected Model's full capability contracts" "proposal validation should keep full capability authority in Models"
assert_contains "$claude_maintainer" 'repeated Role edges for one intent to reuse the same canonical label and target' "proposal validation should normalize shared Role intent without losing permissions"
assert_contains "$claude_maintainer" 'each projected Model source-Command/capability pair to equal one connected diagram edge' "proposal validation should trace Model capabilities to EventStorming Commands"
assert_contains "$claude_maintainer" 'each confirmed Bounded Context-local Role-to-Command permission to remain in that Model' "proposal validation should preserve business permission authority"
assert_contains "$claude_maintainer" 'every state-changing Command edge to reach an Aggregate Capability or explicit coordination' "proposal validation should close Command ownership gaps"
assert_contains "$claude_maintainer" 'supported by a connected Workshop Event, confirmed decision, assumption, or other evidence in the exact minutes rather than introduced only in the Model projection' "proposal validation should reject unreviewed capability meaning"
assert_contains "$claude_maintainer" 'proves only that the displayed diagrams and artifact projections are structurally persistable' "proposal validation should not claim architecture correctness"
assert_contains "$claude_maintainer" 'complete typed critical sequences' "tactical proposal validation should require the typed projection form"
assert_contains "$claude_maintainer" 'A fact-triggered Command has no fake Role' "tactical proposal validation should preserve non-human command causality"
assert_contains "$claude_maintainer" 'Require each Design Delta-relevant Model relationship to appear in at least one sequence' "tactical proposal validation should cover the scoped Model projection"
assert_contains "$claude_maintainer" 'Reject a parallel Model-to-design mapping table' "tactical proposal validation should prevent artifact duplication"
assert_contains "$claude_maintainer" 'do not invalidate an existing `ready` or `implemented` Tactical Design solely because its sequence labels predate the typed projection form' "artifact inspection should migrate typed Tactical Design lazily"
assert_contains "$claude_maintainer" 'complete initial candidate before interactive review begins' "artifact maintenance should materialize the full design canvas before discussion"
assert_contains "$claude_maintainer" 'one settled revision batch' "artifact maintenance should accept coherent draft revisions"
assert_contains "$claude_maintainer" 'Reject partial conversational edits' "artifact maintenance should reject per-message draft mutation"
assert_contains "$claude_maintainer" '## Discard Tactical Design draft' "artifact maintenance should own narrow cleanup of invalidated unconfirmed design"
assert_contains "$claude_maintainer" 'Never discard a `ready` or `implemented` record' "artifact maintenance should protect confirmed design history"
assert_contains "$claude_maintainer" '## Supersede ready Tactical Design' "artifact maintenance should own narrow retirement of invalidated ready design"
assert_contains "$claude_maintainer" 'remove every current BC Architecture row sourced from that record' "tactical retirement should clean stale architecture claim sources"
assert_contains "$claude_maintainer" 'Require evidence that no replacement Design Delta remains' "tactical retirement should use a factual precondition instead of the no-change terminal name"
assert_contains "$claude_maintainer" 'set `last_changed_by` to the just-superseded Tactical Design solely as retirement provenance' "partial architecture retirement should record the revision source without reviving stale claims"
assert_not_contains "$claude_maintainer" 'Require `no_design_change`' "artifact maintenance should not overload the ordinary no-change terminal state"
assert_contains "$claude_maintainer" 'Do not condition this transition on whether the correction originated in Tactical Design' "EventStorming correction lineage should be source-independent"
assert_not_contains "$claude_maintainer" 'For a Model Challenge correction' "artifact maintenance should not restrict EventStorming supersession to Tactical Design challenges"
assert_contains "$claude_maintainer" 'exact `ready -> superseded` transition' "artifact maintenance should apply Model Challenge correction lineage atomically"
assert_contains "$claude_maintainer" 'A structurally valid but different graph is confirmation drift' "artifact maintainer should preserve the confirmed Context Map"
assert_contains "$claude_maintainer" 'every accepted project Bounded Context exactly once' "artifact maintainer should keep isolated contexts in the global diagram"
assert_contains "$claude_maintainer" 'self-loops, reciprocal dependencies, longer cycles' "artifact maintainer should enforce the Context Map DAG"
assert_contains "$claude_maintainer" 'Spec, PRD, ADR, and Glossary' "artifact maintainer should close confirmed source-document impacts"
assert_contains "$claude_maintainer" 'Preserve accepted historical rationale' "artifact maintainer should respect ADR lifecycle"
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
assert_contains "$CLAUDE_ROOT/README.md" 'ten EventStorming steps' "Claude README should expose the complete strategic workflow"
assert_contains "$CODEX_ROOT/README.md" 'ten EventStorming steps' "Codex README should expose the complete strategic workflow"
assert_contains "$CLAUDE_ROOT/README.md" 'one frontier question at a time' "Claude README should expose the HITP conversation contract"
assert_contains "$CODEX_ROOT/README.md" 'one frontier question at a time' "Codex README should expose the HITP conversation contract"
assert_contains "$CLAUDE_ROOT/README.md" 'strongest credible alternative' "Claude README should expose constructive challenge"
assert_contains "$CODEX_ROOT/README.md" 'strongest credible alternative' "Codex README should expose constructive challenge"
assert_contains "$CLAUDE_ROOT/README.md" 'Spec, PRD, ADR, and Glossary' "Claude README should include confirmed documentation closure"
assert_contains "$CODEX_ROOT/README.md" 'Spec, PRD, ADR, and Glossary' "Codex README should include confirmed documentation closure"
assert_contains "$CLAUDE_ROOT/README.md" 'does not force a new repository-wide Big Picture' "Claude README should keep EventStorming proportionate"
assert_contains "$CODEX_ROOT/README.md" 'codex plugin marketplace upgrade skill-workshop-codex' "Codex README should upgrade by marketplace name"
assert_contains "$CLAUDE_ROOT/README.md" 'verified implementation checkpoint' "Claude README should expose the Codify checkpoint"
assert_contains "$CODEX_ROOT/README.md" 'verified implementation checkpoint' "Codex README should expose the Codify checkpoint"
assert_contains "$CLAUDE_ROOT/README.md" 'No Design Delta produces no Tactical Design artifact' "Claude README should keep Tactical Design conditional"
assert_contains "$CODEX_ROOT/README.md" 'No Design Delta produces no Tactical Design artifact' "Codex README should keep Tactical Design conditional"
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

domain="$CLAUDE_ROOT/references/ddd-golang-domain.md"
assert_contains "$domain" 'github.com/go-playground/validator/v10' "Go Domain should own business-data validation"
assert_contains "$domain" 'It does not need to span multiple Aggregates' "Domain Service should not require cross-Aggregate work"
assert_contains "$domain" 'does not save, control transactions' "Domain Services should neither persist Aggregates nor control transactions"
assert_contains "$domain" 'After a successful `Save`, that Aggregate instance is stale' "Go Domain should define the post-Save lifecycle"
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
assert_contains "$typescript_guide" 'A saved Aggregate is stale' "TypeScript guide should define the post-Save lifecycle"

database="$CLAUDE_ROOT/references/database.md"
assert_contains "$database" 'Every table governed by this profile' "database profile should define standard columns"
for column in '`id` varchar(36)' '`version` int unsigned' '`created_at` bigint' '`updated_at` bigint' '`deleted_at` bigint'; do
  assert_contains "$database" "$column" "database profile missing standard column $column"
done
assert_contains "$database" 'new in-memory Aggregate has version `0`' "database profile should define initial versions"
assert_contains "$database" 'After a successful save, the instance is stale' "database profile should align post-save behavior"
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
assert_contains "$ROOT/README.md" 'verified implementation checkpoint' "root README should expose the Codify checkpoint"
assert_contains "$ROOT/README.md" 'jointly closes clear iteration records when the producer checkpoint is complete' "root README should expose the Guard certification boundary"
assert_contains "$ROOT/README.md" 'one `draft` meeting record as the approval surface' "root README should expose EventStorming minutes as the confirmation surface"
assert_contains "$ROOT/README.md" 'Tactical Design uses typed critical sequences as the Model-to-design projection' "root README should expose the typed collaboration-design bridge"
assert_contains "$ROOT/README.md" 'Codify carries a temporary many-to-many Model-to-code projection' "root README should expose transient implementation traceability"
assert_contains "$ROOT/README.md" 'only durable BC-specific decisions are projected into optional sibling `architecture.md` files' "root README should expose sparse current BC Architecture"
assert_contains "$ROOT/README.md" 'link their latest minutes through `last_changed_by`' "root README should expose current Model provenance"
confirmation_adr="$ROOT/docs/adr/0003-event-storming-whole-model-confirmation.md"
direct_codify_adr="$ROOT/docs/adr/0004-model-ready-enters-codify-directly.md"
iteration_minutes_adr="$ROOT/docs/adr/0005-event-storming-minutes-and-current-models.md"
guard_review_adr="$ROOT/docs/adr/0006-guard-is-a-semantic-structure-review.md"
tactical_design_adr="$ROOT/docs/adr/0007-conditional-tactical-design-and-claims.md"
[ -f "$confirmation_adr" ] || fail "whole-model EventStorming ADR missing"
[ -f "$direct_codify_adr" ] || fail "direct model_ready-to-Codify ADR missing"
[ -f "$iteration_minutes_adr" ] || fail "EventStorming iteration-minutes ADR missing"
[ -f "$guard_review_adr" ] || fail "bounded Guard review ADR missing"
[ -f "$tactical_design_adr" ] || fail "conditional Tactical Design ADR missing"
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
assert_contains "$tactical_design_adr" 'No root `docs/ddd-expert/architecture.md` is introduced' "Tactical Design ADR should reject a root architecture catch-all"
assert_contains "$tactical_design_adr" 'one complete typed critical sequence per material success, failure, or recovery path' "Tactical Design ADR should require complete typed collaboration views"
assert_contains "$tactical_design_adr" 'complete initial draft before the first review question' "Tactical Design ADR should make the editor artifact the review canvas"
assert_contains "$tactical_design_adr" 'one connected design revision batch' "Tactical Design ADR should batch related tactical clarification before redrawing"
assert_contains "$tactical_design_adr" 'one temporary Model Review Batch' "Tactical Design ADR should consolidate related Model contradictions before handback"
assert_contains "$tactical_design_adr" 'creates at most one correction draft' "Tactical Design ADR should prevent one EventStorming file per question"
assert_contains "$tactical_design_adr" 'Model Challenge' "Tactical Design ADR should define its falsification handback to EventStorming"
assert_contains "$tactical_design_adr" '`ready -> superseded`' "Tactical Design ADR should retire invalidated ready design without false implementation"
assert_contains "$tactical_design_adr" 'Ordinary `no_design_change` is a zero-write result' "Tactical Design ADR should separate no-change from cleanup outcomes"
assert_contains "$tactical_design_adr" 'Either path replaces or removes every BC Architecture source from the stale claims' "Tactical Design ADR should close stale current architecture authority"
assert_contains "$tactical_design_adr" 'Guard does not parse every Mermaid arrow' "Tactical Design ADR should keep Guard claim-led"
assert_contains "$tactical_design_adr" 'Those sequences are the only persisted Model-to-design projection' "Tactical Design ADR should keep typed sequences as the single design projection"
assert_contains "$tactical_design_adr" 'including the direct EventStorming-to-Codify path' "Tactical Design ADR should retain projection on the low-cost direct path"
assert_contains "$tactical_design_adr" 'temporary scoped `model_projection_map`' "Tactical Design ADR should define transient code traceability"
assert_contains "$tactical_design_adr" 'independently reconstructs the scoped Model projection' "Tactical Design ADR should keep Guard independent of producer claims"
assert_contains "$tactical_design_adr" 'closes every reviewed ready EventStorming and Tactical Design record together' "Tactical Design ADR should define joint closure"
assert_contains "$iteration_minutes_adr" 'closed process history, not authority that future work must reconstruct' "iteration-minutes ADR should keep completed minutes out of future authority"
assert_contains "$iteration_minutes_adr" 'Guard gains one narrowly mechanical post-clear write; its review remains read-only' "iteration-minutes ADR should bound Guard mutation"
assert_contains "$ROOT/CONTEXT.md" 'persisted unchanged in the confirmed iteration minutes and projected into the affected current Models' "shared vocabulary should match the iteration-minutes authority split"
assert_contains "$ROOT/CONTEXT.md" '**Aggregate Capability**:' "shared vocabulary should define Aggregate behavior authority"
assert_contains "$ROOT/CONTEXT.md" '**Event-triggered Command**:' "shared vocabulary should define business-required event-to-intent causality"
assert_contains "$ROOT/CONTEXT.md" '**Bounded Context Architecture**:' "shared vocabulary should define current context-owned software authority"
assert_contains "$ROOT/CONTEXT.md" '**Design Delta**:' "shared vocabulary should define the conditional Tactical Design threshold"
assert_contains "$ROOT/CONTEXT.md" '**Tactical Design Claim**:' "shared vocabulary should define Guard-facing design assertions"
assert_not_contains "$ROOT/CONTEXT.md" 'diagram source unchanged in a `model_ready` Model artifact' "shared vocabulary should not preserve superseded per-Model diagrams"
assert_contains "$claude_maintainer" 'A new Model starts at `model_revision: 1`' "artifact maintainer should define the first greenfield Model revision"

echo "  ddd-expert plugin: workflow contracts and reference architecture correct"
