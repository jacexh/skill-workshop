#!/usr/bin/env bash
# Validate the deterministic ddd-expert Context Map checker.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLAUDE_VALIDATOR="$ROOT/plugins/ddd-expert/scripts/validate-context-map.mjs"
CODEX_VALIDATOR="$ROOT/codex-plugins/ddd-expert/scripts/validate-context-map.mjs"
CLAUDE_TEMPLATE="$ROOT/plugins/ddd-expert/templates/context-map.md"
CODEX_TEMPLATE="$ROOT/codex-plugins/ddd-expert/templates/context-map.md"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

[ -f "$CLAUDE_VALIDATOR" ] || fail "Claude Context Map validator missing"
[ -f "$CODEX_VALIDATOR" ] || fail "Codex Context Map validator missing"
cmp -s "$CLAUDE_VALIDATOR" "$CODEX_VALIDATOR" ||
  fail "Claude and Codex Context Map validators should match"
[ -f "$CLAUDE_TEMPLATE" ] || fail "Claude Context Map template missing"
[ -f "$CODEX_TEMPLATE" ] || fail "Codex Context Map template missing"
cmp -s "$CLAUDE_TEMPLATE" "$CODEX_TEMPLATE" ||
  fail "Claude and Codex Context Map templates should match"

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

```text
+---+         +---+
| A |--+----->| B |
+---+  |      +---+
       |
       |      +---+
       +----->| C |
              +---+
```

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

```text
+---+   +---+   +---+
| A |-->| B |-->| D |
+---+   +---+   +---+
```

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

```text
+---+   +---+   +---+
| A |-->| C |-->| D |
+---+   +---+   +---+
```

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

```text
+---+
| B |--+
+---+  |
       |
+---+  |      +---+
| C |--+----->| D |
+---+         +---+
```

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

```text
+---+
| E |
+---+
```
EOF

legacy_output="$(node "$CLAUDE_VALIDATOR" --allow-legacy "$valid")" ||
  fail "validator rejected a valid fan-out, diamond, and isolated-context DAG"
valid_expected_output='valid Context Map: 5 contexts, 4 dependencies'
[ "$legacy_output" = "$valid_expected_output" ] ||
  fail "legacy validator output changed unexpectedly: $legacy_output"
codex_valid_output="$(node "$CODEX_VALIDATOR" --allow-legacy "$valid")" ||
  fail "Codex validator rejected the valid Context Map"
[ "$codex_valid_output" = "$valid_expected_output" ] ||
  fail "Codex Context Map validator output changed unexpectedly: $codex_valid_output"

rendered_template="$tmp/rendered-template.md"
node - "$CLAUDE_TEMPLATE" "$rendered_template" <<'NODE'
const fs = require("fs");
let source = fs.readFileSync(process.argv[2], "utf8").replace(/<!--[\s\S]*?-->/gu, "");
for (const [placeholder, value] of [
  ["<Context A>", "Decision Authority"],
  ["<Context B>", "Request Coordination"],
  ["<Upstream Context>", "Decision Authority"],
  ["<Downstream Context>", "Request Coordination"],
  ["<Interaction Name>", "Request Decision"],
  ["<Business capability owned by this context>", "Own context decisions"],
  ["<Facts and decisions for which this context is authoritative>", "Context facts and decisions"],
  ["<Contract Name>", "Decision Facts"],
  ["<Upstream facts, decisions, or guarantees exposed in upstream language>", "Decision facts accepted by Request Coordination"],
  ["<Authority, ordering, durability, or failure guarantee the upstream owns>", "Decision Authority owns publication"],
  ["<Receiving Context>", "Decision Authority"],
  ["<Business or runtime condition that initiates the interaction>", "Request Coordination needs a decision"],
  ["<Result, rejection, timeout, or recovery meaning visible to the initiator>", "Decision Authority returns a result or rejection"],
  ["<Published meaning this context is allowed to rely on>", "Request Coordination accepts Decision Facts"],
  ["<How the downstream protects and expresses its local language>", "Request Coordination translates into local language"],
]) {
  source = source.split(placeholder).join(value);
}
source = source.replace(/\n{3,}/gu, "\n\n").trim() + "\n";
if (/<[^>\n]+>/u.test(source)) throw new Error("rendered Context Map template retains a placeholder");
fs.writeFileSync(process.argv[3], source);
NODE
template_output="$(node "$CLAUDE_VALIDATOR" "$rendered_template")" ||
  fail "instantiated Context Map template is not strict-validator compatible"
template_expected_output='valid Context Map: 2 contexts, 1 dependencies, 1 interactions'
[ "$template_output" = "$template_expected_output" ] ||
  fail "instantiated Context Map template output changed unexpectedly: $template_output"

