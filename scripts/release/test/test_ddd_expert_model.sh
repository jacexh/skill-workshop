#!/usr/bin/env bash
# Validate the ddd-expert Model checker: name resolution across model.md,
# domain-objects.md, and the Context Map, the shape of clauses and Invariants,
# and Lifecycle State transitions.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLAUDE_VALIDATOR="$ROOT/plugins/ddd-expert/scripts/validate-model.mjs"
CODEX_VALIDATOR="$ROOT/codex-plugins/ddd-expert/scripts/validate-model.mjs"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

[ -f "$CLAUDE_VALIDATOR" ] || fail "Claude Model validator missing"
[ -f "$CODEX_VALIDATOR" ] || fail "Codex Model validator missing"
cmp -s "$CLAUDE_VALIDATOR" "$CODEX_VALIDATOR" ||
  fail "Claude and Codex Model validators should match"
node --check "$CLAUDE_VALIDATOR"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# write_project <dir>: a two-context project where every name resolves.
write_project() {
  local base="$1/docs/ddd-expert"
  mkdir -p "$base/context/scheduling" "$base/context/billing"
  cat >"$base/context-map.md" <<'EOF'
# Context Map

## Bounded Contexts

| Bounded Context | Purpose | Model |
|---|---|---|
| Scheduling | Owns slots and confirmations. | [Model](context/scheduling/model.md) |
| Billing | Owns invoices. | [Model](context/billing/model.md) |

## Semantic Dependencies

| Upstream | Downstream | Published contract | Downstream use |
|---|---|---|---|
| Scheduling | Billing | **VisitCompleted Published Fact Contract:** Scheduling publishes each completed Visit. | Billing opens an Invoice for the Visit; Policy `Open Invoice` |
EOF
  cat >"$base/context/scheduling/model.md" <<'EOF'
# Scheduling Model

## Business Rules

### Context

- **Closed day:** A closed doctor day admits no change to its Slots.
  - If the doctor day is closed, then Scheduling rejects each confirmation and each release.
- **Open Slot reading:** A receptionist reads the open Slots of
  each doctor day.

## Policies

- **Remind Patient:** When a Slot is confirmed, Scheduling reminds the Patient. If it cannot remind the Patient, then reception calls the Patient.
EOF
  cat >"$base/context/scheduling/domain-objects.md" <<'EOF'
# Scheduling Domain Objects

<!--
  - `Template example` — Subject transitioning State from <before> to <after>. Rules: `<Rule name>`.
-->

## Schedule

### Schedule — Aggregate Root (`DoctorDay`)

- **Definition:** One doctor working day of bookable Slots.
- **Lifecycle State:**
  - `No explicit Lifecycle State`
- **Behavior:**
  - `Confirm Appointment` — Schedule confirms an Appointment into a Slot by composing `Slot.Confirm Appointment`. Rules: `Closed day`.

### Time Slot — Entity (`SlotTime`, unique per Schedule)

- **Definition:** One bookable time in a doctor's day.
- **Lifecycle State:**
  - `TimeSlot.State = Free` — no confirmed Appointment.
  - `Confirmed` — one Appointment occupies the Slot.
  - `Completed` — the visit took place; terminal.
- **Invariants:**
  - `Single occupancy` — A Slot holds at most one confirmed Appointment.
- **Behavior:**
  - `Confirm Appointment` — Slot admits an Appointment, transitioning TimeSlot.State from Free to Confirmed. Rules: `Single occupancy`.
    - If the Slot already holds a confirmed Appointment, then Slot rejects the confirmation.
  - `Release Appointment` — Slot frees its Appointment, using supplied `now` from the clinic clock,
    transitioning State from `Confirmed` to `Free` when the start time is ahead. Rules: `Single occupancy`, `Closed day`.
    - If `now` is at or after `StartTime`, then Slot rejects
      the release.
    - When Slot frees its Appointment, the Slot admits a new confirmation.
  - `Complete Visit` — Slot records the completed visit, transitioning TimeSlot.State from Free or Confirmed to Completed and recording VisitCompleted. Rules: `Remind Patient`.
- **Domain Events:**
  - `VisitCompleted` — recorded by `Complete Visit`; published as `VisitCompleted`.
  - `SlotConfirmed` — recorded by `Confirm Appointment` and `Release Appointment` after the change.
    - **Consumed by:** Policy `Remind Patient`.
EOF
  cat >"$base/context/billing/model.md" <<'EOF'
# Billing Model

## Business Rules

- **Invoice voiding:** If the actor is not a billing clerk, then the Invoice rejects voiding.

## Policies

- **Open Invoice:** When Scheduling publishes `VisitCompleted`, Billing opens an Invoice for that Visit. If Billing cannot open the Invoice, then a billing clerk issues it by hand.
EOF
}

