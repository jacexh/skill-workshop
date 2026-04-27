#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../detect-changed-plugins.sh"

setup_repo() {
  local dir
  dir=$(mktemp -d)
  cd "$dir"
  git init -q
  git config user.email t@t
  git config user.name t
  mkdir -p plugins/foo plugins/bar codex-plugins/foo codex-plugins/baz docs
  echo init > plugins/foo/x.md
  echo init > plugins/bar/x.md
  echo init > codex-plugins/foo/x.md
  echo init > codex-plugins/baz/x.md
  echo init > docs/x.md
  git add -A
  git commit -q -m init
  git tag v1.0.0
  echo "$dir"
}

assert_eq() {
  if [ "$1" != "$2" ]; then
    echo "  FAIL: expected '$2', got '$1'"
    exit 1
  fi
}

# Case 1: change one Claude plugin only
dir=$(setup_repo)
echo change >> "$dir/plugins/foo/x.md"
git -C "$dir" add -A && git -C "$dir" commit -q -m c
out=$(cd "$dir" && bash "$SCRIPT" v1.0.0)
assert_eq "$(echo "$out" | grep ^CLAUDE_PLUGINS=)" "CLAUDE_PLUGINS=foo"
assert_eq "$(echo "$out" | grep ^CODEX_PLUGINS=)" "CODEX_PLUGINS="

# Case 2: change Claude + Codex plugins (different names) + a docs file
dir=$(setup_repo)
echo c >> "$dir/plugins/bar/x.md"
echo c >> "$dir/codex-plugins/foo/x.md"
echo c >> "$dir/codex-plugins/baz/x.md"
echo c >> "$dir/docs/x.md"
git -C "$dir" add -A && git -C "$dir" commit -q -m c
out=$(cd "$dir" && bash "$SCRIPT" v1.0.0)
assert_eq "$(echo "$out" | grep ^CLAUDE_PLUGINS=)" "CLAUDE_PLUGINS=bar"
assert_eq "$(echo "$out" | grep ^CODEX_PLUGINS=)" "CODEX_PLUGINS=baz foo"

# Case 3: only docs change → both lists empty
dir=$(setup_repo)
echo c >> "$dir/docs/x.md"
git -C "$dir" add -A && git -C "$dir" commit -q -m c
out=$(cd "$dir" && bash "$SCRIPT" v1.0.0)
assert_eq "$(echo "$out" | grep ^CLAUDE_PLUGINS=)" "CLAUDE_PLUGINS="
assert_eq "$(echo "$out" | grep ^CODEX_PLUGINS=)" "CODEX_PLUGINS="

# Case 4: same plugin touched in two commits → reported once (sort -u)
dir=$(setup_repo)
echo c >> "$dir/plugins/foo/x.md"
git -C "$dir" add -A && git -C "$dir" commit -q -m c1
echo c2 >> "$dir/plugins/foo/y.md"
git -C "$dir" add -A && git -C "$dir" commit -q -m c2
out=$(cd "$dir" && bash "$SCRIPT" v1.0.0)
assert_eq "$(echo "$out" | grep ^CLAUDE_PLUGINS=)" "CLAUDE_PLUGINS=foo"

echo "  4 cases passed"
