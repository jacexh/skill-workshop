#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const mode = process.argv[2];
const repoRoot = process.cwd();
const knowledgeDir = path.join(repoRoot, "docs", "project-knowledge");
const ignoredPrefixes = [
  "node_modules/",
  "vendor/",
  "dist/",
  "build/",
  ".next/",
  "coverage/",
  ".git/",
  "docs/project-knowledge/",
];

function run(command, args) {
  const result = cp.spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout || "",
  };
}

function findIndexPath() {
  for (const name of ["index.md", "MEMORY.md"]) {
    const candidate = path.join(knowledgeDir, name);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function hasKnowledgeBase() {
  return fs.existsSync(knowledgeDir);
}

function isGitRepo() {
  return run("git", ["rev-parse", "--is-inside-work-tree"]).code === 0;
}

function relativePath(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function normalizePath(inputPath) {
  if (!inputPath) return null;
  const cleaned = inputPath.trim().replace(/\\/g, "/");
  if (!cleaned) return null;
  return cleaned.replace(/^\.\//, "");
}

function hookPayload(eventName, message) {
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    return {
      hookSpecificOutput: {
        hookEventName: eventName,
        additionalContext: message,
      },
    };
  }
  return { additional_context: message };
}

function readStdin() {
  return new Promise((resolve) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => resolve(input));
    process.stdin.resume();
  });
}

function buildSessionStartOutput() {
  if (!hasKnowledgeBase()) {
    return hookPayload(
      "SessionStart",
      "Project knowledge base not initialized. Run superpowers-memory:rebuild to generate it from the codebase."
    );
  }

  const indexPath = findIndexPath();
  if (!indexPath) {
    return hookPayload(
      "SessionStart",
      "Project knowledge base exists but no index file was found. Run superpowers-memory:rebuild to regenerate the knowledge base."
    );
  }

  const content = fs.readFileSync(indexPath, "utf8");
  return hookPayload(
    "SessionStart",
    "Project knowledge index loaded from " + relativePath(indexPath) + ":\n\n" + content
  );
}

function buildPreToolUseOutput(input) {
  let skill = "";
  try {
    skill = JSON.parse(input || "{}")?.tool_input?.skill || "";
  } catch {
    skill = "";
  }

  if (![
    "superpowers:brainstorming",
    "superpowers:writing-plans",
    "superpowers:finishing-a-development-branch",
  ].includes(skill)) {
    return {};
  }

  const kbExists = hasKnowledgeBase();
  const indexPath = findIndexPath();
  const kbReady = kbExists && indexPath;

  if (!kbReady) {
    const reason = kbExists
      ? "Project knowledge base exists but the index file is missing. You MUST run superpowers-memory:rebuild before using this workflow."
      : "Project knowledge base not initialized. You MUST run superpowers-memory:rebuild before using this workflow.";
    return { decision: "block", reason };
  }

  if (skill === "superpowers:brainstorming") {
    return hookPayload(
      "PreToolUse",
      "Load the relevant files from docs/project-knowledge before brainstorming. Use the index first, then read only the detail files needed for this task."
    );
  }

  if (skill === "superpowers:writing-plans") {
    return hookPayload(
      "PreToolUse",
      "Load the relevant files from docs/project-knowledge before writing plans. Use the index first, then read only the detail files needed for this plan."
    );
  }

  return hookPayload(
    "PreToolUse",
    "If this development branch changed project knowledge, run superpowers-memory:update before finishing. If not, you can finish without updating the KB."
  );
}

function parseNameOnly(output) {
  return output
    .split(/\r?\n/)
    .map((line) => normalizePath(line))
    .filter(Boolean);
}

function isIgnored(pathname) {
  return ignoredPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isKnowledgeRelevant(pathname) {
  if (isIgnored(pathname)) return false;
  if (
    pathname.startsWith("docs/superpowers/") ||
    pathname.startsWith("docs/design-patterns/") ||
    pathname.startsWith("src/") ||
    pathname.startsWith("internal/") ||
    pathname.startsWith("app/") ||
    pathname.startsWith("cmd/") ||
    pathname.startsWith("packages/") ||
    pathname.startsWith("services/") ||
    pathname.startsWith("domains/") ||
    pathname.startsWith("plugins/")
  ) {
    return true;
  }
  if (
    pathname === "README.md" ||
    pathname === "package.json" ||
    pathname === "go.mod" ||
    pathname === "Cargo.toml" ||
    pathname === "pyproject.toml" ||
    pathname === "Makefile"
  ) {
    return true;
  }
  if (pathname.startsWith(".github/workflows/")) {
    return true;
  }
  return false;
}

function getStopWarning() {
  if (!hasKnowledgeBase() || !findIndexPath() || !isGitRepo()) {
    return null;
  }

  const relevant = new Set();

  const kbCommit = run("git", ["log", "-1", "--format=%H", "--", "docs/project-knowledge/"]);
  const kbRevision = kbCommit.code === 0 ? kbCommit.stdout.trim() : "";
  if (kbRevision) {
    for (const pathname of parseNameOnly(run("git", ["diff", "--name-only", kbRevision + "..HEAD"]).stdout)) {
      if (isKnowledgeRelevant(pathname)) relevant.add(pathname);
    }
  }

  for (const pathname of parseNameOnly(run("git", ["diff", "--name-only"]).stdout)) {
    if (isKnowledgeRelevant(pathname)) relevant.add(pathname);
  }
  for (const pathname of parseNameOnly(run("git", ["diff", "--cached", "--name-only"]).stdout)) {
    if (isKnowledgeRelevant(pathname)) relevant.add(pathname);
  }
  for (const pathname of parseNameOnly(run("git", ["ls-files", "--others", "--exclude-standard"]).stdout)) {
    if (isKnowledgeRelevant(pathname)) relevant.add(pathname);
  }

  if (relevant.size === 0) {
    return null;
  }

  const sample = [...relevant].sort().slice(0, 3).join(" | ");
  return (
    "Reminder: this workspace has project changes outside docs/project-knowledge. " +
    "If those changes affect project knowledge, run superpowers-memory:update.\n\n" +
    "Examples: " +
    sample
  );
}

async function main() {
  if (mode === "session-start") {
    process.stdout.write(JSON.stringify(buildSessionStartOutput(), null, 2) + "\n");
    return;
  }

  if (mode === "pre-tool-use") {
    const input = await readStdin();
    process.stdout.write(JSON.stringify(buildPreToolUseOutput(input), null, 2) + "\n");
    return;
  }

  if (mode === "stop") {
    const warning = getStopWarning();
    if (!warning) {
      process.stdout.write("{}\n");
      return;
    }
    process.stdout.write(JSON.stringify({ systemMessage: warning }, null, 2) + "\n");
    return;
  }

  if (mode === "analyze") {
    process.stdout.write(
      JSON.stringify(
        {
          knowledge_base_exists: hasKnowledgeBase(),
          index_path: findIndexPath() ? relativePath(findIndexPath()) : null,
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  process.stderr.write("Unknown hook mode: " + mode + "\n");
  process.exit(1);
}

main().catch((error) => {
  process.stderr.write((error.stack || error.message) + "\n");
  process.exit(1);
});