context_named_u="$tmp/context-named-u.md"
sed \
  -e 's/^    e\["E"\]$/    u["U"]/' \
  -e 's/^### E$/### U/' \
  -e 's/isolated E decisions/isolated U decisions/' \
  -e 's/^- \*\*Business authority:\*\* E facts\.$/- **Business authority:** U facts./' \
  -e 's/^| E |$/| U |/' \
  "$valid" >"$context_named_u"
node "$CLAUDE_VALIDATOR" --allow-legacy "$context_named_u" >/dev/null ||
  fail "validator confused a Bounded Context named U with a Local View direction label"

multiline_continuation="$tmp/multiline-continuation.md"
cp "$valid" "$multiline_continuation"
sed -i '/^- \*\*Core responsibility:\*\* Own A decisions\.$/a\  This continuation remains part of the same business description.' "$multiline_continuation"
sed -i '0,/- \*\*Published meaning:\*\*/{/- \*\*Published meaning:\*\*/a\  This continuation clarifies the same published fact.
}' "$multiline_continuation"
sed -i '0,/^  This continuation clarifies/{/^  This continuation clarifies/a\    Four-space continuation remains ordinary prose inside the list item.
}' "$multiline_continuation"
node "$CLAUDE_VALIDATOR" --allow-legacy "$multiline_continuation" >/dev/null ||
  fail "validator rejected an ordinary Markdown bullet continuation"

indented_code_continuation="$tmp/indented-code-continuation.md"
cp "$valid" "$indented_code_continuation"
sed -i '/^- \*\*Core responsibility:\*\* Own A decisions\.$/a\      This six-space line is an indented code block inside the list item.' "$indented_code_continuation"
if node "$CLAUDE_VALIDATOR" --allow-legacy "$indented_code_continuation" >/dev/null 2>&1; then
  fail "validator accepted an indented code block as ordinary bullet continuation"
fi

domain_partnership="$tmp/domain-partnership.md"
cp "$valid" "$domain_partnership"
sed -i '/^    e\["E"\]$/a\    partnership["Partnership"]' "$domain_partnership"
cat >>"$domain_partnership" <<'EOF'

### Partnership

- **Core responsibility:** Own Partnership decisions.
- **Business authority:** Partnership facts.

#### Local View

```text
+-------------+
| Partnership |
+-------------+
```
EOF
node "$CLAUDE_VALIDATOR" --allow-legacy "$domain_partnership" >/dev/null ||
  fail "validator confused a Bounded Context named Partnership with a Context Map pattern"

domain_shared_kernel="$tmp/domain-shared-kernel.md"
cp "$valid" "$domain_shared_kernel"
sed -i '/^    e\["E"\]$/a\    shared_kernel["Shared Kernel"]' "$domain_shared_kernel"
cat >>"$domain_shared_kernel" <<'EOF'

### Shared Kernel

- **Core responsibility:** Own Shared Kernel decisions.
- **Business authority:** Shared Kernel facts.

#### Local View

```text
+---------------+
| Shared Kernel |
+---------------+
```
EOF
node "$CLAUDE_VALIDATOR" --allow-legacy "$domain_shared_kernel" >/dev/null ||
  fail "validator confused a Bounded Context named Shared Kernel with a Context Map pattern"

document_node_id="$tmp/document-node-id.md"
cp "$valid" "$document_node_id"
sed -i 's/^    a\["A"\]$/    upstream_a["A"]/; s/^    a --> /    upstream_a --> /' "$document_node_id"
node "$CLAUDE_VALIDATOR" --allow-legacy "$document_node_id" >/dev/null ||
  fail "validator should accept a unique lower_snake_case node identifier without inferring a directory slug"

assert_invalid() {
  local fixture="$1"
  local expected="$2"
  local output

  if output="$(node "$CLAUDE_VALIDATOR" --allow-legacy "$fixture" 2>&1)"; then
    fail "validator accepted invalid fixture $(basename "$fixture")"
  fi
  printf '%s\n' "$output" | rg -Fq -- "$expected" || {
    printf '%s\n' "$output" >&2
    fail "invalid fixture $(basename "$fixture") did not report $expected"
  }
}

assert_invalid_strict() {
  local fixture="$1"
  local expected="$2"
  local output

  if output="$(node "$CLAUDE_VALIDATOR" "$fixture" 2>&1)"; then
    fail "strict validator accepted invalid fixture $(basename "$fixture")"
  fi
  printf '%s\n' "$output" | rg -Fq -- "$expected" || {
    printf '%s\n' "$output" >&2
    fail "invalid strict fixture $(basename "$fixture") did not report $expected"
  }
}

