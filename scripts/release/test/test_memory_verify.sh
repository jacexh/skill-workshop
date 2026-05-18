#!/usr/bin/env bash
# Verify superpowers-memory content-shape lint for features.md across Claude and Codex runtimes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

assert_feature_template_group_order() {
  local template="$1"
  local product workflows platform operations
  product="$(grep -n '^### Product Capabilities$' "$template" | head -n1 | cut -d: -f1 || true)"
  workflows="$(grep -n '^### User / Operator Workflows$' "$template" | head -n1 | cut -d: -f1 || true)"
  platform="$(grep -n '^### Platform Capabilities$' "$template" | head -n1 | cut -d: -f1 || true)"
  operations="$(grep -n '^### Operations$' "$template" | head -n1 | cut -d: -f1 || true)"

  [ -n "$product" ] || { echo "FAIL missing Product Capabilities in $template"; exit 1; }
  [ -n "$workflows" ] || { echo "FAIL missing User / Operator Workflows in $template"; exit 1; }
  [ -n "$platform" ] || { echo "FAIL missing Platform Capabilities in $template"; exit 1; }
  [ -n "$operations" ] || { echo "FAIL missing Operations in $template"; exit 1; }
  [ "$product" -lt "$workflows" ] || { echo "FAIL Product must precede Workflows in $template"; exit 1; }
  [ "$workflows" -lt "$platform" ] || { echo "FAIL Workflows must precede Platform in $template"; exit 1; }
  [ "$platform" -lt "$operations" ] || { echo "FAIL Platform must precede Operations in $template"; exit 1; }
}

# The features template should keep product capabilities ahead of workflow,
# platform, and operations groups so generated maps do not start with runtime
# components when product capabilities exist.
assert_feature_template_group_order "$ROOT/plugins/superpowers-memory/templates/features.md"
assert_feature_template_group_order "$ROOT/codex-plugins/superpowers-memory/templates/features.md"

# Intent: Claude and Codex tracks must keep the shared KB rules and templates
# identical so generated knowledge does not drift by host runtime.
diff -u "$ROOT/plugins/superpowers-memory/content-rules.md" "$ROOT/codex-plugins/superpowers-memory/content-rules.md" >/dev/null
diff -qr "$ROOT/plugins/superpowers-memory/templates" "$ROOT/codex-plugins/superpowers-memory/templates" >/dev/null

clean="$TMPDIR/clean"
cp -R "$ROOT/plugins/superpowers-memory/hooks/fixtures/clean" "$clean"

clean_out="$(cd "$clean" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$clean_out" | jq -e '.shapeViolations | length == 0' >/dev/null

clean_codex_out="$(cd "$clean" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$clean_codex_out" | jq -e '.shapeViolations | length == 0' >/dev/null

# Current ADR summaries may include a short "Why" line without becoming legacy
# inline ADRs. Legacy detection is limited to fields from the old detail format.
why_summary="$TMPDIR/why-summary"
cp -R "$ROOT/plugins/superpowers-memory/hooks/fixtures/clean" "$why_summary"
sed -i.bak '/^\*\*Decision:/a **Why:** Team familiarity makes maintenance cheaper.' "$why_summary/docs/project-knowledge/decisions.md"
rm "$why_summary/docs/project-knowledge/decisions.md.bak"
why_out="$(cd "$why_summary" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$why_out" | jq -e '[.shapeViolations[] | select(.kind == "legacy_adr_inline")] | length == 0' >/dev/null
why_codex_out="$(cd "$why_summary" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$why_codex_out" | jq -e '[.shapeViolations[] | select(.kind == "legacy_adr_inline")] | length == 0' >/dev/null

missing="$TMPDIR/missing-feature-fields"
cp -R "$ROOT/plugins/superpowers-memory/hooks/fixtures/missing-feature-fields" "$missing"

