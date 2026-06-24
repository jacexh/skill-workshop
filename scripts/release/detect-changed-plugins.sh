#!/usr/bin/env bash
# Detect which Claude/Codex plugins changed between PREV_REF and HEAD.
# Same-name dual-track rule: raw path changes are detected independently, then
# existing same-name counterparts are synchronized across Claude/Codex outputs.
# Inputs:
#   $1 — PREV_REF (any git rev: tag, sha, branch)
# Outputs (stdout):
#   CLAUDE_PLUGINS=<space-separated names, sorted; empty if none>
#   CODEX_PLUGINS=<space-separated names, sorted; empty if none>
set -euo pipefail

PREV="${1:-}"
if [ -z "$PREV" ]; then
  echo "ERROR: PREV_REF arg required" >&2
  exit 2
fi

extract() {
  local prefix="$1"
  git diff --name-only "$PREV"..HEAD -- "$prefix/" \
    | awk -F/ -v p="$prefix" 'index($0, p"/")==1 && NF>=2 {print $2}' \
    | sort -u \
    | grep -v '^$' \
    | tr '\n' ' ' \
    | sed 's/ $//'
}

sync_existing_counterparts() {
  local own_prefix="$1"
  local other_prefix="$2"
  local own_list="$3"
  local other_list="$4"

  {
    for name in $own_list; do
      printf '%s\n' "$name"
    done
    for name in $other_list; do
      [ -d "$own_prefix/$name" ] && printf '%s\n' "$name"
    done
    true
  } | sort -u | tr '\n' ' ' | sed 's/ $//'
}

CLAUDE_RAW=$(extract plugins || true)
CODEX_RAW=$(extract codex-plugins || true)

CLAUDE=$(sync_existing_counterparts plugins codex-plugins "$CLAUDE_RAW" "$CODEX_RAW")
CODEX=$(sync_existing_counterparts codex-plugins plugins "$CODEX_RAW" "$CLAUDE_RAW")

echo "CLAUDE_PLUGINS=$CLAUDE"
echo "CODEX_PLUGINS=$CODEX"