SCHEDULING="docs/ddd-expert/context/scheduling"
BILLING="docs/ddd-expert/context/billing"

write_project "$tmp/valid"
node "$ROOT/plugins/ddd-expert/scripts/validate-context-map.mjs" "$tmp/valid/docs/ddd-expert/context-map.md" >/dev/null ||
  fail "the fixture Context Map should pass its own validator"
expected='valid Model: 2 Business Rules, 1 Policies, 2 domain objects, 1 Invariants, 3 clauses, 3 transitions; Context Map names match'
actual="$(node "$CLAUDE_VALIDATOR" "$tmp/valid/$SCHEDULING/model.md")" || fail "validator rejected a valid Model"
[ "$actual" = "$expected" ] || fail "unexpected valid output: $actual (a valid Model in the current shape needs no note)"
[ "$(node "$CODEX_VALIDATOR" "$tmp/valid/$SCHEDULING/model.md")" = "$expected" ] ||
  fail "Codex validator rejected a valid Model"

# A context without domain-objects.md still resolves its Context Map citations.
expected='valid Model: 1 Business Rules, 1 Policies, no domain-objects.md to cross-check; Context Map names match'
actual="$(node "$CLAUDE_VALIDATOR" "$tmp/valid/$BILLING/model.md")" || fail "validator rejected a Model without domain objects"
[ "$actual" = "$expected" ] || fail "unexpected output without domain objects: $actual"

# A relative path from inside the context directory finds the same Context Map.
(cd "$tmp/valid/$BILLING" && node "$CLAUDE_VALIDATOR" model.md) | grep -Fq "Context Map names match" ||
  fail "validator did not find the Context Map from a relative path"

# A Model outside a project has nothing to cross-check.
mkdir -p "$tmp/alone"
cp "$tmp/valid/$BILLING/model.md" "$tmp/alone/model.md"
node "$CLAUDE_VALIDATOR" "$tmp/alone/model.md" | grep -Fq "no Context Map entry to cross-check" ||
  fail "validator should skip the Context Map check without a Context Map"

# edit <name> <context-relative file> <sed expression>: a copy of the valid project with one edit.
edit() {
  write_project "$tmp/$1"
  sed -i "$3" "$tmp/$1/docs/ddd-expert/$2"
}

# assert_invalid <name> <file> <sed expression> <expected message> [model]
assert_invalid() {
  local name="$1" message="$4" model="${5:-$SCHEDULING/model.md}" output
  edit "$name" "$2" "$3"
  if output="$(node "$CLAUDE_VALIDATOR" "$tmp/$name/$model" 2>&1)"; then
    fail "validator accepted invalid fixture $name"
  fi
  printf '%s\n' "$output" | grep -Fq -- "$message" || {
    printf '%s\n' "$output" >&2
    fail "invalid fixture $name did not report: $message"
  }
}

# assert_note <name> <file> <sed expression> <expected note>: still valid, with a note.
assert_note() {
  local name="$1" message="$4" output
  edit "$name" "$2" "$3"
  output="$(node "$CLAUDE_VALIDATOR" "$tmp/$name/$SCHEDULING/model.md" 2>&1)" || {
    printf '%s\n' "$output" >&2
    fail "validator rejected fixture $name, which only needs a note"
  }
  printf '%s\n' "$output" | grep -Fq -- "note: $message" || {
    printf '%s\n' "$output" >&2
    fail "fixture $name did not note: $message"
  }
}

OBJECTS="context/scheduling/domain-objects.md"
MODEL="context/scheduling/model.md"

