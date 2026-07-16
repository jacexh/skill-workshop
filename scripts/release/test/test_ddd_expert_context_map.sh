#!/usr/bin/env bash
# Validate the deterministic, relationship-centric ddd-expert Context Map checker.
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

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

valid="$tmp/valid.md"
cat >"$valid" <<'EOF'
# Context Map

## Global View

Arrow direction: `U -> D` (Upstream model/published-contract influence -> Downstream model). It does not describe runtime call flow.

```mermaid
graph LR
    a["A"]
    b["B"]
    c["C"]

    a --> b
```

## Bounded Contexts

### A

- **Core responsibility:** Own A decisions.
- **Business authority:** A facts.
- **Model:** [A](context/a/model.md)

#### Local View

```text
+---+   +---+
| A |-->| B |
+---+   +---+
```

### B

- **Core responsibility:** Own B decisions.
- **Business authority:** B facts.
- **Model:** [B](context/b/model.md)

### C

- **Core responsibility:** Own isolated C decisions.
- **Business authority:** C facts.
- **Model:** [C](context/c/model.md)

## Model Dependency Contracts

### A-B Facts

- **Upstream:** A
- **Downstream:** B
- **Published meaning:** A facts exposed in A language.
- **Downstream reliance:** B may rely on published A facts.
- **Local translation:** B translates the facts into B language.
- **Guarantee:** A owns authoritative publication.

EOF

expected='valid Context Map: 3 contexts, 1 dependencies'
actual="$(node "$CLAUDE_VALIDATOR" "$valid")" || fail "validator rejected valid relationship-centric Context Map"
[ "$actual" = "$expected" ] || fail "unexpected valid output: $actual"
actual="$(node "$CODEX_VALIDATOR" "$valid")" || fail "Codex validator rejected valid Context Map"
[ "$actual" = "$expected" ] || fail "unexpected Codex valid output: $actual"

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

# Local View is optional, but remains a strict direct-neighbor projection when present.
without_local="$tmp/without-local.md"
awk '
  $0 == "#### Local View" { skipping = 1; next }
  skipping && $0 == "```text" { in_fence = 1; next }
  skipping && in_fence && $0 == "```" { skipping = 0; in_fence = 0; next }
  skipping { next }
  { print }
' "$valid" >"$without_local"
node "$CLAUDE_VALIDATOR" "$without_local" >/dev/null || fail "validator requires an optional Local View"

bad_local="$tmp/bad-local.md"
sed 's/^| A |-->| B |$/| B |-->| A |/' "$valid" >"$bad_local"
assert_invalid "$bad_local" "Local View"

[ "$(node "$CLAUDE_VALIDATOR" --allow-legacy "$valid")" = "$expected" ] ||
  fail "--allow-legacy CLI compatibility changed"

missing_model="$tmp/missing-model.md"
sed '0,/^- \*\*Model:\*\*/{/^- \*\*Model:\*\*/d;}' "$valid" >"$missing_model"
assert_invalid "$missing_model" "Model link"

bad_model="$tmp/bad-model.md"
sed '0,/context\/a\/model\.md/s//context\/a\/README.md/' "$valid" >"$bad_model"
assert_invalid "$bad_model" "Model link"

mismatched_model="$tmp/mismatched-model.md"
sed '0,/\[A\](context\/a\/model\.md)/s//[B](context\/a\/model.md)/' "$valid" >"$mismatched_model"
assert_invalid "$mismatched_model" "matching Model link"

legacy_projection="$tmp/legacy-projection.md"
sed '/^## Model Dependency Contracts$/i\
#### Upstream Dependencies\
' "$valid" >"$legacy_projection"
assert_invalid "$legacy_projection" "unsupported context section"

missing_contract="$tmp/missing-contract.md"
awk '
  $0 == "## Model Dependency Contracts" { print; skipping = 1; next }
  !skipping { print }
' "$valid" >"$missing_contract"
assert_invalid "$missing_contract" "detail is missing for A -> B"

wrong_contract_endpoint="$tmp/wrong-contract-endpoint.md"
sed 's/^- \*\*Downstream:\*\* B$/- **Downstream:** C/' "$valid" >"$wrong_contract_endpoint"
assert_invalid "$wrong_contract_endpoint" "are absent from Global View"

duplicate_contract="$tmp/duplicate-contract.md"
cat "$valid" >"$duplicate_contract"
cat >>"$duplicate_contract" <<'EOF'

### A-B Facts

- **Upstream:** A
- **Downstream:** B
- **Published meaning:** Other A facts.
- **Downstream reliance:** B relies on other facts.
- **Local translation:** B translates other facts.
- **Guarantee:** A owns the other publication.
EOF
assert_invalid "$duplicate_contract" "duplicate detail name A-B Facts"

missing_contract_field="$tmp/missing-contract-field.md"
sed '/^- \*\*Downstream reliance:\*\*/d' "$valid" >"$missing_contract_field"
assert_invalid "$missing_contract_field" "must declare Downstream reliance exactly once"

unknown_contract_field="$tmp/unknown-contract-field.md"
sed '/^- \*\*Guarantee:\*\*/a\- **Legacy relation:** A directs B.' "$valid" >"$unknown_contract_field"
assert_invalid "$unknown_contract_field" "unsupported field"

interaction_view="$tmp/interaction-view.md"
sed '/^## Bounded Contexts$/i\
## Interaction View\
' "$valid" >"$interaction_view"
assert_invalid "$interaction_view" "expected exactly ## Global View, ## Bounded Contexts"

cycle="$tmp/cycle.md"
sed '/^    a --> b$/a\    b --> a' "$valid" >"$cycle"
assert_invalid "$cycle" "reciprocal dependency"

partnership="$tmp/partnership.md"
sed '/^- \*\*Guarantee:\*\*/a\- **Collaboration pattern:** Partnership' "$valid" >"$partnership"
assert_invalid "$partnership" "Partnership"

echo "PASS ddd-expert Context Map validator"