assert_invalid_strict "$valid" "Interaction View"

add_interaction_view() {
  local source="$1"
  local target="$2"
  local include_edge="$3"

  awk -v include_edge="$include_edge" '
    $0 == "## Bounded Contexts" {
      print "## Interaction View"
      print ""
      print "Arrow direction: `initiator -> receiver` (runtime/business interaction). It does not describe model ownership or Context Map dependency."
      print ""
      print "```mermaid"
      print "graph LR"
      print "    a[\"A\"]"
      print "    b[\"B\"]"
      print "    c[\"C\"]"
      print "    d[\"D\"]"
      print "    e[\"E\"]"
      if (include_edge == "yes") {
        print ""
        print "    b -->|Request A Review| a"
      }
      print "```"
      print ""
    }
    { print }
  ' "$source" >"$target"
}

interaction_graph_only="$tmp/interaction-graph-only.md"
add_interaction_view "$valid" "$interaction_graph_only" yes

reverse_direction_interaction="$tmp/reverse-direction-interaction.md"
awk '
  $0 == "### B" { in_b = 1 }
  $0 == "### C" { in_b = 0 }
  in_b && $0 == "#### Upstream Dependencies" {
    print "#### Interactions"
    print ""
    print "##### Request A Review"
    print ""
    print "- **Receiver:** A"
    print "- **Trigger or intent:** B requests a runtime review from A."
    print "- **Result or failure feedback:** A returns the review result or a failure reason."
    print ""
  }
  { print }
' "$interaction_graph_only" >"$reverse_direction_interaction"

node "$CLAUDE_VALIDATOR" "$reverse_direction_interaction" >/dev/null ||
  fail "strict validator rejected a runtime interaction opposite to the A -> B model dependency"

no_cross_context_interactions="$tmp/no-cross-context-interactions.md"
add_interaction_view "$valid" "$no_cross_context_interactions" no
node "$CLAUDE_VALIDATOR" "$no_cross_context_interactions" >/dev/null ||
  fail "strict validator rejected a canonical zero-edge Interaction View"

interaction_cycle="$tmp/interaction-cycle.md"
awk '
  $0 == "    b -->|Request A Review| a" {
    print
    print "    a -->|Send B Result| b"
    next
  }
  $0 == "### A" { in_a = 1 }
  $0 == "### B" { in_a = 0 }
  in_a && $0 == "#### Downstream Contracts" {
    print "#### Interactions"
    print ""
    print "##### Send B Result"
    print ""
    print "- **Receiver:** B"
    print "- **Trigger or intent:** A sends the runtime result to B."
    print "- **Result or failure feedback:** B acknowledges the result or returns a failure reason."
    print ""
  }
  { print }
' "$reverse_direction_interaction" >"$interaction_cycle"
node "$CLAUDE_VALIDATOR" "$interaction_cycle" >/dev/null ||
  fail "strict validator rejected a valid Interaction View cycle"

assert_invalid_strict "$interaction_graph_only" "interaction projection is missing"

interaction_node_mismatch="$tmp/interaction-node-mismatch.md"
awk '
  $0 == "## Interaction View" { in_interactions = 1 }
  $0 == "## Bounded Contexts" { in_interactions = 0 }
  in_interactions && $0 == "    e[\"E\"]" { next }
  { print }
' "$reverse_direction_interaction" >"$interaction_node_mismatch"
assert_invalid_strict "$interaction_node_mismatch" "Interaction View nodes must match Global View exactly"

projection_without_interaction="$tmp/projection-without-interaction.md"
awk '
  $0 == "### B" { in_b = 1 }
  $0 == "### C" { in_b = 0 }
  in_b && $0 == "#### Upstream Dependencies" {
    print "#### Interactions"
    print ""
    print "##### Request A Review"
    print ""
    print "- **Receiver:** A"
    print "- **Trigger or intent:** B requests a runtime review from A."
    print "- **Result or failure feedback:** A returns the review result or a failure reason."
    print ""
  }
  { print }
' "$no_cross_context_interactions" >"$projection_without_interaction"
assert_invalid_strict "$projection_without_interaction" "is absent from Interaction View"

for interaction_field in 'Receiver' 'Trigger or intent' 'Result or failure feedback'; do
  missing_interaction_field="$tmp/missing-interaction-field-$(printf '%s' "$interaction_field" | tr '[:upper:] ' '[:lower:]-').md"
  sed "/^- \*\*$interaction_field:\*\*/d" \
    "$reverse_direction_interaction" >"$missing_interaction_field"
  assert_invalid_strict "$missing_interaction_field" "must declare exactly one non-empty $interaction_field"
