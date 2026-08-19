#!/usr/bin/env bash
# Validate sparse modeling, implementation, and review fixtures plus the deterministic scorer.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RUNNER="$ROOT/scripts/eval/ddd-expert.js"
RUNNER_TEST="$ROOT/scripts/eval/ddd-expert.test.js"
AUTH_BROKER="$ROOT/scripts/eval/support/codex-auth-fifo-broker.js"
AUTH_BROKER_TEST="$ROOT/scripts/eval/support/codex-auth-fifo-broker.test.js"
CASES_ROOT="$ROOT/evals/ddd-expert/cases"
CONTEXT_MAP_VALIDATOR="$ROOT/plugins/ddd-expert/scripts/validate-context-map.mjs"

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

rg -q 'const AUTOMATED_PHASES = Object\.freeze\(\["event-storming", "tactical-design", "codify", "guard"\]\);' "$RUNNER" ||
  fail "evaluator must admit all four ddd-expert phases"
rg -q 'codex-code-mode-host:ro' "$RUNNER" ||
  fail "container evaluator should mount the code-mode host beside Codex"
rg -q 'ask exactly one model-changing question at a time' "$ROOT/evals/ddd-expert/README.md" ||
  fail "EventStorming eval boundary must preserve one-question interaction"
rg -q 'Root A, its Entities' "$ROOT/evals/ddd-expert/README.md" ||
  fail "Tactical Design eval boundary must preserve depth-first discussion"
rg -q 'receiver-shaped drift' "$ROOT/evals/ddd-expert/README.md" ||
  fail "Codify and Guard evals must cover method ownership"

decisive_prompt="$CASES_ROOT/event-storming-asks-decisive-business-question/prompt.md"
purpose_prompt="$CASES_ROOT/event-storming-clarifies-purpose/prompt.md"
for leaked_instruction in 'exactly one' 'do not infer' 'do not write'; do
  if rg -qi "$leaked_instruction" "$decisive_prompt"; then
    fail "EventStorming prompt discloses hidden pass condition: $leaked_instruction"
  fi
done
for leaked_instruction in 'one question' 'do not choose' 'do not modify' 'process-compliance'; do
  if rg -qi "$leaked_instruction" "$purpose_prompt"; then
    fail "EventStorming purpose prompt discloses hidden pass condition: $leaked_instruction"
  fi
done
if node "$RUNNER" self-test >/dev/null 2>&1; then
  fail "retired scorer self-test should not remain public"
fi

node - "$CASES_ROOT" "$ROOT/evals/ddd-expert/result.schema.json" <<'NODE'
const fs = require("fs");
const path = require("path");

