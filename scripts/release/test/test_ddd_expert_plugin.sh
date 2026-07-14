#!/usr/bin/env bash
# Validate the standalone ddd-expert plugin, phase contracts, and reference architecture.
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
[ ! -e "$CLAUDE_ROOT/hooks" ] || fail "Claude ddd-expert should not ship hooks"
[ ! -e "$CODEX_ROOT/hooks" ] || fail "Codex ddd-expert should not ship hooks"
[ ! -e "$CODEX_ROOT/codex-hooks-snippet.json" ] || fail "Codex ddd-expert should not ship hook snippet"

if rg -n '\$?superpowers(:|-memory|-architect|-ddd-architect)|docs/superpowers' "$CLAUDE_ROOT" "$CODEX_ROOT" >/dev/null; then
  rg -n '\$?superpowers(:|-memory|-architect|-ddd-architect)|docs/superpowers' "$CLAUDE_ROOT" "$CODEX_ROOT" >&2
  fail "ddd-expert should not bind to superpowers plugins, skills, or paths"
fi

# The four phase skills own judgment and load the shared artifact protocol.
for skill in explore shape codify guard; do
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

expected_skill_inventory="$(printf '%s\n' codify explore guard maintain-artifacts shape | sort)"
for root in "$CLAUDE_ROOT" "$CODEX_ROOT"; do
  actual_skill_inventory="$(find "$root/skills" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)"
  [ "$actual_skill_inventory" = "$expected_skill_inventory" ] || {
    diff -u <(printf '%s\n' "$expected_skill_inventory") <(printf '%s\n' "$actual_skill_inventory") >&2 || true
    fail "ddd-expert skill inventory should contain exactly four phases and the internal artifact protocol"
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

assert_contains "$CLAUDE_ROOT/skills/explore/SKILL.md" "load this plugin's internal \`maintain-artifacts\` skill" "explore should load the artifact protocol"
assert_contains "$CLAUDE_ROOT/skills/explore/SKILL.md" 'authority `explore`' "explore should identify its artifact authority"
assert_contains "$CLAUDE_ROOT/skills/explore/SKILL.md" 'execute its `inspect` or `apply-model` operation' "explore should authorize Model transactions"
assert_contains "$CLAUDE_ROOT/skills/explore/SKILL.md" 'never writes DDD artifacts directly' "explore should not bypass the artifact executor"
assert_contains "$CLAUDE_ROOT/skills/explore/SKILL.md" 'ask exactly one focused question and end the turn' "explore should ask one focused question at a time"
explore_skill="$CLAUDE_ROOT/skills/explore/SKILL.md"
# These source sentinels protect scenario-led discovery and its single write gate.
assert_contains "$explore_skill" 'user stories or equivalent business scenarios' "explore should accept user stories or equivalent scenarios as evidence"
assert_contains "$explore_skill" 'shallow-scan every material source item' "explore should scan the complete source scope before descending"
assert_contains "$explore_skill" 'A **source item** is the coverage unit' "explore should define a format-neutral coverage unit"
assert_contains "$explore_skill" 'Never require or invent a Story ID' "explore should not require source Story IDs"
assert_contains "$explore_skill" 'temporary source-coverage ledger' "explore should keep long-run coverage explicit"
assert_contains "$explore_skill" 'it is not a DDD artifact' "explore should not persist Story Coverage as domain authority"
assert_contains "$explore_skill" 'reconstruct a candidate current Bounded Context map' "explore should reconstruct an existing-system baseline"
assert_contains "$explore_skill" 'Make the confirmation question self-contained' "explore should expose reconstructed baseline evidence before confirmation"
assert_contains "$explore_skill" 'The recorded question itself must include that recommendation and zero-write consequence' "explore should make incomplete legacy migration questions self-contained"
assert_contains "$explore_skill" 'Code is evidence of the current system, never business authority by itself' "explore should not promote code into business authority"
assert_contains "$explore_skill" 'A **Scenario Thread** is the traversal unit' "explore should use end-to-end scenario traversal"
assert_contains "$explore_skill" 'normal, failure, duplicate, cancellation, recovery, and concurrency paths' "explore should replay materially distinct alternate paths"
assert_contains "$explore_skill" 'closest credible merge or split alternative' "explore should challenge changed boundaries"
assert_contains "$explore_skill" 'Multiple contexts using one execution capability do not create a Shared Kernel' "explore should model shared execution capability as fan-out when warranted"
assert_contains "$explore_skill" 'Runtime request/response does not create a reverse model dependency' "explore should distinguish calls from model dependency direction"
assert_contains "$explore_skill" 'one integrated model proposal' "explore should expose the complete model before writing"
assert_contains "$explore_skill" 'only artifact write-authorization gate' "explore should have one integrated artifact write gate"
assert_contains "$explore_skill" 'Baseline confirmation establishes the working premise and never authorizes an intermediate artifact write' "explore should distinguish baseline confirmation from write authorization"
assert_contains "$explore_skill" 'Intermediate topology, context, relationship, or "checkpoint" writes are forbidden' "explore should forbid partial model checkpoints"
assert_contains "$explore_skill" '`invalid_layout` remains inspection evidence rather than migration authority' "explore should not treat an invalid legacy map as write authorization"
assert_contains "$explore_skill" 'declare `context_map_migration: true` only after explicit acceptance of the final integrated target' "explore should authorize legacy map migration only through final acceptance"
assert_contains "$explore_skill" 'inspect the complete DDD artifact root' "explore should inspect the complete artifact root before legacy migration"
assert_contains "$explore_skill" 'every Model in that root that still uses the retired `## Context Relationships` heading' "explore should objectively discover every coordinated legacy Model"
assert_contains "$explore_skill" 'root README when it still says `Context relationships are authoritative`' "explore should coordinate retired root README wording"
assert_contains "$explore_skill" '**Apply once after acceptance**' "explore should apply the accepted model once"
assert_contains "$explore_skill" 'Each changed Model revision advances at most once' "explore should advance each revision once per integrated proposal"
assert_not_contains "$explore_skill" '`checkpointed`:' "explore should not expose the retired partial completion"
assert_contains "$explore_skill" 'Only a `shape_ready` result routes affected contexts to `shape`' "only final shape-ready completion should route to Shape"
assert_contains "$CLAUDE_ROOT/skills/explore/SKILL.md" 'Explore is `shape_ready`' "explore should define shape-ready completion"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" "load this plugin's internal \`maintain-artifacts\` skill" "shape should load the artifact protocol"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'authority `shape`' "shape should identify its artifact authority"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'run `apply-design` through `maintain-artifacts`' "shape should authorize Design transactions"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'never writes DDD artifacts directly' "shape should not bypass the artifact executor"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'ask exactly one focused design question and end the turn' "shape should ask one focused question at a time"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" '**Replay with Software Design EventStorming**' "shape should replay accepted scenarios tactically"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'Keep the board, sticky-note inventory, and hot-spot working notes temporary' "shape should not persist its analysis board"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'expose every material tactical conclusion and its evidence before artifact writing' "shape should expose decisions before writing"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'Do not collapse multiple unaccepted tactical choices into a first-turn integrated proposal' "shape should keep the first tactical question focused"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'Spell out the accepted invariant propositions and the relevant concurrent or failure path' "shape should expose concrete invariant evidence"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'include every accepted Model invariant whose owner or consistency boundary that decision would settle' "shape should not silently omit an invariant assigned by the active boundary decision"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'A request to generate the whole Design does not accept those choices' "shape should not treat a write request as design consensus"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'Do not create an Entity, Domain Service, Process Manager, collaboration, technical-constraint, or verification section solely to say that none exists' "shape should omit empty optional sections"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'accepted construction or validity rule' "shape should define Value Object validity without inventing facts"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'A database or language House Style never authorizes a Domain identifier format' "shape should not promote implementation defaults into Domain identifier rules"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'present one integrated proposal, and wait for explicit user acceptance' "shape should keep its integrated write gate"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'A high-level direction is not integrated acceptance' "shape should not mistake direction for complete design acceptance"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'Calling a proposal "complete" does not fill an omitted Aggregate, lifecycle, coordination, contract, or design-significant correctness choice' "shape should verify accepted proposal coverage instead of trusting its label"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'may contain no tactical decision first introduced during writing' "shape documents should not introduce unseen decisions"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'trial implementation trace, not a story inventory' "shape Model Realization should not become Story Coverage"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'closest credible split or merge alternative' "shape should challenge aggregate boundaries"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'rather than creating a Runtime Event category' "shape should not invent a Runtime Event taxonomy"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'Shape may proceed only from a structurally valid acyclic Context Map' "shape should fail closed on cyclic Context Maps"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'returns to `explore` and forbids `apply-design`' "shape should route invalid Explore-owned layouts without writing"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'The Tactical Design is the Implementation handoff' "shape design should be the implementation handoff"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'It is `codify_ready`' "shape should define codify-ready completion"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'semantic owner' "shape should name the semantic owner of scheduled and recovery work"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'execution owner' "shape should separate execution ownership from business semantics"
assert_contains "$CLAUDE_ROOT/templates/model.md" '# <Bounded Context> Domain Model' "model template should identify its bounded context"
assert_contains "$CLAUDE_ROOT/templates/model.md" 'model_revision: 1' "model template should start revision tracking"
assert_contains "$CLAUDE_ROOT/templates/model.md" '## Failure and Recovery Semantics' "model template should preserve failure semantics"
assert_contains "$CLAUDE_ROOT/templates/design.md" '# <Bounded Context> Tactical Design' "design template should identify its bounded context"
assert_contains "$CLAUDE_ROOT/templates/design.md" 'based_on_model_revision: 1' "design template should bind to a model revision"
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
assert_contains "$CLAUDE_ROOT/templates/artifact-layout.md" 'design.md` is intentionally absent' "artifact layout should allow the pre-Shape intermediate state"
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
assert_contains "$CLAUDE_ROOT/templates/context-map.md" '#### Upstream Dependencies' "Context Map template should expose downstream acceptance"
assert_contains "$CLAUDE_ROOT/templates/context-map.md" '#### Downstream Contracts' "Context Map template should expose upstream publication"
assert_not_contains "$CLAUDE_ROOT/templates/context-map.md" '## Relationships' "Context Map template should not keep a detached relationship inventory"
assert_contains "$CLAUDE_ROOT/templates/README.md" '[<Bounded Context>](context/<context-slug>/model.md)' "artifact README should use real context links"
assert_contains "$CLAUDE_ROOT/templates/README.md" '[context-map.md](context-map.md)' "artifact README should link the Context Map"
assert_contains "$CLAUDE_ROOT/templates/README.md" '`design.md` lives beside' "artifact README should locate each Tactical Design"
assert_contains "$CLAUDE_ROOT/templates/README.md" 'may be absent until Shape' "artifact README should explain the pre-Shape Design state"
assert_not_contains "$CLAUDE_ROOT/templates/README.md" '## Structure' "artifact README should not duplicate the canonical structure"
assert_not_contains "$CLAUDE_ROOT/templates/README.md" '|--' "artifact README should not maintain a dynamic directory tree"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" "load this plugin's internal \`maintain-artifacts\` skill" "codify should load the artifact protocol"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'execute only its `inspect` operation' "codify should request read-only artifact inspection"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'never request or perform an apply operation' "codify should never authorize artifact writes"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" '`stale_design`' "codify should reject stale designs"
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
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'A `stale_design` or `pending_design_reconciliation` result' "guard should report stale designs"
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
assert_contains "$claude_maintainer" '`apply-model` | Explore' "artifact maintainer should authorize Model writes only from Explore"
assert_contains "$claude_maintainer" '`apply-design` | Shape' "artifact maintainer should authorize Design writes only from Shape"
assert_contains "$claude_maintainer" 'An `inspect` operation needs no expected revision' "artifact inspection should discover revisions"
assert_contains "$claude_maintainer" 'consistency set' "artifact apply operations should declare their read-only consistency set"
assert_contains "$claude_maintainer" 'read dependencies' "artifact consistency sets should cover accepted inputs outside the write set"
assert_contains "$claude_maintainer" 'write set is a subset of the consistency set' "artifact writes should be covered by the consistency set"
assert_contains "$claude_maintainer" 'require every expected path pre-state in the consistency set to match' "artifact apply should reject stale semantic inputs"
assert_contains "$claude_maintainer" 'A stale or missing Design is a valid pre-state for `apply-design`' "artifact maintainer should repair stale Designs"
assert_contains "$claude_maintainer" 'Preserve accepted wording and distinctions' "artifact maintainer should not make semantic edits"
assert_contains "$claude_maintainer" 'Reject absolute slugs, path separators, `.` or `..` segments' "artifact maintainer should reject unsafe context paths"
assert_contains "$claude_maintainer" 'returns `changed` with a `pending_design_reconciliation` observation' "artifact maintainer should support two-phase context topology changes"
assert_contains "$claude_maintainer" 'increment each changed Model at most once for the accepted integrated model transaction' "artifact maintainer should advance Model revisions once per integrated proposal"
assert_contains "$claude_maintainer" 'set each retained Design' "artifact maintainer should bind Designs to Models"
assert_contains "$claude_maintainer" 'This is a shared in-process workflow, not a separate agent' "artifact maintainer should not imply sub-agent delegation"
assert_contains "$claude_maintainer" "Do not replace that phase's completion response" "artifact maintainer should resume its phase"
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
assert_contains "$claude_maintainer" 'Keep the workspace working directory unchanged' "artifact maintainer should not change cwd to invoke the Context Map validator"
assert_contains "$claude_maintainer" '`node <absolute-validator-path> <absolute-context-map-path>`' "artifact maintainer should invoke the validator with absolute paths"
assert_contains "$claude_maintainer" '`context_map_migration: true`' "artifact maintainer should expose an explicit legacy Context Map migration flag"
assert_contains "$claude_maintainer" 'unscoped inspection of the complete DDD artifact root' "legacy Context Map migration should use a complete-root snapshot"
assert_contains "$claude_maintainer" 'A legacy Model or README with those markers cannot be omitted as "unrelated"' "legacy Context Map migration should fail closed on omitted legacy artifacts"
assert_contains "$claude_maintainer" 'exact observed fingerprint and bytes' "legacy Context Map migration should reject stale source bytes"
assert_contains "$claude_maintainer" 'exact observed fingerprint and bytes of each still match' "coordinated legacy migration should reject stale source bytes"
assert_contains "$claude_maintainer" 'complete accepted terminal Context Map, exact terminal content for every semantically affected Model, and exact terminal README content' "legacy Context Map migration should require a complete accepted target"
assert_contains "$claude_maintainer" 'Replace the complete Context Map, every coordinated legacy Model, and any coordinated legacy README in the same atomic transaction' "legacy Context Map migration should be a whole-artifact atomic replacement"
assert_contains "$claude_maintainer" 'Every other current-state invalidity aborts the transaction' "legacy Context Map migration should not bypass unrelated invalid layouts"
assert_contains "$claude_maintainer" 'never infers a dependency direction, contract, authority, translation, or other semantic repair' "artifact maintainer should not decide legacy-map migration semantics"
assert_contains "$claude_maintainer" 'all other current-pre-state failures abort every apply operation with no write or semantic repair' "artifact maintainer should fail closed outside the controlled migration"
assert_contains "$claude_maintainer" 'self-loops, reciprocal edges, longer cycles' "artifact maintainer should enforce the Context Map DAG"
assert_contains "$claude_maintainer" 'runtime request and response may use one owned contract without creating a reverse dependency' "artifact maintainer should separate runtime interaction from dependency direction"
if rg -n '../../templates/' \
  "$CLAUDE_ROOT/skills/explore/SKILL.md" \
  "$CLAUDE_ROOT/skills/shape/SKILL.md" \
  "$CLAUDE_ROOT/skills/codify/SKILL.md" \
  "$CLAUDE_ROOT/skills/guard/SKILL.md" \
  "$CODEX_ROOT/skills/explore/SKILL.md" \
  "$CODEX_ROOT/skills/shape/SKILL.md" \
  "$CODEX_ROOT/skills/codify/SKILL.md" \
  "$CODEX_ROOT/skills/guard/SKILL.md" >/dev/null; then
  fail "phase skills should load template mechanics through maintain-artifacts"
fi
if rg -n '(\$|/)ddd-expert:' "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" >/dev/null; then
  rg -n '(\$|/)ddd-expert:' "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" >&2
  fail "shared SKILL contracts should not contain platform-specific invocation syntax"
fi
assert_contains "$CLAUDE_ROOT/README.md" '/ddd-expert:explore' "Claude README should use slash skill invocation"
assert_contains "$CODEX_ROOT/README.md" '$ddd-expert:explore' "Codex README should use dollar skill invocation"
assert_contains "$CLAUDE_ROOT/README.md" 'clear independent Guard in the same task' "Claude README should expose the Codify completion gate"
assert_contains "$CODEX_ROOT/README.md" 'clear independent Guard in the same task' "Codex README should expose the Codify completion gate"
if rg -n -F '$ddd-expert:maintain-artifacts' "$CODEX_ROOT/README.md" >/dev/null; then
  fail "Codex README should not expose the internal artifact protocol as a user command"
fi
if rg -n -F 'docs/ddd-expert/context/' "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" >/dev/null; then
  rg -n -F 'docs/ddd-expert/context/' "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" >&2
  fail "phase skills should resolve artifact paths through the central layout contract"
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
  fail "phase skills should enter Go House Style through its router rather than link implementation leaves directly"
fi
if rg -n 'ddd-(golang|python|typescript)\.md' \
  "$CLAUDE_ROOT/skills/explore/SKILL.md" "$CODEX_ROOT/skills/explore/SKILL.md" >/dev/null; then
  fail "explore should not load language House Style"
fi
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'For Go, start with' "shape should enter Go guidance through its router"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'For Python or TypeScript, load only the relevant section' "shape should load compact language guides selectively"
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

if rg -ni 'return(s|ed)? to `?(explore|shape|codify|guard)`?|return-to-(explore|shape|codify|guard)' "${optimized_refs[@]}" >/dev/null; then
  rg -ni 'return(s|ed)? to `?(explore|shape|codify|guard)`?|return-to-(explore|shape|codify|guard)' "${optimized_refs[@]}" >&2
  fail "references should expose missing authority while phase skills own routing"
fi

if rg -n '\.\./skills/|skills/[[:alnum:]-]+/SKILL\.md' "${optimized_refs[@]}" >/dev/null; then
  fail "references should not link directly to phase skill files"
fi

if rg -ni '^#{1,4}[[:space:]]+.*(Planning Workflow|Architecture Gate|Level [123]|Boundary Checklist|Mechanized Review Checks|DDD Tactical Design Reference|Key Principles Summary)' \
  "$CLAUDE_ROOT/references/ddd-python.md" "$CLAUDE_ROOT/references/ddd-typescript.md" >/dev/null; then
  rg -ni '^#{1,4}[[:space:]]+.*(Planning Workflow|Architecture Gate|Level [123]|Boundary Checklist|Mechanized Review Checks|DDD Tactical Design Reference|Key Principles Summary)' \
    "$CLAUDE_ROOT/references/ddd-python.md" "$CLAUDE_ROOT/references/ddd-typescript.md" >&2
  fail "language references should not retain planning workflows or review-checklist sediment"
fi

if rg -ni 'active (DDD )?phase|phase skill|phase route|plan/spec must|apply the gates' \
  "$CLAUDE_ROOT/references/ddd-python.md" "$CLAUDE_ROOT/references/ddd-typescript.md" >/dev/null; then
  rg -ni 'active (DDD )?phase|phase skill|phase route|plan/spec must|apply the gates' \
    "$CLAUDE_ROOT/references/ddd-python.md" "$CLAUDE_ROOT/references/ddd-typescript.md" >&2
  fail "language references should not duplicate phase workflow contracts"
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

echo "  ddd-expert plugin: phase contracts and reference architecture correct"
