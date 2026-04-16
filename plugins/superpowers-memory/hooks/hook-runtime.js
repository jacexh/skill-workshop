#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const mode = process.argv[2];
const repoRoot = process.cwd();
const knowledgeDir = path.join(repoRoot, "docs", "project-knowledge");

function run(command, args) {
  const result = cp.spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 30000,
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
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

function readCoversBranch() {
  const indexPath = findIndexPath();
  if (!indexPath) return null;
  const content = fs.readFileSync(indexPath, "utf8");
  const match = content.match(/^covers_branch:\s*(.+)$/m);
  if (!match) return null;
  const value = match[1].trim();
  return value === "null" || value === "" ? null : value;
}

function getCurrentBranch() {
  const result = run("git", ["branch", "--show-current"]);
  return result.code === 0 ? result.stdout.trim() : null;
}

function getBaseBranch() {
  const result = run("git", ["symbolic-ref", "refs/remotes/origin/HEAD"]);
  if (result.code === 0) {
    return result.stdout.trim().replace("refs/remotes/origin/", "");
  }
  return "main";
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

// Hook output formats per Claude Code protocol:
// - Advisory (SessionStart/PreToolUse): hookSpecificOutput wrapper (plugin env) or flat additional_context
// - Blocking (PreToolUse only): { decision: "block", reason }
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

// Per-skill advisory messages. Adding a new skill = adding one map entry.
const skillAdvisory = {
  "superpowers:brainstorming":
    "Run superpowers-memory:load before brainstorming to understand the project context.",
  "superpowers:writing-plans":
    "Run superpowers-memory:load before writing plans to understand the project context.",
  "superpowers:executing-plans":
    "Run superpowers-memory:load before executing this plan to understand the project context. IMPORTANT: You MUST run superpowers-memory:update after execution completes to capture what was built.",
  "superpowers:subagent-driven-development":
    "Run superpowers-memory:load before dispatching subagents to understand the project context. IMPORTANT: You MUST run superpowers-memory:update after all subagents complete to capture what was built.",
  "superpowers:finishing-a-development-branch":
    "IMPORTANT: You MUST run superpowers-memory:update after finishing this branch to capture what was built.",
};

function buildPreToolUseOutput(input) {
  let skill = "";
  try {
    skill = JSON.parse(input || "{}")?.tool_input?.skill || "";
  } catch {
    skill = "";
  }

  const advisory = skillAdvisory[skill];
  if (!advisory) return {};

  const kbExists = hasKnowledgeBase();
  const indexPath = findIndexPath();
  const kbReady = kbExists && indexPath;

  if (!kbReady) {
    const reason = kbExists
      ? "Project knowledge base exists but the index file is missing. You MUST run superpowers-memory:rebuild before using this workflow."
      : "Project knowledge base not initialized. You MUST run superpowers-memory:rebuild before using this workflow.";
    return { decision: "block", reason };
  }

  if (skill === "superpowers:finishing-a-development-branch") {
    const currentBranch = getCurrentBranch();
    const baseBranch = getBaseBranch();

    // On base branch — no guard needed
    if (!currentBranch || currentBranch === baseBranch) {
      return hookPayload("PreToolUse", advisory);
    }

    const coversBranch = readCoversBranch();
    if (coversBranch !== currentBranch) {
      return {
        decision: "block",
        reason:
          "Project knowledge base has not been updated for this branch. " +
          "Run superpowers-memory:update before finishing the branch. " +
          "(covers_branch: " + (coversBranch || "null") + ", current: " + currentBranch + ")",
      };
    }
  }

  return hookPayload("PreToolUse", advisory);
}

function buildVerifyOutput() {
  if (!hasKnowledgeBase()) {
    return { ok: false, error: "Knowledge base not found" };
  }

  const sizeThresholds = {
    "architecture.md": 200,
    "conventions.md": 150,
    "decisions.md": 150,
    "tech-stack.md": 120,
    "features.md": 100,
    "glossary.md": 80,
    "index.md": 50,
  };

  const sizeWarnings = [];
  const staleRefs = [];
  const refPattern = /`([a-zA-Z0-9_.][a-zA-Z0-9_./\-]*\/[a-zA-Z0-9_./\-]*)`/g;

  for (const [filename, threshold] of Object.entries(sizeThresholds)) {
    const filePath = path.join(knowledgeDir, filename);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");

    const lines = content.split("\n").length;
    if (lines > threshold) {
      sizeWarnings.push({ file: filename, lines, threshold });
    }

    let match;
    while ((match = refPattern.exec(content)) !== null) {
      const ref = match[1];
      if (ref.includes("://") || ref.startsWith("docs/project-knowledge/") || ref.includes("<")) continue;
      // Skip GitHub owner/repo references (e.g., "jacexh/skill-workshop")
      const segments = ref.split("/");
      if (segments.length === 2 && !ref.endsWith("/") && !/\.\w+$/.test(ref)) continue;
      const target = path.join(repoRoot, ref.replace(/\/$/, ""));
      if (!fs.existsSync(target)) {
        staleRefs.push({ file: filename, ref });
      }
    }
  }

  // Git commit readiness — resolve actual git dir to support worktrees
  let committable = false;
  if (isGitRepo()) {
    const gitDir = run("git", ["rev-parse", "--git-dir"]).stdout.trim();
    if (gitDir) {
      const absGitDir = path.resolve(repoRoot, gitDir);
      committable =
        !fs.existsSync(path.join(absGitDir, "rebase-merge")) &&
        !fs.existsSync(path.join(absGitDir, "rebase-apply")) &&
        !fs.existsSync(path.join(absGitDir, "MERGE_HEAD")) &&
        run("git", ["symbolic-ref", "HEAD"]).code === 0;
    }
  }

  return {
    ok: staleRefs.length === 0 && sizeWarnings.length === 0,
    sizeWarnings,
    staleRefs,
    committable,
  };
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

  if (mode === "verify") {
    process.stdout.write(JSON.stringify(buildVerifyOutput(), null, 2) + "\n");
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
