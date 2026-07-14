#!/usr/bin/env bash
# Validate the deterministic ddd-expert Context Map checker.
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

Arrow direction: `U -> D` (Upstream -> Downstream model dependency).

```mermaid
graph LR
    a["A"]
    b["B"]
    c["C"]
    d["D"]

    a --> b
    a --> c
    b --> d
    c --> d
```

## Bounded Contexts

### A

- **Core responsibility:** Own A decisions.
- **Business authority:** A facts.

#### Local View

- `A -> B [D]`
- `A -> C [D]`

#### Downstream Contracts

##### A-B Facts

- **Downstream:** B
- **Published meaning:** A facts accepted by B.
- **Guarantee:** A owns publication.

##### A-C Facts

- **Downstream:** C
- **Published meaning:** A facts accepted by C.
- **Guarantee:** A owns publication.

### B

- **Core responsibility:** Own B decisions.
- **Business authority:** B facts.

#### Local View

- `A [U] -> B`
- `B -> D [D]`

#### Upstream Dependencies

##### A-B Facts

- **Upstream:** A
- **Accepted meaning:** B accepts A facts.
- **Local translation:** B translates into B language.

#### Downstream Contracts

##### B-D Facts

- **Downstream:** D
- **Published meaning:** B facts accepted by D.
- **Guarantee:** B owns publication.

### C

- **Core responsibility:** Own C decisions.
- **Business authority:** C facts.

#### Local View

- `A [U] -> C`
- `C -> D [D]`

#### Upstream Dependencies

##### A-C Facts

- **Upstream:** A
- **Accepted meaning:** C accepts A facts.
- **Local translation:** C translates into C language.

#### Downstream Contracts

##### C-D Facts

- **Downstream:** D
- **Published meaning:** C facts accepted by D.
- **Guarantee:** C owns publication.

### D

- **Core responsibility:** Own D decisions.
- **Business authority:** D facts.

#### Local View

- `B [U] -> D`
- `C [U] -> D`

#### Upstream Dependencies

##### B-D Facts

- **Upstream:** B
- **Accepted meaning:** D accepts B facts.
- **Local translation:** D translates into D language.

##### C-D Facts

- **Upstream:** C
- **Accepted meaning:** D accepts C facts.
- **Local translation:** D translates into D language.
EOF

node "$CLAUDE_VALIDATOR" "$valid" >/dev/null ||
  fail "validator rejected a valid fan-out and diamond DAG"

assert_invalid() {
  local fixture="$1"
  local expected="$2"
  local output

  if output="$(node "$CLAUDE_VALIDATOR" "$fixture" 2>&1)"; then
    fail "validator accepted invalid fixture $(basename "$fixture")"
  fi
  printf '%s\n' "$output" | rg -Fq -- "$expected" || {
    printf '%s\n' "$output" >&2
    fail "invalid fixture $(basename "$fixture") did not report $expected"
  }
}

self_loop="$tmp/self-loop.md"
cp "$valid" "$self_loop"
sed -i '/    a --> b/a\    a --> a' "$self_loop"
assert_invalid "$self_loop" "self-loop"

reciprocal="$tmp/reciprocal.md"
cp "$valid" "$reciprocal"
sed -i '/    a --> b/a\    b --> a' "$reciprocal"
assert_invalid "$reciprocal" "reciprocal"

cycle="$tmp/cycle.md"
cp "$valid" "$cycle"
sed -i '/    c --> d/a\    d --> a' "$cycle"
assert_invalid "$cycle" "cycle"

bidirectional="$tmp/bidirectional.md"
sed 's/a --> b/a <--> b/' "$valid" >"$bidirectional"
assert_invalid "$bidirectional" "bidirectional"

text_bidirectional="$tmp/text-bidirectional.md"
cp "$valid" "$text_bidirectional"
sed -i '/\*\*Business authority:\*\* A facts\./a\- **Legacy relation:** Work <-> Project Knowledge' "$text_bidirectional"
assert_invalid "$text_bidirectional" "bidirectional"

partnership="$tmp/partnership.md"
cp "$valid" "$partnership"
sed -i '/\*\*Business authority:\*\* A facts\./a\- **Relationship:** Partnership' "$partnership"
assert_invalid "$partnership" "Partnership"

shared_kernel="$tmp/shared-kernel.md"
cp "$valid" "$shared_kernel"
sed -i '/\*\*Business authority:\*\* A facts\./a\- **Relationship:** Shared Kernel' "$shared_kernel"
assert_invalid "$shared_kernel" "Shared Kernel"

local_mismatch="$tmp/local-mismatch.md"
sed '/`A -> C \[D\]`/d' "$valid" >"$local_mismatch"
assert_invalid "$local_mismatch" "Local View"

non_neighbor="$tmp/non-neighbor.md"
cp "$valid" "$non_neighbor"
sed -i '/`A -> C \[D\]`/a\- `A -> D [D]`' "$non_neighbor"
assert_invalid "$non_neighbor" "Local View"

contract_mismatch="$tmp/contract-mismatch.md"
sed '0,/##### A-B Facts/{s/##### A-B Facts/##### Wrong Contract/}' "$valid" >"$contract_mismatch"
assert_invalid "$contract_mismatch" "contract projection"

endpoint_mismatch="$tmp/endpoint-mismatch.md"
sed '0,/- \*\*Downstream:\*\* B/{s/- \*\*Downstream:\*\* B/- **Downstream:** D/}' "$valid" >"$endpoint_mismatch"
assert_invalid "$endpoint_mismatch" "contract projection"

echo "  ddd-expert Context Map validator tests passed"
