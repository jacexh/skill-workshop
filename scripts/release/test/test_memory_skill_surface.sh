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
  rules="$ROOT/$track/superpowers-memory/content-rules.md"
  readme="$ROOT/$track/superpowers-memory/README.md"

  ! sed -n '1,5p' "$rules" | grep -Eq '`rebuild`|`update`' \
    || fail "$track content-rules intro must mention current maintenance skills"

  # Only primary memory skills are published in both plugin tracks.
  for skill in query ingest lint; do
    [ -f "$base/$skill/SKILL.md" ] || fail "$track missing $skill skill"
  done
  [ ! -e "$base/cleanup" ] || fail "$track must not publish cleanup skill"
  [ ! -f "$base/load/SKILL.md" ] || fail "$track must not publish load skill"
  [ ! -f "$base/update/SKILL.md" ] || fail "$track must not publish update skill"
  [ ! -f "$base/rebuild/SKILL.md" ] || fail "$track must not publish rebuild skill"

  # Query must stay read-only while producing actionable ingest candidates for coverage gaps.
  grep -q "read-only" "$base/query/SKILL.md" || fail "$track query missing read-only rule"
  grep -q "docs/superpowers/memory" "$base/query/SKILL.md" \
    || fail "$track query missing canonical memory path"
  grep -q "Memory candidate" "$base/query/SKILL.md" || fail "$track query missing Memory candidate"
  grep -q "Missing answerability coverage" "$base/query/SKILL.md" \
    || fail "$track query missing answerability Memory candidate"
  grep -q "Suggested owner/shard" "$base/query/SKILL.md" \
    || fail "$track query missing suggested owner/shard"
  grep -q "durable synthesis" "$base/query/SKILL.md" \
    || fail "$track query missing durable synthesis candidate"
  grep -q "spec/plan/ADR" "$base/query/SKILL.md" \
    || fail "$track query missing durable-source routing guidance"
  grep -q "conversation is not a KB slot" "$base/query/SKILL.md" \
    || fail "$track query missing conversation non-slot rule"
  grep -q "Candidate type" "$base/query/SKILL.md" \
    || fail "$track query missing Memory candidate type"
  grep -Eiq "no concrete question|no-question|no question" "$base/query/SKILL.md" \
    || fail "$track query missing no-question orientation behavior"
  grep -Eiq "orient" "$base/query/SKILL.md" \
    || fail "$track query missing orientation behavior"
  grep -q "Question classification" "$base/query/SKILL.md" \
    || fail "$track query missing question classification stage"
  grep -q "Retrieval route" "$base/query/SKILL.md" \
    || fail "$track query missing retrieval route output"
  grep -q "Skipped" "$base/query/SKILL.md" \
    || fail "$track query missing skipped-source reporting"
  grep -q "Code search seeds" "$base/query/SKILL.md" \
    || fail "$track query missing code search seed output"
  ! grep -Fq "log.md" "$base/query/SKILL.md" \
    || fail "$track query must not mention log.md"

  # Ingest must support full rebuilds and add targeted coverage for high-value query objects.
  grep -q "docs/superpowers/memory" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing canonical memory path"
  grep -q "bootstrap" "$base/ingest/SKILL.md" || fail "$track ingest missing bootstrap mode"
  grep -q "full-refresh" "$base/ingest/SKILL.md" || fail "$track ingest missing full-refresh mode"
  ! grep -Eq "superpowers-memory:(load|update|rebuild)" "$base/ingest/SKILL.md" \
    || fail "$track ingest still documents removed compatibility skills"
  grep -q "Maintenance Timing Gate" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing maintenance timing gate"
  grep -q "Default behavior: do not ingest" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing default-no-ingest rule"
  grep -q "only at a maintenance checkpoint" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing maintenance checkpoint rule"
  grep -q "user explicitly asks" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing explicit-user-request timing"
  grep -q "finishing, committing, opening a PR, merging, or switching tasks" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing finish/commit/PR/merge/switch timing"
  grep -q "KB is missing or damaged" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing bootstrap/repair timing"
  grep -q "pending Memory candidate" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing deferred Memory candidate rule"
  grep -q "Memory Candidate Gate" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing Memory Candidate Gate"
  grep -q "Diff Budget" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing Diff Budget"
  diff_budget_step="$(grep -n "Apply the Diff Budget" "$base/ingest/SKILL.md" | head -n1 | cut -d: -f1 || true)"
  lock_step="$(grep -n "Acquire the write lock" "$base/ingest/SKILL.md" | head -n1 | cut -d: -f1 || true)"
  update_step="$(grep -n "Update only affected owner files" "$base/ingest/SKILL.md" | head -n1 | cut -d: -f1 || true)"
  [ -n "$diff_budget_step" ] && [ -n "$lock_step" ] && [ "$diff_budget_step" -lt "$lock_step" ] \
    || fail "$track ingest must apply Diff Budget before acquiring the write lock"
  [ -n "$diff_budget_step" ] && [ -n "$update_step" ] && [ "$diff_budget_step" -lt "$update_step" ] \
    || fail "$track ingest must apply Diff Budget before updating KB files"
  grep -q "ADR History Protection" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing ADR History Protection"
  grep -q "not a full LLM Wiki" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing non-wiki scope rule"
  grep -q "knowledge graph, vector search, BM25 search, automatic confidence scoring, automatic forgetting, session-end auto-crystallization, or multi-agent sync" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing heavy LLM Wiki exclusion list"
  ! grep -q "default after a spec, plan, PR, or implementation branch" "$base/ingest/SKILL.md" \
    || fail "$track ingest still treats normal work as an automatic trigger"
  grep -q "weak hints" "$base/ingest/SKILL.md" || fail "$track ingest missing commit-message downgrade"
  grep -q "specs/plans/ADRs are the primary raw sources" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing primary raw-source rule"
  grep -q "Conversation/chat/transcript is not a Project Knowledge slot" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing conversation non-slot rule"
  grep -q "Core Query Coverage" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing Core Query Coverage"
  grep -q "Feature Query Coverage" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing feature query coverage"
  grep -q "Decision Query Coverage" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing decision query coverage"
  grep -q "Reference Query Coverage" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing reference query coverage"
  grep -q "high-value" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing high-value object rule"
  grep -q "changed/new high-value objects" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing incremental Core Query Coverage"
  grep -q "Skip ingest for deployment-only, image/tag/version-only" "$base/ingest/SKILL.md" \
    && grep -q "comment-only changes" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing low-value change skip rule"
  grep -q "Impact Radius" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing incremental Impact Radius"
  grep -q "Topic-scope refresh" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing topic-scope refresh mode"
  grep -q "Related owner sweep" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing related owner sweep"
  grep -q "targeted lint" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing targeted lint after incremental ingest"
  grep -q "Escalate to topic-scope refresh" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing topic refresh escalation trigger"
  grep -q "Rebuild decision and glossary routers" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing decision/glossary rebuild compatibility guidance"
  grep -q "decisions-<domain>.md" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing decision shard rebuild guidance"
  grep -q "glossary-<domain>.md" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing glossary shard rebuild guidance"
  grep -q "Internal layers/main components" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing core object layering question"
  grep -q "Upstream/downstream interactions" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing core object interaction question"
  grep -q "architecture answerability self-check" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing architecture answerability self-check"
  grep -q "generic \`domain/application/infrastructure\` labels" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing generic layer depth guard"
  grep -q "architecture-<module>.md" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing module architecture shard guidance"
  grep -q "architecture-<scenario>.md" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing named scenario shard guidance"
  grep -q "architecture-module.md" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing dedicated module template guidance"
  grep -q "architecture-scenario.md" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing dedicated scenario template guidance"
  grep -q "Module refs" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing scenario-to-module reference guidance"
  grep -q "Scenario refs" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing module-to-scenario reference guidance"
  grep -q "Authority boundaries" "$base/ingest/SKILL.md" \
    || fail "$track ingest missing scenario authority boundary guidance"
  ! grep -Fq "log.md" "$base/ingest/SKILL.md" \
    || fail "$track ingest must not mention log.md"
  ! grep -Fq "## [YYYY-MM-DD] ingest |" "$base/ingest/SKILL.md" \
    || fail "$track ingest must not define log heading contract"
  if grep -Eq '^- `architecture-(contexts|flows)\.md` —' "$base/ingest/SKILL.md"; then
    fail "$track ingest still recommends legacy architecture view shards"
  fi

  # Lint must remain read-only while surfacing coverage gaps as suggested ingest work.
  grep -q "without writing" "$base/lint/SKILL.md" || fail "$track lint missing read-only rule"
  ! grep -q "except for the legacy" "$base/lint/SKILL.md" \
    || fail "$track lint must remain read-only and route migrations through ingest"
  grep -q "docs/superpowers/memory" "$base/lint/SKILL.md" \
    || fail "$track lint missing canonical memory path"
  grep -q "suggested ingest targets" "$base/lint/SKILL.md" || fail "$track lint missing ingest target output"
  grep -q "coverage gap" "$base/lint/SKILL.md" || fail "$track lint missing coverage gap advisory"
  grep -q "shallow service cards" "$base/lint/SKILL.md" \
    || fail "$track lint missing shallow service-card advisory"
  grep -q "local source refs" "$base/lint/SKILL.md" \
    || fail "$track lint missing local scenario source-ref advisory"
  grep -q "answerability gap" "$base/lint/SKILL.md" || fail "$track lint missing answerability gap reason"
  grep -q "legacy view shards" "$base/lint/SKILL.md" \
    || fail "$track lint missing legacy architecture shard advisory"
  grep -q "module/scenario cross-references" "$base/lint/SKILL.md" \
    || fail "$track lint missing module/scenario cross-reference advisory"
  grep -q "scenario authority/order/failure" "$base/lint/SKILL.md" \
    || fail "$track lint missing scenario semantic field advisory"
  grep -q "feature product/workflow coverage" "$base/lint/SKILL.md" \
    || fail "$track lint missing feature product/workflow advisory"
  grep -q "decision detail/trade-off routing" "$base/lint/SKILL.md" \
    || fail "$track lint missing decision routing advisory"
  grep -q "reference owner/source gaps" "$base/lint/SKILL.md" \
    || fail "$track lint missing non-architecture reference advisory"
  grep -q "orphan/unreachable shards" "$base/lint/SKILL.md" \
    || fail "$track lint missing orphan shard health check"
  grep -q "missing cross-references" "$base/lint/SKILL.md" \
    || fail "$track lint missing cross-reference health check"
  grep -q "source/data gaps" "$base/lint/SKILL.md" \
    || fail "$track lint missing source gap health check"
  grep -q "topic-scope refresh" "$base/lint/SKILL.md" \
    || fail "$track lint missing topic refresh escalation guidance"
  grep -q "affected routing" "$base/lint/SKILL.md" \
    || fail "$track lint missing decision affected routing advisory"
  ! grep -Fq "log.md" "$base/lint/SKILL.md" \
    || fail "$track lint must not mention log.md"

  # Templates must route high-value objects to query-answerable owner files or shards.
  grep -q "docs/superpowers/memory" "$readme" \
    || fail "$track README missing canonical memory path"
  ! grep -Eq "superpowers-memory:(load|update|rebuild)" "$readme" \
    || fail "$track README still documents removed compatibility skills"
  grep -q "noncanonical_memory_infrastructure_slot" "$readme" \
    || fail "$track README missing noncanonical memory infrastructure verify finding"
  grep -q "high-value project objects" "$templates/index.md" \
    || fail "$track index template missing high-value object routing"
  grep -q "architecture-<module>.md" "$templates/index.md" \
    || fail "$track index template missing module architecture shard route"
  grep -q "architecture-<scenario>.md" "$templates/index.md" \
    || fail "$track index template missing scenario architecture shard route"
  grep -q "CORE QUERY COVERAGE" "$templates/architecture.md" \
    || fail "$track architecture template missing Core Query Coverage"
  grep -q "module-first" "$templates/architecture.md" \
    || fail "$track architecture template missing module-first guidance"
  grep -q "named scenario" "$templates/architecture.md" \
    || fail "$track architecture template missing named scenario guidance"
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
  grep -q "Feature Query Coverage" "$templates/features.md" \
    || fail "$track features template missing feature query coverage"
  grep -q "user workflow" "$templates/features.md" \
    || fail "$track features template missing workflow answerability"
  grep -q "Decision Query Coverage" "$templates/decisions.md" \
    || fail "$track decisions template missing decision query coverage"
  ! grep -q "Known Issues" "$templates/decisions.md" \
    || fail "$track decisions template must not seed wrong-owner known issues"
  grep -q "Decision index / ADR summaries" "$templates/index.md" \
    || fail "$track index template must describe decisions.md as decision routing"
  ! grep -q "ADR log.*known issues" "$templates/index.md" \
    || fail "$track index template must not route known issues to decisions.md"
  grep -q "affects modules" "$templates/decisions.md" \
    || fail "$track decisions template missing affected-module routing"
  grep -q "Reference Query Coverage" "$templates/conventions.md" \
    || fail "$track conventions template missing reference query coverage"
  grep -q "Reference Query Coverage" "$templates/glossary.md" \
    || fail "$track glossary template missing reference query coverage"
  grep -q "Reference Query Coverage" "$templates/tech-stack.md" \
    || fail "$track tech-stack template missing reference query coverage"
  [ ! -f "$templates/log.md" ] \
    || fail "$track must not ship log.md template"
  ! grep -Fq '`log.md`' "$rules" \
    || fail "$track content rules must not define log.md slot"
  ! grep -q "log_event_not_ingest_owned" "$rules" \
    || fail "$track content rules must not define log verification"

  # Dedicated shard templates should make module/scenario files stronger than
  # loose copies of architecture.md sections.
  [ -f "$templates/architecture-module.md" ] \
    || fail "$track missing architecture-module.md template"
  [ -f "$templates/architecture-scenario.md" ] \
    || fail "$track missing architecture-scenario.md template"
  grep -q "Internal Architecture Model" "$templates/architecture-module.md" \
    || fail "$track module template missing internal architecture model"
  grep -q "Scenario refs" "$templates/architecture-module.md" \
    || fail "$track module template missing scenario refs"
  grep -q "Authority Boundaries" "$templates/architecture-scenario.md" \
    || fail "$track scenario template missing authority boundaries"
  grep -q "Ordering / Idempotency / Failure Rules" "$templates/architecture-scenario.md" \
    || fail "$track scenario template missing ordering/idempotency/failure rules"
  grep -q "Module refs" "$templates/architecture-scenario.md" \
    || fail "$track scenario template missing module refs"