# Larger product capability maps and architecture summaries should remain below
# the relaxed warning threshold so agents do not delete useful product context.
large="$TMPDIR/large-capability-map"
cp -R "$ROOT/plugins/superpowers-memory/hooks/fixtures/clean" "$large"
{
  printf '%s\n' '---'
  printf '%s\n' 'last_updated: 2026-05-13'
  printf '%s\n' 'updated_by: superpowers-memory:update'
  printf '%s\n' 'triggered_by_plan: null'
  printf '%s\n' '---'
  printf '\n# Features\n\n## Implemented\n\n### Product Capabilities\n\n'
  for i in $(seq 1 32); do
    printf '#### Product Capability %02d\n\n' "$i"
    printf '**Enables** — Users can complete product workflow %02d from the main workspace.\n\n' "$i"
    printf '**Actors / Entry Points** — Product users enter through the workspace route %02d.\n\n' "$i"
    printf '**Capability Boundary** — Keeps product behavior %02d distinct from runtime implementation detail.\n\n' "$i"
    printf '**References** — Product spec %02d.\n\n' "$i"
  done
} > "$large/docs/project-knowledge/features.md"
{
  printf '%s\n' '---'
  printf '%s\n' 'last_updated: 2026-05-13'
  printf '%s\n' 'updated_by: superpowers-memory:update'
  printf '%s\n' 'triggered_by_plan: null'
  printf '%s\n' '---'
  printf '\n# Architecture\n\n'
  for i in $(seq 1 252); do
    printf 'Architecture summary line %03d describes a cross-module structure without implementation catalogs.\n' "$i"
  done
} > "$large/docs/project-knowledge/architecture.md"

large_out="$(cd "$large" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$large_out" | jq -e '[.sizeWarnings[] | select(.file == "features.md" or .file == "architecture.md")] | length == 0' >/dev/null

large_codex_out="$(cd "$large" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$large_codex_out" | jq -e '[.sizeWarnings[] | select(.file == "features.md" or .file == "architecture.md")] | length == 0' >/dev/null

# playbooks.md is a lazy slot — when absent, neither runtime should warn about it
# nor fail verification. The pre-existing clean fixture has no playbooks.md, so a
# clean verify must not mention it in sizeWarnings.
echo "$clean_out" | jq -e '[.sizeWarnings[] | select(.file == "playbooks.md")] | length == 0' >/dev/null
echo "$clean_codex_out" | jq -e '[.sizeWarnings[] | select(.file == "playbooks.md")] | length == 0' >/dev/null

# When playbooks.md exists and exceeds the 200-line threshold, both runtimes must
# emit a sizeWarning entry naming playbooks.md.
oversized="$TMPDIR/oversized-playbooks"
cp -R "$ROOT/plugins/superpowers-memory/hooks/fixtures/clean" "$oversized"
{
  printf '%s\n' '---'
  printf '%s\n' 'last_updated: 2026-05-13'
  printf '%s\n' 'updated_by: superpowers-memory:update'
  printf '%s\n' 'triggered_by_plan: null'
  printf '%s\n' '---'
  printf '\n# Playbooks\n\n## Code-change recipes\n\n'
  for i in $(seq 1 220); do
    printf -- '- [Recipe %03d](playbooks/recipe-%03d.md) — When: scenario %03d occurs in the codebase.\n' "$i" "$i" "$i"
  done
} > "$oversized/docs/project-knowledge/playbooks.md"

oversized_out="$(cd "$oversized" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$oversized_out" | jq -e '[.sizeWarnings[] | select(.file == "playbooks.md" and .lines > 200 and .threshold == 200)] | length == 1' >/dev/null

oversized_codex_out="$(cd "$oversized" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$oversized_codex_out" | jq -e '[.sizeWarnings[] | select(.file == "playbooks.md" and .lines > 200 and .threshold == 200)] | length == 1' >/dev/null

out="$(cd "$missing" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$out" | jq -e '.shapeViolations[] | select(.kind == "feature_missing_field")' >/dev/null

codex_out="$(cd "$missing" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$codex_out" | jq -e '.shapeViolations[] | select(.kind == "feature_missing_field")' >/dev/null

