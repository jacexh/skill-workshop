#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../bump-versions.sh"

setup_repo() {
  local dir
  dir=$(mktemp -d)
  mkdir -p "$dir/.claude-plugin"
  cat > "$dir/.claude-plugin/marketplace.json" <<JSON
{
  "name": "skill-workshop",
  "metadata": { "version": "1.0.0" },
  "plugins": [
    { "name": "foo", "version": "1.0.0" },
    { "name": "bar", "version": "1.0.0" }
  ]
}
JSON
  mkdir -p "$dir/plugins/foo/.claude-plugin" "$dir/plugins/bar/.claude-plugin"
  echo '{"name":"foo","version":"1.0.0"}' > "$dir/plugins/foo/.claude-plugin/plugin.json"
  echo '{"name":"bar","version":"1.0.0"}' > "$dir/plugins/bar/.claude-plugin/plugin.json"
  mkdir -p "$dir/codex-plugins/foo/.codex-plugin"
  echo '{"name":"foo","version":"1.0.0"}' > "$dir/codex-plugins/foo/.codex-plugin/plugin.json"
  mkdir -p "$dir/.agents/plugins"
  echo '{"name":"skill-workshop-codex"}' > "$dir/.agents/plugins/marketplace.json"
  echo "$dir"
}

assert_eq() {
  if [ "$1" != "$2" ]; then
    echo "  FAIL: expected '$2', got '$1'"
    exit 1
  fi
}

# Case 1: bump claude foo and codex foo → metadata + foo entries change
dir=$(setup_repo)
( cd "$dir" && NEXT=1.2.3 CLAUDE_PLUGINS=foo CODEX_PLUGINS=foo bash "$SCRIPT" )
assert_eq "$(jq -r .metadata.version "$dir/.claude-plugin/marketplace.json")" "1.2.3"
assert_eq "$(jq -r '.plugins[]|select(.name=="foo").version' "$dir/.claude-plugin/marketplace.json")" "1.2.3"
assert_eq "$(jq -r '.plugins[]|select(.name=="bar").version' "$dir/.claude-plugin/marketplace.json")" "1.0.0"
assert_eq "$(jq -r .version "$dir/plugins/foo/.claude-plugin/plugin.json")" "1.2.3"
assert_eq "$(jq -r .version "$dir/plugins/bar/.claude-plugin/plugin.json")" "1.0.0"
assert_eq "$(jq -r .version "$dir/codex-plugins/foo/.codex-plugin/plugin.json")" "1.2.3"
# .agents/plugins/marketplace.json must remain untouched
assert_eq "$(cat "$dir/.agents/plugins/marketplace.json")" '{"name":"skill-workshop-codex"}'

# Case 2: empty plugin lists → only metadata bumps
dir=$(setup_repo)
( cd "$dir" && NEXT=2.0.0 CLAUDE_PLUGINS= CODEX_PLUGINS= bash "$SCRIPT" )
assert_eq "$(jq -r .metadata.version "$dir/.claude-plugin/marketplace.json")" "2.0.0"
assert_eq "$(jq -r '.plugins[]|select(.name=="foo").version' "$dir/.claude-plugin/marketplace.json")" "1.0.0"
assert_eq "$(jq -r .version "$dir/plugins/foo/.claude-plugin/plugin.json")" "1.0.0"
assert_eq "$(jq -r .version "$dir/codex-plugins/foo/.codex-plugin/plugin.json")" "1.0.0"

# Case 3: multiple plugins on Claude side
dir=$(setup_repo)
( cd "$dir" && NEXT=3.1.0 CLAUDE_PLUGINS="foo bar" CODEX_PLUGINS= bash "$SCRIPT" )
assert_eq "$(jq -r .metadata.version "$dir/.claude-plugin/marketplace.json")" "3.1.0"
assert_eq "$(jq -r '.plugins[]|select(.name=="foo").version' "$dir/.claude-plugin/marketplace.json")" "3.1.0"
assert_eq "$(jq -r '.plugins[]|select(.name=="bar").version' "$dir/.claude-plugin/marketplace.json")" "3.1.0"
assert_eq "$(jq -r .version "$dir/plugins/bar/.claude-plugin/plugin.json")" "3.1.0"

# Case 4: nonexistent plugin name → skip with warning, no crash, others still updated
dir=$(setup_repo)
out=$( cd "$dir" && NEXT=4.0.0 CLAUDE_PLUGINS="foo ghost" CODEX_PLUGINS= bash "$SCRIPT" 2>&1 )
echo "$out" | grep -q "ghost" || { echo "  FAIL: expected stderr warning about ghost"; exit 1; }
assert_eq "$(jq -r .version "$dir/plugins/foo/.claude-plugin/plugin.json")" "4.0.0"

# Case 5: idempotent — running twice with same NEXT yields same final state
dir=$(setup_repo)
( cd "$dir" && NEXT=5.0.0 CLAUDE_PLUGINS=foo CODEX_PLUGINS=foo bash "$SCRIPT" )
hash1=$(find "$dir" -name '*.json' | sort | xargs sha256sum | sha256sum)
( cd "$dir" && NEXT=5.0.0 CLAUDE_PLUGINS=foo CODEX_PLUGINS=foo bash "$SCRIPT" )
hash2=$(find "$dir" -name '*.json' | sort | xargs sha256sum | sha256sum)
assert_eq "$hash1" "$hash2"

echo "  5 cases passed"
