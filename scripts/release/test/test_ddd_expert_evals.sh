#!/usr/bin/env bash
# Validate ddd-expert behavior fixtures and the deterministic scorer without a model call.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RUNNER="$ROOT/scripts/eval/ddd-expert.js"

node --check "$RUNNER"
node "$RUNNER" validate
node "$RUNNER" self-test

echo "  ddd-expert evals: static fixture and scorer checks passed"
