#!/usr/bin/env bash
# Validate Codex marketplace entries and plugin manifests against the Codex
# plugin schema shape used by the TUI.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MARKETPLACE="$ROOT/.agents/plugins/marketplace.json"

[ -f "$MARKETPLACE" ] || { echo "FAIL missing $MARKETPLACE"; exit 1; }

count=$(jq '.plugins | length' "$MARKETPLACE")
[ "$count" -gt 0 ] || { echo "FAIL no Codex marketplace plugins"; exit 1; }

for i in $(seq 0 $((count - 1))); do
  name=$(jq -r ".plugins[$i].name" "$MARKETPLACE")
  path=$(jq -r ".plugins[$i].source.path" "$MARKETPLACE")
  manifest="$ROOT/${path#./}/.codex-plugin/plugin.json"

  [ -f "$manifest" ] || { echo "FAIL $name manifest missing at $manifest"; exit 1; }

  manifest_name=$(jq -r '.name' "$manifest")
  [ "$manifest_name" = "$name" ] || {
    echo "FAIL $name manifest name mismatch: $manifest_name"
    exit 1
  }

  skills_type=$(jq -r '.skills | type' "$manifest")
  [ "$skills_type" = "string" ] || {
    echo "FAIL $name .skills must be a string path, got $skills_type"
    exit 1
  }

  skills_path=$(jq -r '.skills' "$manifest")
  [ -d "$(dirname "$manifest")/../${skills_path#./}" ] || {
    echo "FAIL $name .skills path does not exist: $skills_path"
    exit 1
  }

  hooks_type=$(jq -r '.hooks | type' "$manifest")
  [ "$hooks_type" = "string" ] || {
    echo "FAIL $name .hooks must be a string path, got $hooks_type"
    exit 1
  }

  hooks_path=$(jq -r '.hooks' "$manifest")
  hooks_file="$(dirname "$manifest")/../${hooks_path#./}"
  [ -f "$hooks_file" ] || {
    echo "FAIL $name .hooks path does not exist: $hooks_path"
    exit 1
  }

  hooks_shape=$(jq -r '.hooks | type' "$hooks_file")
  [ "$hooks_shape" = "object" ] || {
    echo "FAIL $name lifecycle config must contain a hooks object, got $hooks_shape"
    exit 1
  }

  snippet="$ROOT/${path#./}/codex-hooks-snippet.json"
  if [ -f "$snippet" ]; then
    diff -u <(jq -S '.hooks' "$hooks_file") <(jq -S '.hooks' "$snippet") >/dev/null || {
      echo "FAIL $name native hooks/hooks.json drifted from codex-hooks-snippet.json fallback"
      exit 1
    }
  fi
done

echo "  codex manifests: schema-compatible"