assert_invalid unknown-rule "$OBJECTS" 's/Rules: `Single occupancy`, `Closed day`/Rules: `Single occupancy`, `Closed week`/' \
  'Time Slot Behavior "Release Appointment" cites "Closed week", which is not an Invariant of its Aggregate or a Business Rule or Policy in the Model'
assert_invalid renamed-rule "$MODEL" 's/\*\*Closed day:\*\*/**Closed doctor day:**/' \
  'Schedule Behavior "Confirm Appointment" cites "Closed day"'
assert_invalid duplicate-rule "$MODEL" 's/\*\*Open Slot reading:\*\*/**Closed day:**/' \
  'duplicate Business Rule "Closed day"'
assert_invalid renamed-invariant "$OBJECTS" 's/`Single occupancy` — A Slot/`One Appointment` — A Slot/' \
  'Time Slot Behavior "Confirm Appointment" cites "Single occupancy"'
assert_invalid duplicate-invariant "$OBJECTS" 's/^- \*\*Behavior:\*\*$/  - `Single occupancy` — A Slot stays single.\n&/' \
  'duplicate Invariant "Single occupancy" under Schedule'
# An Invariant of another Aggregate does not govern this Behavior.
assert_invalid foreign-invariant "$OBJECTS" 's/Rules: `Remind Patient`/Rules: `Weekly cover`/; $a\
\
## Roster\
\
### Roster — Aggregate Root (`RosterID`)\
\
- **Invariants:**\
  - `Weekly cover` — A Roster covers each working day.' \
  'Time Slot Behavior "Complete Visit" cites "Weekly cover"'
assert_invalid two-sentence-clause "$OBJECTS" 's/then Slot rejects the confirmation\./then Slot rejects the confirmation. The Patient is told./' \
  'Time Slot Behavior "Confirm Appointment" clause 1 must be one sentence of at most 25 words'
assert_invalid long-clause "$OBJECTS" 's/the Slot admits a new confirmation\./the Slot admits a new confirmation from any receptionist of the same clinic on the same working day and for the same doctor and room as before./' \
  'Time Slot Behavior "Release Appointment" clause 2 must be one sentence of at most 25 words'
assert_invalid two-sentence-invariant "$OBJECTS" 's/A Slot holds at most one confirmed Appointment\./A Slot holds at most one confirmed Appointment. A second one is rejected./' \
  'Time Slot Invariant "Single occupancy" must be one sentence of at most 25 words'
assert_invalid two-sentence-rule-clause "$MODEL" 's/each confirmation and each release\./each confirmation. It rejects each release./' \
  'Business Rule "Closed day" clause 1 must be one sentence of at most 25 words'
assert_invalid unlinked-event "$OBJECTS" 's/recorded by `Complete Visit`; published/raised at the end of the visit; published/' \
  'Domain Event "VisitCompleted" names no recording Behavior under Schedule'
assert_invalid loosely-linked-unknown "$OBJECTS" 's/recorded by `Complete Visit`/recorded by each accepted `Finish Visit`/' \
  'Domain Event "VisitCompleted" names no recording Behavior under Schedule'
# A Behavior of another Aggregate does not record this Aggregate's event.
assert_invalid foreign-recorder "$OBJECTS" 's/recorded by `Complete Visit`/recorded by `Close Roster`/; $a\
\
## Roster\
\
### Roster — Aggregate Root (`RosterID`)\
\
- **Behavior:**\
  - `Close Roster` — Roster closes its week.' \
  'Domain Event "VisitCompleted" is recorded by "Close Roster", which is not a Behavior under Schedule'
assert_invalid unknown-consumer "$OBJECTS" 's/Policy `Remind Patient`\./Policy `Notify Patient`./' \
  'Domain Event "SlotConfirmed" is consumed by Policy "Notify Patient", which is not in the Model'
assert_invalid unpublished-contract "$OBJECTS" 's/published as `VisitCompleted`/published as `VisitFinished`/' \
  'Domain Event "VisitCompleted" is published as "VisitFinished", which the Context Map does not list as a contract Scheduling publishes'
assert_invalid unknown-map-policy "context-map.md" 's/Policy `Open Invoice`/Policy `Issue Invoice`/' \
  'Context Map cites Policy "Issue Invoice" for Billing, which is not in the Model' "$BILLING/model.md"