assert_verify_kind_for_both_runtimes() {
  local fixture="$1"
  local field="$2"
  local kind="$3"
  local scenario="$TMPDIR/$fixture"
  cp -R "$ROOT/plugins/superpowers-memory/hooks/fixtures/$fixture" "$scenario"

  local claude_out codex_verify_out
  claude_out="$(cd "$scenario" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
  codex_verify_out="$(cd "$scenario" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"

  echo "$claude_out" | jq -e --arg field "$field" --arg kind "$kind" '.[$field][] | select(.kind == $kind)' >/dev/null
  echo "$codex_verify_out" | jq -e --arg field "$field" --arg kind "$kind" '.[$field][] | select(.kind == $kind)' >/dev/null
}

# Intent: dense feature prose should be caught so agents do not bury capability
# boundaries inside oversized paragraphs.
assert_verify_kind_for_both_runtimes "dense-features" "shapeViolations" "feature_entry_too_dense"

# Intent: duplicated multi-line KB facts should be caught so the ownership
# matrix remains enforceable across both host runtimes.
ssot="$TMPDIR/ssot-violation"
cp -R "$ROOT/plugins/superpowers-memory/hooks/fixtures/ssot-violation" "$ssot"
ssot_out="$(cd "$ssot" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$ssot_out" | jq -e '.ssotViolations | length > 0' >/dev/null
ssot_codex_out="$(cd "$ssot" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$ssot_codex_out" | jq -e '.ssotViolations | length > 0' >/dev/null

# Intent: legacy inline ADRs should be visible as a migration risk instead of
# silently passing as a modern summary/detail decision log.
assert_verify_kind_for_both_runtimes "legacy-adr-inline" "shapeViolations" "legacy_adr_inline"

# Intent: ADR summaries that point to missing detail files should fail the
# on-demand decision-context contract.
assert_verify_kind_for_both_runtimes "missing-adr-detail" "shapeViolations" "adr_detail_missing"

# Intent: playbook indexes and detail files must stay loadable and complete so
# agents can follow recurring code-change recipes without broken links.
assert_verify_kind_for_both_runtimes "broken-playbook" "shapeViolations" "playbook_detail_missing"
assert_verify_kind_for_both_runtimes "broken-playbook" "shapeViolations" "playbook_missing_section"

# Intent: implemented capabilities that point at scaffolded/not-implemented code
# should surface readiness risk instead of overstating runtime availability.
assert_verify_kind_for_both_runtimes "readiness-warning" "readinessWarnings" "capability_readiness_uncalibrated"

# Intent: Codex status should expose whether KB coverage matches HEAD, giving
# Codex a lightweight compensation for prompt paths that cannot fire JIT hooks.
status_repo="$TMPDIR/status-repo"
cp -R "$ROOT/plugins/superpowers-memory/hooks/fixtures/clean" "$status_repo"
(
  cd "$status_repo"
  git init -q
  git config user.email test@example.com
  git config user.name Test
  git add .
  git commit -q -m "initial"
  covered_sha="$(git rev-parse --short HEAD)"
  branch="$(git branch --show-current)"
  sed -i.bak "s/^covers_branch:.*/covers_branch: ${branch}@${covered_sha}/" docs/project-knowledge/index.md
  rm docs/project-knowledge/index.md.bak
  git add docs/project-knowledge/index.md
  git commit -q -m "docs: record coverage"
  printf 'change\n' > src-new.txt
  git add src-new.txt
  git commit -q -m "feat: add source change"
  node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" status |
    jq -e '.stale == true and .nonKbCommitCount == 1 and (.changedFiles[] == "src-new.txt")' >/dev/null
  node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" session-start |
    jq -e '.additional_context | contains("Project KB status") and contains("stale")' >/dev/null
  node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" session-start |
    jq -e '.hookSpecificOutput.additionalContext | contains("Project KB status") and contains("stale")' >/dev/null
)

echo "  memory verify: feature fixed-field lint correct"
echo "  memory verify: playbooks.md threshold (200) fires when oversized, silent when absent"
echo "  memory verify: shape, ADR, playbook, readiness, SSOT, and runtime status checks correct"
