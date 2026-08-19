#!/usr/bin/env bash
# Validate the sparse table-based ddd-expert Context Map checker.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLAUDE_VALIDATOR="$ROOT/plugins/ddd-expert/scripts/validate-context-map.mjs"
CODEX_VALIDATOR="$ROOT/codex-plugins/ddd-expert/scripts/validate-context-map.mjs"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

[ -f "$CLAUDE_VALIDATOR" ] || fail "Claude Context Map validator missing"
[ -f "$CODEX_VALIDATOR" ] || fail "Codex Context Map validator missing"
cmp -s "$CLAUDE_VALIDATOR" "$CODEX_VALIDATOR" ||
  fail "Claude and Codex Context Map validators should match"
node --check "$CLAUDE_VALIDATOR"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

valid="$tmp/valid.md"
cat >"$valid" <<'EOF'
# Context Map

## Bounded Contexts

| Bounded Context | Purpose | Model |
|---|---|---|
| A | Owns A decisions. | [Model](context/a/model.md) |
| B | Owns B decisions. | [Model](context/b/model.md) |
| C | Owns isolated C decisions. | [Model](context/c/model.md) |

## Semantic Dependencies

| Upstream | Downstream | Published contract | Downstream use |
|---|---|---|---|
| A | B | A Facts | B translates A Facts into local eligibility. |
EOF

expected='valid Context Map: 3 contexts, 1 dependencies'
actual="$(node "$CLAUDE_VALIDATOR" "$valid")" || fail "validator rejected valid sparse Context Map"
[ "$actual" = "$expected" ] || fail "unexpected valid output: $actual"
[ "$(node "$CODEX_VALIDATOR" "$valid")" = "$expected" ] ||
  fail "Codex validator rejected valid sparse Context Map"
[ "$(node "$CLAUDE_VALIDATOR" --allow-legacy "$valid")" = "$expected" ] ||
  fail "--allow-legacy CLI compatibility changed"

assert_invalid() {
  local fixture="$1"
  local expected_message="$2"
  local output
  if output="$(node "$CLAUDE_VALIDATOR" "$fixture" 2>&1)"; then
    fail "validator accepted invalid fixture $(basename "$fixture")"
  fi
  printf '%s\n' "$output" | rg -Fq -- "$expected_message" || {
    printf '%s\n' "$output" >&2
    fail "invalid fixture $(basename "$fixture") did not report $expected_message"
  }
}

no_dependencies="$tmp/no-dependencies.md"
sed '/^| A | B | A Facts |/d' "$valid" >"$no_dependencies"
[ "$(node "$CLAUDE_VALIDATOR" "$no_dependencies")" = 'valid Context Map: 3 contexts, 0 dependencies' ] ||
  fail "validator should accept a Context Map without semantic dependencies"

preamble="$tmp/preamble.md"
{
  printf '%s\n\n' '# Meeting transcript' 'Rejected alternative: merge A and B.'
  cat "$valid"
} >"$preamble"
assert_invalid "$preamble" "expected exactly one # Context Map heading and no preamble"

intro_prose="$tmp/intro-prose.md"
sed '1a\
\
Meeting transcript: rejected alternative was to merge A and B.' "$valid" >"$intro_prose"
assert_invalid "$intro_prose" "Context Map may contain only its heading and two tables"

duplicate_context="$tmp/duplicate-context.md"
sed '/^| B | Owns B decisions/a| A | Owns duplicate A decisions. | [Model](context/another-a/model.md) |' "$valid" >"$duplicate_context"
assert_invalid "$duplicate_context" "duplicate Bounded Context A"

missing_model="$tmp/missing-model.md"
sed 's#\[Model\](context/a/model.md)#A Model#' "$valid" >"$missing_model"
assert_invalid "$missing_model" "needs one context/<slug>/model.md link"

bad_model="$tmp/bad-model.md"
sed 's#context/a/model.md#context/a/README.md#' "$valid" >"$bad_model"
assert_invalid "$bad_model" "needs one context/<slug>/model.md link"

unknown_context="$tmp/unknown-context.md"
sed 's/^| A | B | A Facts |/| A | D | A Facts |/' "$valid" >"$unknown_context"
assert_invalid "$unknown_context" "names an unknown Bounded Context"

self_dependency="$tmp/self-dependency.md"
sed 's/^| A | B | A Facts |/| A | A | A Facts |/' "$valid" >"$self_dependency"
assert_invalid "$self_dependency" "self dependency A -> A"

duplicate_dependency="$tmp/duplicate-dependency.md"
sed '/^| A | B | A Facts |/a| A | B | A Facts | B uses the same contract twice. |' "$valid" >"$duplicate_dependency"
assert_invalid "$duplicate_dependency" "duplicate dependency A -> B for A Facts"

cycle="$tmp/cycle.md"
sed '/^| A | B | A Facts |/a| B | A | B Facts | A translates B Facts. |' "$valid" >"$cycle"
assert_invalid "$cycle" "semantic dependencies must be acyclic"

diagram="$tmp/diagram.md"
cat "$valid" >"$diagram"
cat >>"$diagram" <<'EOF'

```mermaid
graph LR
A --> B
```
EOF
assert_invalid "$diagram" "Context Map must not contain diagrams"

old_section="$tmp/old-section.md"
sed '/^## Bounded Contexts$/i## Global View\n' "$valid" >"$old_section"
assert_invalid "$old_section" "expected exactly ## Bounded Contexts then ## Semantic Dependencies"

echo "PASS ddd-expert Context Map validator"
