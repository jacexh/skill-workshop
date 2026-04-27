#!/usr/bin/env bash
# Compute next semver tag based on the latest v* tag and PR source branch.
# Inputs (env):
#   BRANCH         — PR source branch name (in CI: GITHUB_HEAD_REF)
# Outputs (stdout): three lines —
#   PREV_TAG=vX.Y.Z   (or v0.0.0 if no v* tags exist)
#   BUMP_TYPE=patch|minor|major
#   NEXT=X.Y.Z
set -euo pipefail

BRANCH="${BRANCH:-}"
if [ -z "$BRANCH" ]; then
  echo "ERROR: BRANCH env var required" >&2
  exit 2
fi

PREV_TAG=$(git tag --sort=version:refname | tail -n 1)
PREV_TAG=${PREV_TAG:-v0.0.0}

if [[ "$BRANCH" =~ ^(release)[/-] ]]; then
  BUMP=minor
elif [[ "$BRANCH" =~ ^(breaking|major)[/-] ]]; then
  BUMP=major
else
  BUMP=patch
fi

VER=${PREV_TAG#v}
IFS='.' read -r MAJ MIN PAT <<< "$VER"
case "$BUMP" in
  patch) PAT=$((PAT+1));;
  minor) MIN=$((MIN+1)); PAT=0;;
  major) MAJ=$((MAJ+1)); MIN=0; PAT=0;;
esac

echo "PREV_TAG=$PREV_TAG"
echo "BUMP_TYPE=$BUMP"
echo "NEXT=$MAJ.$MIN.$PAT"