done

interaction_node_id_mismatch="$tmp/interaction-node-id-mismatch.md"
awk '
  $0 == "## Interaction View" { in_interactions = 1 }
  $0 == "## Bounded Contexts" { in_interactions = 0 }
  in_interactions && $0 == "    a[\"A\"]" { print "    interaction_a[\"A\"]"; next }
  in_interactions && $0 == "    b -->|Request A Review| a" { print "    b -->|Request A Review| interaction_a"; next }
  { print }
' "$reverse_direction_interaction" >"$interaction_node_id_mismatch"
assert_invalid_strict "$interaction_node_id_mismatch" "Interaction View nodes must match Global View exactly"

unlabeled_interaction_edge="$tmp/unlabeled-interaction-edge.md"
sed 's/^    b -->|Request A Review| a$/    b --> a/' \
  "$reverse_direction_interaction" >"$unlabeled_interaction_edge"
assert_invalid_strict "$unlabeled_interaction_edge" "unsupported Interaction View graph line"

runtime_edge_in_global_view="$tmp/runtime-edge-in-global-view.md"
sed '0,/^    a --> b$/{s/^    a --> b$/    a -->|Request B Work| b/}' \
  "$valid" >"$runtime_edge_in_global_view"
assert_invalid "$runtime_edge_in_global_view" "unsupported Global View graph line"

duplicate_interaction_name="$tmp/duplicate-interaction-name.md"
sed '/^    b -->|Request A Review| a$/a\    b -->|Request A Review| c' \
  "$reverse_direction_interaction" >"$duplicate_interaction_name"
assert_invalid_strict "$duplicate_interaction_name" "duplicate Interaction Name"

self_interaction="$tmp/self-interaction.md"
sed 's/^    b -->|Request A Review| a$/    b -->|Request A Review| b/' \
  "$reverse_direction_interaction" >"$self_interaction"
assert_invalid_strict "$self_interaction" "not cross-context"

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

review_encoded_bidirectional="$tmp/review-encoded-bidirectional.md"
sed '0,/- \*\*Business authority:\*\* A facts\./{s#A facts\.#Payment \&lt;-\&gt; Order.#}' \
  "$valid" >"$review_encoded_bidirectional"
assert_invalid "$review_encoded_bidirectional" "bidirectional"

review_emphasized_ascii_bidirectional="$tmp/review-emphasized-ascii-bidirectional.md"
sed '0,/- \*\*Business authority:\*\* A facts\./{s#A facts\.#Work \&lt;**-**\&gt; Project Knowledge.#}' \
  "$valid" >"$review_emphasized_ascii_bidirectional"
assert_invalid "$review_emphasized_ascii_bidirectional" "bidirectional"

review_named_opposing_arrows="$tmp/review-named-opposing-arrows.md"
sed '0,/- \*\*Business authority:\*\* A facts\./{s#A facts\.#Work \&larr;\&rarr; Project Knowledge.#}' \
  "$valid" >"$review_named_opposing_arrows"
assert_invalid "$review_named_opposing_arrows" "bidirectional"

review_numeric_opposing_arrows="$tmp/review-numeric-opposing-arrows.md"
sed '0,/- \*\*Business authority:\*\* A facts\./{s|A facts\.|Work \&#8592;\&#8594; Project Knowledge.|}' \
  "$valid" >"$review_numeric_opposing_arrows"
assert_invalid "$review_numeric_opposing_arrows" "bidirectional"

markup_separated_opposing_arrows="$tmp/markup-separated-opposing-arrows.md"
sed '0,/- \*\*Business authority:\*\* A facts\./{s#A facts\.#Work \&rarr;** **\&larr; Project Knowledge.#}' \
  "$valid" >"$markup_separated_opposing_arrows"
assert_invalid "$markup_separated_opposing_arrows" "bidirectional"

for arrow in \
  '&lt;-&gt;' \
  '&#60;-&#62;' \
  '&#x3c;-&#x3e;' \
  '&harr;' \
  '&Longleftrightarrow;' \
  '&longleftrightarrow;' \
  '&xhArr;' \
  '&xharr;' \
  '&#8596;' \
  '&#x2194;' \
  '&#8621;' \
  '&#x21ad;' \
  '&#8703;' \
  '&#x21ff;' \
  '&#11012;' \
  '&#x2b04;' \
  '&#11020;' \
  '&#x2b0c;'; do
  encoded_bidirectional="$tmp/encoded-bidirectional-$(printf '%s' "$arrow" | od -An -tx1 | tr -d ' \n').md"
  escaped_arrow="${arrow//&/\\&}"
  sed "0,/- \*\*Business authority:\*\* A facts\./{s|A facts\.|A facts linked to B by $escaped_arrow.|}" \
    "$valid" >"$encoded_bidirectional"
  assert_invalid "$encoded_bidirectional" "bidirectional"
