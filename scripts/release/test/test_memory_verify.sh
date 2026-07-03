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

migrate_fixture_memory_dir() {
  local repo="$1"
  if [ -d "$repo/docs/project-knowledge" ] && [ ! -d "$repo/docs/superpowers/memory" ]; then
    mkdir -p "$repo/docs/superpowers"
    mv "$repo/docs/project-knowledge" "$repo/docs/superpowers/memory"
  fi
}

copy_fixture() {
  local fixture="$1"
  local dest="$2"
  cp -R "$ROOT/plugins/superpowers-memory/hooks/fixtures/$fixture" "$dest"
  migrate_fixture_memory_dir "$dest"
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
copy_fixture "clean" "$clean"

clean_out="$(cd "$clean" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$clean_out" | jq -e '.shapeViolations | length == 0' >/dev/null
echo "$clean_out" | jq -e '.qualityGate.ok == true and .qualityGate.blockingFindings == 0 and .qualityGate.advisoryFindings == 0 and .qualityGate.coverageAdvisoryOnly == true' >/dev/null

clean_codex_out="$(cd "$clean" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$clean_codex_out" | jq -e '.shapeViolations | length == 0' >/dev/null
echo "$clean_codex_out" | jq -e '.qualityGate.ok == true and .qualityGate.blockingFindings == 0 and .qualityGate.advisoryFindings == 0 and .qualityGate.coverageAdvisoryOnly == true' >/dev/null

clean_lint_out="$(cd "$clean" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" lint)"
echo "$clean_lint_out" | jq -e 'has("staleRefs") and has("shapeViolations") and has("ssotViolations") and has("retrievalCost") and has("coverageGaps") and has("qualityGate")' >/dev/null

clean_codex_lint_out="$(cd "$clean" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" lint)"
echo "$clean_codex_lint_out" | jq -e 'has("staleRefs") and has("shapeViolations") and has("ssotViolations") and has("retrievalCost") and has("coverageGaps") and has("qualityGate")' >/dev/null

# Intent: log.md is a chronological KB maintenance ledger owned by ingest,
# not an unrecognized markdown file or a place for read-only query/lint events.
valid_log="$TMPDIR/valid-log"
copy_fixture "clean" "$valid_log"
{
  printf '%s\n' '---'
  printf '%s\n' 'last_updated: 2026-07-03'
  printf '%s\n' 'updated_by: superpowers-memory:ingest'
  printf '%s\n' 'triggered_by_plan: null'
  printf '%s\n' '---'
  printf '\n# Project Knowledge Log\n\n'
  printf '%s\n' '## [2026-07-03] ingest | slot contracts'
  printf '\n'
  printf '%s\n' '- Source: `docs/superpowers/memory/features.md`'
  printf '%s\n' '- Touched: `docs/superpowers/memory/features.md`, `docs/superpowers/memory/index.md`'
  printf '%s\n' '- Verify: ok; qualityGate blocking=0 advisory=0'
} > "$valid_log/docs/superpowers/memory/log.md"
valid_log_out="$(cd "$valid_log" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$valid_log_out" | jq -e '.retrievalCost.perFile[] | select(.file == "log.md")' >/dev/null
echo "$valid_log_out" | jq -e '[.shapeViolations[] | select(.file == "log.md")] | length == 0' >/dev/null
valid_log_codex_out="$(cd "$valid_log" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$valid_log_codex_out" | jq -e '.retrievalCost.perFile[] | select(.file == "log.md")' >/dev/null
echo "$valid_log_codex_out" | jq -e '[.shapeViolations[] | select(.file == "log.md")] | length == 0' >/dev/null

