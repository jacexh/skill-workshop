#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const mode = process.argv[2];

const SESSION_START_CONTEXT =
  "## DDD Architecture Guardrails\n" +
  "DDD/backend architecture guardrails are available on demand. Use " +
  "`$superpowers-ddd-architect:standards` before DDD, Go backend, " +
  "domain-boundary, event/message, taskqueue/runtime, or database-backed " +
  "persistence work. Explicit `$superpowers:*` workflow skill mentions also " +
  "trigger a compact DDD risk-router index; SessionStart intentionally stays lightweight.\n";

const PROMPT_HEADER =
  "====== DDD Architect Standards ======\n" +
  "The current user request explicitly invokes a superpowers workflow skill that should apply DDD/backend architecture guardrails.\n\n" +
  "You MUST read ddd-risk-router.md first when present, then read only the deeper references required by triggered risk cards or the task/review scope. In your response, state:\n" +
  "- which DDD/backend references apply,\n" +
  "- which risk cards triggered deeper reading,\n" +
  "- which important constraints affect your plan, code, or review,\n" +
  "- which listed patterns are not relevant, if any,\n" +
  "- any conflicts between the request and an applicable DDD/backend standard.\n\n";

const PROMPT_TRIGGERS = [
  /\$superpowers:(?:brainstorming|writing-plans|executing-plans|subagent-driven-development|requesting-code-review|receiving-code-review)\b/i,
];

function isDddBackendPattern(filename) {
  return filename === "database.md" || filename.startsWith("ddd-");
}

function referenceDirs() {
  return [path.join(__dirname, "..", "skills", "standards", "references")];
}

function listReferenceFiles() {
  const files = new Map();
  for (const dir of referenceDirs()) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir).sort()) {
      if (!entry.endsWith(".md") || !isDddBackendPattern(entry)) continue;
      files.set(entry, path.join(dir, entry));
    }
  }
  return new Map([...files.entries()].sort((a, b) => {
    if (a[0] === "ddd-risk-router.md") return -1;
    if (b[0] === "ddd-risk-router.md") return 1;
    return a[0].localeCompare(b[0]);
  }));
}

function readPatternHeader(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  let name = path.basename(filePath, ".md");
  let description = "";

  if (content.startsWith("---")) {
    const end = content.indexOf("---", 3);
    if (end !== -1) {
      for (const line of content.slice(3, end).split(/\r?\n/)) {
        if (line.startsWith("name:")) name = line.slice(5).trim();
        else if (line.startsWith("description:")) description = line.slice(12).trim();
      }
      return { name, description };
    }
  }

  for (const line of content.split(/\r?\n/)) {
    const m1 = line.match(/^#\s+(.+?)\s*$/);
    if (m1 && name === path.basename(filePath, ".md")) {
      name = m1[1];
      continue;
    }
    if (!description && line.trim() && !line.startsWith("#")) {
      description = line.trim();
      break;
    }
  }
  return { name, description };
}

function renderReferenceIndex(files) {
  if (files.size === 0) return "";

  let body = PROMPT_HEADER;
  body +=
    "DDD risk-router workflow:\n" +
    "1. Read ddd-risk-router.md first when it is listed below.\n" +
    "2. Match the task or review against its risk cards.\n" +
    "3. Read only the deeper DDD/backend references required by triggered cards, the task, or an explicit Architecture Gate.\n" +
    "4. For non-backend work, state that this plugin is not relevant and continue without loading unrelated standards.\n\n";

  for (const [filename, absPath] of files) {
    const { name, description } = readPatternHeader(absPath);
    body += `- **${name}** (${filename}): ${description}\n  Path: ${absPath}\n`;
  }
  body += "\nLoad full pattern via Read when relevant.\n";
  return body;
}

function buildSessionStartOutput() {
  return {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: SESSION_START_CONTEXT,
    },
  };
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
  if (!prompt || !shouldTriggerForPrompt(prompt)) return {};

  const body = renderReferenceIndex(listReferenceFiles());
  if (!body) return {};

  return {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: body,
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
  if (mode === "session-start") {
    process.stdout.write(JSON.stringify(buildSessionStartOutput(), null, 2) + "\n");
    return;
  }
  if (mode === "user-prompt-submit") {
    const input = await readStdin();
    process.stdout.write(JSON.stringify(buildUserPromptSubmitOutput(input), null, 2) + "\n");
    return;
  }
  if (mode === "stop") {
    await readStdin();
    process.stdout.write("{}\n");
    return;
  }
  process.stderr.write("Unknown hook mode: " + mode + "\n");
  process.exit(1);
}

main().catch((e) => {
  process.stderr.write((e.stack || e.message) + "\n");
  process.exit(1);
});
