#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

fail() {
  echo "  FAIL: $*"
  exit 1
}

for track in plugins codex-plugins; do
  base="$ROOT/$track/superpowers-memory/skills"
  for skill in query ingest lint load update rebuild; do
    [ -f "$base/$skill/SKILL.md" ] || fail "$track missing $skill skill"
  done

  grep -q "read-only" "$base/query/SKILL.md" || fail "$track query missing read-only rule"
  grep -q "Memory candidate" "$base/query/SKILL.md" || fail "$track query missing Memory candidate"
  grep -q "bootstrap" "$base/ingest/SKILL.md" || fail "$track ingest missing bootstrap mode"
  grep -q "full-refresh" "$base/ingest/SKILL.md" || fail "$track ingest missing full-refresh mode"
  grep -q "weak hints" "$base/ingest/SKILL.md" || fail "$track ingest missing commit-message downgrade"
  grep -q "without writing" "$base/lint/SKILL.md" || fail "$track lint missing read-only rule"
  grep -q "suggested ingest targets" "$base/lint/SKILL.md" || fail "$track lint missing ingest target output"
  grep -q "superpowers-memory:query" "$base/load/SKILL.md" || fail "$track load not pointing to query"
  grep -q "superpowers-memory:ingest" "$base/update/SKILL.md" || fail "$track update not pointing to ingest"
  grep -q "superpowers-memory:ingest" "$base/rebuild/SKILL.md" || fail "$track rebuild not pointing to ingest"
done

# Codex compatibility aliases must not route agents back to Claude-track skill files.
for skill in load update rebuild; do
  if grep -Eq '(^|[^[:alnum:]_-])plugins/superpowers-memory/skills/' "$ROOT/codex-plugins/superpowers-memory/skills/$skill/SKILL.md"; then
    fail "Codex $skill alias points to Claude-track skill path"
  fi
done

diff -u "$ROOT/plugins/superpowers-memory/content-rules.md" "$ROOT/codex-plugins/superpowers-memory/content-rules.md" >/dev/null \
  || fail "content-rules differ between Claude and Codex"

grep -q 'hook-runtime.js" lint' "$ROOT/plugins/superpowers-memory/skills/lint/SKILL.md" \
  || fail "Claude lint skill missing hook-runtime lint command"
grep -q 'codex-runtime.js" lint' "$ROOT/codex-plugins/superpowers-memory/skills/lint/SKILL.md" \
  || fail "Codex lint skill missing codex-runtime lint command"
grep -q 'hook-runtime.js" verify' "$ROOT/plugins/superpowers-memory/skills/ingest/SKILL.md" \
  || fail "Claude ingest skill missing hook-runtime verify command"
grep -q 'codex-runtime.js" verify' "$ROOT/codex-plugins/superpowers-memory/skills/ingest/SKILL.md" \
  || fail "Codex ingest skill missing codex-runtime verify command"

echo "  memory skill surface checks passed"