# Intent: query and lint stay read-only; only ingest-owned write events belong
# in log.md.
query_log="$TMPDIR/query-log"
copy_fixture "clean" "$query_log"
{
  printf '%s\n' '---'
  printf '%s\n' 'last_updated: 2026-07-03'
  printf '%s\n' 'updated_by: superpowers-memory:ingest'
  printf '%s\n' 'triggered_by_plan: null'
  printf '%s\n' '---'
  printf '\n# Project Knowledge Log\n\n'
  printf '%s\n' '## [2026-07-03] query | architecture lookup'
  printf '\n'
  printf '%s\n' '- Source: `docs/superpowers/memory/index.md`'
} > "$query_log/docs/superpowers/memory/log.md"
query_log_out="$(cd "$query_log" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$query_log_out" | jq -e '.shapeViolations[] | select(.file == "log.md" and .kind == "log_event_not_ingest_owned")' >/dev/null
query_log_codex_out="$(cd "$query_log" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$query_log_codex_out" | jq -e '.shapeViolations[] | select(.file == "log.md" and .kind == "log_event_not_ingest_owned")' >/dev/null

# Intent: log headings must be machine-readable so tail/grep workflows can
# recover recent KB maintenance chronology.
bad_log_heading="$TMPDIR/bad-log-heading"
copy_fixture "clean" "$bad_log_heading"
{
  printf '%s\n' '---'
  printf '%s\n' 'last_updated: 2026-07-03'
  printf '%s\n' 'updated_by: superpowers-memory:ingest'
  printf '%s\n' 'triggered_by_plan: null'
  printf '%s\n' '---'
  printf '\n# Project Knowledge Log\n\n'
  printf '%s\n' '## 2026-07-03 ingest | malformed heading'
} > "$bad_log_heading/docs/superpowers/memory/log.md"
bad_log_heading_out="$(cd "$bad_log_heading" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$bad_log_heading_out" | jq -e '.shapeViolations[] | select(.file == "log.md" and .kind == "log_heading_format")' >/dev/null
bad_log_heading_codex_out="$(cd "$bad_log_heading" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$bad_log_heading_codex_out" | jq -e '.shapeViolations[] | select(.file == "log.md" and .kind == "log_heading_format")' >/dev/null

# Intent: log.md references are still source evidence; broken non-memory paths
# should be caught by the existing stale reference checker.
stale_log_ref="$TMPDIR/stale-log-ref"
copy_fixture "clean" "$stale_log_ref"
{
  printf '%s\n' '---'
  printf '%s\n' 'last_updated: 2026-07-03'
  printf '%s\n' 'updated_by: superpowers-memory:ingest'
  printf '%s\n' 'triggered_by_plan: null'
  printf '%s\n' '---'
  printf '\n# Project Knowledge Log\n\n'
  printf '%s\n' '## [2026-07-03] ingest | stale source example'
  printf '\n'
  printf '%s\n' '- Source: `src/missing.js`'
  printf '%s\n' '- Touched: `docs/superpowers/memory/features.md`'
  printf '%s\n' '- Verify: ok; qualityGate blocking=0 advisory=0'
} > "$stale_log_ref/docs/superpowers/memory/log.md"
stale_log_ref_out="$(cd "$stale_log_ref" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$stale_log_ref_out" | jq -e '.staleRefs[] | select(.file == "log.md" and .ref == "src/missing.js")' >/dev/null
stale_log_ref_codex_out="$(cd "$stale_log_ref" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$stale_log_ref_codex_out" | jq -e '.staleRefs[] | select(.file == "log.md" and .ref == "src/missing.js")' >/dev/null

# Current ADR summaries may include a short "Why" line without becoming legacy
# inline ADRs. Legacy detection is limited to fields from the old detail format.
why_summary="$TMPDIR/why-summary"
copy_fixture "clean" "$why_summary"
sed -i.bak '/^\*\*Decision:/a **Why:** Team familiarity makes maintenance cheaper.' "$why_summary/docs/superpowers/memory/decisions.md"
rm "$why_summary/docs/superpowers/memory/decisions.md.bak"
why_out="$(cd "$why_summary" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$why_out" | jq -e '[.shapeViolations[] | select(.kind == "legacy_adr_inline")] | length == 0' >/dev/null
why_codex_out="$(cd "$why_summary" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$why_codex_out" | jq -e '[.shapeViolations[] | select(.kind == "legacy_adr_inline")] | length == 0' >/dev/null

missing="$TMPDIR/missing-feature-fields"
copy_fixture "missing-feature-fields" "$missing"

# Larger product capability maps and architecture summaries should remain below
# the relaxed warning threshold so agents do not delete useful product context.
large="$TMPDIR/large-capability-map"
copy_fixture "clean" "$large"
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
} > "$large/docs/superpowers/memory/features.md"
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
} > "$large/docs/superpowers/memory/architecture.md"

