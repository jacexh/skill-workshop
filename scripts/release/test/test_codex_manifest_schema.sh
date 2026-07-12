#!/usr/bin/env bash
# Validate Codex marketplace entries and plugin manifests against the Codex
# plugin schema shape used by the TUI.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MARKETPLACE="$ROOT/.agents/plugins/marketplace.json"

[ -f "$MARKETPLACE" ] || { echo "FAIL missing $MARKETPLACE"; exit 1; }

root_readme="$ROOT/README.md"
if [ -f "$root_readme" ] && grep -Fq "codex plugin install" "$root_readme"; then
  echo "FAIL root README must use current Codex install command: codex plugin add"
  exit 1
fi

count=$(jq '.plugins | length' "$MARKETPLACE")
[ "$count" -gt 0 ] || { echo "FAIL no Codex marketplace plugins"; exit 1; }

for i in $(seq 0 $((count - 1))); do
  name=$(jq -r ".plugins[$i].name" "$MARKETPLACE")
  marketplace_name=$(jq -r ".name" "$MARKETPLACE")
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
  skills_dir="$(dirname "$manifest")/../${skills_path#./}"
  [ -d "$skills_dir" ] || {
    echo "FAIL $name .skills path does not exist: $skills_path"
    exit 1
  }
  [ ! -f "$skills_dir/setup/SKILL.md" ] || {
    echo "FAIL $name must not expose fallback setup skill"
    exit 1
  }

  readme="$ROOT/${path#./}/README.md"
  if [ -f "$readme" ] && grep -Fq "\$${name}:setup" "$readme"; then
    echo "FAIL $name README must not tell users to run setup"
    exit 1
  fi
  # The public Codex install command is `codex plugin add`; block stale
  # published docs that tell users to run an unrecognized subcommand.
  if [ -f "$readme" ] && grep -Fq "codex plugin install" "$readme"; then
    echo "FAIL $name README must use current Codex install command: codex plugin add"
    exit 1
  fi
  # Codex requires a marketplace selector unless users pass --marketplace.
  # Published examples use the compact PLUGIN@MARKETPLACE form.
  expected_add="codex plugin add ${name}@${marketplace_name}"
  if ! grep -Fq "$expected_add" "$root_readme"; then
    echo "FAIL root README missing marketplace-qualified Codex install command: $expected_add"
    exit 1
  fi
  if [ -f "$readme" ] && ! grep -Fq "$expected_add" "$readme"; then
    echo "FAIL $name README missing marketplace-qualified Codex install command: $expected_add"
    exit 1
  fi
  if [ -f "$readme" ] && grep -Fq "codex_hooks" "$readme"; then
    echo "FAIL $name README must use the canonical hooks feature flag"
    exit 1
  fi

  hooks_type=$(jq -r '.hooks | type' "$manifest")
  if [ "$hooks_type" != "null" ]; then
    [ "$hooks_type" = "string" ] || {
      echo "FAIL $name .hooks must be a string path when present, got $hooks_type"
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
  fi
  # Codex plugin skills must use the Codex root/runtime, not copied Claude hook commands.
  if grep -R -n -E 'CLAUDE_PLUGIN_ROOT|hook-runtime\.js' "$ROOT/${path#./}" >/dev/null; then
    echo "FAIL $name Codex plugin source must not reference CLAUDE_PLUGIN_ROOT or hook-runtime.js"
    exit 1
  fi
  if [ "$hooks_type" != "null" ]; then
    jq -e '
      .hooks
      | to_entries[]
      | .value[]
      | (.hooks // [])[]
      | select(.type == "command")
      | select((.timeout | type) != "number" or .timeout <= 0 or has("statusMessage"))
    ' "$hooks_file" >/dev/null && {
      echo "FAIL $name command hooks must set positive timeout and omit statusMessage"
      exit 1
    }

    snippet="$ROOT/${path#./}/codex-hooks-snippet.json"
    if [ -f "$snippet" ]; then
      diff -u <(jq -S '.hooks' "$hooks_file") <(jq -S '.hooks' "$snippet") >/dev/null || {
        echo "FAIL $name native hooks/hooks.json drifted from codex-hooks-snippet.json fallback"
        exit 1
      }
    fi
  fi
done

echo "  codex manifests: schema-compatible"