done

ordinary_ampersand="$tmp/ordinary-ampersand.md"
sed '0,/- \*\*Business authority:\*\* A facts\./{s#A facts\.#Research \&amp; Development facts.#}' \
  "$valid" >"$ordinary_ampersand"
node "$CLAUDE_VALIDATOR" --allow-legacy "$ordinary_ampersand" >/dev/null ||
  fail "validator confused an ordinary ampersand entity with a bidirectional arrow"

for arrow in \
  '↔' '↭' '⇄' '⇔' '⇌' '⇿' '⟷' '⟺' '⬄' '⬌' \
  '↤' '↦' '⇤' '⇥' '⟻' '⟼' '⬅' '➡' '⭠' '⭢' \
  '⥈' '⥃' '⥅' '⥮' '⥯' '⭤' '🡘'; do
  unicode_bidirectional="$tmp/unicode-bidirectional-$(printf '%s' "$arrow" | od -An -tx1 | tr -d ' \n').md"
  cp "$valid" "$unicode_bidirectional"
  sed -i "/\*\*Business authority:\*\* A facts\./a\\- **Legacy relation:** A $arrow B" "$unicode_bidirectional"
  assert_invalid "$unicode_bidirectional" "bidirectional"
done

for invisible in $'\u034f' $'\ufe0f'; do
  invisible_hex="$(printf '%s' "$invisible" | od -An -tx1 | tr -d ' \n')"
  for arrow in "<${invisible}->" "←${invisible}→"; do
    hidden_bidirectional="$tmp/hidden-bidirectional-$invisible_hex-$(printf '%s' "$arrow" | od -An -tx1 | tr -d ' \n').md"
    sed "0,/- \*\*Business authority:\*\* A facts\./{s#A facts\.#Work $arrow Project Knowledge.#}" \
      "$valid" >"$hidden_bidirectional"
    assert_invalid "$hidden_bidirectional" "bidirectional"
  done
done

indented_unicode_bidirectional="$tmp/indented-unicode-bidirectional.md"
cp "$valid" "$indented_unicode_bidirectional"
sed -i '/\*\*Business authority:\*\* A facts\./a\  Work ⇌ Project Knowledge' "$indented_unicode_bidirectional"
assert_invalid "$indented_unicode_bidirectional" "bidirectional"

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

noncanonical_node_id="$tmp/noncanonical-node-id.md"
cp "$valid" "$noncanonical_node_id"
sed -i 's/^    a\["A"\]$/    a__["A"]/; s/^    a --> /    a__ --> /' "$noncanonical_node_id"
assert_invalid "$noncanonical_node_id" "unsupported Global View graph line"

appendix_swallow="$tmp/appendix-swallow.md"
cp "$valid" "$appendix_swallow"
sed -i '/^## Bounded Contexts$/a\
\
## Appendix' "$appendix_swallow"
assert_invalid "$appendix_swallow" "exactly ## Global View followed by ## Bounded Contexts"

trailing_appendix="$tmp/trailing-appendix.md"
cp "$valid" "$trailing_appendix"
sed -i '$a\
\
## Appendix\
\
Ignored relationship material.' "$trailing_appendix"
assert_invalid "$trailing_appendix" "exactly ## Global View followed by ## Bounded Contexts"

hash_prefixed_appendix="$tmp/hash-prefixed-appendix.md"
cp "$valid" "$hash_prefixed_appendix"
sed -i '$a\
\
## # Appendix\
\
Ignored relationship material.' "$hash_prefixed_appendix"
assert_invalid "$hash_prefixed_appendix" "exactly ## Global View followed by ## Bounded Contexts"

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

review_collaboration_semantics="$tmp/review-collaboration-semantics.md"
sed '0,/- \*\*Business authority:\*\* A facts\./{s#A facts\.#Payment and Order form a Partnership and share a Shared Kernel.#}' \
  "$valid" >"$review_collaboration_semantics"
assert_invalid "$review_collaboration_semantics" "Partnership"

review_emphasized_collaboration_semantics="$tmp/review-emphasized-collaboration-semantics.md"
sed '0,/- \*\*Business authority:\*\* A facts\./{s#A facts\.#Payment and Order form a Part**ner**ship and share a Shared Ker**nel**.#}' \
  "$valid" >"$review_emphasized_collaboration_semantics"