large_out="$(cd "$large" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$large_out" | jq -e '[.sizeWarnings[] | select(.file == "features.md" or .file == "architecture.md")] | length == 0' >/dev/null

large_codex_out="$(cd "$large" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$large_codex_out" | jq -e '[.sizeWarnings[] | select(.file == "features.md" or .file == "architecture.md")] | length == 0' >/dev/null

# Intent: legacy playbooks.md files should no longer be treated as a
# canonical KB slot, so broken playbook links do not create verify failures.
legacy_playbooks="$TMPDIR/legacy-playbooks"
copy_fixture "clean" "$legacy_playbooks"
mkdir -p "$legacy_playbooks/docs/superpowers/memory/playbooks"
{
  printf '%s\n' '---'
  printf '%s\n' 'last_updated: 2026-05-27'
  printf '%s\n' 'updated_by: legacy'
  printf '%s\n' 'triggered_by_plan: null'
  printf '%s\n' '---'
  printf '\n# Playbooks\n\n'
  printf '%s\n' '- [Missing legacy recipe](playbooks/missing.md) — When: old projects still carry this file.'
} > "$legacy_playbooks/docs/superpowers/memory/playbooks.md"

legacy_out="$(cd "$legacy_playbooks" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$legacy_out" | jq -e '[.shapeViolations[] | select(.kind | startswith("playbook_"))] | length == 0' >/dev/null

legacy_codex_out="$(cd "$legacy_playbooks" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$legacy_codex_out" | jq -e '[.shapeViolations[] | select(.kind | startswith("playbook_"))] | length == 0' >/dev/null

# Intent: large non-index KB shards are valid storage and should be reported as
# retrieval/split advisories without making verify fail.
split="$TMPDIR/split-architecture"
copy_fixture "clean" "$split"
{
  printf '%s\n' '---'
  printf '%s\n' 'last_updated: 2026-05-27'
  printf '%s\n' 'updated_by: superpowers-memory:update'
  printf '%s\n' 'triggered_by_plan: null'
  printf '%s\n' '---'
  printf '\n# Runtime Architecture\n\n'
  for i in $(seq 1 360); do
    printf 'Runtime architecture sequence line %03d documents a valid cross-module flow.\n' "$i"
  done
} > "$split/docs/superpowers/memory/architecture-runtime.md"

split_out="$(cd "$split" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$split_out" | jq -e '.ok == true' >/dev/null
echo "$split_out" | jq -e '.retrievalCost.perFile[] | select(.file == "architecture-runtime.md")' >/dev/null
echo "$split_out" | jq -e '.splitCandidates[] | select(.file == "architecture-runtime.md")' >/dev/null

split_codex_out="$(cd "$split" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$split_codex_out" | jq -e '.ok == true' >/dev/null
echo "$split_codex_out" | jq -e '.retrievalCost.perFile[] | select(.file == "architecture-runtime.md")' >/dev/null
echo "$split_codex_out" | jq -e '.splitCandidates[] | select(.file == "architecture-runtime.md")' >/dev/null

# Intent: a root decisions.md with many active ADR summaries should remain
# valid storage, but verify should recommend stable decision-family shards so
# query does not have to scan a chronological decision wall.
decision_router="$TMPDIR/decision-router"
copy_fixture "clean" "$decision_router"
{
  printf '%s\n' '---'
  printf '%s\n' 'last_updated: 2026-06-25'
  printf '%s\n' 'updated_by: superpowers-memory:ingest'
  printf '%s\n' 'triggered_by_plan: null'
  printf '%s\n' '---'
  printf '\n# Decisions\n\n'
  for i in $(seq 1 10); do
    printf '## ADR-%03d: Runtime decision %03d\n' "$i" "$i"
    printf '**Decision:** Choose runtime design %03d for cross-module delivery.\n' "$i"
    printf '**Trade-off:** Adds routing discipline for decision family %03d.\n' "$i"
    printf '**Affects:** architecture-runtime.md, conventions.md\n'
    printf '→ [adr/ADR-%03d-runtime-decision.md](adr/ADR-%03d-runtime-decision.md)\n\n' "$i" "$i"
  done
} > "$decision_router/docs/superpowers/memory/decisions.md"
mkdir -p "$decision_router/docs/superpowers/memory/adr"
for i in $(seq 1 10); do
  printf '# ADR-%03d\n' "$i" > "$decision_router/docs/superpowers/memory/adr/ADR-$(printf '%03d' "$i")-runtime-decision.md"
