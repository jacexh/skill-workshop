#!/usr/bin/env bash
# Minimal test harness — runs every test_*.sh file and reports pass/fail.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0
for t in "$HERE"/test_*.sh; do
  [ -f "$t" ] || continue
  echo "=== $(basename "$t") ==="
  if bash "$t"; then
    echo "  PASS"
    PASS=$((PASS+1))
  else
    echo "  FAIL"
    FAIL=$((FAIL+1))
  fi
done
echo
echo "Summary: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