assert_invalid "$review_emphasized_collaboration_semantics" "Partnership"

for invisible in $'\u200b' $'\u00ad' $'\u034f' $'\ufe0f'; do
  invisible_hex="$(printf '%s' "$invisible" | od -An -tx1 | tr -d ' \n')"

  invisible_partnership="$tmp/invisible-partnership-$invisible_hex.md"
  sed "0,/- \*\*Business authority:\*\* A facts\./{s#A facts\.#Payment and Order form a Part${invisible}nership.#}" \
    "$valid" >"$invisible_partnership"
  assert_invalid "$invisible_partnership" "Partnership"

  invisible_shared_kernel="$tmp/invisible-shared-kernel-$invisible_hex.md"
  sed "0,/- \*\*Business authority:\*\* A facts\./{s#A facts\.#Payment and Order share a Shared${invisible} Kernel.#}" \
    "$valid" >"$invisible_shared_kernel"
  assert_invalid "$invisible_shared_kernel" "Shared Kernel"
done

for dash in $'\u2010' $'\u2011' $'\u2012' $'\u2013' $'\u2014' $'\u2015'; do
  dash_hex="$(printf '%s' "$dash" | od -An -tx1 | tr -d ' \n')"
  unicode_dash_shared_kernel="$tmp/unicode-dash-shared-kernel-$dash_hex.md"
  sed "/\*\*Business authority:\*\* A facts\./a\\- **Collaboration pattern:** Shared${dash}Kernel" \
    "$valid" >"$unicode_dash_shared_kernel"
  assert_invalid "$unicode_dash_shared_kernel" "Shared-Kernel"
done

for unsupported_plural in 'Partnerships' 'Shared Kernels'; do
  plural_collaboration="$tmp/unsupported-plural-$(printf '%s' "$unsupported_plural" | tr '[:upper:] ' '[:lower:]-').md"
  sed "/\*\*Business authority:\*\* A facts\./a\\- **Collaboration pattern:** $unsupported_plural" \
    "$valid" >"$plural_collaboration"
  assert_invalid "$plural_collaboration" "$unsupported_plural"
done

for shared_kernel_variant in 'SharedKernel' 'Shared/Kernel'; do
  variant_collaboration="$tmp/unsupported-variant-$(printf '%s' "$shared_kernel_variant" | tr '[:upper:]/' '[:lower:]-').md"
  sed "/\*\*Business authority:\*\* A facts\./a\\- **Collaboration pattern:** $shared_kernel_variant" \
    "$valid" >"$variant_collaboration"
  assert_invalid "$variant_collaboration" "$shared_kernel_variant"
done

ordinary_business_partnership="$tmp/ordinary-business-partnership.md"
sed '0,/- \*\*Business authority:\*\* A facts\./{s#A facts\.#Partnership application acceptance and lifecycle.#}' \
  "$valid" >"$ordinary_business_partnership"
node "$CLAUDE_VALIDATOR" --allow-legacy "$ordinary_business_partnership" >/dev/null ||
  fail "validator confused ordinary Partnership business language with a DDD collaboration pattern"

for chinese_relation in \
  'A 与 B 构成 Partnership。' \
  'A 和 B 共同拥有 Shared Kernel。'; do
  chinese_collaboration="$tmp/chinese-collaboration-$(printf '%s' "$chinese_relation" | od -An -tx1 | tr -d ' \n').md"
  sed "0,/- \*\*Business authority:\*\* A facts\./{s#A facts\.#$chinese_relation#}" \
    "$valid" >"$chinese_collaboration"
  assert_invalid "$chinese_collaboration" "unsupported"
done

for unsupported_contract_name in 'A-B Partnership' 'A-B Shared Kernel'; do
  unsupported_contract="$tmp/unsupported-contract-$(printf '%s' "$unsupported_contract_name" | tr '[:upper:] ' '[:lower:]-').md"
  sed "s/^##### A-B Facts$/##### $unsupported_contract_name/" "$valid" >"$unsupported_contract"
  assert_invalid "$unsupported_contract" "${unsupported_contract_name#A-B }"
done

ordinary_inline_emphasis="$tmp/ordinary-inline-emphasis.md"
sed '0,/- \*\*Business authority:\*\* A facts\./{s#A facts\.#Payment owns **captured funds** and Research \&amp; Development facts.#}' \
  "$valid" >"$ordinary_inline_emphasis"
node "$CLAUDE_VALIDATOR" --allow-legacy "$ordinary_inline_emphasis" >/dev/null ||
  fail "validator rejected ordinary inline emphasis or an ordinary ampersand entity"

