#!/usr/bin/env bash
# Validate designing-tests runtime guidance and metadata for evidence-first hand-off.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLAUDE_HOOK="$ROOT/plugins/designing-tests/hooks/pre-tool-use"
CODEX_RUNTIME="$ROOT/codex-plugins/designing-tests/hooks/codex-runtime.js"
CODEX_HOOKS="$ROOT/codex-plugins/designing-tests/hooks/hooks.json"
CODEX_SNIPPET="$ROOT/codex-plugins/designing-tests/codex-hooks-snippet.json"

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

  # Intent: completion and review-time skills must receive verification evidence
  # guidance, not only test-list guidance.
  grep -q "EVIDENCE HAND-OFF" <<<"$context" || fail "$skill missing evidence hand-off guidance"
  grep -q "tested" <<<"$context" || fail "$skill missing tested evidence reporting"
  grep -q "checked" <<<"$context" || fail "$skill missing checked evidence reporting"
  grep -q "skipped/unavailable" <<<"$context" || fail "$skill missing skipped/unavailable reporting"
  grep -q "residual risk" <<<"$context" || fail "$skill missing residual risk reporting"
done

planning_context="$(claude_skill_context superpowers:writing-plans)"

# Intent: planning guidance must choose evidence before tests and keep hand-off
# evidence broad enough to include checks, dry-runs, and residual risk.
grep -q "Evidence choice" <<<"$planning_context" || fail "planning tier missing evidence choice"
grep -q "Intent / Risk / Evidence" <<<"$planning_context" || fail "planning tier missing intent-risk-evidence framing"
grep -q "checked" <<<"$planning_context" || fail "planning tier missing checked evidence"
grep -q "residual risk" <<<"$planning_context" || fail "planning tier missing residual risk reporting"

CODEX_HOOKS="$CODEX_HOOKS" CODEX_SNIPPET="$CODEX_SNIPPET" node <<'NODE'
const fs = require("fs");

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

for (const [label, file] of [
  ["native hooks", process.env.CODEX_HOOKS],
  ["fallback snippet", process.env.CODEX_SNIPPET],
]) {
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  if (cfg.hooks?.SessionStart) {
    fail(`Codex designing-tests ${label} must not register SessionStart`);
  }
  if (!Array.isArray(cfg.hooks?.UserPromptSubmit)) {
    fail(`Codex designing-tests ${label} must register UserPromptSubmit`);
  }
}
NODE

codex_prompt_context="$(
  printf '{"prompt":"Please use $superpowers:writing-plans for this ADR and sequence diagram test strategy"}\n' |
    node "$CODEX_RUNTIME" user-prompt-submit |
    extract_context
)"

# Intent: Codex must reinforce evidence-first test design at explicit workflow
# skill mentions, not through broad SessionStart hooks.
grep -q "Evidence Choice (Codex)" <<<"$codex_prompt_context" || fail "codex user-prompt-submit missing evidence choice guidance"
grep -q "Architecture docs" <<<"$codex_prompt_context" || fail "codex user-prompt-submit missing architecture guidance"
grep -q "Hand-off evidence" <<<"$codex_prompt_context" || fail "codex user-prompt-submit missing hand-off evidence guidance"

codex_review_context="$(
  printf '{"prompt":"Run $superpowers:verification-before-completion and prepare hand-off evidence"}\n' |
    node "$CODEX_RUNTIME" user-prompt-submit |
    extract_context
)"

grep -q "completion claims" <<<"$codex_review_context" || fail "codex completion mention missing evidence guidance"

codex_finish_context="$(
  printf '{"prompt":"Run $superpowers:finishing-a-development-branch and prepare branch hand-off evidence"}\n' |
    node "$CODEX_RUNTIME" user-prompt-submit |
    extract_context
)"

grep -q "Evidence Choice (Codex)" <<<"$codex_finish_context" || fail "codex finishing mention missing evidence choice guidance"
grep -q "Hand-off evidence" <<<"$codex_finish_context" || fail "codex finishing mention missing hand-off evidence guidance"

codex_unrelated="$(printf '{"prompt":"summarize this note"}\n' | node "$CODEX_RUNTIME" user-prompt-submit)"
[ "$codex_unrelated" = "{}" ] || fail "codex unrelated prompt should return empty object"

# Intent: skill discovery metadata must mention hand-off evidence and skipped/unrun risk.
grep -q "hand-off" "$ROOT/plugins/designing-tests/skills/designing-tests/SKILL.md" || fail "Claude skill metadata missing hand-off trigger"
grep -q "evidence" "$ROOT/plugins/designing-tests/skills/designing-tests/SKILL.md" || fail "Claude skill metadata missing evidence trigger"
grep -q "skipped" "$ROOT/plugins/designing-tests/skills/designing-tests/SKILL.md" || fail "Claude skill metadata missing skipped evidence trigger"
grep -q "architecture docs" "$ROOT/plugins/designing-tests/skills/designing-tests/SKILL.md" || fail "Claude skill metadata missing architecture-doc trigger"
grep -q "sequence diagrams" "$ROOT/plugins/designing-tests/skills/designing-tests/SKILL.md" || fail "Claude skill metadata missing sequence-diagram trigger"
grep -q "hand-off" "$ROOT/codex-plugins/designing-tests/skills/designing-tests/SKILL.md" || fail "Codex skill metadata missing hand-off trigger"
grep -q "evidence" "$ROOT/codex-plugins/designing-tests/skills/designing-tests/SKILL.md" || fail "Codex skill metadata missing evidence trigger"
grep -q "skipped" "$ROOT/codex-plugins/designing-tests/skills/designing-tests/SKILL.md" || fail "Codex skill metadata missing skipped evidence trigger"
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
grep -q "Goal Risk Evidence Matrix" "$ROOT/plugins/designing-tests/skills/designing-tests/references/architecture-test-design.md" || fail "architecture reference missing goal/risk/evidence matrix"
grep -q "State Ownership Gates" "$ROOT/plugins/designing-tests/skills/designing-tests/references/architecture-test-design.md" || fail "architecture reference missing state ownership gates"
grep -q "Quality Threshold Assumptions" "$ROOT/plugins/designing-tests/skills/designing-tests/references/architecture-test-design.md" || fail "architecture reference missing quality threshold assumptions"
grep -q "Sequence Evidence Matrix" "$ROOT/plugins/designing-tests/skills/designing-tests/references/architecture-test-design.md" || fail "architecture reference missing sequence evidence matrix"
grep -q "architecture design goals" "$ROOT/plugins/designing-tests/skills/designing-tests/references/architecture-test-design.md" || fail "architecture reference missing design-goal focus"
grep -q "Architecture Evidence Hand-off" "$ROOT/plugins/designing-tests/skills/designing-tests/references/handoff-gate.md" || fail "handoff gate missing architecture evidence variant"

echo "  designing-tests runtime: evidence-choice guidance and metadata correct"
