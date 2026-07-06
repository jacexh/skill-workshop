#!/usr/bin/env node
"use strict";

const mode = process.argv[2];

const REMINDERS = [
  {
    pattern: /\$superpowers:writing-plans\b/i,
    context:
      "DDD Expert reminder: before `$superpowers:writing-plans`, confirm an accepted domain model. If none exists, invoke `$ddd-expert:domain-modeling`; if one exists, invoke `$ddd-expert:design` before planning.",
  },
  {
    pattern: /\$superpowers:(?:executing-plans|subagent-driven-development)\b/i,
    context:
      "DDD Expert reminder: for development workflow steps, invoke `$ddd-expert:implement` before code edits.",
  },
  {
    pattern: /\$superpowers:(?:requesting-code-review|receiving-code-review)\b/i,
    context:
      "DDD Expert reminder: for review workflow steps, invoke `$ddd-expert:review` before findings.",
  },
];

function parsePrompt(input) {
  try {
    const parsed = JSON.parse(input || "{}");
    return typeof parsed.prompt === "string" ? parsed.prompt : "";
  } catch {
    return "";
  }
}

function buildUserPromptSubmitOutput(input) {
  const prompt = parsePrompt(input);
  const reminder = REMINDERS.find((entry) => entry.pattern.test(prompt));
  if (!reminder) {
    return {};
  }

  return {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: reminder.context,
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

main().catch((error) => {
  process.stderr.write((error.stack || error.message) + "\n");
  process.exit(1);
});