done

# Runtime hook guidance should mention only primary memory skills, not compatibility names.
for runtime in \
  "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" \
  "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js"; do
  grep -q "superpowers-memory:query" "$runtime" \
    || fail "$runtime missing query guidance"
  grep -q "superpowers-memory:ingest" "$runtime" \
    || fail "$runtime missing ingest guidance"
  grep -q "durable project knowledge" "$runtime" \
    || fail "$runtime missing durable-knowledge ingest gate"
  grep -q "Default behavior is no ingest" "$runtime" \
    || fail "$runtime missing default-no-ingest runtime guidance"
  grep -q "maintenance checkpoint" "$runtime" \
    || fail "$runtime missing maintenance checkpoint runtime guidance"
  ! grep -q "If durable project knowledge changed, invoke" "$runtime" \
    || fail "$runtime still auto-invokes ingest on durable changes"
  ! grep -q "only for meaningful durable project knowledge changes" "$runtime" \
    || fail "$runtime still frames stale changes as an ingest trigger"
  ! grep -q "log_event_not_ingest_owned" "$runtime" \
    || fail "$runtime must not validate log.md events"
  ! grep -q 'filename === "log.md"' "$runtime" \
    || fail "$runtime must not recognize log.md as a KB slot"
  if grep -Eq "superpowers-memory:(load|update|rebuild)" "$runtime"; then
    fail "$runtime still mentions compatibility memory skill names"
  fi
