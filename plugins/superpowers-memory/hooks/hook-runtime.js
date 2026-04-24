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

function normalizeLine(line) {
  return line
    .toLowerCase()
    .replace(/[`*_#>-]/g, "")        // strip common markdown markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // link text only
    .replace(/https?:\/\/\S+/g, "")  // strip URLs
    .replace(/\s+/g, " ")            // collapse whitespace
    .trim();
}

function ssotCheckKnowledgeBase(files) {
  const WINDOW = 3;
  const MIN_LINE_LEN = 40;
  const windowMap = new Map();

  for (const [filename, content] of files) {
    const lines = content.split("\n")
      .map(normalizeLine)
      .filter((l) => l.length >= MIN_LINE_LEN);

    for (let i = 0; i + WINDOW <= lines.length; i++) {
      const window = lines.slice(i, i + WINDOW).join("\n");
      if (!windowMap.has(window)) {
        windowMap.set(window, new Set());
      }
      windowMap.get(window).add(filename);
    }
  }

  const violations = [];
  for (const [window, fileSet] of windowMap) {
    if (fileSet.size >= 2) {
      violations.push({
        files: [...fileSet].sort(),
        sample: window.split("\n")[0].slice(0, 120),
      });
    }
  }

  return violations;
}

const SHA_PATTERN = /\b[0-9a-f]{7,40}\b/;
const TEST_COUNT_PATTERN = /\b\d+\s+(?:unit|integration|e2e|end-to-end|smoke)?\s*tests?\b/i;
const METHOD_SIG_PATTERN = /\b\w+\s*\(\s*ctx\b/;
const SHIPPED_NARRATIVE_PATTERN = /\bshipped\s+\d{4}-\d{2}-\d{2}\b/i;
const COMMITS_RANGE_PATTERN = /\bcommits on [\w\/-]+|\b[0-9a-f]{7,40}\.\.(?:HEAD|[\w\/-]+)/i;
const GLOSSARY_WIDTH_THRESHOLD = 400;

function lintFeatures(content) {
  const findings = [];
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    if (SHA_PATTERN.test(line)) {
      findings.push({ line: i + 1, kind: "commit_sha", sample: line.trim().slice(0, 120) });
    }
    if (TEST_COUNT_PATTERN.test(line)) {
      findings.push({ line: i + 1, kind: "test_count", sample: line.trim().slice(0, 120) });
    }
    if (SHIPPED_NARRATIVE_PATTERN.test(line)) {
      findings.push({ line: i + 1, kind: "shipped_narrative", sample: line.trim().slice(0, 120) });
    }
    if (COMMITS_RANGE_PATTERN.test(line)) {
      findings.push({ line: i + 1, kind: "commits_range", sample: line.trim().slice(0, 120) });
    }
  });
  return findings;
}

function lintGlossary(content) {
  const findings = [];
  const lines = content.split("\n");

  // Detect entries > 2 lines. A glossary entry starts with **Term** — ...
  let entryStart = -1;
  let entryLineCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isEntryStart = /^\*\*[^*]+\*\*\s+—/.test(trimmed);
    const isBlank = trimmed === "";

    if (isEntryStart) {
      if (entryStart >= 0 && entryLineCount > 2) {
        findings.push({
          line: entryStart + 1,
          kind: "glossary_entry_too_long",
          sample: lines[entryStart].trim().slice(0, 120),
        });
      }
      if (line.length > GLOSSARY_WIDTH_THRESHOLD) {
        findings.push({
          line: i + 1,
          kind: "glossary_entry_too_wide",
          sample: trimmed.slice(0, 120),
        });
      }
      entryStart = i;
      entryLineCount = 1;
    } else if (entryStart >= 0 && !isBlank) {
      entryLineCount++;
    } else if (entryStart >= 0 && isBlank) {
      if (entryLineCount > 2) {
        findings.push({
          line: entryStart + 1,
          kind: "glossary_entry_too_long",
          sample: lines[entryStart].trim().slice(0, 120),
        });
      }
      entryStart = -1;
      entryLineCount = 0;
    }

    if (METHOD_SIG_PATTERN.test(line)) {
      findings.push({ line: i + 1, kind: "method_signature", sample: trimmed.slice(0, 120) });
    }
  }
  // tail
  if (entryStart >= 0 && entryLineCount > 2) {
    findings.push({
      line: entryStart + 1,
      kind: "glossary_entry_too_long",
      sample: lines[entryStart].trim().slice(0, 120),
    });
  }
  return findings;
}

const ADR_HEADING_PATTERN = /^## ADR-/;
const ALTERNATIVES_HEADING_PATTERN = /^\*\*\s*Alternatives\s+(?:considered|rejected)\s*:?\s*\*\*/i;
const SECTION_BREAK_PATTERN = /^\*\*[^*]+:\*\*|^##\s/;
const BULLET_PATTERN = /^\s*[-*]\s+\S/;

function lintDecisions(content) {
  const findings = [];
  const lines = content.split("\n");

  // Walk ADR by ADR. Each ADR starts at `## ADR-` and ends at the next `## ADR-` or EOF.
  let adrStart = -1;
  for (let i = 0; i <= lines.length; i++) {
    const atEnd = i === lines.length;
    const isAdrStart = !atEnd && ADR_HEADING_PATTERN.test(lines[i]);

    if (isAdrStart || atEnd) {
      if (adrStart >= 0) {
        // Inspect the just-closed ADR range [adrStart, i).
        let altHeadingLine = -1;
        for (let j = adrStart; j < i; j++) {
          if (ALTERNATIVES_HEADING_PATTERN.test(lines[j])) {
            altHeadingLine = j;
            break;
          }
        }
        if (altHeadingLine >= 0) {
          // Count bullets until next section break or end of ADR.
          let bullets = 0;
          for (let j = altHeadingLine + 1; j < i; j++) {
            if (SECTION_BREAK_PATTERN.test(lines[j])) break;
            if (BULLET_PATTERN.test(lines[j])) bullets++;
          }
          if (bullets < 2) {
            findings.push({
              line: adrStart + 1,
              kind: "critical_format_without_alts",
              sample: lines[adrStart].trim().slice(0, 120),
            });
          }
        }
      }
      if (isAdrStart) adrStart = i;
    }
  }

  // Also flag method signatures (applies to all non-specialized files).
  lines.forEach((line, i) => {
    if (METHOD_SIG_PATTERN.test(line)) {
      findings.push({ line: i + 1, kind: "method_signature", sample: line.trim().slice(0, 120) });
    }
  });

  return findings;
}

function contentShapeLintKnowledgeBase(files) {
  const violations = [];
  for (const [filename, content] of files) {
    let findings = [];
    if (filename === "features.md") findings = lintFeatures(content);
    else if (filename === "glossary.md") findings = lintGlossary(content);
    else if (filename === "decisions.md") findings = lintDecisions(content);
    // Other files: only method signature lint
    else {
      content.split("\n").forEach((line, i) => {
        if (METHOD_SIG_PATTERN.test(line)) {
          findings.push({ line: i + 1, kind: "method_signature", sample: line.trim().slice(0, 120) });
        }
      });
    }
    for (const f of findings) {
      violations.push({ file: filename, ...f });
    }
  }
  return violations;
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
    "IMPORTANT: You MUST run superpowers-memory:update for this branch before finishing it.",
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

    // On base branch or detached HEAD — no guard needed
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
    "decisions.md": 300,
    "tech-stack.md": 120,
    "features.md": 100,
    "glossary.md": 80,
    "index.md": 50,
  };

  const TOKEN_BUDGET = 20000;

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

      const rawSegments = ref.split("/");
      const segments = rawSegments.filter(Boolean);

      // Bare single-segment references (`application/`, `nats/`) — too generic to resolve
      if (segments.length < 2) continue;

      // GitHub owner/repo references (e.g., "jacexh/skill-workshop")
      if (segments.length === 2 && !ref.endsWith("/") && !/\.\w+$/.test(ref)) continue;

      // Filename-or-list form: every segment looks like `name.ext` (e.g., `go.mod/go.sum`)
      if (segments.every((s) => /^[\w-]+\.[\w-]+$/.test(s))) continue;

      // Module/host-prefixed paths: first segment is a dotted host (github.com, k8s.io, oras.land, go.uber.org)
      if (segments[0].includes(".")) continue;

      // Go package.Type references: last segment is `lowercase.CamelCase` (pkg/bus.MessageBus)
      if (/^[a-z]\w*\.[A-Z]\w*$/.test(segments[segments.length - 1])) continue;

      // Identifier catalog: 3+ bare identifiers with no trailing slash (WorkStarted/Activated/Archived, json/toml/yaml)
      if (!ref.endsWith("/") && segments.length >= 3 && segments.every((s) => /^[A-Za-z]\w*$/.test(s))) continue;

      const target = path.join(repoRoot, ref.replace(/\/$/, ""));
      if (!fs.existsSync(target)) {
        staleRefs.push({ file: filename, ref });
      }
    }
  }

  // SSOT check — detect near-duplicate 3-line blocks across KB files
  const fileContents = [];
  for (const filename of Object.keys(sizeThresholds)) {
    const filePath = path.join(knowledgeDir, filename);
    if (fs.existsSync(filePath)) {
      fileContents.push([filename, fs.readFileSync(filePath, "utf8")]);
    }
  }
  const ssotViolations = ssotCheckKnowledgeBase(fileContents);
  const shapeViolations = contentShapeLintKnowledgeBase(fileContents);

  const totalBytes = fileContents.reduce((sum, [, content]) => sum + Buffer.byteLength(content, "utf8"), 0);
  const estimatedTokens = Math.ceil(totalBytes / 4);
  const perFileTokens = fileContents.map(([filename, content]) => ({
    file: filename,
    tokens: Math.ceil(Buffer.byteLength(content, "utf8") / 4),
  }));
  const tokenBudgetViolation = estimatedTokens > TOKEN_BUDGET
    ? { estimatedTokens, budget: TOKEN_BUDGET, bytes: totalBytes, perFile: perFileTokens }
    : null;

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
    ok:
      staleRefs.length === 0 &&
      sizeWarnings.length === 0 &&
      ssotViolations.length === 0 &&
      shapeViolations.length === 0 &&
      !tokenBudgetViolation,
    sizeWarnings,
    staleRefs,
    ssotViolations,
    shapeViolations,
    tokenBudgetViolation,
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
