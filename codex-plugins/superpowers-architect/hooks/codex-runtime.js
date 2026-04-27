#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const mode = process.argv[2];

const FUSED_HEADER =
  "## Project Architecture Standards\n" +
  "When invoking $superpowers:writing-plans / executing-plans / subagent-driven-development, " +
  "treat the patterns below as STRICT CONSTRAINTS to apply: state which apply, which do not, " +
  "and call out any conflicts explicitly rather than silently ignoring them. " +
  "When invoking $superpowers:requesting-code-review / receiving-code-review, " +
  "treat them as VERIFICATION CRITERIA: identify violations, conflicts, and improvements.\n\n";

function listPatternFiles() {
  const localDir = path.join(__dirname, "..", "design-patterns");
  const globalDir = process.env.SP_ARCHITECT_DIR ||
    path.join(process.env.HOME || "", ".claude", "superpowers-architect", "design-patterns");

  const files = new Map(); // filename -> absolute path; project-local overrides global by filename
  for (const dir of [globalDir, localDir]) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
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

function buildSessionStartOutput() {
  const files = listPatternFiles();
  if (files.size === 0) {
    return { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "" } };
  }

  let body = FUSED_HEADER;
  for (const [filename, absPath] of files) {
    const { name, description } = readPatternHeader(absPath);
    body += `- **${name}** (${filename}): ${description}\n  Path: ${absPath}\n`;
  }
  body += "\nLoad full pattern via Read when relevant.\n";

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
