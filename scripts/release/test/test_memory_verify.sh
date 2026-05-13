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

clean="$TMPDIR/clean"
cp -R "$ROOT/plugins/superpowers-memory/hooks/fixtures/clean" "$clean"

clean_out="$(cd "$clean" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$clean_out" | jq -e '.shapeViolations | length == 0' >/dev/null

clean_codex_out="$(cd "$clean" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$clean_codex_out" | jq -e '.shapeViolations | length == 0' >/dev/null

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

out="$(cd "$missing" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$out" | jq -e '.shapeViolations[] | select(.kind == "feature_missing_field")' >/dev/null

codex_out="$(cd "$missing" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$codex_out" | jq -e '.shapeViolations[] | select(.kind == "feature_missing_field")' >/dev/null

echo "  memory verify: feature fixed-field lint correct"