done

decision_router_out="$(cd "$decision_router" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$decision_router_out" | jq -e '.ok == true' >/dev/null
echo "$decision_router_out" | jq -e '.coverageGaps[] | select(.kind == "decisions_family_shards_recommended")' >/dev/null

decision_router_codex_out="$(cd "$decision_router" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$decision_router_codex_out" | jq -e '.ok == true' >/dev/null
echo "$decision_router_codex_out" | jq -e '.coverageGaps[] | select(.kind == "decisions_family_shards_recommended")' >/dev/null

# Intent: a large global glossary whose terms all have owner refs is still a
# query problem. Verify should recommend turning the root glossary into an
# alias router with stable glossary-<domain>.md shards.
glossary_router="$TMPDIR/glossary-router"
copy_fixture "clean" "$glossary_router"
{
  printf '%s\n' '---'
  printf '%s\n' 'last_updated: 2026-06-25'
  printf '%s\n' 'updated_by: superpowers-memory:ingest'
  printf '%s\n' 'triggered_by_plan: null'
  printf '%s\n' '---'
  printf '\n# Glossary\n\n'
  for i in $(seq 1 90); do
    printf '**Runtime Term %03d** — Runtime-owned business alias %03d. → `cmd/server/`\n' "$i" "$i"
  done
} > "$glossary_router/docs/superpowers/memory/glossary.md"

glossary_router_out="$(cd "$glossary_router" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$glossary_router_out" | jq -e '.ok == true' >/dev/null
echo "$glossary_router_out" | jq -e '.coverageGaps[] | select(.kind == "glossary_alias_router_recommended")' >/dev/null

glossary_router_codex_out="$(cd "$glossary_router" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$glossary_router_codex_out" | jq -e '.ok == true' >/dev/null
echo "$glossary_router_codex_out" | jq -e '.coverageGaps[] | select(.kind == "glossary_alias_router_recommended")' >/dev/null

# Intent: complex repos with only thin architecture summaries should produce
# advisory ingest targets without making verify fail.
architecture_gap="$TMPDIR/architecture-coverage-gap"
copy_fixture "architecture-coverage-gap" "$architecture_gap"
architecture_gap_out="$(cd "$architecture_gap" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$architecture_gap_out" | jq -e '.ok == true' >/dev/null
echo "$architecture_gap_out" | jq -e '.qualityGate.ok == true and .qualityGate.blockingFindings == 0 and .qualityGate.advisoryFindings > 0 and .qualityGate.coverageAdvisoryOnly == true' >/dev/null
echo "$architecture_gap_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_service_cards_sparse")' >/dev/null
echo "$architecture_gap_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_scenarios_sparse")' >/dev/null

architecture_gap_codex_out="$(cd "$architecture_gap" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$architecture_gap_codex_out" | jq -e '.ok == true' >/dev/null
echo "$architecture_gap_codex_out" | jq -e '.qualityGate.ok == true and .qualityGate.blockingFindings == 0 and .qualityGate.advisoryFindings > 0 and .qualityGate.coverageAdvisoryOnly == true' >/dev/null
echo "$architecture_gap_codex_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_service_cards_sparse")' >/dev/null
echo "$architecture_gap_codex_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_scenarios_sparse")' >/dev/null

# Intent: architecture coverage should not pass just because card and
# diagram counts are high. Cards that only name generic code layers should
# prompt deeper architecture answerability, and scenario diagrams should carry
# local source refs so query can cite the flow directly.
shallow_architecture="$TMPDIR/architecture-shallow-coverage"
copy_fixture "architecture-shallow-coverage" "$shallow_architecture"
shallow_architecture_out="$(cd "$shallow_architecture" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$shallow_architecture_out" | jq -e '.ok == true' >/dev/null
echo "$shallow_architecture_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_service_cards_shallow")' >/dev/null
echo "$shallow_architecture_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_scenario_refs_missing")' >/dev/null
echo "$shallow_architecture_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_module_shards_missing")' >/dev/null
echo "$shallow_architecture_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_scenario_shards_missing")' >/dev/null