for semantic_field in \
  'Core responsibility' \
  'Business authority' \
  'Accepted meaning' \
  'Local translation' \
  'Published meaning' \
  'Guarantee'; do
  semantic_partnership="$tmp/semantic-partnership-$(printf '%s' "$semantic_field" | tr '[:upper:] ' '[:lower:]-').md"
  cp "$valid" "$semantic_partnership"
  sed -i "0,/- \*\*$semantic_field:\*\*/{s#- \*\*$semantic_field:\*\*.*#- **$semantic_field:** A and B collaborate as a Partnership.#}" \
    "$semantic_partnership"
  assert_invalid "$semantic_partnership" "Partnership"
done

business_authority_shared_kernel="$tmp/business-authority-shared-kernel.md"
sed '0,/- \*\*Business authority:\*\*/{s//- **Business authority:** A and B jointly own a Shared Kernel./}' \
  "$valid" >"$business_authority_shared_kernel"
assert_invalid "$business_authority_shared_kernel" "Shared Kernel"

continued_semantic_shared_kernel="$tmp/continued-semantic-shared-kernel.md"
cp "$valid" "$continued_semantic_shared_kernel"
sed -i '/^- \*\*Business authority:\*\* A facts\.$/a\  A and B jointly own a Shared Kernel.' \
  "$continued_semantic_shared_kernel"
assert_invalid "$continued_semantic_shared_kernel" "Shared Kernel"

wrapped_semantic_shared_kernel="$tmp/wrapped-semantic-shared-kernel.md"
sed '0,/- \*\*Business authority:\*\* A facts\./{s//- **Business authority:** A and B jointly own a Shared/}' \
  "$valid" >"$wrapped_semantic_shared_kernel"
sed -i '/^- \*\*Business authority:\*\* A and B jointly own a Shared$/a\  Kernel.' \
  "$wrapped_semantic_shared_kernel"
assert_invalid "$wrapped_semantic_shared_kernel" "Shared Kernel"

collaboration_partnership="$tmp/collaboration-partnership.md"
cp "$valid" "$collaboration_partnership"
sed -i '0,/- \*\*Guarantee:\*\*/{/- \*\*Guarantee:\*\*/a\- **Collaboration pattern:** Directional Partnership arrangement
}' "$collaboration_partnership"
assert_invalid "$collaboration_partnership" "Partnership"

relationship_type_partnership="$tmp/relationship-type-partnership.md"
cp "$valid" "$relationship_type_partnership"
sed -i '/\*\*Business authority:\*\* A facts\./a\- **Relationship type:** Partnership' "$relationship_type_partnership"
assert_invalid "$relationship_type_partnership" "Partnership"

indented_relationship_partnership="$tmp/indented-relationship-partnership.md"
cp "$valid" "$indented_relationship_partnership"
sed -i '/\*\*Business authority:\*\* A facts\./a\  **Relationship:** Partnership' "$indented_relationship_partnership"
assert_invalid "$indented_relationship_partnership" "indented structured field"

indented_collaboration_shared_kernel="$tmp/indented-collaboration-shared-kernel.md"
cp "$valid" "$indented_collaboration_shared_kernel"
sed -i '/\*\*Business authority:\*\* A facts\./a\  **Collaboration pattern:** Shared Kernel' "$indented_collaboration_shared_kernel"
assert_invalid "$indented_collaboration_shared_kernel" "indented structured field"

unknown_context_section="$tmp/unknown-context-section.md"
cp "$valid" "$unknown_context_section"
sed -i '/^#### Local View$/i\
#### Relationship Notes\
' "$unknown_context_section"
assert_invalid "$unknown_context_section" "unsupported context section"

unknown_contract_field="$tmp/unknown-contract-field.md"
cp "$valid" "$unknown_contract_field"
sed -i '0,/- \*\*Guarantee:\*\*/{/- \*\*Guarantee:\*\*/a\- **Legacy relation:** A directs C
}' "$unknown_contract_field"
assert_invalid "$unknown_contract_field" "unsupported contract field"

duplicate_core_responsibility="$tmp/duplicate-core-responsibility.md"
cp "$valid" "$duplicate_core_responsibility"
sed -i '/^- \*\*Core responsibility:\*\* Own A decisions\.$/p' "$duplicate_core_responsibility"
assert_invalid "$duplicate_core_responsibility" "exactly one non-empty Core responsibility"

duplicate_business_authority="$tmp/duplicate-business-authority.md"
cp "$valid" "$duplicate_business_authority"
sed -i '/^- \*\*Business authority:\*\* A facts\.$/p' "$duplicate_business_authority"
assert_invalid "$duplicate_business_authority" "exactly one non-empty Business authority"

