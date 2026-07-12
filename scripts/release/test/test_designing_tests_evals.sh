#!/usr/bin/env bash
# Validate the designing-tests behavior-eval corpus and deterministic scorer.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RUNNER="$ROOT/scripts/eval/designing-tests.js"

node --check "$RUNNER"
node "$RUNNER" validate
node "$RUNNER" self-test

echo "  designing-tests evals: fixtures and scorer contract correct"
