#!/usr/bin/env bash
# Validate the remaining implementation/review fixtures and deterministic scorer.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RUNNER="$ROOT/scripts/eval/ddd-expert.js"
RUNNER_TEST="$ROOT/scripts/eval/ddd-expert.test.js"
AUTH_BROKER="$ROOT/scripts/eval/support/codex-auth-fifo-broker.js"
AUTH_BROKER_TEST="$ROOT/scripts/eval/support/codex-auth-fifo-broker.test.js"
CASES_ROOT="$ROOT/evals/ddd-expert/cases"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

node --check "$RUNNER"
node --check "$RUNNER_TEST"
node --check "$AUTH_BROKER"
node --check "$AUTH_BROKER_TEST"
node "$AUTH_BROKER_TEST"
node "$RUNNER" validate
node "$RUNNER_TEST"

rg -q 'const AUTOMATED_PHASES = Object\.freeze\(\["codify", "guard"\]\);' "$RUNNER" ||
  fail "automated ddd-expert evaluator should admit only Codify and Guard cases"
rg -q 'codex-code-mode-host:ro' "$RUNNER" ||
  fail "container evaluator should mount the code-mode host beside Codex"
if node "$RUNNER" self-test >/dev/null 2>&1; then
  fail "retired scorer self-test should not remain a public evaluator command"
fi

if find "$CASES_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'event-storming-*' | grep -q .; then
  fail "EventStorming architecture quality must not be release-gated by answer-or-keyword fixtures"
fi

node - "$CASES_ROOT" <<'NODE'
const fs = require("fs");
const path = require("path");

