#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../compute-next-version.sh"

setup_repo() {
  local dir
  dir=$(mktemp -d)
  cd "$dir"
  git init -q
  git config user.email t@t
  git config user.name t
  git commit -q --allow-empty -m init
  echo "$dir"
}

assert_eq() {
  if [ "$1" != "$2" ]; then
    echo "  FAIL: expected '$2', got '$1'"
    exit 1
  fi
}

# Case 1: hotfix/* → patch from v1.12.0
dir=$(setup_repo)
git -C "$dir" tag v1.12.0
out=$(cd "$dir" && BRANCH=hotfix/codex bash "$SCRIPT")
assert_eq "$(echo "$out" | grep ^PREV_TAG=)" "PREV_TAG=v1.12.0"
assert_eq "$(echo "$out" | grep ^BUMP_TYPE=)" "BUMP_TYPE=patch"
assert_eq "$(echo "$out" | grep ^NEXT=)" "NEXT=1.12.1"

# Case 2: release/* → minor from v1.12.5
dir=$(setup_repo)
git -C "$dir" tag v1.12.5
out=$(cd "$dir" && BRANCH=release/2026-q2 bash "$SCRIPT")
assert_eq "$(echo "$out" | grep ^BUMP_TYPE=)" "BUMP_TYPE=minor"
assert_eq "$(echo "$out" | grep ^NEXT=)" "NEXT=1.13.0"

# Case 3: breaking/* → major from v1.12.5
dir=$(setup_repo)
git -C "$dir" tag v1.12.5
out=$(cd "$dir" && BRANCH=breaking/api-v2 bash "$SCRIPT")
assert_eq "$(echo "$out" | grep ^BUMP_TYPE=)" "BUMP_TYPE=major"
assert_eq "$(echo "$out" | grep ^NEXT=)" "NEXT=2.0.0"

# Case 4: no tags at all → v0.0.0 baseline → 0.0.1
dir=$(setup_repo)
out=$(cd "$dir" && BRANCH=feat/foo bash "$SCRIPT")
assert_eq "$(echo "$out" | grep ^PREV_TAG=)" "PREV_TAG=v0.0.0"
assert_eq "$(echo "$out" | grep ^NEXT=)" "NEXT=0.0.1"

# Case 5: hyphen-separated branch (release-q2) also treated as minor
dir=$(setup_repo)
git -C "$dir" tag v1.0.0
out=$(cd "$dir" && BRANCH=release-q2 bash "$SCRIPT")
assert_eq "$(echo "$out" | grep ^BUMP_TYPE=)" "BUMP_TYPE=minor"

# Case 6: unrecognized branch → patch (default)
dir=$(setup_repo)
git -C "$dir" tag v3.4.5
out=$(cd "$dir" && BRANCH=random-name bash "$SCRIPT")
assert_eq "$(echo "$out" | grep ^BUMP_TYPE=)" "BUMP_TYPE=patch"
assert_eq "$(echo "$out" | grep ^NEXT=)" "NEXT=3.4.6"

echo "  6 cases passed"
