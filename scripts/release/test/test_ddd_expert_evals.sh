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
]) {
  if (!pattern.test(runner)) {
    throw new Error(`runner is missing the ${label} seam`);
  }
}
if (/runManagedDockerContainer\(executionArgs/u.test(runner)) {
  throw new Error("model trial still uses the synchronous Docker runner");
}
NODE

node - "$CASES_ROOT" <<'NODE'
const fs = require("fs");
const path = require("path");

const casesRoot = process.argv[2];
const readCase = (id) => JSON.parse(fs.readFileSync(path.join(casesRoot, id, "case.json"), "utf8"));
const completedExploreCases = fs.readdirSync(casesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => readCase(entry.name))
  .filter((config) => config.phase === "explore" && config.expect.completion.includes("completed"));
const exactCoverageHeadings = ["## Source Coverage", "## Story Coverage", "## Coverage Ledger"];
const semanticCoverageTerms = ["Source Coverage", "Story Coverage", "Coverage Ledger"];
for (const config of completedExploreCases) {
  const id = config.id;
  const dddArtifacts = config.expect.files.filter((item) => item.path.startsWith("docs/ddd-expert/"));
  const assertedPaths = new Set(dddArtifacts.map((item) => item.path));
  const allowedPaths = config.expect.git.allowed_paths;
  if (!Array.isArray(allowedPaths)) {
    throw new Error(`${id} must declare an exact artifact write set`);
  }
  if (allowedPaths.length !== assertedPaths.size || allowedPaths.some((item) => !assertedPaths.has(item))) {
    throw new Error(`${id} allowed paths must equal its asserted DDD artifacts`);
  }
  for (const allowedPath of allowedPaths) {
    if (!/^docs\/ddd-expert\/(?:README\.md|context-map\.md|context\/[a-z0-9-]+\/model\.md)$/u.test(allowedPath)) {
      throw new Error(`${id} allows non-canonical Explore artifact ${allowedPath}`);
    }
  }
  for (const artifact of dddArtifacts) {
    if (artifact.forbid_temporary_trace !== true) {
      throw new Error(`${id} does not forbid temporary discovery traces in ${artifact.path}`);
    }
    for (const heading of exactCoverageHeadings) {
      if (!(artifact.excludes || []).includes(heading)) {
        throw new Error(`${id} does not exclude ${heading} from ${artifact.path}`);
      }
    }
    for (const term of semanticCoverageTerms) {
      if (!(artifact.excludes_semantic || []).includes(term)) {
        throw new Error(`${id} does not semantically exclude ${term} from ${artifact.path}`);
      }
    }
  }
}

const firstShape = readCase("shape-requires-design-consensus");
for (const wrongRoute of ["explore", "codify", "guard"]) {
  if (!firstShape.expect.routes.excludes.includes(wrongRoute)) {
    throw new Error(`first Shape consensus case permits ${wrongRoute}`);
  }
}
for (const id of [
  "explore-blocks-partial-legacy-migration",
  "shape-requires-design-consensus",
  "shape-continues-after-boundary-acceptance",
  "shape-requires-integrated-design-acceptance",
]) {
  const propositions = readCase(id).expect.questions.propositions;
  if (!Array.isArray(propositions) || propositions.length === 0 ||
      propositions.some((item) => !item.accepts?.length || !item.rejects?.length)) {
    throw new Error(`${id} must score accepted and rejected question propositions`);
  }
}

const entityDesign = readCase("shape-defines-retained-entity").expect.files[0];
if (!(entityDesign.identifiers_without_format || []).includes("LineId")) {
  throw new Error("retained-Entity case does not reject invented identifier formats");
}
if (!Array.isArray(entityDesign.propositions) || entityDesign.propositions.length === 0) {
  throw new Error("retained-Entity case does not score polarity-aware Value Object propositions");
}
for (const requiredSignal of [
  "Quantity represents the allocation amount",
  "LineId is constructed from",
  "no additional business-format rule",
  "LineId values are equal when",
  "Quantity values are equal when",
]) {
  if (!entityDesign.contains_any.some((group) => group.includes(requiredSignal))) {
    throw new Error(`retained-Entity case does not require ${requiredSignal}`);
  }
}
NODE

for consensus_case in \
  shape-continues-after-boundary-acceptance \
  shape-requires-integrated-design-acceptance \
  shape-defines-retained-entity; do
  [ -f "$CASES_ROOT/$consensus_case/case.json" ] ||
    fail "ddd-expert eval suite is missing staged Shape coverage: $consensus_case"
done

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
done < <(find "$CASES_ROOT" -path '*/workspace/docs/ddd-expert/context/*/model.md' -type f)

legacy_model_headings="$(rg -n '^## Context Relationships$' "$CASES_ROOT" \
  --glob '**/workspace/docs/ddd-expert/context/*/model.md' \
  --glob '!**/explore-migrates-legacy-context-map/**' \
  --glob '!**/explore-blocks-partial-legacy-migration/**' || true)"
if [ -n "$legacy_model_headings" ]; then
  printf '%s\n' "$legacy_model_headings" >&2
  fail "canonical eval Models should use Context Dependencies rather than Context Relationships"
fi

canonical_readme_wording='Context dependencies and named contracts are authoritative in [context-map.md](context-map.md).'
while IFS= read -r readme; do
  case "$readme" in
    */explore-migrates-legacy-context-map/*|*/explore-blocks-partial-legacy-migration/*)
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
    */explore-document-confirmed-model/*) continue ;;
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
  rg -Fq 'may be absent until Shape' "$artifact_root/README.md" ||
    fail "artifact README does not explain the pre-Shape Design state: $artifact_root"
  if rg -q '^## Structure$|^[[:space:]]*[|`]--' "$artifact_root/README.md"; then
    fail "artifact README duplicates the canonical directory layout: $artifact_root"
  fi
  if rg -q '\]\(context/[^)]*/design\.md\)' "$artifact_root/README.md"; then
    fail "artifact README should navigate contexts through their Models only: $artifact_root"
  fi

  case "$artifact_root" in
    */shape-rejects-cyclic-context-map/*)
      if node "$CONTEXT_MAP_VALIDATOR" "$artifact_root/context-map.md" >/dev/null 2>&1; then
        fail "cyclic-map eval must retain its intentionally invalid input: $artifact_root"
      fi
      ;;
    */explore-migrates-legacy-context-map/*)
      if node "$CONTEXT_MAP_VALIDATOR" "$artifact_root/context-map.md" >/dev/null 2>&1; then
        fail "legacy-map migration eval must retain its intentionally invalid pre-state: $artifact_root"
      fi
      ;;
    */explore-blocks-partial-legacy-migration/*)
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
