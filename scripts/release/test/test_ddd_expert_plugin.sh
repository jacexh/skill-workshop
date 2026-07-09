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

skill_description() {
  local file="$1"

  awk '
    NR == 1 && $0 == "---" { in_frontmatter = 1; next }
    in_frontmatter && $0 == "---" { exit }
    in_frontmatter && /^description:[[:space:]]*/ {
      sub(/^description:[[:space:]]*/, "")
      print
      exit
    }
  ' "$file"
}

assert_description_contains() {
  local file="$1"
  local label="$2"
  local needle="$3"

  skill_description "$file" | grep -Fqi "$needle" || fail "$label description should mention $needle"
}

assert_description_avoids_ddd_jargon() {
  local file="$1"
  local label="$2"
  local desc

  desc="$(skill_description "$file")"
  printf '%s\n' "$desc" | grep -Eq '^Use when ' || fail "$label description should start with Use when"
  if printf '%s\n' "$desc" | rg -i 'Aggregate|Bounded Context|Core Domain|Domain Event|Integration Message|CQRS|Repository|Value Object' >/dev/null; then
    printf '%s\n' "$desc" >&2
    fail "$label description should be written in common development language, not DDD internal jargon"
  fi
  ! grep -q "^## Project-stage triggers$" "$file" || fail "$label should not put trigger rules in the skill body"
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

check_explore_skill() {
  local explore_skill="$1"
  local label="$2"

  assert_description_avoids_ddd_jargon "$explore_skill" "$label explore"
  assert_description_contains "$explore_skill" "$label explore" "product discovery"
  assert_description_contains "$explore_skill" "$label explore" "PRD/spec writing"
  assert_description_contains "$explore_skill" "$label explore" "feature scoping"
  assert_description_contains "$explore_skill" "$label explore" "backlog refinement"
  assert_description_contains "$explore_skill" "$label explore" "story mapping"
  assert_description_contains "$explore_skill" "$label explore" "change-request intake"
  assert_description_contains "$explore_skill" "$label explore" "before architecture planning"
  assert_description_contains "$explore_skill" "$label explore" "ticket breakdown"
  assert_description_contains "$explore_skill" "$label explore" "user workflows"
  assert_description_contains "$explore_skill" "$label explore" "business rules"
  grep -qi "strategic domain-modeling workflow" "$explore_skill" || fail "$label explore should be framed as strategic domain modeling"
  grep -q "updating the project's existing documentation surfaces" "$explore_skill" || fail "$label explore should update existing project docs"
  grep -q "not by producing a standalone modeling report" "$explore_skill" || fail "$label explore should not emit a standalone report"
  grep -q "Core Domain" "$explore_skill" || fail "$label explore should focus the core domain"
  grep -q "Context Map" "$explore_skill" || fail "$label explore should cover context maps"
  grep -q "ddd-modeling-gates.md" "$explore_skill" || fail "$label explore should load modeling gates"
  grep -q "target PRD/spec/change request" "$explore_skill" || fail "$label explore should read PRD/spec/change-request evidence first"
  grep -q "glossary or terminology docs" "$explore_skill" || fail "$label explore should read glossary/terminology docs"
  grep -q "only confirmed model changes" "$explore_skill" || fail "$label explore should output only confirmed model changes"
  grep -q "Domain concepts are business-language concepts, not tactical classifications" "$explore_skill" || fail "$label explore should keep concepts at business-language level"
  grep -q "one-question-at-a-time" "$explore_skill" || fail "$label explore should advertise one-question interview"
  grep -q "Ask exactly one high-fidelity question at a time" "$explore_skill" || fail "$label explore should force one high-fidelity question"
  grep -q "do not write partial output or a gap list" "$explore_skill" || fail "$label explore should ask instead of emitting gap lists"
  grep -q "Avoid low-fidelity questions" "$explore_skill" || fail "$label explore should reject low-fidelity questions"
  grep -q "event-storming timeline" "$explore_skill" || fail "$label explore should reconstruct an event-storming timeline"
  grep -q "past-tense business facts" "$explore_skill" || fail "$label explore should start from past-tense business facts"
  grep -q "write confirmed domain model changes to the project docs" "$explore_skill" || fail "$label explore should write confirmed model changes to docs"
  grep -q "update the existing glossary" "$explore_skill" || fail "$label explore should update glossary carriers"
  grep -q "update the existing context map" "$explore_skill" || fail "$label explore should update boundary/context carriers"
  grep -q "update the relevant PRD/spec section" "$explore_skill" || fail "$label explore should update relevant PRD/spec sections"
  grep -q 'append a concise `Domain Model` section to the current PRD/spec' "$explore_skill" || fail "$label explore should append to PRD/spec when no carrier exists"
  grep -q "Mermaid or text diagram only when it clarifies a flow, lifecycle, boundary, or rule" "$explore_skill" || fail "$label explore should allow only useful business diagrams"
  grep -q "Do not add class diagrams, ERDs, component diagrams, deployment diagrams, API call graphs, schemas, or DTO shapes" "$explore_skill" || fail "$label explore should ban technical diagrams"
  grep -q "Do not duplicate content" "$explore_skill" || fail "$label explore should avoid duplicating clear PRD/spec content"
  grep -q "Do not produce a complete model inventory" "$explore_skill" || fail "$label explore should avoid complete inventory output"
  grep -q "ask about it instead of writing it as a candidate" "$explore_skill" || fail "$label explore should ask about unconfirmed concepts instead of emitting candidates"
  grep -q "Final response: list the files updated" "$explore_skill" || fail "$label explore final response should summarize files updated"
  grep -q "No domain model changes needed" "$explore_skill" || fail "$label explore should support no-change completion"
  ! grep -q "When shared understanding is reached, write a PRD-shaped" "$explore_skill" || fail "$label explore should not emit the old PRD-shaped brief"
  ! grep -q "knowledge candidates" "$explore_skill" || fail "$label explore should not emit memory candidates"
}

check_explore_skill "$CLAUDE_ROOT/skills/explore/SKILL.md" "Claude"
check_explore_skill "$CODEX_ROOT/skills/explore/SKILL.md" "Codex"

check_shape_skill() {
  local shape_skill="$1"
  local label="$2"

  assert_description_avoids_ddd_jargon "$shape_skill" "$label shape"
  assert_description_contains "$shape_skill" "$label shape" "backend architecture planning"
  assert_description_contains "$shape_skill" "$label shape" "technical design"
  assert_description_contains "$shape_skill" "$label shape" "solution design"
  assert_description_contains "$shape_skill" "$label shape" "ticket breakdown"
  assert_description_contains "$shape_skill" "$label shape" "implementation planning"
  assert_description_contains "$shape_skill" "$label shape" "design review"
  assert_description_contains "$shape_skill" "$label shape" "accepted requirements"
  assert_description_contains "$shape_skill" "$label shape" "before coding"
  assert_description_contains "$shape_skill" "$label shape" "boundaries"
  assert_description_contains "$shape_skill" "$label shape" "data ownership"
  assert_description_contains "$shape_skill" "$label shape" "transaction shape"
  assert_description_contains "$shape_skill" "$label shape" "test seams"
  grep -q "smallest useful DDD/backend design" "$shape_skill" || fail "$label shape should produce the smallest useful backend design"
  grep -q "confirmed domain model content from project docs" "$shape_skill" || fail "$label shape should consume confirmed model content from project docs"
  grep -q "^1\\. Read inputs:" "$shape_skill" || fail "$label shape workflow should use numbered list steps"
  grep -q "target PRD/spec" "$shape_skill" || fail "$label shape should read the target PRD/spec"
  grep -q "confirmed domain model sections" "$shape_skill" || fail "$label shape should read confirmed domain model sections"
  grep -q "ddd-modeling-gates.md" "$shape_skill" || fail "$label shape should load modeling gates"
  grep -q "Read deeper references only for touched surfaces" "$shape_skill" || fail "$label shape should load deeper references only for touched surfaces"
  grep -q "^2\\. Reference routing:" "$shape_skill" || fail "$label shape workflow should list reference routing as a step"
  grep -q "Reference routing: load only the narrow reference for the touched design surface" "$shape_skill" || fail "$label shape should route references by touched design surface"
  grep -q "language/framework placement" "$shape_skill" || fail "$label shape should load language guides for language/framework placement"
  grep -q "ddd-golang.md" "$shape_skill" || fail "$label shape should route Go design through the Go reference router"
  grep -q "ddd-python.md" "$shape_skill" || fail "$label shape should route Python design through the Python reference"
  grep -q "ddd-typescript.md" "$shape_skill" || fail "$label shape should route TypeScript design through the TypeScript reference"
  grep -q "follow its router for domain, application, infrastructure, CQRS, events/messages, taskqueue, runtime, scaffold, or generated-code surfaces" "$shape_skill" || fail "$label shape should follow the Go router for narrow references"
  grep -q "database.md" "$shape_skill" || fail "$label shape should load database reference for database decisions"
  grep -q "schema, migration, index, or SQL decisions" "$shape_skill" || fail "$label shape should route database decisions narrowly"
  grep -q "ddd-agent-contract.md" "$shape_skill" || fail "$label shape should load agent contract for execution handoff constraints"
  grep -q "execution handoff, stop conditions, self-checks, or reporting constraints" "$shape_skill" || fail "$label shape should route agent-contract decisions narrowly"
  grep -q "^3\\. Check phase fit:" "$shape_skill" || fail "$label shape workflow should list phase fit as a step"
  grep -q "before naming Aggregates" "$shape_skill" || fail "$label shape should gate tactical objects before naming aggregates"
  grep -q "Normal-shape concepts" "$shape_skill" || fail "$label shape should state normal-shape concepts before deviations"
  grep -q "^4\\. Shape decisions:" "$shape_skill" || fail "$label shape workflow should list shaping as a step"
  grep -q "accepted model facts first" "$shape_skill" || fail "$label shape should start from accepted model facts"
  grep -q "^5\\. Gate-review output:" "$shape_skill" || fail "$label shape workflow should list gate review as a step"
  grep -q "before writing Tactical Design, review the shaped result against" "$shape_skill" || fail "$label shape should review its own output before documentation"
  grep -q "internal gate checklist" "$shape_skill" || fail "$label shape should use modeling gates as an internal checklist"
  grep -q "story before nouns, event timeline before objects, authority before ownership, lifecycle before type" "$shape_skill" || fail "$label shape gate review should cover early modeling gates"
  grep -q "invariant before aggregate, failure tolerance before transaction, language before integration, and coordination before abstraction" "$shape_skill" || fail "$label shape gate review should cover tactical modeling gates"
  grep -q "If a material gate fails, do not publish the design" "$shape_skill" || fail "$label shape should block output when gate review fails"
  grep -q "Do not print the gate checklist in project docs or the final response" "$shape_skill" || fail "$label shape should keep gate checklist internal"
  grep -q "ask one focused design question" "$shape_skill" || fail "$label shape should ask focused design questions for unclear tactical choices"
  grep -q "Implementation handoff" "$shape_skill" || fail "$label shape should emit an implementation handoff"
  grep -q "accepted model source" "$shape_skill" || fail "$label shape handoff should name accepted model source"
  grep -q "layer ownership" "$shape_skill" || fail "$label shape handoff should decide layer ownership"
  grep -q "collaboration model before mechanism" "$shape_skill" || fail "$label shape should decide collaboration model before mechanism"
  grep -q "Only shape decisions that are material before implementation" "$shape_skill" || fail "$label shape should output only material tactical decisions"
  grep -q "Omit categories that do not affect this change" "$shape_skill" || fail "$label shape should omit irrelevant design categories"
  grep -q "If any Implementation handoff item is material to codification and unknown" "$shape_skill" || fail "$label shape should stop instead of leaving codify to guess"
  grep -q "Aggregate Boundary Conflict returns to \`explore\`" "$shape_skill" || fail "$label shape should route aggregate boundary conflicts to explore"
  grep -q "Return to explore for missing model facts" "$shape_skill" || fail "$label shape should route missing model facts to explore"
  grep -q "Return to shape for placement or mechanism decisions" "$shape_skill" || fail "$label shape should keep placement/mechanism decisions in shape"
  grep -q "Implementation transaction shape is not model evidence" "$shape_skill" || fail "$label shape should reject implementation transaction evidence"
  grep -q "Write the accepted tactical design back to the project docs" "$shape_skill" || fail "$label shape should write design decisions back to project docs"
  grep -q "Prefer an existing design doc, architecture/domain doc, ADR, or PRD/spec design section" "$shape_skill" || fail "$label shape should prefer existing design carriers"
  grep -q 'append a concise `Tactical Design` section to the current PRD/spec' "$shape_skill" || fail "$label shape should append Tactical Design when no carrier exists"
  grep -q 'Write only the decisions `codify` must obey' "$shape_skill" || fail "$label shape should write only codify-relevant decisions"
  grep -q "responsibility being shaped" "$shape_skill" || fail "$label shape output should name the shaped responsibility"
  grep -q "Model Decisions, Boundary / Consistency, Implementation Constraints, Verification Seams" "$shape_skill" || fail "$label shape should use compact tactical design sections"
  grep -q "tactical objects and responsibilities" "$shape_skill" || fail "$label shape model decisions should state tactical objects and responsibilities"
  grep -q "aggregate, policy, service, read-model, command, query, event, or message choices" "$shape_skill" || fail "$label shape model decisions should state required tactical choices"
  grep -q "aggregate boundary, invariant owner, data authority" "$shape_skill" || fail "$label shape boundary output should state boundary and authority"
  grep -q "transaction boundary, idempotency, failure handling" "$shape_skill" || fail "$label shape consistency output should state transaction and failure rules"
  grep -q "layer ownership, ports, repositories, adapters" "$shape_skill" || fail "$label shape constraints should state layer and adapter ownership"
  grep -q "generated/protocol boundaries, runtime/task/message containment" "$shape_skill" || fail "$label shape constraints should state generated and runtime containment"
  grep -q "forbidden shortcuts" "$shape_skill" || fail "$label shape constraints should forbid shortcuts"
  grep -q "smallest domain, application, contract, or integration checks" "$shape_skill" || fail "$label shape verification seams should name minimal checks"
  grep -q "The Tactical Design section is the Implementation handoff" "$shape_skill" || fail "$label shape should make project docs the implementation handoff"
  grep -q "do not create a separate agent-to-agent report" "$shape_skill" || fail "$label shape should avoid agent-to-agent reports"
  grep -q "Mermaid or text diagram only when it clarifies aggregate boundaries, lifecycle, collaboration, or consistency" "$shape_skill" || fail "$label shape should allow only useful tactical diagrams"
  grep -q "Do not add ERDs, component diagrams, deployment diagrams, API call graphs, schemas, DTO shapes, or file-layout diagrams" "$shape_skill" || fail "$label shape should ban technical implementation diagrams"
  ! grep -q "documented transaction exception" "$shape_skill" || fail "$label shape should not list documented transaction exception as a collaboration model"
  ! grep -q "Domain Modeling Brief" "$shape_skill" || fail "$label shape should not depend on a standalone Domain Modeling Brief"
  ! grep -q "Default shape:" "$shape_skill" || fail "$label shape should not use the old fixed output template"
  ! grep -q "Open questions / Stop" "$shape_skill" || fail "$label shape should not emit open-question sections"
  ! grep -q "candidate tactics" "$shape_skill" || fail "$label shape should not emit candidate tactics"
}

check_shape_skill "$CLAUDE_ROOT/skills/shape/SKILL.md" "Claude"
check_shape_skill "$CODEX_ROOT/skills/shape/SKILL.md" "Codex"

check_codify_skill() {
  local codify_skill="$1"
  local label="$2"

  line_count=$(wc -l <"$codify_skill")
  [ "$line_count" -le 110 ] || fail "$label codify skill should stay concise"
  assert_description_avoids_ddd_jargon "$codify_skill" "$label codify"
  assert_description_contains "$codify_skill" "$label codify" "writing or changing backend code"
  assert_description_contains "$codify_skill" "$label codify" "implementing tickets"
  assert_description_contains "$codify_skill" "$label codify" "refactoring"
  assert_description_contains "$codify_skill" "$label codify" "bug fixes"
  assert_description_contains "$codify_skill" "$label codify" "API/RPC handlers"
  assert_description_contains "$codify_skill" "$label codify" "persistence"
  assert_description_contains "$codify_skill" "$label codify" "migrations"
  assert_description_contains "$codify_skill" "$label codify" "messages/jobs"
  assert_description_contains "$codify_skill" "$label codify" "runtime wiring"
  assert_description_contains "$codify_skill" "$label codify" "logging"
  assert_description_contains "$codify_skill" "$label codify" "tests"
  assert_description_contains "$codify_skill" "$label codify" "code placement"
  grep -q "Tactical Design / Implementation handoff" "$codify_skill" || fail "$label codify should consume Tactical Design handoff"
  grep -q "active reference implementation shape" "$codify_skill" || fail "$label codify should target reference-conforming code shape"
  grep -q "repository scaffold, package boundaries, adopted libraries, abstract interfaces, adapters" "$codify_skill" || fail "$label codify should codify scaffold, libraries, interfaces, and adapters"
  grep -q "Codification maps decisions" "$codify_skill" || fail "$label codify should be framed as codification"
  grep -q "Implementation handoff" "$codify_skill" || fail "$label codify should consume shape handoff"
  grep -q "Handoff check" "$codify_skill" || fail "$label codify should verify handoff before code"
  grep -q "modeling evidence" "$codify_skill" || fail "$label codify should verify modeling evidence"
  grep -q "Accepted model source" "$codify_skill" || fail "$label codify should name accepted model source"
  grep -q "Object Shape Router" "$codify_skill" || fail "$label codify should route confirmed objects through the active reference"
  grep -q "Layer Reference Map" "$codify_skill" || fail "$label codify should use layer reference routing"
  grep -q "File Quick Index" "$codify_skill" || fail "$label codify should use file scaffold guidance"
  grep -q "package boundary rules" "$codify_skill" || fail "$label codify should enforce package boundaries"
  grep -q "adopted library defaults" "$codify_skill" || fail "$label codify should enforce adopted library defaults"
  grep -q "Language:" "$codify_skill" || fail "$label codify should route references by language"
  grep -q "ddd-golang.md" "$codify_skill" || fail "$label codify should route Go work to Go reference"
  grep -q "ddd-python.md" "$codify_skill" || fail "$label codify should route Python work to Python reference"
  grep -q "ddd-typescript.md" "$codify_skill" || fail "$label codify should route TypeScript work to TypeScript reference"
  grep -q "Use:" "$codify_skill" || fail "$label codify should route references by implementation use"
  grep -q "scaffold/layout" "$codify_skill" || fail "$label codify should route scaffold/layout work"
  grep -q "command/query/RPC/application handlers" "$codify_skill" || fail "$label codify should route application handler work"
  grep -q "persistence, DO/converter, schema, migration, index, or SQL" "$codify_skill" || fail "$label codify should route persistence and schema work"
  grep -q "events/messages" "$codify_skill" || fail "$label codify should route events and messages work"
  grep -q "jobs/tasks/schedulers/periodic work" "$codify_skill" || fail "$label codify should route task and scheduler work"
  grep -q "runtime/config/module/lifecycle/logging" "$codify_skill" || fail "$label codify should route runtime and logging work"
  grep -q "before adding or changing ports/interfaces" "$codify_skill" || fail "$label codify should load agent contract before port/interface changes"
  grep -q "local conventions conflict with the reference shape" "$codify_skill" || fail "$label codify should stop on local-reference conflicts"
  grep -q "reference-prescribed scaffold, package path, layer owner, abstract interface" "$codify_skill" || fail "$label codify should implement reference-prescribed shape"
  grep -q "Do not invent local substitutes for adopted libraries" "$codify_skill" || fail "$label codify should not invent local library substitutes"
  grep -q "Normal-shape concepts" "$codify_skill" || fail "$label codify should use normal-shape concepts before deviations"
  grep -q "Surface preflight" "$codify_skill" || fail "$label codify should classify touched surfaces"
  grep -q "collaboration model" "$codify_skill" || fail "$label codify should require accepted collaboration model"
  grep -q "run the smallest checks that prove the accepted user stories, design decisions, touched technology rules, and reference conformance" "$codify_skill" || fail "$label codify should verify implemented reference shape"
  grep -q "return to \`explore\`" "$codify_skill" || fail "$label codify should return missing business facts upstream"
  grep -q "return to \`shape\`" "$codify_skill" || fail "$label codify should return missing placement upstream"
  grep -q "guard finding includes \`Model correction\`" "$codify_skill" || fail "$label codify should recognize guard model corrections"
  grep -q "already accepted by the user or shape handoff" "$codify_skill" || fail "$label codify should not apply model corrections without accepted shape"
  grep -q "Aggregate Boundary Conflict returns to \`explore\`" "$codify_skill" || fail "$label codify should route aggregate boundary conflicts upstream"
  grep -q "Return to explore for aggregate boundary, lifecycle, invariant, fact language, or bounded-context uncertainty" "$codify_skill" || fail "$label codify should route unresolved model facts upstream"
  grep -q "Return to shape for layer ownership, CQRS split, port placement, adapter boundary, or repository API shape after the model is accepted" "$codify_skill" || fail "$label codify should route unresolved tactical placement upstream"
  grep -q "Implementation transaction shape is not Repository design evidence" "$codify_skill" || fail "$label codify should reject persistence transaction evidence"
  ! grep -q "Domain Modeling Brief" "$codify_skill" || fail "$label codify should not depend on a standalone Domain Modeling Brief"
  ! grep -q "## Output" "$codify_skill" || fail "$label codify should not define a separate output section"
  ! grep -q "DDD implementation:" "$codify_skill" || fail "$label codify should not emit an implementation report template"
  ! grep -q "Changed files by layer" "$codify_skill" || fail "$label codify should not prescribe final response fields"
  ! grep -q "Rules Satisfied / Not Applicable" "$codify_skill" || fail "$label codify should not prescribe output status fields"
  ! grep -q "documented transaction exception" "$codify_skill" || fail "$label codify should not list documented transaction exception as a collaboration model"
}

check_codify_skill "$CLAUDE_ROOT/skills/codify/SKILL.md" "Claude"
check_codify_skill "$CODEX_ROOT/skills/codify/SKILL.md" "Codex"

check_review_evidence_gate() {
  local review_skill="$1"
  local label="$2"
  local line_count
  local output_lines

  line_count=$(wc -l < "$review_skill")
  [ "$line_count" -le 280 ] || fail "$label guard should keep merged review guidance concise"
  output_lines=$(section_line_count "$review_skill" "## Reporting" "## Calibration")
  [ "$output_lines" -le 25 ] || fail "$label review output should stay concise and avoid field-heavy templates"

  assert_description_avoids_ddd_jargon "$review_skill" "$label guard"
  assert_description_contains "$review_skill" "$label guard" "reviewing backend work"
  assert_description_contains "$review_skill" "$label guard" "code review"
  assert_description_contains "$review_skill" "$label guard" "PR review"
  assert_description_contains "$review_skill" "$label guard" "pull request review"
  assert_description_contains "$review_skill" "$label guard" "diff review"
  assert_description_contains "$review_skill" "$label guard" "design/spec review"
  assert_description_contains "$review_skill" "$label guard" "architecture review"
  assert_description_contains "$review_skill" "$label guard" "pre-merge checks"
  assert_description_contains "$review_skill" "$label guard" "release readiness"
  assert_description_contains "$review_skill" "$label guard" "regression investigation"
  assert_description_contains "$review_skill" "$label guard" "concrete plans"
  assert_description_contains "$review_skill" "$label guard" "generated artifacts"
  grep -q "guard review finds" "$review_skill" || fail "$label guard should be framed as a guard review"
  grep -q "## Scope and References" "$review_skill" || fail "$label guard should separate scope/reference routing"
  grep -q "## Expected Model Sources" "$review_skill" || fail "$label guard should reconstruct expected model from upstream outputs"
  grep -q "model evidence" "$review_skill" || fail "$label review should reconstruct model evidence"
  grep -q "project Domain Model sections in PRD/spec/change requests" "$review_skill" || fail "$label guard should read current project model docs"
  grep -q "Tactical Design, testing seams, and \\*\\*Implementation handoff\\*\\*" "$review_skill" || fail "$label guard should read tactical design and implementation handoff"
  grep -q "Implementation handoff" "$review_skill" || fail "$label review should read implementation handoff"
  grep -q "Evidence gate" "$review_skill" || fail "$label review skill should define an evidence gate"
  grep -q "First read \\[../../references/ddd-core.md\\]" "$review_skill" || fail "$label review should load core baseline directly"
  grep -q "This skill owns the workflow and layer baseline" "$review_skill" || fail "$label review should own workflow and layer baseline"
  grep -q "quick smell detector" "$review_skill" || fail "$label guard should keep the body checklist as quick smell detector"
  grep -q "Reference routing" "$review_skill" || fail "$label guard should route deeper references after smells"
  grep -q "ddd-golang.md" "$review_skill" || fail "$label guard should route Go evidence to Go reference"
  grep -q "ddd-python.md" "$review_skill" || fail "$label guard should route Python evidence to Python reference"
  grep -q "ddd-typescript.md" "$review_skill" || fail "$label guard should route TypeScript evidence to TypeScript reference"
  grep -q "database.md" "$review_skill" || fail "$label guard should route database evidence"
  grep -q "ddd-agent-contract.md" "$review_skill" || fail "$label guard should route agent-contract evidence"
  grep -q "Coverage boundary" "$review_skill" || fail "$label guard should state coverage boundary"
  grep -q "guard covers DDD/backend model, layer, boundary, persistence, generated-protocol, async/recovery, runtime-wiring, logging, and verification evidence" "$review_skill" || fail "$label guard should cover backend DDD evidence surfaces"
  grep -q "does not replace general security, performance, product UX, dependency-license, or capacity review" "$review_skill" || fail "$label guard should state non-DDD review boundaries"
  ! grep -q "Domain Modeling Brief" "$review_skill" || fail "$label guard should not depend on standalone Domain Modeling Brief"
  ! grep -q "return-to-modeling" "$review_skill" || fail "$label guard should use explore/shape return routing"
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
  grep -q "\`design/convention accepted\`, \`MVP transaction\`, or similar waiver wording is an accepted-design evidence gap, not clearance" "$review_skill" || fail "$label review should block accepted-design waiver clearance phrases"
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
  grep -q "durable-fact command admission, terminal/execution split, repository/API candidate owner, collaboration mechanism, parent state vocabulary, accepted-design waiver, CQRS inventory, and recovery reachability" "$review_skill" || fail "$label review workflow should seed required family rows"
  grep -q "\\*\\*Merge same-shape smells\\*\\*: group rows by owner, lifecycle, boundary, state vocabulary, collaboration mechanism" "$review_skill" || fail "$label review workflow should merge same-shape smell families"
  grep -q "preserving every trigger and every required family row" "$review_skill" || fail "$label review workflow should preserve required family rows during merge"
  grep -q "\\*\\*Explain each family\\*\\*: assume the smell is wrong until" "$review_skill" || fail "$label review workflow should explain each smell family with guilty-presumption shape"
  grep -q "Output: violation, return-to-explore, return-to-shape, evidence-gap, or adjacent-smell" "$review_skill" || fail "$label review workflow should output constrained verdicts"
  grep -q "\\*\\*Follow related evidence\\*\\*: for each adjacent smell, inspect the nearest sibling methods" "$review_skill" || fail "$label review workflow should follow adjacent smell evidence"
  grep -q "Output: updated Smell List with any new family rows" "$review_skill" || fail "$label review workflow should output updated smell list rows"
  grep -q "\\*\\*Synthesize root cause\\*\\*: combine family verdicts\\. Output: shared wrong model, boundary, lifecycle" "$review_skill" || fail "$label review workflow should output root synthesis"
  grep -q "\\*\\*Report\\*\\*: turn the synthesized verdicts into findings, evidence gaps / returns, non-required positive notes, verification, and residual risk\\. Output: final review judgment that places every triggered required family row under Findings or Evidence gaps / returns" "$review_skill" || fail "$label review workflow should output final review judgment"
  grep -Fxq "Smell explanation stays local by default. Use subagents only when the user explicitly asks." "$review_skill" || fail "$label review should make subagents explicit opt-in"
  ! grep -q "or a smell family is independently large" "$review_skill" || fail "$label review should not add an implicit subagent escape hatch"

  grep -q "## Quick Smell Checklist" "$review_skill" || fail "$label guard should define quick smell checklist"
  grep -q "### Layer Baseline" "$review_skill" || fail "$label review should define layer baseline"
  grep -q "which required shapes are missing, and which forbidden shapes appear" "$review_skill" || fail "$label review should derive smells from missing-required and present-forbidden shapes"
  grep -q "#### Domain Layer" "$review_skill" || fail "$label review should define domain layer shape"
  grep -q "#### Application Layer" "$review_skill" || fail "$label review should define application layer shape"
  grep -q "#### Infrastructure Layer" "$review_skill" || fail "$label review should define infrastructure layer shape"
  grep -q "#### Interface Layer" "$review_skill" || fail "$label review should define interface layer shape"
  grep -q "#### Runtime Layer" "$review_skill" || fail "$label review should define runtime layer shape"
  grep -q "### Cross-Layer Sentinels" "$review_skill" || fail "$label review should define cross-layer sentinels"
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
  grep -q "Terminal/execution event vocabulary: child execution events and parent terminal events have distinct names and timing" "$review_skill" || fail "$label review should inspect terminal event vocabulary"
  grep -q "parent terminal events are not emitted during partial child execution" "$review_skill" || fail "$label review should reject premature parent terminal events"
  grep -q "final verdict cites event names" "$review_skill" || fail "$label review terminal verdicts should cite event names"
  grep -q "state closure alone does not clear this row" "$review_skill" || fail "$label review should not clear terminal row from state closure alone"
  grep -q "adjacent recovery, terminal event vocabulary, or \"main risk elsewhere\" do not clear collaboration rows" "$review_skill" || fail "$label review should not let adjacent rows clear collaboration"
  grep -q "CQRS: write repositories serve command-side aggregate facts" "$review_skill" || fail "$label review should whitelist CQRS shape"
  grep -q "Required family rows: multi-step value transfer, fulfillment/execution, reversal/compensation, dispute/exception, settlement/closure, or similar lifecycle scope keeps durable-fact command admission" "$review_skill" || fail "$label review should require separate family rows for lifecycle scopes"
  grep -q "Repository/API inventory: inspect Domain Repository interfaces, Application repository calls, Infrastructure store methods" "$review_skill" || fail "$label review should require repository/API inventory rows"
  grep -Fq 'classify each extra `List*`, read-shaped, semantic, or coordinated-object method' "$review_skill" || fail "$label review should classify List/read-shaped repository methods"
  grep -q "Accepted-design waiver inventory: when spec/design/local convention accepts semantic repository transactions" "$review_skill" || fail "$label review should require accepted-design waiver inventory"
  grep -q "expected model sources are not waivers" "$review_skill" || fail "$label review should not treat expected design as waiver"
  grep -q "CQRS inventory: inspect write repositories and shared adapters for list/detail/history/summary/read-shaped methods before clearing CQRS shape" "$review_skill" || fail "$label review should require CQRS inventory rows"
  grep -q "Parent-state vocabulary: when a parent aggregate has state words that mirror a child/execution lifecycle" "$review_skill" || fail "$label review should require parent-state vocabulary rows"
  grep -q "final verdict names the actual state words" "$review_skill" || fail "$label review should name actual parent-state vocabulary"
  grep -q "does not omit this row because recovery or durable-fact command admission already has a finding" "$review_skill" || fail "$label review should not let adjacent findings hide state vocabulary"
  ! rg -n "TaskAgreement|payment_pending|payment_failed|payment_cancelled|payment/delivery/refund/dispute/settlement" "$review_skill" >/dev/null || fail "$label guard should not contain fixture-specific payment vocabulary"
  grep -q "## Reporting" "$review_skill" || fail "$label guard should define reporting section"
  ! grep -q "^## Output$" "$review_skill" || fail "$label guard should use Reporting section instead of Output"
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
  grep -q "Each triggered required family label gets its own final verdict line" "$review_skill" || fail "$label review should keep required family verdicts separate"
  grep -q "a broad repository/lifecycle evidence gap may summarize root cause only after candidate-owner, collaboration, accepted-design waiver, CQRS, and state-vocabulary rows are separately decided" "$review_skill" || fail "$label review should not merge required rows into one broad gap"
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
  grep -q "## Calibration" "$review_skill" || fail "$label guard should separate calibration from hot-path workflow"
  grep -q "Post-review calibration" "$review_skill" || fail "$label review should support post-review calibration against known issue sets"
  grep -q "known issue or scoring set" "$review_skill" || fail "$label review should accept known issue sets after the initial conclusion"
  grep -q "reflect why each issue was missed or shallowly found" "$review_skill" || fail "$label review should reflect on missed findings after scoring feedback"
  grep -q "collaboration model" "$review_skill" || fail "$label review should reconstruct collaboration model"
  ! grep -q "Default-first key concept check" "$review_skill" || fail "$label review should not keep default-first separate from baseline"
  grep -q "Accepted design and local convention are evidence to inspect, not waivers" "$review_skill" || fail "$label review should reject accepted design/local convention as waivers"
  grep -q "Implementation transaction shape is not model evidence and cannot satisfy Repository design" "$review_skill" || fail "$label review should reject transaction-shaped repository satisfaction"
  grep -q "No DDD findings: say that directly only when no concrete violation/return was found" "$review_skill" || fail "$label review should define no-finding output"
}

check_review_evidence_gate "$CLAUDE_ROOT/skills/guard/SKILL.md" "Claude"
check_review_evidence_gate "$CODEX_ROOT/skills/guard/SKILL.md" "Codex"

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