assert_invalid undeclared-source "$OBJECTS" 's/from Free to Confirmed/from Open to Confirmed/' \
  'Time Slot Behavior "Confirm Appointment" transitions TimeSlot.State through "Open", which is not a Lifecycle State of Time Slot'
assert_invalid undeclared-second-source "$OBJECTS" 's/from Free or Confirmed to Completed/from Free or Held to Completed/' \
  'transitions TimeSlot.State through "Held"'
assert_invalid undeclared-target "$OBJECTS" 's/to Completed and recording/to Done and recording/' \
  'transitions TimeSlot.State through "Done and recording VisitCompleted", which is not a Lifecycle State of Time Slot'
assert_invalid undeclared-quoted-target "$OBJECTS" 's/to `Free` when/to `Open` when/' \
  'Time Slot Behavior "Release Appointment" transitions State through "Open when the start time is ahead"'
assert_invalid stateless-object "$OBJECTS" 's/by composing `Slot.Confirm Appointment`/transitioning Schedule.State from Open to Full/' \
  'Schedule Behavior "Confirm Appointment" transitions Schedule.State through "Open", which is not a Lifecycle State of Schedule'

# Every error is reported in one run.
edit two-errors "$OBJECTS" 's/from Free to Confirmed/from Open to Confirmed/; s/recorded by `Complete Visit`/recorded by `Finish Visit`/'
[ "$(node "$CLAUDE_VALIDATOR" "$tmp/two-errors/$SCHEDULING/model.md" 2>&1 | grep -c '^invalid Model:')" = 2 ] ||
  fail "validator should report every error in one run"

# A rule under a Root group has no owning Behavior yet: it waits for Tactical Design.
assert_note waiting-rule "$MODEL" 's/^### Context$/### Schedule\n\n- **Late arrival:** If a Patient arrives late, then the Schedule keeps the Slot.\n\n&/' \
  '1 of 3 Business Rules are outside `### Context` and have no owning Behavior: "Late arrival"'
# A Model written before rule groups keeps its cited rules and reports the others.
assert_note ungrouped-model "$MODEL" '/^### Context$/d' \
  '1 of 2 Business Rules are outside `### Context` and have no owning Behavior: "Open Slot reading"'
assert_note dead-state "$OBJECTS" 's/from Free or Confirmed to Completed and recording/from Free to Confirmed and recording/' \
  'Time Slot Lifecycle State "Completed" takes part in no transition and no Behavior names it'
assert_note unknown-lifecycle "$OBJECTS" 's/transitioning TimeSlot.State from Free to Confirmed/transitioning Occupancy from Vacant to Taken/' \
  'Time Slot Behavior "Confirm Appointment" transitions "Occupancy", which names no object'"'"'s Lifecycle State; it was not checked'
assert_note unreadable-transition "$OBJECTS" 's/transitioning TimeSlot.State from Free to Confirmed/transitioning TimeSlot.State/' \
  'Time Slot Behavior "Confirm Appointment" states a transition that has no "to <state>"; it was not checked'

# A state that a Behavior names without a transition is not dead.
edit named-state "$OBJECTS" 's/from Free or Confirmed to Completed and recording/from Free to Confirmed, entering Completed later, and recording/'
if node "$CLAUDE_VALIDATOR" "$tmp/named-state/$SCHEDULING/model.md" | grep -Fq 'Lifecycle State "Completed"'; then
  fail "validator noted a state that a Behavior names"
fi

# Looser wording still links the event when it names one Behavior of the Aggregate.
edit loosely-linked "$OBJECTS" 's/recorded by `Complete Visit`/recorded by each accepted `Complete Visit`/'
node "$CLAUDE_VALIDATOR" "$tmp/loosely-linked/$SCHEDULING/model.md" >/dev/null ||
  fail "validator rejected an event whose looser wording names its Behavior"

if node "$CLAUDE_VALIDATOR" "$tmp/missing/model.md" >/dev/null 2>&1; then
  fail "validator accepted a missing Model"
fi

echo "PASS ddd-expert Model validator: name resolution, rule shape, and Lifecycle State transitions"