shallow_architecture_codex_out="$(cd "$shallow_architecture" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$shallow_architecture_codex_out" | jq -e '.ok == true' >/dev/null
echo "$shallow_architecture_codex_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_service_cards_shallow")' >/dev/null
echo "$shallow_architecture_codex_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_scenario_refs_missing")' >/dev/null
echo "$shallow_architecture_codex_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_module_shards_missing")' >/dev/null
echo "$shallow_architecture_codex_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_scenario_shards_missing")' >/dev/null

# Intent: dedicated module/scenario shards should not be hollow files. Module
# shards must link to participating scenarios, scenario shards must link back
# to modules, and scenario shards must preserve authority/order/failure
# semantics that affect safe future changes.
shard_crossrefs_gap="$TMPDIR/architecture-shard-crossrefs-gap"
copy_fixture "architecture-shard-crossrefs-gap" "$shard_crossrefs_gap"
shard_crossrefs_gap_out="$(cd "$shard_crossrefs_gap" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$shard_crossrefs_gap_out" | jq -e '.ok == true' >/dev/null
echo "$shard_crossrefs_gap_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_module_scenario_refs_missing")' >/dev/null
echo "$shard_crossrefs_gap_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_scenario_module_refs_missing")' >/dev/null
echo "$shard_crossrefs_gap_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_scenario_fields_missing")' >/dev/null

shard_crossrefs_gap_codex_out="$(cd "$shard_crossrefs_gap" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$shard_crossrefs_gap_codex_out" | jq -e '.ok == true' >/dev/null
echo "$shard_crossrefs_gap_codex_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_module_scenario_refs_missing")' >/dev/null
echo "$shard_crossrefs_gap_codex_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_scenario_module_refs_missing")' >/dev/null
echo "$shard_crossrefs_gap_codex_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_scenario_fields_missing")' >/dev/null

# Intent: non-architecture KB slots must also surface query-answerability
# gaps. A legal-looking KB that only has platform features, thin ADR
# summaries, and unreferenced reference entries should produce ingest targets
# without making verify fail.
non_architecture_query_gaps="$TMPDIR/non-architecture-query-gaps"
copy_fixture "non-architecture-query-gaps" "$non_architecture_query_gaps"
non_architecture_query_gaps_out="$(cd "$non_architecture_query_gaps" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$non_architecture_query_gaps_out" | jq -e '.ok == false' >/dev/null
echo "$non_architecture_query_gaps_out" | jq -e '.coverageGaps[] | select(.kind == "features_product_coverage_missing")' >/dev/null
echo "$non_architecture_query_gaps_out" | jq -e '.coverageGaps[] | select(.kind == "features_workflow_coverage_missing")' >/dev/null
echo "$non_architecture_query_gaps_out" | jq -e '.coverageGaps[] | select(.kind == "decisions_detail_links_missing")' >/dev/null
echo "$non_architecture_query_gaps_out" | jq -e '.coverageGaps[] | select(.kind == "decisions_tradeoffs_missing")' >/dev/null
echo "$non_architecture_query_gaps_out" | jq -e '.coverageGaps[] | select(.kind == "decisions_affected_routing_missing")' >/dev/null
echo "$non_architecture_query_gaps_out" | jq -e '.coverageGaps[] | select(.kind == "knowledge_shards_unrouted" and (.sample | contains("decisions-runtime.md")))' >/dev/null
echo "$non_architecture_query_gaps_out" | jq -e '.coverageGaps[] | select(.kind == "knowledge_shards_unrouted" and (.sample | contains("conventions-frontend.md")))' >/dev/null
echo "$non_architecture_query_gaps_out" | jq -e '.coverageGaps[] | select(.kind == "conventions_source_refs_missing")' >/dev/null
echo "$non_architecture_query_gaps_out" | jq -e '.coverageGaps[] | select(.kind == "tech_stack_rationale_missing")' >/dev/null
echo "$non_architecture_query_gaps_out" | jq -e '.coverageGaps[] | select(.kind == "glossary_owner_refs_missing")' >/dev/null
echo "$non_architecture_query_gaps_out" | jq -e '.shapeViolations[] | select(.kind == "forbidden_kb_slot" and .file == "conversation.md")' >/dev/null

