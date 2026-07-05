#!/usr/bin/env bash
# Validate ddd-expert is an explicit, standalone DDD/backend plugin.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLAUDE_ROOT="$ROOT/plugins/ddd-expert"
CODEX_ROOT="$ROOT/codex-plugins/ddd-expert"

fail() {
  echo "FAIL $1" >&2
  exit 1
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

# ddd-expert is explicit-only. It must not register lifecycle hooks or ship
# fallback hook snippets that reintroduce automatic Superpowers workflow routing.
[ "$(jq -r '.hooks // empty' "$CODEX_ROOT/.codex-plugin/plugin.json")" = "" ] || fail "Codex ddd-expert manifest should not declare hooks"
[ ! -e "$CLAUDE_ROOT/hooks/hooks.json" ] || fail "Claude ddd-expert should not register hooks"
[ ! -e "$CODEX_ROOT/hooks/hooks.json" ] || fail "Codex ddd-expert should not register hooks"
[ ! -e "$CODEX_ROOT/codex-hooks-snippet.json" ] || fail "Codex ddd-expert should not ship hook snippet"

for skill in design implement review; do
  [ -f "$CLAUDE_ROOT/skills/$skill/SKILL.md" ] || fail "Claude ddd-expert missing $skill skill"
  [ -f "$CODEX_ROOT/skills/$skill/SKILL.md" ] || fail "Codex ddd-expert missing $skill skill"
  grep -q '../../references/ddd-risk-router.md' "$CLAUDE_ROOT/skills/$skill/SKILL.md" || fail "Claude $skill skill should route through ddd-risk-router"
  grep -q '../../references/ddd-risk-router.md' "$CODEX_ROOT/skills/$skill/SKILL.md" || fail "Codex $skill skill should route through ddd-risk-router"
done

check_implement_preflight_gate() {
  local implement_skill="$1"
  local label="$2"

  grep -q "## Preflight Rule Gate" "$implement_skill" || fail "$label implement skill should define a preflight rule gate"
  grep -q "Run this gate before file edits" "$implement_skill" || fail "$label implement gate should run before edits"
  grep -q "Turn explicit user requirements into acceptance items" "$implement_skill" || fail "$label implement skill should force user requirements into acceptance items"
  grep -q "Classify touched surfaces from user requirements, planned files, imports, generated artifacts, migrations, runtime entrypoints, tests, and existing conventions" "$implement_skill" || fail "$label implement skill should classify touched surfaces from evidence"
  grep -q "router, not an inventory" "$implement_skill" || fail "$label implement surface table should not be exhaustive"
  grep -q "Add or rename surfaces from repository evidence" "$implement_skill" || fail "$label implement skill should allow repo-specific surfaces"
  grep -q "cmd/\\*\\*, configs/\\*\\*, internal/pkg/\\*\\*" "$implement_skill" || fail "$label implement skill should include runtime/config example surfaces"
  grep -q "proto/\\*\\*, pkg/gen/\\*\\*, ConnectRPC, gRPC" "$implement_skill" || fail "$label implement skill should include generated RPC example surfaces"
  grep -q "scripts/sql/\\*\\*, migrations/\\*\\*, repository/DO/persistence" "$implement_skill" || fail "$label implement skill should include database example surfaces"
  grep -q "Rules Satisfied / Not Applicable / Exception" "$implement_skill" || fail "$label implement output should require rule status table"
  grep -q "Generated RPC mapping test" "$implement_skill" || fail "$label implement skill should suggest generated RPC seam tests"
  grep -q "real schema test" "$implement_skill" || fail "$label implement skill should suggest real schema tests"
  grep -q "fx graph/config profile test" "$implement_skill" || fail "$label implement skill should suggest runtime config tests"
}

check_implement_preflight_gate "$CLAUDE_ROOT/skills/implement/SKILL.md" "Claude"
check_implement_preflight_gate "$CODEX_ROOT/skills/implement/SKILL.md" "Codex"

check_review_evidence_gate() {
  local review_skill="$1"
  local label="$2"

  grep -q "## Evidence Gate" "$review_skill" || fail "$label review skill should define an evidence gate"
  grep -q "Run this gate before findings" "$review_skill" || fail "$label review gate should run before findings"
  grep -q "Do not rely on review as the first placement gate" "$review_skill" || fail "$label review skill should not replace implement preflight"
  grep -q "Classify touched surfaces from paths, imports, generated artifacts, migrations, runtime entrypoints, tests, and logs" "$review_skill" || fail "$label review skill should classify touched surfaces from evidence"
  grep -q "router, not an inventory" "$review_skill" || fail "$label review surface table should not be exhaustive"
  grep -q "Add or rename surfaces from the repository evidence" "$review_skill" || fail "$label review skill should allow repo-specific surfaces"
  grep -q "cmd/\\*\\*, configs/\\*\\*, internal/pkg/\\*\\*" "$review_skill" || fail "$label review skill should include runtime/config example surfaces"
  grep -q "proto/\\*\\*, pkg/gen/\\*\\*, ConnectRPC, gRPC" "$review_skill" || fail "$label review skill should include generated RPC example surfaces"
  grep -q "scripts/sql/\\*\\*, migrations/\\*\\*, repository/DO/persistence" "$review_skill" || fail "$label review skill should include database example surfaces"
  grep -q "Rules Satisfied / Not Applicable / Exception" "$review_skill" || fail "$label review output should require rule status table"
  grep -q "Evidence gap, not finding" "$review_skill" || fail "$label review skill should separate evidence gaps from findings"
}

check_review_evidence_gate "$CLAUDE_ROOT/skills/review/SKILL.md" "Claude"
check_review_evidence_gate "$CODEX_ROOT/skills/review/SKILL.md" "Codex"

for reference in \
  database.md \
  ddd-agent-contract.md \
  ddd-core.md \
  ddd-golang-events-messages.md \
  ddd-golang-runtime.md \
  ddd-golang-taskqueue.md \
  ddd-golang.md \
  ddd-modeling.md \
  ddd-python.md \
  ddd-risk-router.md \
  ddd-typescript.md
do
  [ -f "$CLAUDE_ROOT/references/$reference" ] || fail "Claude ddd-expert missing reference $reference"
  [ -f "$CODEX_ROOT/references/$reference" ] || fail "Codex ddd-expert missing reference $reference"
done

# The standalone plugin should not route users back to the retired Superpowers
# DDD plugin.
if grep -R -n -i 'superpowers-ddd-architect' "$CLAUDE_ROOT" "$CODEX_ROOT" >/dev/null; then
  grep -R -n -i 'superpowers-ddd-architect' "$CLAUDE_ROOT" "$CODEX_ROOT" >&2
  fail "ddd-expert should not reference retired superpowers-ddd-architect"
fi

grep -Fq "/plugin install ddd-expert@skill-workshop" "$ROOT/README.md" || fail "root README missing Claude ddd-expert install command"
grep -Fq "codex plugin add ddd-expert@skill-workshop-codex" "$ROOT/README.md" || fail "root README missing Codex ddd-expert install command"

echo "  ddd-expert plugin: standalone explicit contract correct"
