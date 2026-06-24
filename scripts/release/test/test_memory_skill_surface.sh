#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

fail() {
  echo "  FAIL: $*"
  exit 1
}

for track in plugins codex-plugins; do
  base="$ROOT/$track/superpowers-memory/skills"
  templates="$ROOT/$track/superpowers-memory/templates"

  # Primary and compatibility skills must exist in both plugin tracks.
  for skill in query ingest lint load update rebuild; do
    [ -f "$base/$skill/SKILL.md" ] || fail "$track missing $skill skill"
  done

  # Query must stay read-only while producing actionable ingest candidates for coverage gaps.
  grep -q "read-only" "$base/query/SKILL.md" || fail "$track query missing read-only rule"
  grep -q "Memory candidate" "$base/query/SKILL.md" || fail "$track query missing Memory candidate"
  grep -q "Missing answerability coverage" "$base/query/SKILL.md" \
    || fail "$track query missing answerability Memory candidate"
  grep -q "Suggested owner/shard" "$base/query/SKILL.md" \
    || fail "$track query missing suggested owner/shard"
  grep -q "durable synthesis" "$base/query/SKILL.md" \
    || fail "$track query missing durable synthesis candidate"
  grep -q "Candidate type" "$base/query/SKILL.md" \
    || fail "$track query missing Memory candidate type"
  grep -Eiq "no concrete question|no-question|no question" "$base/query/SKILL.md" \
    || fail "$track query missing no-question orientation behavior"
  grep -Eiq "orient" "$base/query/SKILL.md" \
    || fail "$track query missing orientation behavior"

  # Ingest must support full rebuilds and add targeted coverage for high-value query objects.
  grep -q "bootstrap" "$base/ingest/SKILL.md" || fail "$track ingest missing bootstrap mode"
  grep -q "full-refresh" "$base/ingest/SKILL.md" || fail "$track ingest missing full-refresh mode"
  grep -q "weak hints" "$base/ingest/SKILL.md" || fail "$track ingest missing commit-message downgrade"
  grep -q "Core Query Coverage" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing Core Query Coverage"
  grep -q "high-value" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing high-value object rule"
  grep -q "changed/new high-value objects" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing incremental Core Query Coverage"
  grep -q "Internal layers/main components" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing core object layering question"
  grep -q "Upstream/downstream interactions" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing core object interaction question"
  grep -q "architecture answerability self-check" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing architecture answerability self-check"
  grep -q "generic \`domain/application/infrastructure\` labels" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing generic layer depth guard"

  # Lint must remain read-only while surfacing coverage gaps as suggested ingest work.
  grep -q "without writing" "$base/lint/SKILL.md" || fail "$track lint missing read-only rule"
  grep -q "suggested ingest targets" "$base/lint/SKILL.md" || fail "$track lint missing ingest target output"
  grep -q "coverage gap" "$base/lint/SKILL.md" || fail "$track lint missing coverage gap advisory"
  grep -q "shallow service cards" "$base/lint/SKILL.md" \
    || fail "$track lint missing shallow service-card advisory"
  grep -q "local source refs" "$base/lint/SKILL.md" \
    || fail "$track lint missing local scenario source-ref advisory"
  grep -q "answerability gap" "$base/lint/SKILL.md" || fail "$track lint missing answerability gap reason"
  grep -q "orphan/unreachable shards" "$base/lint/SKILL.md" \
    || fail "$track lint missing orphan shard health check"
  grep -q "missing cross-references" "$base/lint/SKILL.md" \
    || fail "$track lint missing cross-reference health check"
  grep -q "source/data gaps" "$base/lint/SKILL.md" \
    || fail "$track lint missing source gap health check"

  # Compatibility aliases must continue to point at the LLM Wiki-aligned primary skills.
  grep -q "superpowers-memory:query" "$base/load/SKILL.md" || fail "$track load not pointing to query"
  grep -q "superpowers-memory:ingest" "$base/update/SKILL.md" || fail "$track update not pointing to ingest"
  grep -q "superpowers-memory:ingest" "$base/rebuild/SKILL.md" || fail "$track rebuild not pointing to ingest"

  # Templates must route high-value objects to query-answerable owner files or shards.
  grep -q "high-value project objects" "$templates/index.md" \
    || fail "$track index template missing high-value object routing"
  grep -q "CORE QUERY COVERAGE" "$templates/architecture.md" \
    || fail "$track architecture template missing Core Query Coverage"
  grep -q "Interactions:" "$templates/architecture.md" \
    || fail "$track architecture template missing interactions field"
  grep -q "Source refs:" "$templates/architecture.md" \
    || fail "$track architecture template missing source refs field"
  grep -q "design-doc planes/subsystems/workflows/processors/projections" "$templates/architecture.md" \
    || fail "$track architecture template missing design-doc architecture model guidance"
  grep -q "Source refs after each scenario diagram" "$templates/architecture.md" \
    || fail "$track architecture template missing per-scenario source refs guidance"
  grep -q "architecture owner/shard" "$templates/features.md" \
    || fail "$track features template missing architecture owner/shard references"
done

# Runtime hook guidance should mention only primary memory skills, not compatibility names.
for runtime in \
  "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" \
  "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js"; do
  grep -q "superpowers-memory:query" "$runtime" \
    || fail "$runtime missing query guidance"
  grep -q "superpowers-memory:ingest" "$runtime" \
    || fail "$runtime missing ingest guidance"
  if grep -Eq "superpowers-memory:(load|update|rebuild)" "$runtime"; then
    fail "$runtime still mentions compatibility memory skill names"
  fi
done

# Codex compatibility aliases must not route agents back to Claude-track skill files.
for skill in load update rebuild; do
  if grep -Eq '(^|[^[:alnum:]_-])plugins/superpowers-memory/skills/' "$ROOT/codex-plugins/superpowers-memory/skills/$skill/SKILL.md"; then
    fail "Codex $skill alias points to Claude-track skill path"
  fi
done

# Shared content rules must stay identical and include the core query coverage contract.
diff -u "$ROOT/plugins/superpowers-memory/content-rules.md" "$ROOT/codex-plugins/superpowers-memory/content-rules.md" >/dev/null \
  || fail "content-rules differ between Claude and Codex"
grep -q "Core Query Coverage" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing Core Query Coverage"
grep -q "high-value project objects" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing high-value object coverage"

# Skill examples must invoke the matching runtime for each plugin track.
grep -q 'hook-runtime.js" lint' "$ROOT/plugins/superpowers-memory/skills/lint/SKILL.md" \
  || fail "Claude lint skill missing hook-runtime lint command"
grep -q 'codex-runtime.js" lint' "$ROOT/codex-plugins/superpowers-memory/skills/lint/SKILL.md" \
  || fail "Codex lint skill missing codex-runtime lint command"
grep -q 'hook-runtime.js" verify' "$ROOT/plugins/superpowers-memory/skills/ingest/SKILL.md" \
  || fail "Claude ingest skill missing hook-runtime verify command"
grep -q 'codex-runtime.js" verify' "$ROOT/codex-plugins/superpowers-memory/skills/ingest/SKILL.md" \
  || fail "Codex ingest skill missing codex-runtime verify command"

echo "  memory skill surface checks passed"
