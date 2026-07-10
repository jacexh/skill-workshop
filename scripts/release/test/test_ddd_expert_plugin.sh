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
      case "$file:$target" in
        */references/ddd-python.md:ddd-agent-contract.md|*/references/ddd-typescript.md:ddd-agent-contract.md) continue ;;
      esac
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

# The four skills own workflow and load references progressively.
for skill in explore shape codify guard; do
  claude_skill="$CLAUDE_ROOT/skills/$skill/SKILL.md"
  codex_skill="$CODEX_ROOT/skills/$skill/SKILL.md"
  [ -f "$claude_skill" ] || fail "Claude ddd-expert missing $skill skill"
  [ -f "$codex_skill" ] || fail "Codex ddd-expert missing $skill skill"
  cmp -s "$claude_skill" "$codex_skill" || fail "Claude and Codex $skill skills should match"
  rg -q '^description: Use when ' "$claude_skill" || fail "$skill description should start with Use when"
  assert_references_last "$claude_skill" "$skill"
done

for retired_skill in domain-modeling design implement review; do
  [ ! -e "$CLAUDE_ROOT/skills/$retired_skill" ] || fail "Claude should not keep retired $retired_skill alias"
  [ ! -e "$CODEX_ROOT/skills/$retired_skill" ] || fail "Codex should not keep retired $retired_skill alias"
done

assert_contains "$CLAUDE_ROOT/skills/explore/SKILL.md" 'docs/ddd/model.md' "explore should own the DDD model artifact"
assert_contains "$CLAUDE_ROOT/skills/explore/SKILL.md" 'ask exactly one focused question, and end the turn' "explore should ask one focused question at a time"
assert_contains "$CLAUDE_ROOT/skills/explore/SKILL.md" 'present one integrated proposed model delta and wait for explicit user acceptance' "explore should keep its write gate"
assert_contains "$CLAUDE_ROOT/skills/explore/SKILL.md" 'Explore is `shape_ready`' "explore should define shape-ready completion"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'docs/ddd/design.md' "shape should own the Tactical Design artifact"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'Ask exactly one focused design question and end the turn' "shape should ask one focused question at a time"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'present one integrated proposed design delta and wait for explicit user acceptance' "shape should keep its write gate"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'The Tactical Design is the Implementation handoff' "shape design should be the implementation handoff"
assert_contains "$CLAUDE_ROOT/skills/shape/SKILL.md" 'It is `codify_ready`' "shape should define codify-ready completion"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Use this order when inputs disagree' "codify should define authority order"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" '**Preflight before edits**' "codify should preflight before modifying code"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'Design Realization and House-Style Conformance' "codify should verify design and house-style conformance"
assert_contains "$CLAUDE_ROOT/skills/codify/SKILL.md" 'finish `changed` with route `guard`' "codify should close Guard remediation"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'Breadth produces falsifiable hypotheses; depth clears or proves them' "guard should retain breadth/depth discipline"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" '`clear`, `violation`, or `evidence_gap`' "guard should use terminal verdicts"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'does not redesign or modify project files' "guard should remain read-only"
assert_contains "$CLAUDE_ROOT/skills/guard/SKILL.md" 'route `codify`' "guard should route implementation violations to codify"

# Canonical reference inventory. Python and TypeScript are retained unchanged but
# deliberately excluded from this revision's content and link migration.
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

if rg -n 'ddd-agent-contract\.md|ddd-modeling-gates\.md|mysql\.md' "$CLAUDE_ROOT/skills" "$CODEX_ROOT/skills" >/dev/null; then
  fail "phase skills should not load retired reference files"
fi

# Lock the explicitly out-of-scope language leaves to their pre-refactor bodies.
[ "$(git hash-object "$CLAUDE_ROOT/references/ddd-python.md")" = "a7f0081a0282a895dca6b41646707630e4b75ae1" ] || fail "Python reference changed during the Go/generic reference refactor"
[ "$(git hash-object "$CLAUDE_ROOT/references/ddd-typescript.md")" = "3946207ff7353c28e8f13735d5460584ecb65b6e" ] || fail "TypeScript reference changed during the Go/generic reference refactor"

