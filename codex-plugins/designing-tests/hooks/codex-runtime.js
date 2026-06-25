#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const mode = process.argv[2];

const EXECUTION_TIER_BODY =
  "## Test Design Principles (Codex)\n" +
  "Test work and completion claims must follow:\n\n" +
  "1. **Intent-first**: derive tests from function intent BEFORE reading implementation; build a test list as a planning step.\n" +
  "2. **Intent comments**: every test gets a one-line comment naming the intent it verifies.\n" +
  "3. **Architecture docs**: for ADRs, architecture docs, message flows, or sequence diagrams, first extract architecture design goals, hotspots, and sequence phases; tests should verify design goals, not mechanically cover every arrow.\n" +
  "4. **Boundary selection**: pick the lowest boundary that fails like production; escalate to integration/seam/contract/E2E when risk depends on real storage, serialization, middleware, generated clients, broker behavior, or deployment-like config.\n" +
  "5. **Case design**: cover Equivalence Partitions, Boundary Value Analysis, and Decision Tables relevant to the intent.\n" +
  "6. **Quality labels**: tag each test as `real`, `shallow`, or `fake`. An integration test that mocks the risky internal collaborator is not real for that risk.\n" +
  "7. **Hand-off gate**: before claiming completion, report commands run, test labels, skipped/unavailable tests, and residual risk. Skipped integration/E2E tests do not count as verification evidence.\n";

const PROMPT_TRIGGERS = [
  /\$superpowers:(?:writing-plans|executing-plans|subagent-driven-development|test-driven-development|verification-before-completion|requesting-code-review|receiving-code-review)\b/i,
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
  body += "\nFull SKILL.md available via $designing-tests:designing-tests when test work begins.\n";

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