non_architecture_query_gaps_codex_out="$(cd "$non_architecture_query_gaps" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$non_architecture_query_gaps_codex_out" | jq -e '.ok == false' >/dev/null
echo "$non_architecture_query_gaps_codex_out" | jq -e '.coverageGaps[] | select(.kind == "features_product_coverage_missing")' >/dev/null
echo "$non_architecture_query_gaps_codex_out" | jq -e '.coverageGaps[] | select(.kind == "features_workflow_coverage_missing")' >/dev/null
echo "$non_architecture_query_gaps_codex_out" | jq -e '.coverageGaps[] | select(.kind == "decisions_detail_links_missing")' >/dev/null
echo "$non_architecture_query_gaps_codex_out" | jq -e '.coverageGaps[] | select(.kind == "decisions_tradeoffs_missing")' >/dev/null
echo "$non_architecture_query_gaps_codex_out" | jq -e '.coverageGaps[] | select(.kind == "decisions_affected_routing_missing")' >/dev/null
echo "$non_architecture_query_gaps_codex_out" | jq -e '.coverageGaps[] | select(.kind == "knowledge_shards_unrouted" and (.sample | contains("decisions-runtime.md")))' >/dev/null
echo "$non_architecture_query_gaps_codex_out" | jq -e '.coverageGaps[] | select(.kind == "knowledge_shards_unrouted" and (.sample | contains("conventions-frontend.md")))' >/dev/null
echo "$non_architecture_query_gaps_codex_out" | jq -e '.coverageGaps[] | select(.kind == "conventions_source_refs_missing")' >/dev/null
echo "$non_architecture_query_gaps_codex_out" | jq -e '.coverageGaps[] | select(.kind == "tech_stack_rationale_missing")' >/dev/null
echo "$non_architecture_query_gaps_codex_out" | jq -e '.coverageGaps[] | select(.kind == "glossary_owner_refs_missing")' >/dev/null
echo "$non_architecture_query_gaps_codex_out" | jq -e '.shapeViolations[] | select(.kind == "forbidden_kb_slot" and .file == "conversation.md")' >/dev/null

# Intent: architecture coverage should not be split only by document view
# (`contexts` vs `flows`). Even when counts and source refs look complete,
# complex repos need module shards and named scenario shards so query can route
# directly to service internals or an end-to-end message chain.
legacy_view_shards="$TMPDIR/architecture-view-shards-legacy"
copy_fixture "architecture-view-shards-legacy" "$legacy_view_shards"
legacy_view_shards_out="$(cd "$legacy_view_shards" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$legacy_view_shards_out" | jq -e '.ok == true' >/dev/null
echo "$legacy_view_shards_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_view_shards_legacy")' >/dev/null

legacy_view_shards_codex_out="$(cd "$legacy_view_shards" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$legacy_view_shards_codex_out" | jq -e '.ok == true' >/dev/null
echo "$legacy_view_shards_codex_out" | jq -e '.coverageGaps[] | select(.kind == "architecture_view_shards_legacy")' >/dev/null

# Intent: index.md remains the only strict size-constrained hot-path file
# because it is injected at session start.
oversized_index="$TMPDIR/oversized-index"
copy_fixture "clean" "$oversized_index"
for i in $(seq 1 60); do
  printf -- '- extra index route %03d\n' "$i" >> "$oversized_index/docs/superpowers/memory/index.md"
done

oversized_index_out="$(cd "$oversized_index" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$oversized_index_out" | jq -e '.ok == false' >/dev/null
echo "$oversized_index_out" | jq -e '.shapeViolations[] | select(.file == "index.md" and .kind == "index_too_large")' >/dev/null

oversized_index_codex_out="$(cd "$oversized_index" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$oversized_index_codex_out" | jq -e '.ok == false' >/dev/null
echo "$oversized_index_codex_out" | jq -e '.shapeViolations[] | select(.file == "index.md" and .kind == "index_too_large")' >/dev/null

