#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const mode = process.argv[2];

// Resolve repoRoot to the worktree top-level so the hook reads the correct
// docs/project-knowledge/ when invoked from a subdir or a linked worktree.
// Falls back to process.cwd() if git is unavailable or the dir is not a repo.
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
const repoRoot = resolveRepoRoot();
const knowledgeDir = path.join(repoRoot, "docs", "project-knowledge");

// Lock file lives in .git/ so it's per-repo, never tracked, and survives across
// hook invocations within a single update/rebuild run. 60-min TTL prevents
// permanent lockout if the skill aborts before calling unlock.
function resolveGitDir() {
  const result = cp.spawnSync("git", ["rev-parse", "--git-dir"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 5000,
  });
  if (result.status === 0 && result.stdout.trim()) {
    return path.resolve(repoRoot, result.stdout.trim());
  }
  return null;
}
const gitDir = resolveGitDir();
const lockFile = gitDir ? path.join(gitDir, "superpowers-memory.lock") : null;
const LOCK_TTL_MS = 60 * 60 * 1000;

function acquireLock(skill) {
  if (!lockFile) return { ok: false, reason: "Not a git repo (no .git dir resolved)" };
  const payload = { acquired_at: new Date().toISOString(), skill: skill || "unknown" };
  fs.writeFileSync(lockFile, JSON.stringify(payload, null, 2));
  return { ok: true, lockFile, skill: payload.skill };
}

function releaseLock() {
  if (!lockFile) return { ok: true };
  if (fs.existsSync(lockFile)) {
    try { fs.unlinkSync(lockFile); } catch (e) { return { ok: false, reason: e.message }; }
  }
  return { ok: true };
}

function readLock() {
  if (!lockFile || !fs.existsSync(lockFile)) return null;
  const stat = fs.statSync(lockFile);
  if (Date.now() - stat.mtimeMs > LOCK_TTL_MS) {
    try { fs.unlinkSync(lockFile); } catch {}
    return null;
  }
  let payload = {};
  try { payload = JSON.parse(fs.readFileSync(lockFile, "utf8")); } catch {}
  return { ...payload, mtime: stat.mtime.toISOString() };
}

function isLockHeld() {
  return readLock() !== null;
}

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
  if (value === "null" || value === "") return null;
  // Parse <branch>@<sha>; legacy plain <branch> returns sha=null
  const atIdx = value.lastIndexOf("@");
  if (atIdx === -1) return { branch: value, sha: null };
  return { branch: value.slice(0, atIdx), sha: value.slice(atIdx + 1) };
}

function getCurrentBranch() {
  const result = run("git", ["branch", "--show-current"]);
  return result.code === 0 ? result.stdout.trim() : null;
}

function getCurrentSHA() {
  const result = run("git", ["rev-parse", "HEAD"]);
  return result.code === 0 ? result.stdout.trim() : null;
}

// Resolve a stored short/long SHA to its full 40-char form via git rev-parse.
// Returns null if the SHA is unknown to the repo (garbage-collected, amended, ambiguous).
function resolveStoredSHA(storedSHA) {
  if (!storedSHA) return null;
  const result = run("git", ["rev-parse", "--verify", "--quiet", storedSHA + "^{commit}"]);
  return result.code === 0 && result.stdout.trim() ? result.stdout.trim() : null;
}

function getBaseBranch() {
  const result = run("git", ["symbolic-ref", "refs/remotes/origin/HEAD"]);
  if (result.code === 0) {
    return result.stdout.trim().replace("refs/remotes/origin/", "");
  }
  return "main";
}