const casesRoot = process.argv[2];
const resultSchema = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const directories = fs.readdirSync(casesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const readCase = (id) => JSON.parse(fs.readFileSync(path.join(casesRoot, id, "case.json"), "utf8"));

const requiredCases = [
  "event-storming-asks-decisive-business-question",
  "event-storming-clarifies-purpose",
  "tactical-design-asks-one-object-question",
  "tactical-design-writes-confirmed-root",
  "codify-accepted-model-and-objects",
  "codify-business-request-conflicts-with-model",
  "codify-deletes-obsolete-mechanism",
  "codify-requires-domain-objects",
  "guard-domain-lifecycle-conformance",
  "guard-domain-object-behavior-drift",
  "guard-missing-model-evidence",
  "guard-outbound-port-structure",
  "guard-query-check-is-not-domain-violation",
  "guard-reciprocal-context-imports",
];
for (const id of requiredCases) {
  if (!directories.includes(id)) throw new Error(`ddd-expert eval suite is missing ${id}`);
}

const phases = new Set();
for (const directory of directories) {
  const config = readCase(directory);
  if (config.id !== directory) throw new Error(`${directory} case id does not match its directory`);
  phases.add(config.phase);
}
for (const phase of ["event-storming", "tactical-design", "codify", "guard"]) {
  if (!phases.has(phase)) throw new Error(`ddd-expert eval suite is missing ${phase} coverage`);
}
if ([...phases].some((phase) => !["event-storming", "tactical-design", "codify", "guard"].includes(phase))) {
  throw new Error("ddd-expert eval suite contains an unsupported phase");
}

if (!resultSchema.required.includes("architecture_ledger")) {
  throw new Error("Guard result schema must require its ephemeral review ledger");
}
if (resultSchema.properties.verdicts.items.properties.unit_ids.uniqueItems !== true) {
  throw new Error("Guard verdict unit_ids must be unique");
}
if (!resultSchema.properties.routes.items.properties.target.enum.includes("tactical-design")) {
  throw new Error("result routes must admit Tactical Design authority gaps");
}

for (const id of ["event-storming-clarifies-purpose", "event-storming-asks-decisive-business-question"]) {
  const eventCase = readCase(id);
  if (eventCase.expect.questions.min !== 1 || eventCase.expect.questions.max !== 1 ||
      eventCase.expect.git.changed !== "none" || eventCase.expect.routes.contains.length !== 0) {
    throw new Error(`${id} must assert one question, zero writes, and no downstream route`);
  }
}

const tacticalQuestion = readCase("tactical-design-asks-one-object-question");
if (tacticalQuestion.expect.questions.min !== 1 || tacticalQuestion.expect.questions.max !== 1 ||
    tacticalQuestion.expect.git.changed !== "none" ||
    !tacticalQuestion.expect.git.forbidden_paths.includes("docs/ddd-expert/context/billing/domain-objects.md")) {
  throw new Error("unresolved Tactical Design must ask one question and write nothing");
}

const tacticalWrite = readCase("tactical-design-writes-confirmed-root");
const tacticalFile = tacticalWrite.expect.files.find((file) => file.path.endsWith("domain-objects.md"));
if (tacticalWrite.expect.questions.max !== 0 ||
    tacticalWrite.expect.git.allowed_paths.join("\0") !== "docs/ddd-expert/context/billing/domain-objects.md" ||
    !tacticalFile?.contains.includes("## Credit Note") || !tacticalFile?.contains.includes("## Invoice") ||
    !tacticalFile?.contains.includes("### Payment Attempt — Entity (`PaymentAttemptID`)") ||
    !tacticalFile?.contains.includes("`Invoice Settled`") ||
    !tacticalFile?.excludes.includes("sequenceDiagram")) {
  throw new Error("confirmed Tactical Design must update one Root slice while preserving prior Roots");
}

const accepted = readCase("codify-accepted-model-and-objects");
const acceptedFile = accepted.expect.files.find((file) => file.path === "internal/order/domain/order.go");
if (!acceptedFile?.contains.includes("func (o *Order) Rename") ||
    !acceptedFile?.excludes.includes("func RenameOrder(") ||
    !accepted.expect.git.forbidden_paths.includes("docs/ddd-expert")) {
  throw new Error("Codify accepted behavior fixture must require the owning receiver and read-only artifacts");
}

const missingObjects = readCase("codify-requires-domain-objects");
if (!missingObjects.expect.routes.contains.includes("tactical-design") || missingObjects.expect.git.changed !== "none") {
  throw new Error("Codify must stop and route missing object ownership to Tactical Design");
}

const conflict = readCase("codify-business-request-conflicts-with-model");
if (!conflict.expect.routes.contains.includes("event-storming") || conflict.expect.git.changed !== "none") {
  throw new Error("Codify must route changed business meaning back to EventStorming");
}

const deletion = readCase("codify-deletes-obsolete-mechanism");
const deletionWorkspace = path.join(casesRoot, deletion.id, "workspace");
const deletionTest = fs.readFileSync(path.join(deletionWorkspace, "internal/billing/invoice_test.go"), "utf8");
if (deletion.expect.routes.contains.length !== 0 ||
    !deletion.expect.git.allowed_paths.includes("internal/billing/invoice.go") ||
    !deletion.expect.checks.some((check) => check.argv.join(" ") === "go test ./...") ||
    !deletionTest.includes('parser.ParseFile(token.NewFileSet(), "invoice.go"') ||
    !deletionTest.includes("unexpected package-level declaration")) {
  throw new Error("semantic deletion must reject renamed carriers and complete under accepted design");
}

const methodDrift = readCase("guard-domain-object-behavior-drift");
const methodUnit = methodDrift.expect.architecture_ledger.required.find((row) =>
  row.source_id === "docs/ddd-expert/context/settlement/domain-objects.md#Account");
const methodCode = fs.readFileSync(path.join(casesRoot, methodDrift.id,
  "workspace/internal/settlement/domain/account.go"), "utf8");
if (!methodUnit || methodUnit.state !== "violation" || methodUnit.responsibility !== "domain" ||
    !methodCode.includes("func SettleAccount(account *Account") ||
    !methodDrift.expect.routes.contains.includes("codify")) {
  throw new Error("Guard must detect receiver-shaped free-function drift");
}

const compound = readCase("guard-outbound-port-structure");
if (compound.expect.architecture_ledger.min_units < 2 ||
    !compound.expect.architecture_ledger.required.some((row) => row.state === "violation" && row.responsibility === "application") ||
    !compound.expect.architecture_ledger.required.some((row) => row.state === "clear" && row.responsibility === "infrastructure")) {
  throw new Error("Guard must keep inner-contract and adapter judgments independent");
}

const reciprocal = readCase("guard-reciprocal-context-imports");
if (reciprocal.expect.architecture_ledger.required
    .filter((row) => row.distinct_group === "reciprocal-context-edges").length !== 2) {
  throw new Error("reciprocal dependency fixture must keep both edges independently terminal");
}

for (const id of ["guard-query-check-is-not-domain-violation", "guard-mysql-migration"]) {
  const negative = readCase(id);
  if (negative.expect.review_conclusion.join() !== "clear" || negative.expect.verdicts.length !== 0) {
    throw new Error(`${id} must remain a negative example for ordinary implementation concerns`);
  }
}
if (readCase("guard-mysql-migration").expect.architecture_ledger.max_units !== 0) {
  throw new Error("migration-only Guard fixture must require no semantic review unit");
}

for (const id of directories.filter((entry) => entry.startsWith("guard-") && entry !== "guard-mysql-migration")) {
  const guardCase = readCase(id);
  if (!Array.isArray(guardCase.expect.architecture_ledger.required) || guardCase.expect.architecture_ledger.required.length === 0) {
    throw new Error(`${id} must bind its Guard oracle to source-backed assertions`);
  }
}
NODE

stale_refs="$(rg -n \
  'model_revision|model_status|last_changed_by|model-ready|model_ready|docs/ddd-expert/(event-storming|tactical-design)/|architecture\.md|sequenceDiagram|classDiagram|reconcil|projection' \
  "$CASES_ROOT" --glob '**/prompt.md' --glob '**/workspace/docs/**' || true)"
if [ -n "$stale_refs" ]; then
  printf '%s\n' "$stale_refs" >&2
  fail "eval fixtures retain retired artifact lifecycle or diagram machinery"
fi

if find "$CASES_ROOT" -path '*/workspace/docs/ddd-expert/README.md' -type f | grep -q .; then
  fail "eval fixtures must not carry the retired DDD artifact README"
fi

while IFS= read -r context_map; do
  node "$CONTEXT_MAP_VALIDATOR" "$context_map" >/dev/null ||
    fail "invalid sparse Context Map: $context_map"
done < <(find "$CASES_ROOT" -path '*/workspace/docs/ddd-expert/context-map.md' -type f | sort)

while IFS= read -r model; do
  for heading in Purpose 'Essential Language' 'Aggregate Roots' 'Business Rules'; do
    rg -q "^## $heading$" "$model" || fail "sparse Model lacks $heading: $model"
  done
  if rg -q '^## (Scenarios|Lifecycle|Model Realization|Persistence|Architecture|Domain Events|Entities)' "$model"; then
    fail "strategic Model contains tactical or implementation detail: $model"
  fi

  object_file="$(dirname "$model")/domain-objects.md"
  case "$model" in
    */tactical-design-asks-one-object-question/*|*/codify-requires-domain-objects/*)
      [ ! -e "$object_file" ] || fail "negative fixture unexpectedly has domain objects: $object_file"
      ;;
    *)
      [ -f "$object_file" ] || fail "Codify/Guard fixture lacks current domain objects: $object_file"
      ;;
  esac
done < <(find "$CASES_ROOT" -path '*/workspace/docs/ddd-expert/context/*/model.md' -type f | sort)

while IFS= read -r objects; do
  for field in Definition State Behavior; do
    rg -q "\*\*$field:\*\*" "$objects" || fail "domain objects lack $field: $objects"
  done
  if rg -q '^## (Responsibilities|Lifecycle|Collaboration|Callers|Impact|Sequence)|status:|revision:' "$objects"; then
    fail "domain objects contain retired verbose sections: $objects"
  fi
done < <(find "$CASES_ROOT" -path '*/workspace/docs/ddd-expert/context/*/domain-objects.md' -type f | sort)

echo "PASS ddd-expert deterministic eval checks"
