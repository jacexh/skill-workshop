#!/usr/bin/env bash
# Bump version fields across marketplace + plugin manifests per R-X rule.
# Inputs (env):
#   NEXT             — new version, e.g. "1.12.1" (required)
#   CLAUDE_PLUGINS   — space-separated plugin names changed under plugins/ (may be empty)
#   CODEX_PLUGINS    — space-separated plugin names changed under codex-plugins/ (may be empty)
# Behavior:
#   1) always set .claude-plugin/marketplace.json .metadata.version = $NEXT
#   2) for each name N in CLAUDE_PLUGINS:
#        - .claude-plugin/marketplace.json .plugins[name=N].version = $NEXT
#        - plugins/N/.claude-plugin/plugin.json .version = $NEXT
#      (skip with stderr warning if directory absent)
#   3) for each name N in CODEX_PLUGINS:
#        - codex-plugins/N/.codex-plugin/plugin.json .version = $NEXT
#      (skip with stderr warning if directory absent)
#   .agents/plugins/marketplace.json is never touched.
set -euo pipefail

NEXT="${NEXT:-}"
CLAUDE_PLUGINS="${CLAUDE_PLUGINS:-}"
CODEX_PLUGINS="${CODEX_PLUGINS:-}"

if [ -z "$NEXT" ]; then
  echo "ERROR: NEXT env var required" >&2
  exit 2
fi

write_jq() {
  # write_jq <file> [jq args...] <expr>
  local file="$1"; shift
  local tmp
  tmp=$(mktemp)
  jq "$@" "$file" > "$tmp"
  mv "$tmp" "$file"
}

# (1) marketplace metadata
MK=".claude-plugin/marketplace.json"
[ -f "$MK" ] || { echo "ERROR: $MK not found" >&2; exit 3; }
write_jq "$MK" --arg v "$NEXT" '.metadata.version = $v'

# (2) Claude side per-plugin
for N in $CLAUDE_PLUGINS; do
  if [ ! -d "plugins/$N" ]; then
    echo "WARN: plugins/$N missing — skipping Claude bump for '$N'" >&2
    continue
  fi
  PJ="plugins/$N/.claude-plugin/plugin.json"
  if [ ! -f "$PJ" ]; then
    echo "WARN: $PJ missing — skipping" >&2
    continue
  fi
  write_jq "$MK" --arg n "$N" --arg v "$NEXT" \
    '(.plugins[] | select(.name == $n) | .version) = $v'
  write_jq "$PJ" --arg v "$NEXT" '.version = $v'
done

# (3) Codex side per-plugin
for N in $CODEX_PLUGINS; do
  if [ ! -d "codex-plugins/$N" ]; then
    echo "WARN: codex-plugins/$N missing — skipping Codex bump for '$N'" >&2
    continue
  fi
  PJ="codex-plugins/$N/.codex-plugin/plugin.json"
  if [ ! -f "$PJ" ]; then
    echo "WARN: $PJ missing — skipping" >&2
    continue
  fi
  write_jq "$PJ" --arg v "$NEXT" '.version = $v'
done
