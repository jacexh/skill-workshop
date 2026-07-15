#!/usr/bin/env bash
# Validate ddd-expert behavior fixtures and the deterministic scorer without a model call.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RUNNER="$ROOT/scripts/eval/ddd-expert.js"
AUTH_BROKER="$ROOT/scripts/eval/support/codex-auth-fifo-broker.js"
AUTH_BROKER_TEST="$ROOT/scripts/eval/support/codex-auth-fifo-broker.test.js"
CASES_ROOT="$ROOT/evals/ddd-expert/cases"
CONTEXT_MAP_VALIDATOR="$ROOT/plugins/ddd-expert/scripts/validate-context-map.mjs"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

node --check "$RUNNER"
node --check "$AUTH_BROKER"
node --check "$AUTH_BROKER_TEST"
node "$AUTH_BROKER_TEST"
node "$RUNNER" validate
node "$RUNNER" self-test

node - "$RUNNER" <<'NODE'
const fs = require("fs");

const runner = fs.readFileSync(process.argv[2], "utf8");
for (const [pattern, label] of [
  [/const RUNNER_FILES = \[__filename, AUTH_BROKER\];/u, "broker source fingerprint"],
  [/filter:\s*\(source\)\s*=>\s*path\.resolve\(source\)\s*!==\s*installedAuth/u, "auth-excluding trial-home copy"],
  [/trial home copied the retained auth source before broker startup/u, "absent trial-home auth assertion"],
  [/\{ stdio: \["pipe", "pipe", "pipe"\] \}/u, "broker parent-liveness pipe"],
  [/["'`]\$\{authFile\}:\/eval-home\/auth\.json:ro["'`]/u, "read-only nested FIFO bind"],
  [/event\.type !== ["']thread\.started["']/u, "thread.started compatibility cutoff"],
  [/verifyEmptyAuthFifo\(authFile, fifoIdentity\)/u, "post-run empty FIFO verification"],
  [/startManagedDockerContainerAsync\(executionArgs/u, "asynchronous managed Docker execution"],
  [/ACTIVE_ASYNC_DOCKER_CONTROLLERS\.add\(controller\)/u, "active async Docker controller registry"],
  [/process\.on\("SIGINT"[\s\S]*process\.on\("SIGTERM"/u, "runner termination handlers"],
  [/await cleanupActiveEvaluatorResources\(\)/u, "top-level container and runtime cleanup"],
  [/function buildContinuationPrompt\(loadedCase, firstResult\)/u, "explicit two-turn continuation prompt"],
  [/continuationMode: "explicit-prompt-same-workspace"/u, "declared two-turn continuation mode"],
  [/function inspectCaseInputPath\(caseDir, relative, label, expectedType\)/u, "real-path fixture isolation"],
  [/sameFilesystemObject\(answerInput, promptInput\)/u, "answer inode isolation"],
  [/files: firstTurn\.files \|\| \[\]/u, "first-turn file-content scoring"],
  [/checks: firstTurn\.checks \|\| \[\]/u, "first-turn verification scoring"],
  [/const normalizedQuestionEntries = result\.questions\.map/u, "per-entry question semantic scoring"],
]) {
  if (!pattern.test(runner)) {
    throw new Error(`runner is missing the ${label} seam`);
  }
}
if (/runManagedDockerContainer\(executionArgs/u.test(runner)) {
  throw new Error("model trial still uses the synchronous Docker runner");
}
if (/focusedQuestionFindings|questionMarks\s*=|first question is a single question/u.test(runner)) {
  throw new Error("runner still scores question punctuation or a fixed one-decision sentence shape");
}
NODE

node - "$CASES_ROOT" <<'NODE'
const fs = require("fs");
const path = require("path");

const casesRoot = process.argv[2];
const readCase = (id) => JSON.parse(fs.readFileSync(path.join(casesRoot, id, "case.json"), "utf8"));
const allCases = fs.readdirSync(casesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => readCase(entry.name));
const completedStrategicCases = allCases
  .filter((config) => config.phase === "event-storming" &&
    config.expect.completion.includes("completed") &&
    config.expect.files.some((item) => item.path.endsWith("/model.md")) &&
    !config.expect.files.some((item) => item.path.endsWith("/design.md")));
for (const config of completedStrategicCases) {
  const id = config.id;
  const dddArtifacts = config.expect.files.filter((item) => item.path.startsWith("docs/ddd-expert/"));
  const assertedPaths = new Set(dddArtifacts.map((item) => item.path));
  const allowedPaths = config.expect.git.allowed_paths;
  if (!Array.isArray(allowedPaths)) {
    throw new Error(`${id} must declare an exact artifact write set`);
  }
  if ([...assertedPaths].some((item) => !allowedPaths.includes(item))) {
    throw new Error(`${id} must allow every asserted DDD artifact`);
  }
  for (const allowedPath of allowedPaths) {
    if (!/^docs\/ddd-expert\/(?:README\.md|context-map\.md|context\/[a-z0-9-]+\/(?:model|design)\.md)$/u.test(allowedPath)) {
      throw new Error(`${id} allows non-canonical EventStorming artifact ${allowedPath}`);
    }
  }
  for (const artifact of dddArtifacts) {
    if (artifact.forbid_temporary_trace !== true) {
      throw new Error(`${id} does not forbid temporary discovery traces in ${artifact.path}`);
    }
  }
}

for (const config of allCases.filter((item) => item.phase === "event-storming")) {
  if (!config.expect.routes.excludes.includes(config.phase)) {
    throw new Error(`${config.id} permits a user-visible route back to its active ${config.phase} phase`);
  }
}

const firstTacticalDecision = readCase("event-storming-derives-design-from-complete-model");
for (const wrongRoute of ["event-storming", "codify", "guard"]) {
  if (!firstTacticalDecision.expect.routes.excludes.includes(wrongRoute)) {
    throw new Error(`first EventStorming consensus case permits ${wrongRoute}`);
  }
}
for (const id of [
  "event-storming-applies-accepted-model-slice",
  "event-storming-baseline-with-open-lifecycle",
  "event-storming-continues-after-boundary-acceptance",
]) {
  const config = readCase(id);
  if (!config.dialogue || config.dialogue.answer !== "answer.md" ||
      !fs.statSync(path.join(casesRoot, id, config.dialogue.answer)).isFile()) {
    throw new Error(`${id} must withhold a checked-in domain answer for turn 2`);
  }
  if (config.dialogue.first_turn.questions.min < 1 ||
      config.dialogue.first_turn.git.changed !== "some" ||
      config.dialogue.first_turn.git.required_paths.length === 0) {
    throw new Error(`${id} must score a first-turn HotSpot and its incremental accepted slice`);
  }
  const propositions = config.dialogue.first_turn.questions.propositions;
  if (!Array.isArray(propositions) || propositions.length === 0 ||
      propositions.some((item) => !item.accepts?.length || !item.rejects?.length)) {
    throw new Error(`${id} must score accepted and rejected first-turn HotSpot propositions`);
  }
}

const directTacticalCase = readCase("event-storming-derives-design-from-complete-model");
const directTacticalDesign = directTacticalCase.expect.files.find((item) => item.path.endsWith("/design.md"));
if (!directTacticalCase.expect.completion.includes("completed") ||
    directTacticalCase.expect.questions.max !== 0 ||
    !directTacticalDesign?.contains.includes("design_status: codify_ready")) {
  throw new Error("complete accepted business facts should converge without a synthetic design-approval question");
}

const entityDesign = readCase("event-storming-defines-retained-entity").expect.files[0];
if (!(entityDesign.identifiers_without_format || []).includes("LineId")) {
  throw new Error("retained-Entity case does not reject invented identifier formats");
}
if (!Array.isArray(entityDesign.propositions) || entityDesign.propositions.length === 0) {
  throw new Error("retained-Entity case does not score polarity-aware Value Object propositions");
}
for (const requiredSignal of [
  "Quantity represents the allocation amount",
  "no additional business-format rule",
  "LineId values are equal when",
  "Quantity values are equal when",
]) {
  if (!entityDesign.contains_any.some((group) => group.includes(requiredSignal))) {
    throw new Error(`retained-Entity case does not require ${requiredSignal}`);
  }
}

const restrainedStrategicCase = readCase("event-storming-document-confirmed-model");
const restrainedSource = fs.readFileSync(
  path.join(casesRoot, restrainedStrategicCase.id, "workspace", "docs", "spec.md"),
  "utf8",
);
for (const weakNoun of ["Priority Badge", "Operator Bundle"]) {
  if (!new RegExp(weakNoun.replace(" ", "\\s+"), "u").test(restrainedSource)) {
    throw new Error(`restrained EventStorming source does not present weak noun ${weakNoun}`);
  }
  for (const artifact of restrainedStrategicCase.expect.files) {
    if (!(artifact.excludes_semantic || []).includes(weakNoun)) {
      throw new Error(`restrained EventStorming case permits ${weakNoun} in ${artifact.path}`);
    }
  }
}

for (const id of [
  "codify-rejects-evolving-design",
  "guard-statusless-design-readiness",
  "event-storming-bootstraps-accepted-story",
]) {
  if (!allCases.some((config) => config.id === id)) {
    throw new Error(`ddd-expert eval suite is missing readiness/continuity coverage: ${id}`);
  }
}

const bootstrapEventStorming = readCase("event-storming-bootstraps-accepted-story");
const bootstrapPaths = [
  "docs/ddd-expert/README.md",
  "docs/ddd-expert/context-map.md",
  "docs/ddd-expert/context/pass/model.md",
  "docs/ddd-expert/context/pass/design.md",
];
for (const expectedPath of bootstrapPaths) {
  if (!bootstrapEventStorming.expect.git.required_paths.includes(expectedPath) ||
      !bootstrapEventStorming.expect.git.allowed_paths.includes(expectedPath)) {
    throw new Error(`EventStorming bootstrap case does not require the semantic bootstrap path ${expectedPath}`);
  }
}
const bootstrapDesign = bootstrapEventStorming.expect.files.find((item) =>
  item.path === "docs/ddd-expert/context/pass/design.md");
if (!bootstrapEventStorming.expect.routes.excludes.includes("event-storming") ||
    !bootstrapEventStorming.expect.completion.includes("completed") ||
    bootstrapEventStorming.expect.questions.max !== 0 ||
    !bootstrapDesign?.contains.includes("design_status: codify_ready")) {
  throw new Error("EventStorming bootstrap case must converge directly to a codify-ready Design");
}
NODE

for consensus_case in \
  event-storming-continues-after-boundary-acceptance \
  event-storming-promotes-ready-without-duplicate-acceptance \
  event-storming-resumes-after-semantic-acceptance \
  event-storming-resumes-evolving-design \
  event-storming-defines-retained-entity; do
  [ -f "$CASES_ROOT/$consensus_case/case.json" ] ||
    fail "ddd-expert eval suite is missing staged EventStorming coverage: $consensus_case"
done

rg -q '^design_status: evolving$' \
  "$CASES_ROOT/event-storming-promotes-ready-without-duplicate-acceptance/workspace/docs/ddd-expert/context/reservation/design.md" ||
  fail "final EventStorming readiness case should start from an evolving Design"
rg -q '"design_status: codify_ready"' \
  "$CASES_ROOT/event-storming-promotes-ready-without-duplicate-acceptance/case.json" ||
  fail "final EventStorming readiness case should require codify_ready promotion"

rg -q '^design_status: evolving$' \
  "$CASES_ROOT/codify-rejects-evolving-design/workspace/docs/ddd-expert/context/order/design.md" ||
  fail "Codify readiness-gate case should start from an evolving Design"
if rg -q '^design_status:' \
  "$CASES_ROOT/guard-statusless-design-readiness/workspace/docs/ddd-expert/context/order/design.md"; then
  fail "Guard legacy-readiness case should keep the Design statusless"
fi
[ ! -e "$CASES_ROOT/event-storming-bootstraps-accepted-story/workspace/docs/ddd-expert" ] ||
  fail "EventStorming bootstrap case should start from an uninitialized artifact root"

legacy_artifact_refs="$(rg -n \
  'docs/ddd/|docs/design\.md|docs/domain\.md|docs/ddd-expert/(model|design)\.md' \
  "$CASES_ROOT" --glob '**/prompt.md' --glob '**/workspace/**' || true)"
if [ -n "$legacy_artifact_refs" ]; then
  printf '%s\n' "$legacy_artifact_refs" >&2
  echo "FAIL ddd-expert eval inputs should use the canonical per-context artifact layout" >&2
  exit 1
fi

while IFS= read -r model; do
  rg -q '^model_revision: [1-9][0-9]*$' "$model" || {
    echo "FAIL canonical eval model lacks a positive model_revision: $model" >&2
    exit 1
  }
  model_status="$(sed -n 's/^model_status: //p' "$model")"
  case "$model_status" in
    evolving|shape_ready) ;;
    *)
      echo "FAIL canonical eval input model has invalid readiness '$model_status': $model" >&2
      exit 1
      ;;
  esac
done < <(find "$CASES_ROOT" -path '*/workspace/docs/ddd-expert/context/*/model.md' -type f)

legacy_model_headings="$(rg -n '^## Context Relationships$' "$CASES_ROOT" \
  --glob '**/workspace/docs/ddd-expert/context/*/model.md' \
  --glob '!**/event-storming-migrates-legacy-context-map/**' \
  --glob '!**/event-storming-blocks-partial-legacy-migration/**' || true)"
if [ -n "$legacy_model_headings" ]; then
  printf '%s\n' "$legacy_model_headings" >&2
  fail "canonical eval Models should use Context Dependencies rather than Context Relationships"
fi

canonical_readme_wording='Context dependencies and named contracts are authoritative in [context-map.md](context-map.md).'
while IFS= read -r readme; do
  case "$readme" in
    */event-storming-migrates-legacy-context-map/*|*/event-storming-blocks-partial-legacy-migration/*)
      rg -Fq 'Context relationships are authoritative in [context-map.md](context-map.md).' "$readme" ||
        fail "legacy migration eval README should retain the retired pre-state wording: $readme"
      ;;
    *)
      rg -Fq "$canonical_readme_wording" "$readme" ||
        fail "eval README should use the canonical Context dependencies and named contracts wording: $readme"
      ;;
  esac
done < <(find "$CASES_ROOT" -path '*/workspace/docs/ddd-expert/README.md' -type f)

while IFS= read -r design; do
  model="${design%/design.md}/model.md"
  [ -f "$model" ] || {
    echo "FAIL canonical eval design lacks its context model: $design" >&2
    exit 1
  }
  model_revision="$(sed -n 's/^model_revision: //p' "$model")"
  design_revision="$(sed -n 's/^based_on_model_revision: //p' "$design")"
  design_status="$(sed -n 's/^design_status: //p' "$design")"
  case "$design" in
    */guard-statusless-design-readiness/*)
      [ -z "$design_status" ] || {
        echo "FAIL Guard statusless-readiness fixture unexpectedly declares '$design_status': $design" >&2
        exit 1
      }
      ;;
    *)
      case "$design_status" in
        evolving|codify_ready) ;;
        *)
          echo "FAIL canonical eval input design has invalid readiness '$design_status': $design" >&2
          exit 1
          ;;
      esac
      ;;
  esac
  case "$design" in
    */codify-stale-design-revision/*|*/guard-stale-design-revision/*)
      [ "$model_revision" != "$design_revision" ] || {
        echo "FAIL stale-design eval should keep a revision mismatch: $design" >&2
        exit 1
      }
      ;;
    *)
      [ "$model_revision" = "$design_revision" ] || {
        echo "FAIL canonical eval design revision differs from its model: $design" >&2
        exit 1
      }
      ;;
  esac
done < <(find "$CASES_ROOT" -path '*/workspace/docs/ddd-expert/context/*/design.md' -type f)

while IFS= read -r artifact_root; do
  case "$artifact_root" in
    */event-storming-document-confirmed-model/*) continue ;;
  esac
  [ -f "$artifact_root/README.md" ] || {
    echo "FAIL canonical eval artifact root lacks README.md: $artifact_root" >&2
    exit 1
  }
  [ -f "$artifact_root/context-map.md" ] || {
    echo "FAIL canonical eval artifact root lacks context-map.md: $artifact_root" >&2
    exit 1
  }

  rg -Fq '[context-map.md](context-map.md)' "$artifact_root/README.md" ||
    fail "artifact README does not link the Context Map: $artifact_root"
  rg -Fq '`design.md` lives beside' "$artifact_root/README.md" ||
    fail "artifact README does not locate each context Design: $artifact_root"
  rg -Fq 'may be absent before EventStorming applies the first accepted tactical slice' "$artifact_root/README.md" ||
    fail "artifact README does not explain the pre-checkpoint Design state: $artifact_root"
  rg -Fq 'remains `evolving`' "$artifact_root/README.md" ||
    fail "artifact README does not explain evolving Design readiness: $artifact_root"
  if rg -q '^## Structure$|^[[:space:]]*[|`]--' "$artifact_root/README.md"; then
    fail "artifact README duplicates the canonical directory layout: $artifact_root"
  fi
  if rg -q '\]\(context/[^)]*/design\.md\)' "$artifact_root/README.md"; then
    fail "artifact README should navigate contexts through their Models only: $artifact_root"
  fi

  case "$artifact_root" in
    */event-storming-rejects-cyclic-context-map/*)
      if node "$CONTEXT_MAP_VALIDATOR" "$artifact_root/context-map.md" >/dev/null 2>&1; then
        fail "cyclic-map eval must retain its intentionally invalid input: $artifact_root"
      fi
      ;;
    */event-storming-migrates-legacy-context-map/*)
      if node "$CONTEXT_MAP_VALIDATOR" "$artifact_root/context-map.md" >/dev/null 2>&1; then
        fail "legacy-map migration eval must retain its intentionally invalid pre-state: $artifact_root"
      fi
      ;;
    */event-storming-blocks-partial-legacy-migration/*)
      if node "$CONTEXT_MAP_VALIDATOR" "$artifact_root/context-map.md" >/dev/null 2>&1; then
        fail "partial legacy migration eval must retain its intentionally invalid pre-state: $artifact_root"
      fi
      audit_model="$artifact_root/context/audit/model.md"
      [ -f "$audit_model" ] || fail "partial legacy migration eval must contain the omitted Audit Model"
      rg -Fq '## Context Relationships' "$audit_model" ||
        fail "partial legacy migration eval Audit Model must retain its retired heading"
      if rg -Fq 'Audit' "$artifact_root/context-map.md" || rg -Fq 'Audit' "$artifact_root/README.md"; then
        fail "partial legacy migration eval must keep Audit outside the accepted target and navigation"
      fi
      continue
      ;;
    *)
      node "$CONTEXT_MAP_VALIDATOR" "$artifact_root/context-map.md" >/dev/null ||
        fail "invalid canonical Context Map: $artifact_root"
      ;;
  esac

  map_contexts="$(awk '
    $0 == "## Bounded Contexts" { in_contexts = 1; next }
    in_contexts && /^## [^#]/ { in_contexts = 0 }
    in_contexts && /^### [^#]/ { sub(/^### /, ""); print }
  ' "$artifact_root/context-map.md" | sort)"

  if find "$artifact_root" -type f \
    \( -iname '*story*coverage*' -o -iname '*source*coverage*' -o -iname '*coverage*ledger*' \) \
    -print -quit | rg -q .; then
    fail "temporary source coverage must not be persisted as a DDD artifact: $artifact_root"
  fi

  model_contexts="$(while IFS= read -r model; do
    sed -n -E 's/^context: "?([^"[:cntrl:]]+)"?$/\1/p' "$model"
  done < <(find "$artifact_root/context" -name model.md -type f | sort) | sort)"
  [ "$map_contexts" = "$model_contexts" ] || {
    diff -u <(printf '%s\n' "$map_contexts") <(printf '%s\n' "$model_contexts") >&2 || true
    echo "FAIL Context Map and per-context Model inventory differ: $artifact_root" >&2
    exit 1
  }

  while IFS= read -r model; do
    model_relative="${model#"$artifact_root/"}"
    rg -Fq "]($model_relative)" "$artifact_root/README.md" || {
      echo "FAIL artifact README does not link Model: $model" >&2
      exit 1
    }
  done < <(find "$artifact_root/context" -name model.md -type f | sort)
done < <(find "$CASES_ROOT" -path '*/workspace/docs/ddd-expert' -type d)

echo "  ddd-expert evals: static fixture and scorer checks passed"
