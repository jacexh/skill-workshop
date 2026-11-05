#!/usr/bin/env bash
# Validate the ddd-expert architecture wireframe checker and its shipped template.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLAUDE_VALIDATOR="$ROOT/plugins/ddd-expert/scripts/validate-architecture.mjs"
CODEX_VALIDATOR="$ROOT/codex-plugins/ddd-expert/scripts/validate-architecture.mjs"
TEMPLATE="$ROOT/plugins/ddd-expert/templates/architecture.html"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

[ -f "$CLAUDE_VALIDATOR" ] || fail "Claude Architecture validator missing"
[ -f "$CODEX_VALIDATOR" ] || fail "Codex Architecture validator missing"
cmp -s "$CLAUDE_VALIDATOR" "$CODEX_VALIDATOR" ||
  fail "Claude and Codex Architecture validators should match"
node --check "$CLAUDE_VALIDATOR"

# The shipped template validates against the shipped domain-object template beside it.
node "$CLAUDE_VALIDATOR" "$TEMPLATE" | grep -Fq "Domain names match domain-objects.md" ||
  fail "shipped architecture template does not validate against the domain-object template"
if grep -Eq '<(script|link)[^>]+(src|href)="https?:' "$TEMPLATE"; then
  fail "architecture template must be self-contained"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# write_fixture <dir> <json>: an architecture.html holding only the data block.
write_fixture() {
  mkdir -p "$1"
  printf '<!doctype html>\n<script type="application/json" id="architecture-data">\n%s\n</script>\n' "$2" \
    >"$1/architecture.html"
}

VALID='{
  "context": "Scheduling",
  "components": [
    { "id": "app", "kind": "application", "name": "Scheduling Application", "note": "HTTP API" },
    { "id": "leave", "kind": "integration-message", "name": "DoctorLeaveApproved" },
    { "id": "handler", "kind": "event-handler", "name": "Publish VisitCompleted" },
    { "id": "pub", "kind": "application-port", "name": "VisitCompletedPublisher" },
    { "id": "pub-msg", "kind": "integration-message", "name": "VisitCompleted" },
    { "id": "schedule", "kind": "aggregate-root", "name": "Schedule" },
    { "id": "referral", "kind": "domain-port", "name": "ReferralPort" },
    { "id": "done", "kind": "domain-event", "name": "VisitCompleted" },
    { "id": "repo", "kind": "repository", "name": "ScheduleRepository" },
    { "id": "repo-a", "kind": "adapter", "name": "Schedule repository", "note": "MySQL" },
    { "id": "referral-a", "kind": "adapter", "name": "Referral ACL" },
    { "id": "pub-a", "kind": "adapter", "name": "VisitCompleted publisher", "note": "Kafka" }
  ],
  "dependencies": [
    { "from": "app", "to": "leave" },
    { "from": "app", "to": "schedule" },
    { "from": "app", "to": "repo" },
    { "from": "schedule", "to": "referral" },
    { "from": "schedule", "to": "done" },
    { "from": "handler", "to": "done" },
    { "from": "handler", "to": "pub" },
    { "from": "pub", "to": "pub-msg" },
    { "from": "repo-a", "to": "repo" },
    { "from": "referral-a", "to": "referral" },
    { "from": "pub-a", "to": "pub" }
  ],
  "mechanisms": [
    { "name": "Rate limit", "seam": "app", "serves": "Booking burst" },
    { "name": "Transactional outbox", "seam": "pub-a", "serves": "Billing relies on every VisitCompleted" }
  ]
}'

DOMAIN_OBJECTS='# Scheduling Domain Objects

## Schedule

### Schedule — Aggregate Root (`DoctorDay`)

- **Definition:** One doctor working day of bookable Slots.
- **Domain-owned Ports:**
  - `ReferralPort`
    - `Find Valid Referral` — `Confirm Appointment` invokes it to obtain a valid referral.
- **Domain Events:**
  - `VisitCompleted` — recorded by `Complete Visit`.
'

write_fixture "$tmp/valid" "$VALID"
printf '%s' "$DOMAIN_OBJECTS" >"$tmp/valid/domain-objects.md"
expected='valid Architecture: 12 components, 11 dependencies, 2 mechanisms; Domain names match domain-objects.md'
actual="$(node "$CLAUDE_VALIDATOR" "$tmp/valid/architecture.html")" || fail "validator rejected valid architecture"
[ "$actual" = "$expected" ] || fail "unexpected valid output: $actual"
[ "$(node "$CODEX_VALIDATOR" "$tmp/valid/architecture.html")" = "$expected" ] ||
  fail "Codex validator rejected valid architecture"

