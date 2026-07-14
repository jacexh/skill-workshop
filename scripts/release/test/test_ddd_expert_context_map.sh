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

Arrow direction: `U -> D` (Upstream model/published-contract influence -> Downstream model). It does not describe runtime call flow.

```mermaid
graph LR
    a["A"]
    b["B"]
    c["C"]
    d["D"]
    e["E"]

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

### E

- **Core responsibility:** Own isolated E decisions.
- **Business authority:** E facts.

#### Local View

- No context dependencies.
EOF

node "$CLAUDE_VALIDATOR" "$valid" >/dev/null ||
  fail "validator rejected a valid fan-out, diamond, and isolated-context DAG"

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

missing_direction="$tmp/missing-direction.md"
sed '/^Arrow direction:/d' "$valid" >"$missing_direction"
assert_invalid "$missing_direction" "Arrow direction"

duplicate_direction="$tmp/duplicate-direction.md"
cp "$valid" "$duplicate_direction"
sed -i '/^Arrow direction:/p' "$duplicate_direction"
assert_invalid "$duplicate_direction" "Arrow direction"

graph_outside_mermaid="$tmp/graph-outside-mermaid.md"
sed '0,/^```mermaid$/{s/^```mermaid$//}; 0,/^```$/{s/^```$//}' "$valid" >"$graph_outside_mermaid"
assert_invalid "$graph_outside_mermaid" "Mermaid graph LR"

duplicate_mermaid="$tmp/duplicate-mermaid.md"
cp "$valid" "$duplicate_mermaid"
sed -i '/^## Bounded Contexts$/i\
```mermaid\
graph LR\
```\
' "$duplicate_mermaid"
assert_invalid "$duplicate_mermaid" "exactly one Mermaid"

equivalent_global_heading="$tmp/equivalent-global-heading.md"
cp "$valid" "$equivalent_global_heading"
sed -i '/^## Global View$/i\
## Global View ##\
\
Arrow direction: `U -> D` (Upstream model/published-contract influence -> Downstream model). It does not describe runtime call flow.\
\
```mermaid\
graph LR\
    shadow["Shadow"]\
```\
' "$equivalent_global_heading"
assert_invalid "$equivalent_global_heading" "canonical ATX heading"

indented_global_heading="$tmp/indented-global-heading.md"
cp "$valid" "$indented_global_heading"
sed -i '/^## Global View$/i\
 ## Global View\
\
Arrow direction: `U -> D` (Upstream model/published-contract influence -> Downstream model). It does not describe runtime call flow.\
' "$indented_global_heading"
assert_invalid "$indented_global_heading" "canonical ATX heading"

entity_global_heading="$tmp/entity-global-heading.md"
cp "$valid" "$entity_global_heading"
sed -i '/^## Global View$/i\
## Global V&#105;ew\
' "$entity_global_heading"
assert_invalid "$entity_global_heading" "plain-text ATX headings"

setext_global_heading="$tmp/setext-global-heading.md"
cp "$valid" "$setext_global_heading"
sed -i '/^## Global View$/i\
Global View\
-----------\
' "$setext_global_heading"
assert_invalid "$setext_global_heading" "Setext headings"

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

duplicate_local="$tmp/duplicate-local.md"
cp "$valid" "$duplicate_local"
sed -i '0,/`A -> B \[D\]`/{/`A -> B \[D\]`/p}' "$duplicate_local"
assert_invalid "$duplicate_local" "duplicate Local View"

unbackticked_local="$tmp/unbackticked-local.md"
cp "$valid" "$unbackticked_local"
sed -i '0,/`A -> B \[D\]`/{/`A -> B \[D\]`/a\- A -> B [D]
}' "$unbackticked_local"
assert_invalid "$unbackticked_local" "Local View"

duplicate_isolated_marker="$tmp/duplicate-isolated-marker.md"
cp "$valid" "$duplicate_isolated_marker"
sed -i '/^- No context dependencies\.$/p' "$duplicate_isolated_marker"
assert_invalid "$duplicate_isolated_marker" "duplicate Local View"

equivalent_local_heading="$tmp/equivalent-local-heading.md"
cp "$valid" "$equivalent_local_heading"
sed -i '0,/- \*\*Business authority:\*\* A facts\./{/- \*\*Business authority:\*\* A facts\./a\
\
#### Local View ####\
\
- `A -> B [D]`\
- `A -> C [D]`
}' "$equivalent_local_heading"
assert_invalid "$equivalent_local_heading" "canonical ATX heading"

indented_local_heading="$tmp/indented-local-heading.md"
cp "$valid" "$indented_local_heading"
sed -i '0,/- \*\*Business authority:\*\* A facts\./{/- \*\*Business authority:\*\* A facts\./a\
\
  #### Local View\
\
- `A -> B [D]`\
- `A -> C [D]`
}' "$indented_local_heading"
assert_invalid "$indented_local_heading" "canonical ATX heading"

formatted_local_heading="$tmp/formatted-local-heading.md"
cp "$valid" "$formatted_local_heading"
sed -i '0,/- \*\*Business authority:\*\* A facts\./{/- \*\*Business authority:\*\* A facts\./a\
\
#### *Local View*\
\
- `A -> B [D]`\
- `A -> C [D]`
}' "$formatted_local_heading"
assert_invalid "$formatted_local_heading" "plain-text ATX headings"

spaced_local_heading="$tmp/spaced-local-heading.md"
cp "$valid" "$spaced_local_heading"
sed -i '0,/- \*\*Business authority:\*\* A facts\./{/- \*\*Business authority:\*\* A facts\./a\
\
#### Local  View\
\
- `A -> B [D]`\
- `A -> C [D]`
}' "$spaced_local_heading"
assert_invalid "$spaced_local_heading" "single-space ATX heading"

tabbed_local_heading="$tmp/tabbed-local-heading.md"
cp "$valid" "$tabbed_local_heading"
sed -i '0,/- \*\*Business authority:\*\* A facts\./{/- \*\*Business authority:\*\* A facts\./a\
\
#### Local\tView\
\
- `A -> B [D]`\
- `A -> C [D]`
}' "$tabbed_local_heading"
assert_invalid "$tabbed_local_heading" "single-space ATX heading"

blockquoted_heading="$tmp/blockquoted-heading.md"
cp "$valid" "$blockquoted_heading"
sed -i '/^## Global View$/i\
> ## Global View\
' "$blockquoted_heading"
assert_invalid "$blockquoted_heading" "blockquotes"

list_nested_heading="$tmp/list-nested-heading.md"
cp "$valid" "$list_nested_heading"
sed -i '/^## Global View$/i\
- ## Global View\
' "$list_nested_heading"
assert_invalid "$list_nested_heading" "nested headings"

list_blockquote_heading="$tmp/list-blockquote-heading.md"
cp "$valid" "$list_blockquote_heading"
sed -i '/^## Global View$/i\
- > ## Global View\
' "$list_blockquote_heading"
assert_invalid "$list_blockquote_heading" "nested Markdown containers"

recursive_list_heading="$tmp/recursive-list-heading.md"
cp "$valid" "$recursive_list_heading"
sed -i '/^## Global View$/i\
- - ## Global View\
' "$recursive_list_heading"
assert_invalid "$recursive_list_heading" "nested Markdown containers"

list_continuation_heading="$tmp/list-continuation-heading.md"
cp "$valid" "$list_continuation_heading"
sed -i '/^## Global View$/i\
- wrapper\
    ## Global View\
' "$list_continuation_heading"
assert_invalid "$list_continuation_heading" "indentation outside the Mermaid graph"

fenced_context_structure="$tmp/fenced-context-structure.md"
cp "$valid" "$fenced_context_structure"
sed -i '/^### A$/a\
```text
' "$fenced_context_structure"
sed -i '/^### B$/i\
```\
' "$fenced_context_structure"
assert_invalid "$fenced_context_structure" "code fence"

commented_context_structure="$tmp/commented-context-structure.md"
cp "$valid" "$commented_context_structure"
sed -i '/^### A$/a\
<!--
' "$commented_context_structure"
sed -i '/^### B$/i\
-->\
' "$commented_context_structure"
assert_invalid "$commented_context_structure" "HTML comments"

raw_html_document="$tmp/raw-html-document.md"
cp "$valid" "$raw_html_document"
sed -i '/^### A$/a\
<pre>
' "$raw_html_document"
sed -i '/^### B$/i\
</pre>
' "$raw_html_document"
assert_invalid "$raw_html_document" "raw HTML"

contract_mismatch="$tmp/contract-mismatch.md"
sed '0,/##### A-B Facts/{s/##### A-B Facts/##### Wrong Contract/}' "$valid" >"$contract_mismatch"
assert_invalid "$contract_mismatch" "contract projection"

endpoint_mismatch="$tmp/endpoint-mismatch.md"
sed '0,/- \*\*Downstream:\*\* B/{s/- \*\*Downstream:\*\* B/- **Downstream:** D/}' "$valid" >"$endpoint_mismatch"
assert_invalid "$endpoint_mismatch" "contract projection"

duplicate_contract="$tmp/duplicate-contract.md"
cp "$valid" "$duplicate_contract"
sed -i '0,/^##### A-C Facts$/{/^##### A-C Facts$/i\
##### A-B Facts\
\
- **Downstream:** B\
- **Published meaning:** A facts accepted by B.\
- **Guarantee:** A owns publication.\

}' "$duplicate_contract"
assert_invalid "$duplicate_contract" "duplicate contract projection"

conflicting_endpoint="$tmp/conflicting-endpoint.md"
cp "$valid" "$conflicting_endpoint"
sed -i '0,/- \*\*Downstream:\*\* B/{/- \*\*Downstream:\*\* B/a\- **Downstream:** D
}' "$conflicting_endpoint"
assert_invalid "$conflicting_endpoint" "contract projection"

