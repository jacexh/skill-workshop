#!/usr/bin/env bash
# Validate ddd-expert behavior fixtures and the deterministic scorer without a model call.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RUNNER="$ROOT/scripts/eval/ddd-expert.js"
CASES_ROOT="$ROOT/evals/ddd-expert/cases"
CONTEXT_MAP_VALIDATOR="$ROOT/plugins/ddd-expert/scripts/validate-context-map.mjs"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

node --check "$RUNNER"
node "$RUNNER" validate
node "$RUNNER" self-test

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
