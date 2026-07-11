#!/usr/bin/env bash
# Validate ddd-expert behavior fixtures and the deterministic scorer without a model call.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RUNNER="$ROOT/scripts/eval/ddd-expert.js"
CASES_ROOT="$ROOT/evals/ddd-expert/cases"

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

  map_contexts="$(awk '
    $0 == "## Bounded Contexts" { in_contexts = 1; next }
    $0 == "## Relationships" { in_contexts = 0 }
    in_contexts && /^### / { sub(/^### /, ""); print }
  ' "$artifact_root/context-map.md" | sort)"

  global_view_count="$(rg -c '^## Global View$' "$artifact_root/context-map.md" || true)"
  [ "$global_view_count" = "1" ] ||
    fail "Context Map should contain exactly one Global View: $artifact_root"
  rg -Fq 'Arrow direction: `U -> D` (Upstream -> Downstream).' "$artifact_root/context-map.md" ||
    fail "Context Map does not define U-to-D arrow direction: $artifact_root"
  mermaid_count="$(rg -c '^```mermaid$' "$artifact_root/context-map.md" || true)"
  [ "$mermaid_count" = "1" ] ||
    fail "Context Map should contain exactly one Mermaid diagram: $artifact_root"

  diagram="$(awk '
    $0 == "```mermaid" { in_diagram = 1; next }
    in_diagram && $0 == "```" { exit }
    in_diagram { print }
  ' "$artifact_root/context-map.md")"
  graph_count="$(printf '%s\n' "$diagram" | rg -c '^graph LR$' || true)"
  [ "$graph_count" = "1" ] ||
    fail "Context Map Global View should use graph LR: $artifact_root"

  invalid_diagram_lines="$(printf '%s\n' "$diagram" | rg -v \
    '^(graph LR|[[:space:]]*|[[:space:]]*[a-z][a-z0-9_]*\["[^"]+"\][[:space:]]*|[[:space:]]*[a-z][a-z0-9_]*[[:space:]]+-->[[:space:]]+[a-z][a-z0-9_]*[[:space:]]*)$' || true)"
  [ -z "$invalid_diagram_lines" ] || {
    printf '%s\n' "$invalid_diagram_lines" >&2
    fail "Context Map Global View should contain only labeled nodes and unlabeled edges: $artifact_root"
  }

  diagram_contexts="$(printf '%s\n' "$diagram" | sed -nE \
    's/^[[:space:]]*[a-z][a-z0-9_]*\["([^"]+)"\][[:space:]]*$/\1/p' | sort)"
  [ "$diagram_contexts" = "$map_contexts" ] || {
    diff -u <(printf '%s\n' "$map_contexts") <(printf '%s\n' "$diagram_contexts") >&2 || true
    fail "Context Map Global View and Bounded Context inventory differ: $artifact_root"
  }

  node_ids="$(printf '%s\n' "$diagram" | sed -nE \
    's/^[[:space:]]*([a-z][a-z0-9_]*)\["[^"]+"\][[:space:]]*$/\1/p')"
  node_pairs="$(printf '%s\n' "$diagram" | sed -nE \
    's/^[[:space:]]*([a-z][a-z0-9_]*)\["([^"]+)"\][[:space:]]*$/\1|\2/p')"
  diagram_edges="$(printf '%s\n' "$diagram" | sed -nE \
    's/^[[:space:]]*([a-z][a-z0-9_]*)[[:space:]]+-->[[:space:]]+([a-z][a-z0-9_]*)[[:space:]]*$/\1 \2/p')"

  duplicate_node_ids="$(printf '%s\n' "$node_ids" | sed '/^$/d' | sort | uniq -d)"
  [ -z "$duplicate_node_ids" ] ||
    fail "Context Map Global View reuses a node identifier: $artifact_root"
  duplicate_edges="$(printf '%s\n' "$diagram_edges" | sed '/^$/d' | sort | uniq -d)"
  [ -z "$duplicate_edges" ] ||
    fail "Context Map Global View duplicates a directed relationship: $artifact_root"

  while read -r upstream_id downstream_id; do
    [ -n "$upstream_id" ] || continue
    printf '%s\n' "$node_ids" | rg -Fxq "$upstream_id" ||
      fail "Context Map edge has an undeclared upstream node: $artifact_root"
    printf '%s\n' "$node_ids" | rg -Fxq "$downstream_id" ||
      fail "Context Map edge has an undeclared downstream node: $artifact_root"

    upstream_name="$(printf '%s\n' "$node_pairs" | awk -F '|' -v id="$upstream_id" '$1 == id { print $2 }')"
    downstream_name="$(printf '%s\n' "$node_pairs" | awk -F '|' -v id="$downstream_id" '$1 == id { print $2 }')"
    rg -Fq "### $upstream_name -> $downstream_name" "$artifact_root/context-map.md" ||
      fail "Context Map edge has no matching directed Relationship: $artifact_root"
  done < <(printf '%s\n' "$diagram_edges")

  while IFS= read -r relationship; do
    [ -n "$relationship" ] || continue
    upstream_name="${relationship%% -> *}"
    downstream_name="${relationship#* -> }"
    upstream_id="$(printf '%s\n' "$node_pairs" | awk -F '|' -v name="$upstream_name" '$2 == name { print $1 }')"
    downstream_id="$(printf '%s\n' "$node_pairs" | awk -F '|' -v name="$downstream_name" '$2 == name { print $1 }')"
    # Relationships with an external endpoint remain textual and intentionally
    # have no Global View node or edge.
    if [ -z "$upstream_id" ] || [ -z "$downstream_id" ]; then
      continue
    fi
    printf '%s\n' "$diagram_edges" | rg -Fxq "$upstream_id $downstream_id" ||
      fail "directed Relationship is missing from the Global View: $artifact_root"
  done < <(awk '
    $0 == "## Relationships" { in_relationships = 1; next }
    in_relationships && /^### .* -> .*$/ { sub(/^### /, ""); print }
  ' "$artifact_root/context-map.md")

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