out="$(cd "$missing" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" verify)"
echo "$out" | jq -e '.shapeViolations[] | select(.kind == "feature_missing_field")' >/dev/null

codex_out="$(cd "$missing" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" verify)"
echo "$codex_out" | jq -e '.shapeViolations[] | select(.kind == "feature_missing_field")' >/dev/null

assert_verify_kind_for_both_runtimes() {
  local fixture="$1"
  local field="$2"
  local kind="$3"
  local scenario="$TMPDIR/$fixture"
  copy_fixture "$fixture" "$scenario"

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
copy_fixture "ssot-violation" "$ssot"
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

# Intent: implemented capabilities that point at scaffolded/not-implemented code
# should surface readiness risk instead of overstating runtime availability.
assert_verify_kind_for_both_runtimes "readiness-warning" "readinessWarnings" "capability_readiness_uncalibrated"

# Intent: Codex status should expose whether KB coverage matches HEAD, giving
# Codex a lightweight compensation for prompt paths that cannot fire JIT hooks.
status_repo="$TMPDIR/status-repo"
copy_fixture "clean" "$status_repo"
(
  cd "$status_repo"
  git init -q
  git config user.email test@example.com
  git config user.name Test
  git add .
  git commit -q -m "initial"
  covered_sha="$(git rev-parse --short HEAD)"
  branch="$(git branch --show-current)"
  sed -i.bak "s/^covers_branch:.*/covers_branch: ${branch}@${covered_sha}/" docs/superpowers/memory/index.md
  rm docs/superpowers/memory/index.md.bak
  git add docs/superpowers/memory/index.md
  git commit -q -m "docs: record coverage"
  printf 'change\n' > src-new.txt
  git add src-new.txt
  git commit -q -m "feat: add source change"
  node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" status |
    jq -e '.stale == true and .nonKbCommitCount == 1 and (.changedFiles[] == "src-new.txt")' >/dev/null
  node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" session-start |
    jq -e '.additional_context | contains("Project KB available at docs/superpowers/memory/") and contains("Project KB status") and contains("stale") and contains("superpowers-memory:query") and (contains("# Project Knowledge Index") | not)' >/dev/null
  node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" session-start |
    jq -e '.hookSpecificOutput.additionalContext | contains("Project KB available at docs/superpowers/memory/") and contains("Project KB status") and contains("stale") and contains("$superpowers-memory:query") and (contains("# Project Knowledge Index") | not)' >/dev/null
)

# Intent: Codex KB write protection should use the current PreToolUse deny
# protocol so direct canonical and legacy memory edits are blocked by Codex itself.
pretool_repo="$TMPDIR/pretool-repo"
copy_fixture "clean" "$pretool_repo"
(
  cd "$pretool_repo"
  printf '%s' '{"tool_name":"apply_patch","tool_input":{"patch":"*** Update File: docs/superpowers/memory/index.md\n@@\n-old\n+new\n"}}' |
    node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" pre-tool-use |
    jq -e '.hookSpecificOutput.hookEventName == "PreToolUse" and .hookSpecificOutput.permissionDecision == "deny" and (.hookSpecificOutput.permissionDecisionReason | contains("Direct edits to docs/superpowers/memory/")) and (.hookSpecificOutput.permissionDecisionReason | contains("legacy docs/project-knowledge"))' >/dev/null
  printf '%s' '{"tool_name":"apply_patch","tool_input":{"patch":"*** Update File: docs/project-knowledge/index.md\n@@\n-old\n+new\n"}}' |
    node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" pre-tool-use |
    jq -e '.hookSpecificOutput.hookEventName == "PreToolUse" and .hookSpecificOutput.permissionDecision == "deny" and (.hookSpecificOutput.permissionDecisionReason | contains("legacy docs/project-knowledge"))' >/dev/null
)

echo "  memory verify: feature fixed-field lint correct"
echo "  memory verify: legacy playbooks ignored; split KB shards are retrieval advisories"
echo "  memory verify: shape, ADR, readiness, SSOT, and runtime status checks correct"