const casesRoot = process.argv[2];
const directories = fs.readdirSync(casesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (directories.length === 0) throw new Error("ddd-expert eval suite is empty");

const phases = new Set();
for (const directory of directories) {
  const casePath = path.join(casesRoot, directory, "case.json");
  const config = JSON.parse(fs.readFileSync(casePath, "utf8"));
  if (config.id !== directory) throw new Error(`${directory} case id does not match its directory`);
  phases.add(config.phase);
}

for (const expected of ["codify", "guard"]) {
  if (!phases.has(expected)) throw new Error(`ddd-expert eval suite is missing ${expected} coverage`);
}
for (const phase of phases) {
  if (phase !== "codify" && phase !== "guard") {
    throw new Error(`unsupported automated ddd-expert behavior phase: ${phase}`);
  }
}

for (const id of [
  "codify-accepted-go-change",
  "codify-model-ready-direct-handoff",
  "codify-business-request-conflicts-with-model",
  "guard-model-ready-lifecycle-conformance",
  "guard-model-ready-query-violation",
  "guard-missing-model-evidence",
  "guard-outbound-port-structure",
  "guard-tactical-design-claim-drift",
]) {
  if (!directories.includes(id)) throw new Error(`ddd-expert eval suite is missing ${id}`);
}
NODE

node - "$CASES_ROOT" "$ROOT/evals/ddd-expert/result.schema.json" <<'NODE'
const fs = require("fs");
const path = require("path");

const casesRoot = process.argv[2];
const resultSchema = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const readCase = (id) => JSON.parse(fs.readFileSync(path.join(casesRoot, id, "case.json"), "utf8"));

if (!resultSchema.required.includes("architecture_ledger")) {
  throw new Error("Guard result schema must require architecture_ledger");
}
if (resultSchema.properties.verdicts.items.properties.unit_ids.uniqueItems !== true) {
  throw new Error("Guard verdict unit_ids must be unique");
}
if (!resultSchema.properties.routes.items.properties.target.enum.includes("tactical-design")) {
  throw new Error("Guard result routes must admit Tactical Design authority gaps");
}

const compound = readCase("guard-outbound-port-structure");
if (compound.expect.architecture_ledger.min_units < 2 || compound.expect.architecture_ledger.required.length !== 2) {
  throw new Error("compound contract/adapter fixture must require two independently terminal units");
}
if (!compound.expect.architecture_ledger.required.some((row) => row.state === "violation" && row.responsibility === "application") ||
    !compound.expect.architecture_ledger.required.some((row) => row.state === "clear" && row.responsibility === "infrastructure")) {
  throw new Error("compound fixture must keep inner-contract shape separate from adapter fidelity");
}

const reciprocal = readCase("guard-reciprocal-context-imports");
const reciprocalGroups = reciprocal.expect.architecture_ledger.required
  .filter((row) => row.distinct_group === "reciprocal-context-edges");
if (reciprocal.expect.architecture_ledger.min_units < 2 || reciprocalGroups.length !== 2) {
  throw new Error("reciprocal collaboration fixture must keep both dependency edges independently terminal");
}

const tacticalDrift = readCase("guard-tactical-design-claim-drift");
const tacticalWorkspace = path.join(casesRoot, "guard-tactical-design-claim-drift", "workspace");
const tacticalRecord = fs.readFileSync(path.join(tacticalWorkspace, "docs/ddd-expert/tactical-design/settle-account.md"), "utf8");
const tacticalClaim = tacticalDrift.expect.architecture_ledger.required
  .find((row) => row.source_id === "docs/ddd-expert/tactical-design/settle-account.md#TD-001");
if (!tacticalClaim || tacticalClaim.state !== "violation" || tacticalClaim.responsibility !== "application") {
  throw new Error("Tactical Design drift fixture must bind TD-001 to an Application violation");
}
if (!tacticalRecord.includes('<a id="TD-001"></a>TD-001')) {
  throw new Error("Tactical Design drift fixture must expose a navigable TD-001 anchor");
}
if ((tacticalRecord.match(/Operator->>Application: Settle account/g) || []).length !== 2) {
  throw new Error("every Tactical Design fixture sequence must show its initiating intent");
}
if (fs.existsSync(path.join(tacticalWorkspace, "docs/ddd-expert/context/settlement/architecture.md"))) {
  throw new Error("Tactical Design drift fixture must not duplicate Model or House Style in BC Architecture");
}
if (!tacticalDrift.expect.routes.contains.includes("codify") ||
    !tacticalDrift.expect.routes.excludes.includes("tactical-design")) {
  throw new Error("accepted Tactical Design code drift must route to Codify");
}

for (const id of ["guard-model-ready-query-violation", "guard-mysql-migration"]) {
  const negative = readCase(id);
  if (negative.expect.review_conclusion.length !== 1 || negative.expect.review_conclusion[0] !== "clear" || negative.expect.verdicts.length !== 0) {
    throw new Error(`${id} must remain a negative example for ordinary implementation review`);
  }
}
if (readCase("guard-mysql-migration").expect.architecture_ledger.max_units !== 0) {
  throw new Error("migration-only Guard fixture must require an empty architecture ledger");
}

for (const id of fs.readdirSync(casesRoot).filter((entry) => entry.startsWith("guard-") && entry !== "guard-mysql-migration")) {
  const guardCase = readCase(id);
  if (!Array.isArray(guardCase.expect.architecture_ledger.required) || guardCase.expect.architecture_ledger.required.length === 0) {
    throw new Error(`${id} must bind its Guard oracle to source-backed architecture assertions`);
  }
}
NODE

legacy_artifact_refs="$(rg -n \
  'docs/ddd/|docs/design\.md|docs/domain\.md|docs/ddd-expert/(model|design)\.md' \
  "$CASES_ROOT" --glob '**/prompt.md' --glob '**/workspace/**' || true)"
if [ -n "$legacy_artifact_refs" ]; then
  printf '%s\n' "$legacy_artifact_refs" >&2
  fail "ddd-expert eval inputs should use the canonical per-context artifact layout"
fi

while IFS= read -r model; do
  rg -q '^model_revision: [1-9][0-9]*$' "$model" ||
    fail "canonical eval Model lacks a positive model_revision: $model"
  status="$(sed -n 's/^model_status: //p' "$model")"
  case "$status" in
    model_ready|draft) ;;
    *) fail "canonical eval Model has invalid status '$status': $model" ;;
  esac
  case "$model" in
    */codify-requires-model-ready/*)
      [ "$status" = "draft" ] ||
        fail "negative readiness fixture must remain unconfirmed: $model"
      ;;
    *)
      [ "$status" = "model_ready" ] ||
        fail "Codify/Guard authority must be a confirmed model_ready Model: $model"
      ;;
  esac
done < <(find "$CASES_ROOT" -path '*/workspace/docs/ddd-expert/context/*/model.md' -type f)

if find "$CASES_ROOT" -type f -name 'design.md' | grep -q .; then
  fail "retired root design.md artifacts must not appear in ddd-expert evals"
fi

readiness_refs="$(rg -n 'design_' "$CASES_ROOT" || true)"
if [ -n "$readiness_refs" ]; then
  printf '%s\n' "$readiness_refs" >&2
  fail "ddd-expert evals must use model_ready Models as direct authority"
fi

echo "PASS ddd-expert deterministic eval checks"