missing_published_meaning="$tmp/missing-published-meaning.md"
sed '0,/- \*\*Published meaning:\*\*/{/- \*\*Published meaning:\*\*/d}' "$valid" >"$missing_published_meaning"
assert_invalid "$missing_published_meaning" "contract semantics"

missing_guarantee="$tmp/missing-guarantee.md"
sed '0,/- \*\*Guarantee:\*\*/{/- \*\*Guarantee:\*\*/d}' "$valid" >"$missing_guarantee"
assert_invalid "$missing_guarantee" "contract semantics"

missing_accepted_meaning="$tmp/missing-accepted-meaning.md"
sed '0,/- \*\*Accepted meaning:\*\*/{/- \*\*Accepted meaning:\*\*/d}' "$valid" >"$missing_accepted_meaning"
assert_invalid "$missing_accepted_meaning" "contract semantics"

missing_local_translation="$tmp/missing-local-translation.md"
sed '0,/- \*\*Local translation:\*\*/{/- \*\*Local translation:\*\*/d}' "$valid" >"$missing_local_translation"
assert_invalid "$missing_local_translation" "contract semantics"

duplicate_semantics="$tmp/duplicate-semantics.md"
cp "$valid" "$duplicate_semantics"
sed -i '0,/- \*\*Guarantee:\*\*/{/- \*\*Guarantee:\*\*/p}' "$duplicate_semantics"
assert_invalid "$duplicate_semantics" "contract semantics"

equivalent_contract_headings="$tmp/equivalent-contract-headings.md"
cp "$valid" "$equivalent_contract_headings"
sed -i '0,/^##### A-C Facts$/{/^##### A-C Facts$/i\
##### A-B Facts #####\
\
- **Downstream:** B\
- **Published meaning:** A facts accepted by B.\
- **Guarantee:** A owns publication.\

}' "$equivalent_contract_headings"
sed -i '0,/^##### B-D Facts$/{/^##### B-D Facts$/i\
##### A-B Facts #####\
\
- **Upstream:** A\
- **Accepted meaning:** B accepts A facts.\
- **Local translation:** B translates into B language.\

}' "$equivalent_contract_headings"
assert_invalid "$equivalent_contract_headings" "canonical ATX heading"

echo "  ddd-expert Context Map validator tests passed"
