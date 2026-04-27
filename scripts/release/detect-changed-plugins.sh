#!/usr/bin/env bash
# Detect which Claude/Codex plugins changed between PREV_REF and HEAD.
# Per-physical-path rule (R-X): the two tracks are evaluated independently.
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

CLAUDE=$(extract plugins || true)
CODEX=$(extract codex-plugins || true)

echo "CLAUDE_PLUGINS=$CLAUDE"
echo "CODEX_PLUGINS=$CODEX"
