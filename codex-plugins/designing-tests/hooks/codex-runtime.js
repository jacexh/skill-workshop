#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const mode = process.argv[2];

const EXECUTION_TIER_BODY =
  "## Evidence Choice (Codex)\n" +
  "Use this compact primer for test work and completion claims:\n\n" +
  "1. **Intent**: name the requirement source or mark the intent as an assumption.\n" +
  "2. **Risk**: state the observable regression: `If <behavior breaks>, users/system observe <failure>`.\n" +
  "3. **Evidence choice**: choose `test`, `check`, `dry-run`, `smoke`, `manual`, or `residual risk` before writing tests.\n" +
  "4. **Test only when justified**: a test is selected only when it is the narrowest reliable evidence for the stated regression; explain why lighter checked evidence would miss it.\n" +
  "5. **High-risk upgrade**: security, data, contract, async, migration/config, and historical incident risks need real tests or an explicit residual-risk explanation.\n" +
  "6. **Architecture docs**: verify architecture design goals with goal/risk/evidence and residual risk, not every diagram arrow.\n" +
  "7. **Hand-off evidence**: completion claims must report tested evidence, checked evidence, skipped/unavailable checks, and residual risk. Skipped integration/E2E tests do not count as passing evidence.\n";

const PROMPT_TRIGGERS = [
  /\$superpowers:(?:writing-plans|executing-plans|subagent-driven-development|test-driven-development|verification-before-completion|requesting-code-review|receiving-code-review|finishing-a-development-branch)\b/i,
];

function buildPromptPrimer() {
  const refsDir = path.join(__dirname, "..", "references");
  const refs = [];
  if (fs.existsSync(refsDir)) {
    for (const entry of fs.readdirSync(refsDir).sort()) {
      if (!entry.endsWith(".md")) continue;
      refs.push({ name: entry.replace(/\.md$/, ""), path: path.join(refsDir, entry) });
    }
  }

  let body = EXECUTION_TIER_BODY;
  if (refs.length) {
    body += "\n## References (Read on demand)\n";
    for (const ref of refs) body += `- **${ref.name}** — ${ref.path}\n`;
  }
  body += "\nFull SKILL.md available via $designing-tests:designing-tests when deeper verification design begins.\n";

  return body;
}

function parsePrompt(input) {
  try {
    const parsed = JSON.parse(input || "{}");
    return typeof parsed.prompt === "string" ? parsed.prompt : "";
  } catch {
    return "";
  }
}

function shouldTriggerForPrompt(prompt) {
  return PROMPT_TRIGGERS.some((pattern) => pattern.test(prompt));
}

function buildUserPromptSubmitOutput(input) {
  const prompt = parsePrompt(input);
  if (!prompt || !shouldTriggerForPrompt(prompt)) {
    return {};
  }
  return {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: buildPromptPrimer(),
    },
  };
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data));
    process.stdin.resume();
  });
}

async function main() {
  if (mode === "user-prompt-submit") {
    const input = await readStdin();
    process.stdout.write(JSON.stringify(buildUserPromptSubmitOutput(input), null, 2) + "\n");
    return;
  }
  process.stderr.write("Unknown hook mode: " + mode + "\n");
  process.exit(1);
}

main().catch((e) => {
  process.stderr.write((e.stack || e.message) + "\n");
  process.exit(1);
});
