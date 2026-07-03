#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const mode = process.argv[2];

const SESSION_START_CONTEXT =
  "## DDD Architecture Guardrails\n" +
  "DDD/backend architecture guardrails are available on demand. Use " +
  "`$superpowers-ddd-architect:design` before DDD boundary design, " +
  "`$superpowers-ddd-architect:implement` while placing backend code, and " +
  "`$superpowers-ddd-architect:review` when auditing DDD/backend diffs. " +
  "Explicit `$superpowers:*` workflow skill mentions trigger the matching compact DDD risk-router index; SessionStart intentionally stays lightweight.\n";

const PROMPT_MODES = [
  { mode: "design", pattern: /\$superpowers:(?:brainstorming|writing-plans)\b/i },
  { mode: "implement", pattern: /\$superpowers:(?:executing-plans|subagent-driven-development)\b/i },
  { mode: "review", pattern: /\$superpowers:(?:requesting-code-review|receiving-code-review)\b/i },
];

const REFERENCE_BUDGETS = {
  design: new Set(["ddd-risk-router.md"]),
  implement: new Set(["ddd-risk-router.md"]),
  review: new Set(["ddd-risk-router.md"]),
};

const PHASE_SKILLS = {
  design: "design",
  implement: "implement",
  review: "review",
};

function isDddBackendPattern(filename) {
  return filename === "database.md" || filename.startsWith("ddd-");
}

function referenceDirs() {
  return [path.join(__dirname, "..", "references")];
}

function phaseSkillPath(mode) {
  const skill = PHASE_SKILLS[mode] || PHASE_SKILLS.design;
  return path.join(__dirname, "..", "skills", skill, "SKILL.md");
}

function listReferenceFiles(mode) {
  const budget = REFERENCE_BUDGETS[mode] || REFERENCE_BUDGETS.design;
  const files = new Map();
  for (const dir of referenceDirs()) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir).sort()) {
      if (!entry.endsWith(".md") || !isDddBackendPattern(entry)) continue;
      if (!budget.has(entry)) continue;
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

function promptHeader(mode) {
  if (mode === "design") {
    return (
      "====== DDD Design Guidance ======\n" +
      "Reference budget: design. Only the phase skill and risk router are listed by default; deeper DDD/backend references are on-demand when the skill or risk router routes to them.\n\n" +
      "This hook only selects the design entrypoint. You MUST read the listed design phase skill before continuing, then use ddd-risk-router.md as the shared risk-card router.\n\n"
    );
  }
  if (mode === "review") {
    return (
      "====== DDD Boundary Review ======\n" +
      "Reference budget: review. Only the phase skill and risk router are listed by default; deeper DDD/backend references are on-demand when the skill or risk router routes to them.\n\n" +
      "This hook only selects the review entrypoint. You MUST read the listed review phase skill before continuing, then use ddd-risk-router.md as the shared risk-card router.\n\n"
    );
  }
  return (
    "====== DDD Implementation Guardrails ======\n" +
    "Reference budget: implement. Only the phase skill and risk router are listed by default; deeper DDD/backend references are on-demand when the skill or risk router routes to them.\n\n" +
    "This hook only selects the implement entrypoint. You MUST read the listed implement phase skill before continuing, then use ddd-risk-router.md as the shared risk-card router.\n\n"
  );
}

function renderReferenceIndex(files, mode) {
  if (files.size === 0) return "";

  let body = promptHeader(mode);
  const skillPath = phaseSkillPath(mode);
  if (fs.existsSync(skillPath)) {
    body += `- **${mode} phase skill** (${path.relative(path.join(__dirname, ".."), skillPath)}): phase entrypoint and output contract\n  Path: ${skillPath}\n`;
  }
  body +=
    "DDD phase router:\n" +
    "1. Read the listed phase skill and ddd-risk-router.md.\n" +
    "2. Use the phase skill as the behavior contract for this phase.\n" +
    "3. Load deeper DDD/backend references only when the phase skill or risk router routes there.\n" +
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

function modeForPrompt(prompt) {
  const found = PROMPT_MODES.find(({ pattern }) => pattern.test(prompt));
  return found ? found.mode : null;
}

function buildUserPromptSubmitOutput(input) {
  const prompt = parsePrompt(input);
  const mode = prompt ? modeForPrompt(prompt) : null;
  if (!mode) return {};

  const body = renderReferenceIndex(listReferenceFiles(mode), mode);
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
