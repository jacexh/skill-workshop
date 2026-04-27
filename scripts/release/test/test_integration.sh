#!/usr/bin/env bash
# Integration: simulate the workflow's Step 2/3/4 chain on a fresh git repo,
# verify the resulting NEXT, plugin lists, and manifest state are consistent.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS="$HERE/.."

dir=$(mktemp -d)
cd "$dir"
git init -q
git config user.email t@t
git config user.name t

# Seed marketplace + 2 claude plugins + 2 codex plugins
mkdir -p .claude-plugin plugins/alpha/.claude-plugin plugins/beta/.claude-plugin \
         codex-plugins/alpha/.codex-plugin codex-plugins/beta/.codex-plugin .agents/plugins
cat > .claude-plugin/marketplace.json <<JSON
{
  "name": "test-mk",
  "metadata": { "version": "1.11.0" },
  "plugins": [
    { "name": "alpha", "version": "1.11.0" },
    { "name": "beta",  "version": "1.6.2" }
  ]
}
JSON
echo '{"name":"alpha","version":"1.11.0"}' > plugins/alpha/.claude-plugin/plugin.json
echo '{"name":"beta","version":"1.6.2"}'  > plugins/beta/.claude-plugin/plugin.json
echo '{"name":"alpha","version":"1.11.0"}' > codex-plugins/alpha/.codex-plugin/plugin.json
echo '{"name":"beta","version":"1.6.2"}'  > codex-plugins/beta/.codex-plugin/plugin.json
echo '{"name":"test-mk-codex"}' > .agents/plugins/marketplace.json

git add -A && git commit -q -m baseline
git tag v1.12.0

# Now make a change: only plugins/alpha/ touched
echo "skill change" >> plugins/alpha/skill.md
git add -A && git commit -q -m "feat(alpha): tweak"

# Step 2: compute next
out=$(BRANCH=feat/alpha-tweak bash "$SCRIPTS/compute-next-version.sh")
NEXT=$(echo "$out" | grep ^NEXT= | cut -d= -f2)
PREV=$(echo "$out" | grep ^PREV_TAG= | cut -d= -f2)
[ "$NEXT" = "1.12.1" ] || { echo "FAIL NEXT=$NEXT (want 1.12.1)"; exit 1; }
[ "$PREV" = "v1.12.0" ] || { echo "FAIL PREV=$PREV"; exit 1; }

# Step 3: detect changed
out=$(bash "$SCRIPTS/detect-changed-plugins.sh" "$PREV")
CLAUDE=$(echo "$out" | grep ^CLAUDE_PLUGINS= | cut -d= -f2-)
CODEX=$(echo "$out" | grep ^CODEX_PLUGINS= | cut -d= -f2-)
[ "$CLAUDE" = "alpha" ] || { echo "FAIL CLAUDE=$CLAUDE"; exit 1; }
[ "$CODEX" = "" ] || { echo "FAIL CODEX=$CODEX"; exit 1; }

# Step 4: bump
NEXT="$NEXT" CLAUDE_PLUGINS="$CLAUDE" CODEX_PLUGINS="$CODEX" \
  bash "$SCRIPTS/bump-versions.sh"

# Verify final state
[ "$(jq -r .metadata.version .claude-plugin/marketplace.json)" = "1.12.1" ] \
  || { echo "FAIL metadata.version"; exit 1; }
[ "$(jq -r '.plugins[]|select(.name=="alpha").version' .claude-plugin/marketplace.json)" = "1.12.1" ] \
  || { echo "FAIL alpha mk entry"; exit 1; }
[ "$(jq -r '.plugins[]|select(.name=="beta").version' .claude-plugin/marketplace.json)" = "1.6.2" ] \
  || { echo "FAIL beta mk entry should stay"; exit 1; }
[ "$(jq -r .version plugins/alpha/.claude-plugin/plugin.json)" = "1.12.1" ] \
  || { echo "FAIL alpha plugin.json"; exit 1; }
[ "$(jq -r .version plugins/beta/.claude-plugin/plugin.json)" = "1.6.2" ] \
  || { echo "FAIL beta plugin.json should stay"; exit 1; }
[ "$(jq -r .version codex-plugins/alpha/.codex-plugin/plugin.json)" = "1.11.0" ] \
  || { echo "FAIL codex/alpha (R-X: only Claude side changed)"; exit 1; }
[ "$(cat .agents/plugins/marketplace.json)" = '{"name":"test-mk-codex"}' ] \
  || { echo "FAIL .agents marketplace must not be touched"; exit 1; }

echo "  integration: full pipeline correct"