empty_core_responsibility="$tmp/empty-core-responsibility.md"
sed '0,/^- \*\*Core responsibility:\*\* Own A decisions\.$/{s//- **Core responsibility:** **/}' "$valid" >"$empty_core_responsibility"
assert_invalid "$empty_core_responsibility" "exactly one non-empty Core responsibility"

local_mismatch="$tmp/local-mismatch.md"
cp "$valid" "$local_mismatch"
sed -i '/^### A$/,/^### B$/ {
  s/^+---+         +---+$/+---+   +---+/
  s/^| A |--+----->| B |$/| A |-->| B |/
  s/^+---+  |      +---+$/+---+   +---+/
  /^       |$/d
  /^       |      +---+$/d
  /^       +----->| C |$/d
  /^              +---+$/d
}' "$local_mismatch"
assert_invalid "$local_mismatch" "Local View"

non_neighbor="$tmp/non-neighbor.md"
cp "$valid" "$non_neighbor"
sed -i '/^### A$/,/^### B$/ s/| C |$/| D |/' "$non_neighbor"
assert_invalid "$non_neighbor" "non-neighbor"

duplicate_local="$tmp/duplicate-local.md"
cp "$valid" "$duplicate_local"
sed -i '/^### A$/,/^### B$/ s/| B |$/| C |/' "$duplicate_local"
assert_invalid "$duplicate_local" "duplicate Local View context box"

wrong_center="$tmp/wrong-center.md"
cp "$valid" "$wrong_center"
sed -i '/^### A$/,/^### B$/ s/^| A |--+----->| B |$/| E |--+----->| B |/' "$wrong_center"
assert_invalid "$wrong_center" "must center the current context box A"

wrong_direction="$tmp/wrong-direction.md"
cp "$valid" "$wrong_direction"
sed -i '/^### B$/,/^### C$/ s/^| A |-->| B |-->| D |$/| B |-->| A |-->| D |/' "$wrong_direction"
assert_invalid "$wrong_direction" "Local View"

wrong_local_fence="$tmp/wrong-local-fence.md"
sed '0,/^```text$/{s/^```text$/```ascii/}' "$valid" >"$wrong_local_fence"
assert_invalid "$wrong_local_fence" "code fence"

local_mermaid="$tmp/local-mermaid.md"
sed '0,/^```text$/{s/^```text$/```mermaid/}' "$valid" >"$local_mermaid"
assert_invalid "$local_mermaid" "code fence"

legacy_local_list="$tmp/legacy-local-list.md"
awk '
  $0 == "### A" { in_context_a = 1 }
  $0 == "### B" { in_context_a = 0 }
  in_context_a && $0 == "```text" {
    print "- `A -> B [D]`"
    in_wireframe = 1
    next
  }
  in_wireframe && $0 == "```" {
    in_wireframe = 0
    next
  }
  !in_wireframe { print }
' "$valid" >"$legacy_local_list"
assert_invalid "$legacy_local_list" 'canonical ```text wireframe'

local_direction_label="$tmp/local-direction-label.md"
cp "$valid" "$local_direction_label"
sed -i '/^### A$/,/^### B$/ { /^```$/i\[D]
}' "$local_direction_label"
assert_invalid "$local_direction_label" "unsupported character ["

duplicate_isolated_box="$tmp/duplicate-isolated-box.md"
cp "$valid" "$duplicate_isolated_box"
sed -i '/^### E$/,$ {
  s/^+---+$/+---+   +---+/
  s/^| E |$/| E |   | E |/
}' "$duplicate_isolated_box"
assert_invalid "$duplicate_isolated_box" "duplicate Local View context box E"

isolated_marker="$tmp/isolated-marker.md"
cp "$valid" "$isolated_marker"
sed -i '/^### E$/,$ { /^```$/i\(no direct dependencies)
}' "$isolated_marker"
assert_invalid "$isolated_marker" "unsupported character ("

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
assert_invalid "$list_continuation_heading" "only blank lines may appear between # Context Map and ## Global View"

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

for rendered_empty in '&nbsp;' '**' '<span></span>'; do
  rendered_empty_semantics="$tmp/rendered-empty-semantics-$(printf '%s' "$rendered_empty" | od -An -tx1 | tr -d ' \n').md"
  escaped_rendered_empty="${rendered_empty//&/\\&}"
  sed "0,/- \*\*Published meaning:\*\*/{s#- \*\*Published meaning:\*\*.*#- **Published meaning:** $escaped_rendered_empty#}" \
    "$valid" >"$rendered_empty_semantics"
  assert_invalid "$rendered_empty_semantics" "contract semantics"
done

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