check_local_markdown_links "$CLAUDE_ROOT" "Claude"
check_local_markdown_links "$CODEX_ROOT" "Codex"

optimized_refs=(
  "$CLAUDE_ROOT/references/ddd-modeling.md"
  "$CLAUDE_ROOT/references/ddd-core.md"
  "$CLAUDE_ROOT/references/ddd-collaboration.md"
  "$CLAUDE_ROOT/references/ddd-golang"*.md
  "$CLAUDE_ROOT/references/database.md"
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

# One Go router reaches every layer, flow, and platform guide.
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

# High-value Go boundaries, intentionally sparse and independent of section numbers.
scaffold="$CLAUDE_ROOT/references/ddd-golang-scaffold.md"
assert_contains "$scaffold" 'internal/business/' "Go scaffold should support multiple bounded contexts"
assert_contains "$scaffold" 'application.go' "Go scaffold should require application.go"
assert_contains "$scaffold" 'assembler.go' "Go scaffold should require assembler.go"
assert_contains "$scaffold" 'messagesubscriber/' "Go scaffold should separate message subscribers"
assert_contains "$scaffold" 'taskprocessor/' "Go scaffold should separate task processors"
assert_contains "$scaffold" 'convert.go' "Go scaffold should use convert.go for persistence mapping"
assert_contains "$scaffold" 'gen/' "Go scaffold should place generated stubs under gen"

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

events="$CLAUDE_ROOT/references/ddd-golang-events-messages.md"
assert_contains "$events" 'Published Fact Contract' "Go messaging should define producer-owned facts"
assert_contains "$events" 'Asynchronous Intent Contract' "Go messaging should define receiver-owned intents"
assert_contains "$events" 'Use outbox only after the design accepts' "Go messaging should keep outbox conditional"
assert_contains "$events" 'does not supply an xorm Store' "Go messaging should not invent missing outbox adapters"

taskqueue="$CLAUDE_ROOT/references/ddd-golang-taskqueue.md"
assert_contains "$taskqueue" 'application/task' "Go taskqueue should own task contracts in Application"
assert_contains "$taskqueue" 'transport/taskprocessor' "Go taskqueue should own processors in Transport"
assert_contains "$taskqueue" 'internal/pkg/taskqueue' "Go taskqueue should keep Asynq runtime technical"

infrastructure="$CLAUDE_ROOT/references/ddd-golang-infrastructure.md"
assert_contains "$infrastructure" 'infrastructure/convert.go' "Go Infrastructure should own DO/Domain conversion"
assert_contains "$infrastructure" 'xorm.io/xorm' "Go Infrastructure should use the adopted ORM"
assert_contains "$infrastructure" 'Do not log and return the same error' "Go Infrastructure should avoid duplicate error logs"

runtime="$CLAUDE_ROOT/references/ddd-golang-runtime.md"
assert_contains "$runtime" 'Execution Completion Log' "Go Runtime should define completion-log ownership"
assert_contains "$runtime" 'trace_id' "Go Runtime should define trace correlation fields"
assert_contains "$runtime" 'request_id' "Go Runtime should define request correlation fields"

database="$CLAUDE_ROOT/references/database.md"
assert_contains "$database" 'Every table governed by this profile' "database profile should define standard columns"
for column in '`id` varchar(36)' '`version` int unsigned' '`created_at` bigint' '`updated_at` bigint' '`deleted_at` bigint'; do
  assert_contains "$database" "$column" "database profile missing standard column $column"
done
assert_contains "$database" 'new in-memory Aggregate has `Version == 0`' "database profile should define initial versions"
assert_contains "$database" 'After a successful Save, the instance is stale' "database profile should align post-Save behavior"

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

echo "  ddd-expert plugin: phase contracts and reference architecture correct"