done

# Shared content rules must stay identical and include the core query coverage contract.
diff -u "$ROOT/plugins/superpowers-memory/content-rules.md" "$ROOT/codex-plugins/superpowers-memory/content-rules.md" >/dev/null \
  || fail "content-rules differ between Claude and Codex"
grep -q "Core Query Coverage" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing Core Query Coverage"
grep -q "high-value project objects" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing high-value object coverage"
grep -q "module-first" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing module-first architecture split rule"
grep -q "named scenario" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing named scenario architecture split rule"
grep -q "architecture-module.md" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing dedicated module template"
grep -q "architecture-scenario.md" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing dedicated scenario template"
grep -q "Conversation is not a KB slot" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing conversation non-slot rule"
grep -q "Feature Query Coverage" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing feature query coverage"
grep -q "Decision Query Coverage" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing decision query coverage"
grep -q "Reference Query Coverage" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing reference query coverage"
grep -q "Query Routing Output" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing query routing output contract"
grep -q "Decision Router Rebuild" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing decision router rebuild guidance"
grep -q "Glossary Alias Router Rebuild" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing glossary alias router rebuild guidance"
grep -q "Incremental Ingest Guardrails" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing incremental ingest guardrails"
grep -q "Memory Candidate Gate" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing Memory Candidate Gate"
grep -q "Diff Budget" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing Diff Budget"
grep -q "ADR History Protection" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing ADR History Protection"
grep -q "not a full LLM Wiki" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing non-wiki scope rule"
grep -q "knowledge graph, vector search, BM25 search, automatic confidence scoring, automatic forgetting, session-end auto-crystallization, or multi-agent sync" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing heavy LLM Wiki exclusion list"
grep -q "noncanonical_memory_infrastructure_slot" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing noncanonical memory infrastructure verify finding"
grep -q "Impact Radius" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing impact radius"
grep -q "Topic-scope refresh" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing topic-scope refresh"
grep -q "Escalation Triggers" "$ROOT/plugins/superpowers-memory/content-rules.md" \
  || fail "content-rules missing escalation triggers"
if grep -Eq '^- `architecture-(contexts|flows)\.md` —' "$ROOT/plugins/superpowers-memory/content-rules.md"; then
  fail "content-rules still recommends legacy architecture view shards"
fi

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
