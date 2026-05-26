#!/usr/bin/env bash
# Validate designing-tests runtime guidance and metadata for hand-off evidence.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLAUDE_HOOK="$ROOT/plugins/designing-tests/hooks/pre-tool-use"
CODEX_RUNTIME="$ROOT/codex-plugins/designing-tests/hooks/codex-runtime.js"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

extract_context() {
  node -e '
const fs = require("fs");
const raw = fs.readFileSync(0, "utf8");
const data = JSON.parse(raw);
process.stdout.write(data.hookSpecificOutput?.additionalContext || data.additional_context || "");
'
}

claude_skill_context() {
  local skill="$1"
  printf '{"tool_input":{"skill":"%s"}}\n' "$skill" | "$CLAUDE_HOOK" | extract_context
}

for skill in \
  superpowers:verification-before-completion \
  superpowers:requesting-code-review \
  superpowers:receiving-code-review \
  superpowers:finishing-a-development-branch; do
  context="$(claude_skill_context "$skill")"

  # Intent: completion and review-time skills must receive hand-off evidence guidance,
  # not only test-writing skills.
  grep -q "HAND-OFF GATE" <<<"$context" || fail "$skill missing hand-off gate guidance"
  grep -q "skipped/unavailable" <<<"$context" || fail "$skill missing skipped/unavailable reporting"
  grep -q "residual risk" <<<"$context" || fail "$skill missing residual risk reporting"
  grep -q "real.*shallow.*fake" <<<"$context" || fail "$skill missing quality labels"
done

planning_context="$(claude_skill_context superpowers:writing-plans)"

# Intent: planning guidance must require a final verification hand-off step.
grep -q "hand-off verification step" <<<"$planning_context" || fail "planning tier missing hand-off step"
grep -q "skipped tests" <<<"$planning_context" || fail "planning tier missing skipped-test reporting"

codex_context="$(node "$CODEX_RUNTIME" session-start | extract_context)"

# Intent: Codex primer should apply to test work and completion claims, not only four
# implementation skills that might not run at final hand-off.
grep -q "Test work and completion claims must follow" <<<"$codex_context" || fail "codex primer scope too narrow"
grep -q "Hand-off gate" <<<"$codex_context" || fail "codex primer missing hand-off gate"
grep -q "Skipped integration/E2E tests do not count" <<<"$codex_context" || fail "codex primer missing skipped-test evidence rule"
grep -q "handoff-gate" <<<"$codex_context" || fail "codex primer missing handoff-gate reference"
grep -q "integration-quality" <<<"$codex_context" || fail "codex primer missing integration-quality reference"
grep -q "architecture-test-design" <<<"$codex_context" || fail "codex primer missing architecture-test-design reference"

codex_prompt_context="$(
  printf '{"prompt":"Please use $superpowers:writing-plans for this ADR and sequence diagram test strategy"}\n' |
    node "$CODEX_RUNTIME" user-prompt-submit |
    extract_context
)"

# Intent: Codex must reinforce architecture-aware test design at explicit workflow
# skill mentions, not only at SessionStart.
grep -q "Test Design Principles (Codex)" <<<"$codex_prompt_context" || fail "codex user-prompt-submit missing test design guidance"
grep -q "Architecture docs" <<<"$codex_prompt_context" || fail "codex user-prompt-submit missing architecture guidance"
grep -q "Hand-off gate" <<<"$codex_prompt_context" || fail "codex user-prompt-submit missing hand-off guidance"

codex_review_context="$(
  printf '{"prompt":"Run $superpowers:verification-before-completion and prepare hand-off evidence"}\n' |
    node "$CODEX_RUNTIME" user-prompt-submit |
    extract_context
)"

grep -q "completion claims" <<<"$codex_review_context" || fail "codex completion mention missing evidence guidance"

codex_unrelated="$(printf '{"prompt":"summarize this note"}\n' | node "$CODEX_RUNTIME" user-prompt-submit)"
[ "$codex_unrelated" = "{}" ] || fail "codex unrelated prompt should return empty object"

# Intent: skill discovery metadata must mention hand-off evidence and skipped/unrun risk.
grep -q "hand-off" "$ROOT/plugins/designing-tests/skills/designing-tests/SKILL.md" || fail "Claude skill metadata missing hand-off trigger"
grep -q "skipped" "$ROOT/plugins/designing-tests/skills/designing-tests/SKILL.md" || fail "Claude skill metadata missing skipped-test trigger"
grep -q "architecture docs" "$ROOT/plugins/designing-tests/skills/designing-tests/SKILL.md" || fail "Claude skill metadata missing architecture-doc trigger"
grep -q "sequence diagrams" "$ROOT/plugins/designing-tests/skills/designing-tests/SKILL.md" || fail "Claude skill metadata missing sequence-diagram trigger"
grep -q "hand-off" "$ROOT/codex-plugins/designing-tests/skills/designing-tests/SKILL.md" || fail "Codex skill metadata missing hand-off trigger"
grep -q "skipped" "$ROOT/codex-plugins/designing-tests/skills/designing-tests/SKILL.md" || fail "Codex skill metadata missing skipped-test trigger"
grep -q "architecture docs" "$ROOT/codex-plugins/designing-tests/skills/designing-tests/SKILL.md" || fail "Codex skill metadata missing architecture-doc trigger"
grep -q "sequence diagrams" "$ROOT/codex-plugins/designing-tests/skills/designing-tests/SKILL.md" || fail "Codex skill metadata missing sequence-diagram trigger"
grep -q "hand-off" "$ROOT/.claude-plugin/marketplace.json" || fail "Claude marketplace metadata missing hand-off positioning"
grep -q "hand-off" "$ROOT/codex-plugins/designing-tests/.codex-plugin/plugin.json" || fail "Codex manifest metadata missing hand-off positioning"

# Intent: all referenced high-signal hand-off files must be present in both tracks.
for file in architecture-test-design.md handoff-gate.md integration-quality.md; do
  [ -f "$ROOT/plugins/designing-tests/skills/designing-tests/references/$file" ] || fail "missing Claude reference $file"
  [ -f "$ROOT/codex-plugins/designing-tests/references/$file" ] || fail "missing Codex reference $file"
done

grep -q "Architecture Test Design" "$ROOT/plugins/designing-tests/skills/designing-tests/references/architecture-test-design.md" || fail "architecture reference missing output format"
grep -q "Goal Coverage Matrix" "$ROOT/plugins/designing-tests/skills/designing-tests/references/architecture-test-design.md" || fail "architecture reference missing goal coverage matrix"
grep -q "State Ownership Gates" "$ROOT/plugins/designing-tests/skills/designing-tests/references/architecture-test-design.md" || fail "architecture reference missing state ownership gates"
grep -q "Quality Threshold Assumptions" "$ROOT/plugins/designing-tests/skills/designing-tests/references/architecture-test-design.md" || fail "architecture reference missing quality threshold assumptions"
grep -q "Sequence Phase Matrix" "$ROOT/plugins/designing-tests/skills/designing-tests/references/architecture-test-design.md" || fail "architecture reference missing sequence phase matrix"
grep -q "architecture design goals" "$ROOT/plugins/designing-tests/skills/designing-tests/references/architecture-test-design.md" || fail "architecture reference missing design-goal focus"
grep -q "Architecture Verification Hand-off" "$ROOT/plugins/designing-tests/skills/designing-tests/references/handoff-gate.md" || fail "handoff gate missing architecture verification variant"

echo "  designing-tests runtime: hand-off guidance and metadata correct"