write_fixture "$tmp/no-objects" "$VALID"
node "$CLAUDE_VALIDATOR" "$tmp/no-objects/architecture.html" | grep -Fq "no domain-objects.md to cross-check" ||
  fail "validator should skip the Domain name check without domain-objects.md"

# The adapter of an application-port carries another context's Asynchronous Intent Contract.
INTENT="$(VALID="$VALID" python3 -c 'import json,os; d=json.loads(os.environ["VALID"])
d["components"] += [{"id":"notice","kind":"application-port","name":"ConfirmationNoticePort"},
  {"id":"notice-a","kind":"adapter","name":"Notification ACL"},
  {"id":"intent","kind":"integration-message","name":"SendAppointmentNotice"}]
d["dependencies"] += [{"from":"notice-a","to":"notice"},{"from":"notice-a","to":"intent"}]
print(json.dumps(d))')"
write_fixture "$tmp/intent" "$INTENT"
node "$CLAUDE_VALIDATOR" "$tmp/intent/architecture.html" >/dev/null ||
  fail "validator rejected an intent message carried by an application-port adapter"

# assert_invalid <name> <python-expression editing d> <expected message>
assert_invalid() {
  local name="$1" edit="$2" message="$3" json output
  json="$(VALID="$VALID" python3 -c "import json,os; d=json.loads(os.environ['VALID']); $edit; print(json.dumps(d))")"
  write_fixture "$tmp/$name" "$json"
  printf '%s' "$DOMAIN_OBJECTS" >"$tmp/$name/domain-objects.md"
  if output="$(node "$CLAUDE_VALIDATOR" "$tmp/$name/architecture.html" 2>&1)"; then
    fail "validator accepted invalid fixture $name"
  fi
  printf '%s\n' "$output" | grep -Fq -- "$message" || {
    printf '%s\n' "$output" >&2
    fail "invalid fixture $name did not report: $message"
  }
}

assert_invalid unknown-kind 'd["components"][0]["kind"]="inbound"' 'unknown kind "inbound"'
assert_invalid unknown-field 'd["dependencies"][0]["label"]="carries"' 'unknown field "label"'
assert_invalid duplicate-id 'd["components"][1]["id"]="app"' 'duplicate component id "app"'
assert_invalid unknown-target 'd["dependencies"].append({"from":"app","to":"ghost"})' 'unknown component "ghost"'
assert_invalid outward 'd["dependencies"].append({"from":"schedule","to":"app"})' 'points from domain to application'
assert_invalid domain-to-infra 'd["dependencies"].append({"from":"schedule","to":"repo-a"})' 'points from domain to infrastructure'
assert_invalid contract-without-adapter 'd["dependencies"]=[x for x in d["dependencies"] if x["from"]!="repo-a"]; d["components"]=[c for c in d["components"] if c["id"]!="repo-a"]' 'repository "repo" has no implementing adapter'
assert_invalid idle-adapter 'd["components"].append({"id":"idle","kind":"adapter","name":"Idle"})' 'adapter "idle" implements no contract'
assert_invalid orphan-message 'd["dependencies"]=[x for x in d["dependencies"] if x["to"]!="leave"]' 'integration-message "leave" needs exactly one dependency'
assert_invalid message-on-repository-adapter 'd["dependencies"]=[x for x in d["dependencies"] if x["to"]!="leave"]+[{"from":"repo-a","to":"leave"}]' 'integration-message "leave" needs exactly one dependency'
assert_invalid two-owners 'd["dependencies"].append({"from":"pub","to":"leave"})' 'integration-message "leave" needs exactly one dependency'
assert_invalid mechanism-on-domain 'd["mechanisms"].append({"name":"Cache","seam":"repo","serves":"Reads"})' 'a mechanism sits on the application entry or an adapter'
assert_invalid mechanism-unknown-seam 'd["mechanisms"][0]["seam"]="ghost"' 'unknown seam "ghost"'
assert_invalid undrawn-event 'd["components"]=[c for c in d["components"] if c["id"]!="done"]; d["dependencies"]=[x for x in d["dependencies"] if x["to"]!="done"]' 'domain-event "VisitCompleted" from domain-objects.md is not drawn'
assert_invalid unknown-root 'd["components"][5]["name"]="Calendar"' 'aggregate-root "Calendar" is not in domain-objects.md'

write_fixture "$tmp/no-block" '{}'
sed -i 's/architecture-data/other-data/' "$tmp/no-block/architecture.html"
if node "$CLAUDE_VALIDATOR" "$tmp/no-block/architecture.html" >/dev/null 2>&1; then
  fail "validator accepted a file without the data block"
fi

echo "PASS ddd-expert Architecture validator and shipped template compatibility"