// Builds an architect-style rich-context block telling the model it MUST
// invoke `superpowers-memory:update` as its very next tool call.
// Used by finishing-a-development-branch when KB does not yet cover HEAD.
function buildFinishingRichContext({ currentBranch, currentSHA, covered, resolvedStoredSHA, reasonDetail }) {
  const shortCurrent = currentSHA ? currentSHA.slice(0, 12) : "(unknown)";
  const coveredRepr = covered
    ? (covered.sha ? covered.branch + "@" + covered.sha.slice(0, 12) : covered.branch + " (legacy: no SHA)")
    : "(none recorded)";

  // Compute commits + files since covered SHA; fall back gracefully when SHA unresolvable.
  let commitLines = [];
  let fileLines = [];
  if (resolvedStoredSHA) {
    const range = resolvedStoredSHA + "..HEAD";
    const logResult = run("git", ["log", "--oneline", "--no-merges", "-n", "20", range]);
    if (logResult.code === 0 && logResult.stdout.trim()) {
      commitLines = logResult.stdout.trim().split("\n");
    }
    const diffResult = run("git", ["diff", "--name-only", range]);
    if (diffResult.code === 0 && diffResult.stdout.trim()) {
      fileLines = diffResult.stdout.trim().split("\n").slice(0, 30);
    }
  }

  const sections = [
    "====== Memory: Finishing-Branch Update Required ======",
    "Your project knowledge base does not yet cover the latest commits on this branch.",
    "You MUST invoke `superpowers-memory:update` as your VERY NEXT tool call.",
    "Do not call `superpowers:finishing-a-development-branch` again until the update completes.",
    "",
    "Context:",
    "- Current branch: " + (currentBranch || "(unknown)") + "@" + shortCurrent,
    "- Knowledge base covers: " + coveredRepr,
    "- Reason: " + reasonDetail,
  ];

  if (commitLines.length > 0) {
    sections.push("");
    sections.push("Commits since last KB update (max 20):");
    for (const line of commitLines) sections.push("  " + line);
  }

  if (fileLines.length > 0) {
    sections.push("");
    sections.push("Files changed since last KB update (max 30):");
    for (const line of fileLines) sections.push("  " + line);
  }

  sections.push("");
  sections.push("Required workflow:");
  sections.push("  1. Invoke `superpowers-memory:update` (it will read the diff above and refresh docs/project-knowledge/).");
  sections.push("  2. Wait for it to complete (the KB write-lock will be released automatically).");
  sections.push("  3. Re-invoke `superpowers:finishing-a-development-branch` to continue.");
  sections.push("");
  sections.push("Escape hatch:");
  sections.push("  If you have inspected the diff above and are confident none of it changes architecture, conventions,");
  sections.push("  features, dependencies, decisions, or glossary terms (e.g., pure formatting, comment-only edits),");
  sections.push("  state that explicitly in your next message and proceed. Otherwise, run update first.");
  sections.push("======================================================");

  return sections.join("\n");
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
const SUPERSEDE_HEADING_PATTERN = /Superseded by ADR-/i;
const ADR_SUMMARY_MAX_LINES = 6;

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
        const heading = lines[adrStart];
        const body = lines.slice(adrStart + 1, i);
        const nonBlankBody = body.filter((l) => l.trim().length > 0);

        if (SUPERSEDE_HEADING_PATTERN.test(heading)) {
          // Supersede: summary must be heading-only (no body content).
          if (nonBlankBody.length > 0) {
            findings.push({
              line: adrStart + 1,
              kind: "unresolved_supersede",
              sample: heading.trim().slice(0, 120),
            });
          }
        } else if (nonBlankBody.length > ADR_SUMMARY_MAX_LINES) {
          // Active ADR: summary must fit in ≤6 non-blank lines (Decision + Trade-off + pointer).
          // Exceeding means full rationale is still inline instead of in adr/ADR-NNN-*.md.
          findings.push({
            line: adrStart + 1,
            kind: "unsplit_adr_detail",
            sample: heading.trim().slice(0, 120),
          });
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
    "Run superpowers-memory:load before executing this plan to understand the project context.",
  "superpowers:subagent-driven-development":
    "Run superpowers-memory:load before dispatching subagents to understand the project context.",
  "superpowers:finishing-a-development-branch":
    "IMPORTANT: You MUST run superpowers-memory:update for this branch before finishing it.",
};

function buildPreToolUseOutput(input) {
  let parsed = {};
  try {
    parsed = JSON.parse(input || "{}");
  } catch {
    parsed = {};
  }
  const toolName = parsed.tool_name || "";
  const toolInput = parsed.tool_input || {};

  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(toolName)) {
    return handleWritePreToolUse(toolName, toolInput);
  }

  // Skill tool: existing per-skill advisory + finishing-branch guard.
  const skill = toolInput.skill || "";
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

    const covered = readCoversBranch();
    const currentSHA = getCurrentSHA();
    const resolvedStoredSHA = covered && covered.sha ? resolveStoredSHA(covered.sha) : null;
    const branchMatches = covered && covered.branch === currentBranch;
    const shaMatches = resolvedStoredSHA && currentSHA && resolvedStoredSHA === currentSHA;

    if (!branchMatches || !shaMatches) {
      const storedRepr = covered
        ? (covered.sha ? covered.branch + "@" + covered.sha : covered.branch + " (legacy: no SHA recorded)")
        : "null";
      const currentRepr = currentSHA ? currentBranch + "@" + currentSHA : currentBranch;
      let detail;
      if (!covered) detail = "Knowledge base has no covers_branch recorded.";
      else if (!branchMatches) detail = "Knowledge base does not cover this branch.";
      else if (!covered.sha) detail = "Legacy covers_branch format (no SHA). Re-run update to record current HEAD.";
      else if (!resolvedStoredSHA) detail = "Stored SHA is unresolvable (amended or garbage-collected).";
      else detail = "New commits since last update on this branch.";
      return {
        decision: "block",
        reason:
          detail + " Run superpowers-memory:update before finishing the branch. " +
          "(covers_branch: " + storedRepr + ", current: " + currentRepr + ")",
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

function handleWritePreToolUse(toolName, toolInput) {
  const targetPath = toolInput.file_path || toolInput.notebook_path;
  if (!targetPath) return {};

  const absTarget = path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(repoRoot, targetPath);
  const rel = path.relative(knowledgeDir, absTarget);
  const insideKB = rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
  if (!insideKB) return {};

  if (isLockHeld()) return {};

  const relFromRepo = path.relative(repoRoot, absTarget).replace(/\\/g, "/");
  return {
    decision: "block",
    reason:
      "Direct edits to docs/project-knowledge/ are forbidden. " +
      "This directory is owned by superpowers-memory:update " +
      "(or superpowers-memory:rebuild for full regeneration). " +
      "To record an architectural decision: document it in your plan/spec under " +
      "docs/superpowers/plans/, then run superpowers-memory:update to materialize " +
      "the entry per content-rules.md. " +
      "(blocked tool=" + toolName + ", path=" + relFromRepo + ")",
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

  if (mode === "lock") {
    const skill = process.argv[3] || process.env.CLAUDE_SKILL_NAME || "unknown";
    process.stdout.write(JSON.stringify(acquireLock(skill), null, 2) + "\n");
    return;
  }

  if (mode === "unlock") {
    process.stdout.write(JSON.stringify(releaseLock(), null, 2) + "\n");
    return;
  }

  if (mode === "lock-status") {
    const lock = readLock();
    process.stdout.write(JSON.stringify({ held: lock !== null, lock, lockFile }, null, 2) + "\n");
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
