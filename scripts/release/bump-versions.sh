#!/usr/bin/env bash
# Bump version fields across marketplace + plugin manifests.
# Same-name dual-track rule: requested plugin names are expanded to existing
# same-name Claude/Codex counterparts before per-track manifest bumps.
# Inputs (env):
#   NEXT             — new version, e.g. "1.12.1" (required)
#   CLAUDE_PLUGINS   — space-separated plugin names changed under plugins/ (may be empty)
#   CODEX_PLUGINS    — space-separated plugin names changed under codex-plugins/ (may be empty)
# Behavior:
#   1) always set .claude-plugin/marketplace.json .metadata.version = $NEXT
#   2) for each name N in CLAUDE_PLUGINS or CODEX_PLUGINS where plugins/N exists:
#        - .claude-plugin/marketplace.json .plugins[name=N].version = $NEXT
#        - plugins/N/.claude-plugin/plugin.json .version = $NEXT
#      (skip with stderr warning if directory absent)
#   3) for each name N in CLAUDE_PLUGINS or CODEX_PLUGINS where codex-plugins/N exists:
#        - codex-plugins/N/.codex-plugin/plugin.json .version = $NEXT
#        - codex-plugins/N/codex-hooks-snippet.json .version = $NEXT when present
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

sync_existing_counterparts() {
  local own_prefix="$1"
  local other_prefix="$2"
  local own_list="$3"
  local other_list="$4"

  {
    for name in $own_list; do
      [ -d "$own_prefix/$name" ] && printf '%s\n' "$name"
    done
    for name in $other_list; do
      [ -d "$own_prefix/$name" ] && [ -d "$other_prefix/$name" ] && printf '%s\n' "$name"
    done
    true
  } | sort -u | tr '\n' ' ' | sed 's/ $//'
}

warn_missing_requested() {
  local prefix="$1"
  local label="$2"
  local list="$3"

  for name in $list; do
    if [ ! -d "$prefix/$name" ]; then
      echo "WARN: $prefix/$name missing — skipping $label bump for '$name'" >&2
    fi
  done
}

# (1) marketplace metadata
MK=".claude-plugin/marketplace.json"
[ -f "$MK" ] || { echo "ERROR: $MK not found" >&2; exit 3; }
write_jq "$MK" --arg v "$NEXT" '.metadata.version = $v'

warn_missing_requested plugins Claude "$CLAUDE_PLUGINS"
warn_missing_requested codex-plugins Codex "$CODEX_PLUGINS"

SYNCED_CLAUDE_PLUGINS=$(sync_existing_counterparts plugins codex-plugins "$CLAUDE_PLUGINS" "$CODEX_PLUGINS")
SYNCED_CODEX_PLUGINS=$(sync_existing_counterparts codex-plugins plugins "$CODEX_PLUGINS" "$CLAUDE_PLUGINS")

# (2) Claude side per-plugin
for N in $SYNCED_CLAUDE_PLUGINS; do
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
for N in $SYNCED_CODEX_PLUGINS; do
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
  HS="codex-plugins/$N/codex-hooks-snippet.json"
  if [ -f "$HS" ]; then
    write_jq "$HS" --arg v "$NEXT" '.version = $v'
  fi
done
