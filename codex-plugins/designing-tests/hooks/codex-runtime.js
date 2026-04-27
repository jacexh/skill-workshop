#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const mode = process.argv[2];

const EXECUTION_TIER_BODY =
  "## Test Design Principles (Codex)\n" +
  "When invoking $superpowers:writing-plans / executing-plans / subagent-driven-development / test-driven-development, follow:\n\n" +
  "1. **Intent-first**: derive tests from function intent BEFORE reading implementation; build a test list as a planning step.\n" +
  "2. **Intent comments**: every test gets a one-line comment naming the intent it verifies.\n" +
  "3. **Boundary selection**: cover Equivalence Partitions, Boundary Value Analysis, and Decision Tables relevant to the intent.\n" +
  "4. **Quality labels**: tag each test as `real` (real impl + real deps), `shallow` (real impl + faked deps), or `fake` (no impl, only mocks).\n" +
  "5. **Layer selection**: pick unit / integration / E2E by what the intent actually crosses; do NOT default to unit.\n";

function buildSessionStartOutput() {
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

  return {
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: body },
  };
}

async function main() {
  if (mode === "session-start") {
    process.stdout.write(JSON.stringify(buildSessionStartOutput(), null, 2) + "\n");
    return;
  }
  process.stderr.write("Unknown hook mode: " + mode + "\n");
  process.exit(1);
}

main().catch((e) => {
  process.stderr.write((e.stack || e.message) + "\n");
  process.exit(1);
});
