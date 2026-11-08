#!/usr/bin/env bash
# Validate the ddd-expert architecture catalog checker, the view renderer, and the shipped template.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PLUGIN="$ROOT/plugins/ddd-expert"
VALIDATOR="$PLUGIN/scripts/validate-architecture.mjs"
RENDERER="$PLUGIN/scripts/render-architecture.mjs"
TEMPLATE="$PLUGIN/templates/architecture.md"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

for script in validate-architecture.mjs render-architecture.mjs; do
  [ -f "$PLUGIN/scripts/$script" ] || fail "Claude $script missing"
  [ -f "$ROOT/codex-plugins/ddd-expert/scripts/$script" ] || fail "Codex $script missing"
  cmp -s "$PLUGIN/scripts/$script" "$ROOT/codex-plugins/ddd-expert/scripts/$script" ||
    fail "Claude and Codex $script should match"
  node --check "$PLUGIN/scripts/$script"
done

# The shipped template uses exactly the sections and headers the validator parses.
node --input-type=module - "$RENDERER" "$TEMPLATE" <<'NODE' || fail "architecture template headers drift from the validator"
import fs from "node:fs";
const { SECTIONS } = await import(process.argv[2]);
const text = fs.readFileSync(process.argv[3], "utf8");
const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
const headers = [...text.matchAll(/^## .+\n\n(\|.+\|)$/gm)].map((m) => m[1]);
const expected = SECTIONS.map((s) => "| " + s.headers.join(" | ") + " |");
if (JSON.stringify(headings) !== JSON.stringify(SECTIONS.map((s) => s.title))) process.exit(1);
if (JSON.stringify(headers) !== JSON.stringify(expected)) process.exit(1);
NODE

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# One project: Scheduling consumes Staffing's leave fact and publishes VisitCompleted to Billing.
make_project() {
  local dir="$1"
  mkdir -p "$dir/context/scheduling"
  cat >"$dir/context-map.md" <<'EOF'
# Context Map

## Bounded Contexts

| Bounded Context | Purpose | Model |
|---|---|---|
| Staffing | Own doctors' leave. | [Model](context/staffing/model.md) |
| Scheduling | Own doctors' bookable days. | [Model](context/scheduling/model.md) |
| Billing | Own invoices. | [Model](context/billing/model.md) |

## Semantic Dependencies

| Upstream | Downstream | Published contract | Downstream use |
|---|---|---|---|
| Staffing | Scheduling | **Doctor Leave Published Fact Contract:** Staffing publishes each approved leave. | Scheduling frees the doctor's Slots; Policy `Release leave slots` |
| Scheduling | Billing | **VisitCompleted Published Fact Contract:** Scheduling publishes each completed visit. **Appointment Query Contract:** Scheduling supplies an appointment by id. | Billing opens an invoice; Policy `Open Invoice` |
EOF
  cat >"$dir/context/scheduling/model.md" <<'EOF'
# Scheduling Model

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Schedule | One doctor working day of bookable Slots. | One confirmed appointment per Slot. |

## Policies

- **Release leave slots:** When Staffing reports approved leave, Scheduling frees the doctor's Slots. If it cannot free them, then the hold sweep frees them later.
- **Expire hold:** When an appointment is held, Scheduling expires the hold within 10 minutes. If it cannot expire it, then the hold stays until the next attempt.
EOF
  cat >"$dir/context/scheduling/domain-objects.md" <<'EOF'
# Scheduling Domain Objects

## Schedule

### Schedule — Aggregate Root (`DoctorDay`)

- **Definition:** One doctor working day of bookable Slots.
- **Domain-owned Ports:**
  - `ReferralPort`
    - `Find Valid Referral` — `Confirm Appointment` invokes it to obtain a valid referral.
- **Domain Events:**
  - `AppointmentHeld` — recorded by `Hold Appointment`.
    - **Consumed by:** Policy `Expire hold`.
  - `VisitCompleted` — recorded by `Complete Visit`; published as `VisitCompleted Published Fact Contract`.
EOF
  cat >"$dir/context/scheduling/architecture.md" <<'EOF'
# Scheduling Architecture

<!-- The closed contract catalog. -->

## Query Repositories

| Query Repository | Reads | Read needs | Store | Reason |
|---|---|---|---|---|
| ScheduleQueryRepository | Schedule facts: open Slots, held and confirmed appointments | Reception sees a doctor's open Slots before it confirms; Appointment Query Contract | MySQL | Every read of Schedule's own facts |

## Application Ports

| Application Port | Authority | Covers | Adapter | Reason |
|---|---|---|---|---|
| Publisher | Scheduling's own Published Fact Contracts | VisitCompleted | Kafka | VisitCompleted Published Fact Contract |
| TaskEnqueuer | Scheduling's task queue | Every task below | asynq on Redis | House Style task queue |

## Tasks

| Task | Advances | Key | Enqueued by | Reason |
|---|---|---|---|---|
| Expire hold | Schedule | Appointment | Expire hold | Policy `Expire hold` expires each hold within 10 minutes |
| Hold sweep | Schedule | One per interval | Every 5 minutes, UTC | Failure outcome of Policy `Release leave slots` |

## Mechanisms

| Mechanism | Seam | Serves |
|---|---|---|
| Rate limit of 50 requests per second per clinic | Application | Booking bursts at 08:00 never slow confirmations |
| Consumer concurrency limit | Staffing subscriber | Staffing replays leave in bursts |
| Transactional outbox | Publisher | Billing relies on every VisitCompleted |
| Referral cache for 5 minutes | ReferralPort | Confirmation answers within 300 ms |
EOF
}

PROJECT="$tmp/valid"
CONTEXT="$PROJECT/context/scheduling"
make_project "$PROJECT"

# A draft validates against --artifacts without a view.
node "$VALIDATOR" "$CONTEXT/architecture.md" --artifacts "$CONTEXT" | grep -Fq "view not compared" ||
  fail "validator should accept a draft checked against --artifacts"
# Without the view, the committed form fails.
if node "$VALIDATOR" "$CONTEXT/architecture.md" >/dev/null 2>&1; then fail "validator accepted a missing view"; fi

node "$RENDERER" "$CONTEXT" >/dev/null || fail "renderer failed on a valid context"
expected='valid Architecture: Query Repositories 1, Application Ports 2, Inbound Sources 0, Tasks 2, Mechanisms 4; seams resolved against model.md, domain-objects.md, context-map.md; architecture.html is current'
actual="$(node "$VALIDATOR" "$CONTEXT/architecture.md")" || fail "validator rejected a valid catalog"
[ "$actual" = "$expected" ] || fail "unexpected valid output: $actual"
[ "$(node "$ROOT/codex-plugins/ddd-expert/scripts/validate-architecture.mjs" "$CONTEXT/architecture.md")" = "$expected" ] ||
  fail "Codex validator disagrees on a valid catalog"

# The view is deterministic, self-contained, and states only the artifacts' relations.
cp "$CONTEXT/architecture.html" "$tmp/first.html"
node "$RENDERER" "$CONTEXT/architecture.md" >/dev/null
cmp -s "$tmp/first.html" "$CONTEXT/architecture.html" || fail "renderer output is not deterministic"
if grep -Eq '<(script|link)[^>]+(src|href)="https?:' "$CONTEXT/architecture.html"; then
  fail "architecture view must be self-contained"
fi
node - "$CONTEXT/architecture.html" <<'NODE' || fail "view misses a stated relation"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const view = JSON.parse(html.match(/id="architecture-view">\n([\s\S]*?)\n<\/script>/)[1]);
const has = (from, to, kind) => view.edges.some((e) => e.from === from && e.to === to && e.kind === kind);
const card = (name) => view.cards.find((c) => c.name === name);
if (!has("event:AppointmentHeld", "policy:Expire hold", "reacts")) process.exit(1);
if (!has("sub:Staffing subscriber", "policy:Release leave slots", "delivers")) process.exit(1);
if (!has("policy:Expire hold", "task:Expire hold", "enqueues")) process.exit(1);
if (!card("VisitCompleted Published Fact Contract") || card("VisitCompleted Published Fact Contract").band !== "outbound") process.exit(1);
if (!card("Schedule").mechanisms.some((m) => m.seam === "ReferralPort")) process.exit(1);
if (!card("Scheduling Application").lines.some((l) => l.startsWith("Appointment Query Contract"))) process.exit(1);
if (view.edges.length !== 3) process.exit(1);
NODE

# A change to a sibling artifact makes the committed view stale.
printf -- '- **Notify Billing:** When a visit completes, Scheduling notifies Billing. If it cannot, then it retries.\n' \
  >>"$CONTEXT/model.md"
if stale="$(node "$VALIDATOR" "$CONTEXT/architecture.md" 2>&1)"; then fail "validator accepted a stale view"; fi
printf '%s\n' "$stale" | grep -Fq "architecture.html differs from a fresh render" ||
  fail "stale view reported the wrong failure: $stale"

# assert_invalid <name> <python statement editing s, the catalog text> <expected message>
assert_invalid() {
  local name="$1" edit="$2" message="$3" output
  make_project "$tmp/$name"
  local file="$tmp/$name/context/scheduling/architecture.md"
  python3 -c "import sys; p=sys.argv[1]; s=open(p).read(); $edit; open(p,'w').write(s)" "$file"
  if output="$(node "$VALIDATOR" "$file" --artifacts "$tmp/$name/context/scheduling" 2>&1)"; then
    fail "validator accepted invalid fixture $name"
  fi
  printf '%s\n' "$output" | grep -Fq -- "$message" || {
    printf '%s\n' "$output" >&2
    fail "invalid fixture $name did not report: $message"
  }
}

assert_invalid wrong-title 's=s.replace("# Scheduling Architecture","# Scheduling Design")' 'expected exactly one "# <Bounded Context> Architecture" heading'
assert_invalid other-context 's=s.replace("# Scheduling Architecture","# Billing Architecture")' 'heading names "Billing" but model.md names "Scheduling"'
assert_invalid preamble 's=s.replace("<!-- The closed contract catalog. -->","Some prose.")' 'only sections may follow the heading'
assert_invalid unknown-section 's=s.replace("## Tasks","## Jobs")' 'unknown section "## Jobs"'
assert_invalid out-of-order 's=s.replace("## Query Repositories","## Tmp").replace("## Application Ports","## Query Repositories").replace("## Tmp","## Application Ports")' 'out of order'
assert_invalid missing-required 'i=s.index("## Application Ports"); j=s.index("## Tasks"); s=s[:i]+s[j:]' 'missing section "## Application Ports"'
assert_invalid wrong-headers 's=s.replace("| Query Repository | Reads | Read needs | Store | Reason |","| Query Repository | Reads | Store | Reason | Note |")' 'headers must be: Query Repository | Reads | Read needs | Store | Reason'
assert_invalid empty-cell 's=s.replace("| Kafka |","|  |")' 'Application Ports row 1 contains an empty cell'
assert_invalid trailing-prose 's=s+"\nNot carried over: the old cache.\n"' 'Mechanisms row 5 must contain exactly 3 cells'
assert_invalid duplicate-name 's=s.replace("| Hold sweep |","| Expire hold |")' 'repeats the name "Expire hold"'
assert_invalid issue-reference 's=s.replace("Booking bursts at 08:00","Booking bursts (#26)")' 'cites issue or pull request "(#26"'
assert_invalid code-reason 's=s.replace("Every read of Schedule'"'"'s own facts","The existing code has it")' 'takes its Reason from existing code'
assert_invalid unknown-seam 's=s.replace("| Staffing subscriber |","| Leave consumer |")' 'unknown seam "Leave consumer"'

# None. stands in for an empty required section.
make_project "$tmp/none"
python3 - "$tmp/none/context/scheduling/architecture.md" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
start = s.index("| Query Repository |")
s = s[:start] + "None.\n" + s[s.index("## Application Ports"):]
s = s.replace("| ScheduleQueryRepository |", "")
open(p, "w").write(s)
PY
node "$VALIDATOR" "$tmp/none/context/scheduling/architecture.md" --artifacts "$tmp/none/context/scheduling" | grep -Fq "Query Repositories 0" ||
  fail "validator rejected None. for an empty Query Repositories section"

echo "PASS ddd-expert Architecture catalog validator, view renderer, and shipped template"
