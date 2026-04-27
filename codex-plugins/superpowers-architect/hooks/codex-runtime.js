#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const mode = process.argv[2];

const FUSED_HEADER =
  "## Project Architecture Standards\n" +
  "For architecture, API, database, backend, frontend, refactoring, implementation planning, " +
  "execution, and code review work, treat the patterns below as strict standards. " +
  "Before acting, identify which patterns apply, read the relevant full pattern files, " +
  "state which patterns do not apply, and call out conflicts explicitly.\n\n";

const PROMPT_HEADER =
  "====== Architect Standards ======\n" +
  "The current user request explicitly invokes a superpowers workflow skill that should apply architecture standards.\n\n" +
  "You MUST identify and read the relevant patterns below before proceeding. In your response, state:\n" +
  "- which patterns apply,\n" +
  "- which important constraints from those patterns affect your plan, code, or review,\n" +
  "- which listed patterns are not relevant, if any,\n" +
  "- any conflicts between the request and an applicable pattern.\n\n";

function resolveRepoRoot() {
  const result = cp.spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 5000,
  });
  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim();
  }
  return process.cwd();
}

function addDir(dirs, dirPath) {
  if (!dirPath) return;
  const resolved = path.resolve(dirPath);
  if (!dirs.includes(resolved)) {
    dirs.push(resolved);
  }
}

function patternDirs() {
  const dirs = [];
  const pluginDir = path.join(__dirname, "..", "design-patterns");
  const repoRoot = resolveRepoRoot();

  if (process.env.SPA_DEFAULTS !== "false") {
    addDir(dirs, pluginDir);
  }

  // Support both the Claude-side variable and the original Codex port name.
  addDir(dirs, path.join(process.env.HOME || "", ".claude", "superpowers-architect", "design-patterns"));
  addDir(dirs, process.env.SP_ARCHITECT_DIR);
  addDir(dirs, process.env.SPA_GLOBAL);

  // Project-local patterns are highest priority. `docs/design-patterns` matches
  // the Claude plugin contract; `design-patterns` preserves the early Codex README.
  addDir(dirs, path.join(repoRoot, "design-patterns"));
  addDir(dirs, path.join(repoRoot, "docs", "design-patterns"));
  return dirs;
}

function listPatternFiles() {
  const files = new Map(); // filename -> absolute path; later dirs override earlier dirs by filename
  for (const dir of patternDirs()) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir).sort()) {
      if (!entry.endsWith(".md")) continue;
      files.set(entry, path.join(dir, entry));
    }
  }
  return files;
}

function readPatternHeader(filePath) {
  // Pattern files use YAML frontmatter to declare name + description (matches the
  // Claude-side hook's parsing in plugins/superpowers-architect/hooks/pre-tool-use).
  // Falls back to filename + first non-frontmatter line if frontmatter is absent.
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

  // No frontmatter: use H1 + first non-blank, non-header line.
  for (const line of content.split(/\r?\n/)) {
    const m1 = line.match(/^#\s+(.+?)\s*$/);
    if (m1 && name === path.basename(filePath, ".md")) { name = m1[1]; continue; }
    if (!description && line.trim() && !line.startsWith("#")) {
      description = line.trim();
      break;
    }
  }
  return { name, description };
}

function renderPatternIndex(files, header) {
  if (files.size === 0) {
    return "";
  }

  let body = header;
  for (const [filename, absPath] of files) {
    const { name, description } = readPatternHeader(absPath);
    body += `- **${name}** (${filename}): ${description}\n  Path: ${absPath}\n`;
  }
  body += "\nLoad full pattern via Read when relevant.\n";
  return body;
}

function buildSessionStartOutput() {
  const body = renderPatternIndex(listPatternFiles(), FUSED_HEADER);

  return {
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: body },
  };
}

const PROMPT_TRIGGERS = [
  /\$superpowers:(?:brainstorming|writing-plans|executing-plans|subagent-driven-development|requesting-code-review|receiving-code-review)\b/i,
];

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

  const files = listPatternFiles();
  const body = renderPatternIndex(files, PROMPT_HEADER);
  if (!body) return {};

  return {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: body,
    },
  };
}

async function main() {
  if (mode === "session-start") {
    process.stdout.write(JSON.stringify(buildSessionStartOutput(), null, 2) + "\n");
    return;
  }
  if (mode === "user-prompt-submit") {
    const input = await new Promise((resolve) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { data += chunk; });
      process.stdin.on("end", () => resolve(data));
      process.stdin.resume();
    });
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
