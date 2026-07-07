#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const mode = process.argv[2];

// Resolve repoRoot to the worktree top-level so the hook reads the correct
// docs/superpowers/memory/ when invoked from a subdir or a linked worktree.
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
const MEMORY_REL_DIR = "docs/superpowers/memory";
const knowledgeDir = path.join(repoRoot, ...MEMORY_REL_DIR.split("/"));

function nonKnowledgePathspecs() {
  return [".", ":!" + MEMORY_REL_DIR];
}

function isInsideDir(rootDir, absTarget) {
  const rel = path.relative(rootDir, absTarget);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function isInsideKnowledgeTree(absTarget) {
  return isInsideDir(knowledgeDir, absTarget);
}

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

function parsePorcelainPath(line) {
  return line.slice(2).trimStart();
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

// Builds an architect-style rich-context block for finishing work when the KB
// does not yet cover HEAD. Staleness is informational; ingest is a maintenance
// action and is only useful when the finishing checkpoint has durable knowledge
// to preserve.
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
    const logResult = run("git", ["log", "--oneline", "--no-merges", "-n", "20", range, "--", ...nonKnowledgePathspecs()]);
    if (logResult.code === 0 && logResult.stdout.trim()) {
      commitLines = logResult.stdout.trim().split("\n");
    }
    const diffResult = run("git", ["diff", "--name-only", range, "--", ...nonKnowledgePathspecs()]);
    if (diffResult.code === 0 && diffResult.stdout.trim()) {
      fileLines = diffResult.stdout.trim().split("\n").slice(0, 30);
    }
  }

  const sections = [
    "====== Memory: Finishing-Branch Knowledge Review ======",
    "Your project knowledge base does not yet cover the latest commits on this branch.",
    "Default behavior is no ingest; this is a maintenance checkpoint review, not a standing sync.",
    "Inspect the changed files before deciding whether KB maintenance is needed.",
    "Run `superpowers-memory:ingest` only when this checkpoint has stable durable project knowledge to preserve.",
    "Skip ingest for deployment-only, image/tag/version-only, formatting, or comment-only changes.",
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
  sections.push("Knowledge review workflow:");
  sections.push("  1. Inspect the diff for durable changes to capabilities, architecture, conventions, dependencies, decisions, glossary terms, lifecycle rules, or query answerability.");
  sections.push("  2. If this maintenance checkpoint has stable durable project knowledge changes, invoke `superpowers-memory:ingest` and wait for it to complete.");
  sections.push("  3. If the diff is operational-only, still actively changing, or otherwise low-value for the KB, state that no ingest is needed and proceed.");
  sections.push("  4. Re-invoke `superpowers:finishing-a-development-branch` only if ingest ran.");
  sections.push("");
  sections.push("Low-value examples:");
  sections.push("  Deployment-only image rollout, image tag bump, version-only upgrade with no behavior or dependency-policy change,");
  sections.push("  formatting-only edits, and comment-only edits do not require updating docs/superpowers/memory/index.md.");
  sections.push("======================================================");

  return sections.join("\n");
}

function hasKnowledgeBase() {
  return fs.existsSync(knowledgeDir);
}

const KNOWLEDGE_SLOT_PREFIXES = [
  "architecture",
  "features",
  "conventions",
  "decisions",
  "tech-stack",
  "glossary",
];

const FORBIDDEN_KB_SLOT_PATTERN = /^(conversation|conversations|chat|chats|transcript|transcripts)(-|\.md$)/i;
const NONCANONICAL_MEMORY_INFRASTRUCTURE_SLOT_PATTERN =
  /^(?:knowledge-graph|graph|entities|relationships|confidence|working-memory|episodic-memory|semantic-memory|procedural-memory|crystallization|hybrid-search|vector-search|bm25)(?:-|\.md$)/i;

function knowledgeSlotForFile(filename) {
  if (filename === "index.md") return "index";
  for (const prefix of KNOWLEDGE_SLOT_PREFIXES) {
    if (filename === `${prefix}.md`) return prefix;
    if (filename.startsWith(`${prefix}-`) && filename.endsWith(".md")) return prefix;
  }
  return null;
}

function listKnowledgeEntryFiles() {
  if (!hasKnowledgeBase()) return [];
  return fs.readdirSync(knowledgeDir)
    .filter((filename) => {
      const filePath = path.join(knowledgeDir, filename);
      return fs.statSync(filePath).isFile() && knowledgeSlotForFile(filename);
    })
    .sort();
}

function listKnowledgeMarkdownFiles() {
  if (!hasKnowledgeBase()) return [];
  return fs.readdirSync(knowledgeDir)
    .filter((filename) => {
      const filePath = path.join(knowledgeDir, filename);
      return fs.statSync(filePath).isFile() && filename.endsWith(".md");
    })
    .sort();
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
const FEATURE_DENSE_PARAGRAPH_THRESHOLD = 500;
const REQUIRED_IMPLEMENTED_FEATURE_FIELDS = [
  "Enables",
  "Actors / Entry Points",
  "Capability Boundary",
  "References",
];

function lintFeatures(content) {
  const findings = [];
  const lines = content.split("\n");
  let paragraphStart = -1;
  let paragraphText = "";
  let awaitingFeatureParagraph = false;
  let lifecycle = null;
  let currentFeature = null;

  function flushImplementedFeature() {
    if (!currentFeature) return;
    const missing = REQUIRED_IMPLEMENTED_FEATURE_FIELDS.filter((field) => !currentFeature.fields.has(field));
    if (missing.length > 0) {
      findings.push({
        line: currentFeature.line,
        kind: "feature_missing_field",
        sample: `${currentFeature.name} missing ${missing.join(", ")}`,
      });
    }
    currentFeature = null;
  }

  function flushFeatureParagraph() {
    if (paragraphStart < 0) return;
    if (paragraphText.length > FEATURE_DENSE_PARAGRAPH_THRESHOLD) {
      findings.push({
        line: paragraphStart + 1,
        kind: "feature_entry_too_dense",
        sample: paragraphText.trim().slice(0, 120),
      });
    }
    paragraphStart = -1;
    paragraphText = "";
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    const isHeading = /^#{1,6}\s+/.test(trimmed);
    const lifecycleMatch = /^##\s+(.+?)\s*$/.exec(trimmed);
    const implementedFeatureMatch = /^####\s+(.+?)\s*$/.exec(trimmed);
    const isFeatureHeading = /^#{3,4}\s+/.test(trimmed);
    const isBlank = trimmed === "";
    const structuredFieldMatch = /^\*\*([^*]+)\*\*\s+—/.exec(trimmed);
    const isStructuredField = structuredFieldMatch !== null;

    if (lifecycleMatch) {
      flushImplementedFeature();
      lifecycle = lifecycleMatch[1];
    } else if (isHeading && !implementedFeatureMatch) {
      flushImplementedFeature();
    }

    if (implementedFeatureMatch) {
      flushImplementedFeature();
      if (lifecycle === "Implemented") {
        currentFeature = {
          line: i + 1,
          name: implementedFeatureMatch[1],
          fields: new Set(),
        };
      }
    } else if (currentFeature && structuredFieldMatch) {
      currentFeature.fields.add(structuredFieldMatch[1].trim());
    }

    if (isHeading || isBlank || isStructuredField) {
      flushFeatureParagraph();
      if (isFeatureHeading) awaitingFeatureParagraph = true;
      else if (isHeading || isStructuredField) awaitingFeatureParagraph = false;
    } else if (paragraphStart >= 0) {
      paragraphText += ` ${trimmed}`;
    } else if (awaitingFeatureParagraph) {
      paragraphStart = i;
      paragraphText = trimmed;
      awaitingFeatureParagraph = false;
    }

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
  flushImplementedFeature();
  flushFeatureParagraph();
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
const LEGACY_ADR_INLINE_PATTERN = /^\s*(?:\*\*)?(Date|Status|Context|Reason|Alternatives|Alternatives Rejected|Consequences)(?:\*\*)?\s*:/i;
const ADR_DETAIL_LINK_PATTERN = /\]\((adr\/ADR-[^)]+\.md)\)/g;
const READINESS_RISK_PATTERN = /\b(STATUS:\s*Scaffolding only|return(?:s)?\s+.*not implemented|throw new Error\([^)]*not implemented|errors\.New\([^)]*not implemented|TODO[^\n]*not implemented|not-yet-wired[^\n]*error)\b/i;
const READINESS_CALIBRATION_PATTERN = /\b(scaffold|partial|not implemented|not-yet-wired|requires|deferred|experimental|in progress|future)\b/i;

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

        if (body.some((line) => LEGACY_ADR_INLINE_PATTERN.test(line.trim()))) {
          findings.push({
            line: adrStart + 1,
            kind: "legacy_adr_inline",
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
    const slot = knowledgeSlotForFile(filename);
    let findings = [];
    if (slot === "features") findings = lintFeatures(content);
    else if (slot === "glossary") findings = lintGlossary(content);
    else if (slot === "decisions") findings = lintDecisions(content);
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

function lintDecisionDetailLinks(filename, content) {
  const findings = [];
  let match;
  while ((match = ADR_DETAIL_LINK_PATTERN.exec(content)) !== null) {
    const ref = match[1];
    if (!fs.existsSync(path.join(knowledgeDir, ref))) {
      findings.push({
        file: filename,
        line: content.slice(0, match.index).split("\n").length,
        kind: "adr_detail_missing",
        sample: ref,
      });
    }
  }
  return findings;
}

function extractBacktickRefs(text) {
  const refs = [];
  const refPattern = /`([^`]+)`/g;
  let match;
  while ((match = refPattern.exec(text)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

function lintReadinessWarnings(files) {
  const warnings = [];

  for (const [filename, content] of files) {
    if (knowledgeSlotForFile(filename) !== "features") continue;

    const lines = content.split("\n");
    let lifecycle = null;
    let current = null;
    const capabilities = [];

    function flushCapability() {
      if (current) capabilities.push(current);
      current = null;
    }

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      const lifecycleMatch = /^##\s+(.+?)\s*$/.exec(trimmed);
      const capabilityMatch = /^####\s+(.+?)\s*$/.exec(trimmed);
      const fieldMatch = /^\*\*([^*]+)\*\*\s+—\s*(.*)$/.exec(trimmed);

      if (lifecycleMatch) {
        flushCapability();
        lifecycle = lifecycleMatch[1];
        return;
      }

      if (capabilityMatch) {
        flushCapability();
        if (lifecycle === "Implemented") {
          current = {
            line: i + 1,
            name: capabilityMatch[1],
            fields: {},
            text: "",
          };
        }
        return;
      }

      if (current) {
        current.text += "\n" + line;
        if (fieldMatch) current.fields[fieldMatch[1].trim()] = fieldMatch[2].trim();
      }
    });
    flushCapability();

    for (const cap of capabilities) {
      const capabilityBoundary = cap.fields["Capability Boundary"] || "";
      if (READINESS_CALIBRATION_PATTERN.test(capabilityBoundary)) continue;

      const refs = extractBacktickRefs(cap.text);
      for (const ref of refs) {
        if (ref.includes("://") || ref.startsWith("docs/")) continue;
        if (/\.md$/i.test(ref)) continue;
        const target = path.join(repoRoot, ref.replace(/\/$/, ""));
        if (!fs.existsSync(target) || !fs.statSync(target).isFile()) continue;
        const targetContent = fs.readFileSync(target, "utf8");
        if (READINESS_RISK_PATTERN.test(targetContent)) {
          warnings.push({
            file: filename,
            line: cap.line,
            kind: "capability_readiness_uncalibrated",
            sample: `${cap.name} references ${ref} with scaffold/not-implemented signals but no Capability Boundary calibration`,
          });
          break;
        }
      }
    }
  }

  return warnings;
}

function listChildDirs(relPath) {
  const abs = path.join(repoRoot, relPath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return [];
  return fs.readdirSync(abs)
    .map((name) => path.join(relPath, name).replace(/\\/g, "/"))
    .filter((child) => {
      try {
        return fs.statSync(path.join(repoRoot, child)).isDirectory();
      } catch {
        return false;
      }
    });
}

function countFilesUnder(relPath, predicate, limit = 200) {
  const abs = path.join(repoRoot, relPath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return 0;
  let count = 0;
  const stack = [abs];
  while (stack.length > 0 && count < limit) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (![".git", "node_modules", "vendor", "dist", "build"].includes(entry.name)) {
          stack.push(full);
        }
      } else if (predicate(full)) {
        count++;
        if (count >= limit) break;
      }
    }
  }
  return count;
}

function inspectRepoArchitectureSignals() {
  const serviceDirs = [
    ...listChildDirs("cmd"),
    ...listChildDirs("apps"),
    ...listChildDirs("services"),
  ];
  const packageDirs = listChildDirs("packages");
  const protoFiles =
    countFilesUnder("api", (file) => file.endsWith(".proto")) +
    countFilesUnder("proto", (file) => file.endsWith(".proto"));

  const internalContexts = listChildDirs("internal");
  const dddContextCount = internalContexts.filter((contextPath) => {
    const abs = path.join(repoRoot, contextPath);
    return ["domain", "application", "infrastructure", "adapters", "readmodels", "projections"]
      .some((layer) => fs.existsSync(path.join(abs, layer)));
  }).length;

  const adrCount = countFilesUnder(path.join(MEMORY_REL_DIR, "adr"), (file) => file.endsWith(".md"), 100);
  const manifestCount =
    countFilesUnder("deploy", (file) => /\.(ya?ml|json|toml)$/.test(file), 100) +
    countFilesUnder("k8s", (file) => /\.(ya?ml|json|toml)$/.test(file), 100) +
    countFilesUnder("helm", (file) => /\.(ya?ml|json|toml)$/.test(file), 100);

  const deployableCount = serviceDirs.length + packageDirs.length;
  const isComplex =
    deployableCount >= 3 ||
    protoFiles >= 3 ||
    dddContextCount >= 3 ||
    (deployableCount >= 2 && (protoFiles > 0 || manifestCount > 0 || adrCount >= 3)) ||
    (dddContextCount > 0 && adrCount >= 5);

  return {
    isComplex,
    deployableCount,
    serviceDirs,
    packageDirs,
    protoFiles,
    dddContextCount,
    adrCount,
    manifestCount,
  };
}

function architectureCardChunks(content) {
  return content.split(/^####\s+/m).slice(1);
}

function countArchitectureCards(content) {
  const chunks = architectureCardChunks(content);
  return chunks.filter((chunk) =>
    /\*\*Responsibility:\*\*/.test(chunk) &&
    /\*\*(?:Internal layers \/ components|Internal components|Key abstractions):\*\*/.test(chunk) &&
    /\*\*Interactions:\*\*/.test(chunk) &&
    /\*\*Source refs:\*\*/.test(chunk)
  ).length;
}

function architectureCardInternalField(chunk) {
  const match = chunk.match(/\*\*(?:Internal layers \/ components|Internal components|Key abstractions):\*\*\s*([^\n]+)/);
  return match ? match[1].trim() : "";
}

function architectureCardIsShallow(chunk) {
  const field = architectureCardInternalField(chunk);
  if (!field) return false;

  const genericLayer = /^(?:domain|application|infrastructure|adapter|adapters|interface|interfaces|api|handler|handlers|worker|workers|repository|repositories|readmodel|read model|readmodels|read models|projection|projections|service|services|controller|controllers|usecase|use case|usecases|use cases|port|ports|facade|facades|cmd|internal|package|packages|module|modules|layer|layers)$/i;
  const codeRefs = (field.match(/`([^`]+)`/g) || [])
    .map((ref) => ref.replace(/`/g, "").trim())
    .filter((ref) => ref && !genericLayer.test(ref) && !/^(?:cmd|internal|api|apps|services|packages)\//.test(ref));

  if (codeRefs.length >= 2) return false;

  const namedArchitecturePattern = /\b(?:plane|subsystem|workflow|processor|policy|gate|mailbox|projection|reducer|coordinator|sequencer|runtime|resolver|publisher|subscriber|scheduler|poller|syncer|state machine|read model|materializer|dispatcher|router|bridge|registry|catalog|adapter strategy|boundary)\b/i;
  const cleaned = field
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[.;]+$/g, "")
    .trim();
  if (namedArchitecturePattern.test(cleaned)) return false;

  const parts = cleaned
    .split(/[,;/]|(?:\s+\+\s+)|(?:\s+and\s+)|(?:\s+&\s+)/i)
    .map((part) => part.trim().replace(/^[`"']|[`"']$/g, ""))
    .filter(Boolean);

  return parts.length > 0 && parts.every((part) => genericLayer.test(part));
}

function countShallowArchitectureCards(content) {
  return architectureCardChunks(content).filter((chunk) =>
    /\*\*Responsibility:\*\*/.test(chunk) &&
    /\*\*(?:Internal layers \/ components|Internal components|Key abstractions):\*\*/.test(chunk) &&
    architectureCardIsShallow(chunk)
  ).length;
}

function countSequenceDiagramsMissingSourceRefs(content) {
  const sequenceMatches = [...content.matchAll(/\bsequenceDiagram\b/g)];
  if (sequenceMatches.length === 0) return 0;

  const headingPositions = [...content.matchAll(/^#{2,4}\s+/gm)].map((match) => match.index);
  let missing = 0;

  for (const match of sequenceMatches) {
    const start = headingPositions.filter((position) => position <= match.index).pop() ?? 0;
    const end = headingPositions.find((position) => position > match.index) ?? content.length;
    const section = content.slice(start, end);
    if (!/\bSource refs?:/i.test(section)) missing += 1;
  }

  return missing;
}

function isArchitectureDetailShard(filename) {
  return /^architecture-.+\.md$/.test(filename) &&
    filename !== "architecture-contexts.md" &&
    filename !== "architecture-flows.md";
}

function isScenarioArchitectureShard(filename, content) {
  if (!isArchitectureDetailShard(filename)) return false;
  return /\bsequenceDiagram\b/i.test(content) ||
    /\b(Participants|Sequence Phases|Authority Boundaries|Ordering \/ Idempotency \/ Failure Rules)\b/i.test(content);
}

function isModuleArchitectureShard(filename, content) {
  if (!isArchitectureDetailShard(filename) || isScenarioArchitectureShard(filename, content)) return false;
  return /\b(Module Identity|Internal Architecture Model|Responsibility|Path \/ entry|Scenario refs?)\b/i.test(content);
}

function hasModuleScenarioRefs(content) {
  return /^.*\bScenario refs?:.*architecture-[a-z0-9][a-z0-9-]*\.md.*$/im.test(content);
}

function hasScenarioModuleRefs(content) {
  return /^.*\bModule refs?:.*architecture-[a-z0-9][a-z0-9-]*\.md.*$/im.test(content);
}

function missingScenarioArchitectureFields(content) {
  const missing = [];
  if (!/\bParticipants\b/i.test(content)) missing.push("Participants");
  if (!/\b(?:Sequence Phases|Phases)\b/i.test(content)) missing.push("Sequence Phases");
  if (!/\bAuthority Boundaries\b/i.test(content)) missing.push("Authority Boundaries");
  if (!/\b(?:Ordering \/ Idempotency \/ Failure Rules|Ordering|Idempotency|Failure Rules|Failure)\b/i.test(content)) {
    missing.push("Ordering / Idempotency / Failure Rules");
  }
  return missing;
}

function lintArchitectureCoverage(files) {
  const signals = inspectRepoArchitectureSignals();
  if (!signals.isComplex) return [];

  const architectureFiles = files.filter(([filename]) => knowledgeSlotForFile(filename) === "architecture");
  const findings = [];

  if (architectureFiles.length === 0) {
    findings.push({
      kind: "architecture_owner_missing",
      sample: "Complex repo signals found but no architecture owner file exists",
      signals,
      suggestedOwner: "docs/superpowers/memory/architecture.md",
    });
    return findings;
  }

  const legacyViewShardFiles = architectureFiles
    .map(([filename]) => filename)
    .filter((filename) => filename === "architecture-contexts.md" || filename === "architecture-flows.md");
  const moduleShardFiles = architectureFiles.filter(([filename, content]) => isModuleArchitectureShard(filename, content));
  const scenarioShardFiles = architectureFiles.filter(([filename, content]) => isScenarioArchitectureShard(filename, content));

  const architectureText = architectureFiles.map(([, content]) => content).join("\n\n");
  const sequenceCount = (architectureText.match(/\bsequenceDiagram\b/g) || []).length;
  const stateDiagramCount = (architectureText.match(/\bstateDiagram-v2\b/g) || []).length;
  const serviceCardCount = architectureFiles.reduce((sum, [, content]) => sum + countArchitectureCards(content), 0);
  const shallowServiceCardCount = architectureFiles.reduce((sum, [, content]) => sum + countShallowArchitectureCards(content), 0);
  const scenarioWithoutRefsCount = architectureFiles.reduce((sum, [, content]) => sum + countSequenceDiagramsMissingSourceRefs(content), 0);
  const sourceRefCount = (architectureText.match(/\bSource refs?:/gi) || []).length;
  const hasTopology =
    /\b(System Topology|Context Map|System Context)\b/i.test(architectureText) &&
    (/\bgraph\s+(?:TD|LR|BT|RL)\b/.test(architectureText) || /\bCall direction rules:\b/i.test(architectureText));

  if (!hasTopology) {
    findings.push({
      kind: "architecture_topology_missing",
      sample: "Complex repo architecture should expose a system topology/context map and call/event direction rules",
      signals,
      suggestedOwner: "docs/superpowers/memory/architecture.md",
    });
  }

  if (legacyViewShardFiles.length > 0) {
    findings.push({
      kind: "architecture_view_shards_legacy",
      sample: `Found legacy architecture view shard(s): ${legacyViewShardFiles.join(", ")}. Prefer module-first shards such as architecture-orchestrator.md plus named scenario shards such as architecture-runtime-message-chain.md; do not split architecture detail by diagram/view type.`,
      signals,
      suggestedOwner: "docs/superpowers/memory/architecture.md",
    });
  }

  const expectedCards = Math.min(3, Math.max(signals.deployableCount, signals.dddContextCount));
  if (expectedCards > 0 && serviceCardCount < expectedCards) {
    findings.push({
      kind: "architecture_service_cards_sparse",
      sample: `Found ${serviceCardCount} service architecture card(s); expected at least ${expectedCards} high-value card(s) for complex repo signals`,
      signals,
      suggestedOwner: "docs/superpowers/memory/architecture-<module>.md",
    });
  }

  if (expectedCards > 0 && moduleShardFiles.length === 0) {
    findings.push({
      kind: "architecture_module_shards_missing",
      sample: "Complex repo architecture has no dedicated module shard; create architecture-<module>.md files for high-value services/bounded contexts that need direct query answers",
      signals,
      suggestedOwner: "docs/superpowers/memory/architecture-<module>.md",
    });
  }

  if (serviceCardCount >= expectedCards && shallowServiceCardCount > 0) {
    findings.push({
      kind: "architecture_service_cards_shallow",
      sample: `Found ${shallowServiceCardCount} service architecture card(s) whose internal components mostly name generic code layers; add named planes, subsystems, workflows, processors, projections, or other stable architecture components when source docs support them`,
      signals,
      suggestedOwner: "docs/superpowers/memory/architecture-<module>.md",
    });
  }

  const expectedSequences = signals.deployableCount >= 3 || signals.protoFiles >= 3 ? 4 : 2;
  if (sequenceCount < expectedSequences) {
    findings.push({
      kind: "architecture_scenarios_sparse",
      sample: `Found ${sequenceCount} sequenceDiagram(s); expected at least ${expectedSequences} high-value cross-service scenario(s) for complex repo signals`,
      signals,
      suggestedOwner: "docs/superpowers/memory/architecture-<scenario>.md",
    });
  }

  if (expectedSequences > 0 && scenarioShardFiles.length === 0) {
    findings.push({
      kind: "architecture_scenario_shards_missing",
      sample: "Complex repo architecture has no dedicated named scenario shard; create architecture-<scenario>.md files for high-value cross-service flows",
      signals,
      suggestedOwner: "docs/superpowers/memory/architecture-<scenario>.md",
    });
  }

  if (scenarioWithoutRefsCount > 0) {
    findings.push({
      kind: "architecture_scenario_refs_missing",
      sample: `Found ${scenarioWithoutRefsCount} sequenceDiagram scenario(s) without local Source refs; each high-value flow should cite its ADR/spec/doc/source basis`,
      signals,
      suggestedOwner: "docs/superpowers/memory/architecture-<scenario>.md",
    });
  }

  if (moduleShardFiles.length > 0 && scenarioShardFiles.length > 0) {
    const modulesMissingScenarioRefs = moduleShardFiles
      .filter(([, content]) => !hasModuleScenarioRefs(content))
      .map(([filename]) => filename);
    if (modulesMissingScenarioRefs.length > 0) {
      findings.push({
        kind: "architecture_module_scenario_refs_missing",
        sample: `Module shard(s) missing Scenario refs back to named scenario shards: ${modulesMissingScenarioRefs.join(", ")}`,
        signals,
        suggestedOwner: "docs/superpowers/memory/architecture-<module>.md",
      });
    }

    const scenariosMissingModuleRefs = scenarioShardFiles
      .filter(([, content]) => !hasScenarioModuleRefs(content))
      .map(([filename]) => filename);
    if (scenariosMissingModuleRefs.length > 0) {
      findings.push({
        kind: "architecture_scenario_module_refs_missing",
        sample: `Scenario shard(s) missing Module refs back to participating module shards: ${scenariosMissingModuleRefs.join(", ")}`,
        signals,
        suggestedOwner: "docs/superpowers/memory/architecture-<scenario>.md",
      });
    }
  }

  for (const [filename, content] of scenarioShardFiles) {
    const missing = missingScenarioArchitectureFields(content);
    if (missing.length > 0) {
      findings.push({
        kind: "architecture_scenario_fields_missing",
        sample: `${filename} missing scenario field(s): ${missing.join(", ")}`,
        signals,
        suggestedOwner: `docs/superpowers/memory/${filename}`,
      });
    }
  }

  if (signals.dddContextCount > 0 && stateDiagramCount === 0) {
    findings.push({
      kind: "architecture_lifecycle_missing",
      sample: "DDD/context signals found but no cross-context lifecycle/FSM coverage is present",
      signals,
      suggestedOwner: "docs/superpowers/memory/architecture-<scenario>.md",
    });
  }

  if (sourceRefCount === 0) {
    findings.push({
      kind: "architecture_source_refs_missing",
      sample: "Architecture entries should include source refs for service cards and scenario diagrams",
      signals,
      suggestedOwner: "docs/superpowers/memory/architecture.md",
    });
  }

  return findings;
}

function countCapabilitiesInFeatureGroup(content, groupName) {
  const lines = content.split("\n");
  let inGroup = false;
  let count = 0;
  for (const line of lines) {
    const groupMatch = /^###\s+(.+?)\s*$/.exec(line.trim());
    if (groupMatch) {
      inGroup = groupMatch[1] === groupName;
      continue;
    }
    if (/^##\s+/.test(line.trim())) {
      inGroup = false;
      continue;
    }
    if (inGroup && /^####\s+/.test(line.trim())) count += 1;
  }
  return count;
}

function lintFeatureQueryCoverage(files) {
  const featureFiles = files.filter(([filename]) => knowledgeSlotForFile(filename) === "features");
  if (featureFiles.length === 0) return [];

  const findings = [];
  const text = featureFiles.map(([, content]) => content).join("\n\n");
  if (!/\n##\s+Implemented\b/i.test(text)) return findings;

  const productCount = featureFiles.reduce((sum, [, content]) => sum + countCapabilitiesInFeatureGroup(content, "Product Capabilities"), 0);
  const workflowCount = featureFiles.reduce((sum, [, content]) => sum + countCapabilitiesInFeatureGroup(content, "User / Operator Workflows"), 0);
  const platformCount = featureFiles.reduce((sum, [, content]) => sum + countCapabilitiesInFeatureGroup(content, "Platform Capabilities"), 0);
  const operationsCount = featureFiles.reduce((sum, [, content]) => sum + countCapabilitiesInFeatureGroup(content, "Operations"), 0);

  if (productCount === 0 && (platformCount > 0 || operationsCount > 0)) {
    findings.push({
      kind: "features_product_coverage_missing",
      sample: "Implemented feature map has platform/operations entries but no Product Capabilities; query may not answer what users can do now",
      suggestedOwner: "docs/superpowers/memory/features.md",
    });
  }

  if (workflowCount === 0 && (platformCount > 0 || operationsCount > 0 || productCount >= 3)) {
    findings.push({
      kind: "features_workflow_coverage_missing",
      sample: "Implemented feature map has enough capability surface to need at least one User / Operator Workflows entry for end-to-end query answers",
      suggestedOwner: "docs/superpowers/memory/features.md",
    });
  }

  return findings;
}

function parseDecisionAdrBlocks(content) {
  const lines = content.split("\n");
  const blocks = [];
  let current = null;

  function flush(endLine) {
    if (!current) return;
    current.endLine = endLine;
    current.text = lines.slice(current.startIndex, endLine).join("\n");
    blocks.push(current);
    current = null;
  }

  lines.forEach((line, index) => {
    if (ADR_HEADING_PATTERN.test(line)) {
      flush(index);
      current = {
        heading: line.trim(),
        line: index + 1,
        startIndex: index,
      };
    }
  });
  flush(lines.length);
  return blocks;
}

function lintDecisionQueryCoverage(files) {
  const decisionFiles = files.filter(([filename]) => knowledgeSlotForFile(filename) === "decisions");
  const findings = [];
  const rootDecisions = new Map(files).get("decisions.md");
  const hasDecisionShard = decisionFiles.some(([filename]) => filename !== "decisions.md");

  for (const [filename, content] of decisionFiles) {
    const activeBlocks = parseDecisionAdrBlocks(content)
      .filter((block) => !SUPERSEDE_HEADING_PATTERN.test(block.heading));
    const missingDetail = activeBlocks.filter((block) => !/\]\(adr\/ADR-[^)]+\.md\)/.test(block.text));
    const missingTradeoff = activeBlocks.filter((block) => !/^\*\*Trade-off:\*\*/m.test(block.text));
    const missingAffectedRouting = activeBlocks.length >= 2
      ? activeBlocks.filter((block) => !/^\*\*Affects:\*\*/m.test(block.text))
      : [];

    if (missingDetail.length > 0) {
      findings.push({
        kind: "decisions_detail_links_missing",
        sample: `${filename} ADR summary block(s) missing on-demand adr/ detail links: ${missingDetail.map((block) => block.heading.replace(/^##\s+/, "")).join(", ")}`,
        suggestedOwner: `docs/superpowers/memory/${filename}`,
      });
    }

    if (missingTradeoff.length > 0) {
      findings.push({
        kind: "decisions_tradeoffs_missing",
        sample: `${filename} ADR summary block(s) missing explicit Trade-off lines: ${missingTradeoff.map((block) => block.heading.replace(/^##\s+/, "")).join(", ")}`,
        suggestedOwner: `docs/superpowers/memory/${filename}`,
      });
    }

    if (missingAffectedRouting.length > 0) {
      findings.push({
        kind: "decisions_affected_routing_missing",
        sample: `${filename} ADR summary block(s) missing affected owner/module routing for topic-scope refresh: ${missingAffectedRouting.map((block) => block.heading.replace(/^##\s+/, "")).join(", ")}`,
        suggestedOwner: `docs/superpowers/memory/${filename}`,
      });
    }
  }

  if (rootDecisions && !hasDecisionShard) {
    const rootActiveBlocks = parseDecisionAdrBlocks(rootDecisions)
      .filter((block) => !SUPERSEDE_HEADING_PATTERN.test(block.heading));
    if (rootActiveBlocks.length >= 8) {
      findings.push({
        kind: "decisions_family_shards_recommended",
        sample: `decisions.md has ${rootActiveBlocks.length} active ADR summaries and no decisions-<domain>.md shard routes; rebuild decision families so query can load the smallest decision context`,
        suggestedOwner: "docs/superpowers/memory/decisions.md and docs/superpowers/memory/decisions-<domain>.md",
      });
    }
  }

  return findings;
}

function lintShardRoutingCoverage(files) {
  const findings = [];
  const byName = new Map(files);
  const indexContent = byName.get("index.md") || "";

  for (const [filename] of files) {
    const slot = knowledgeSlotForFile(filename);
    if (!slot || slot === "index") continue;
    if (filename === `${slot}.md`) continue;

    const ownerContent = byName.get(`${slot}.md`) || "";
    const routedByIndex = indexContent.includes(filename);
    const routedByOwner = ownerContent.includes(filename);
    if (!routedByIndex && !routedByOwner) {
      findings.push({
        kind: "knowledge_shards_unrouted",
        sample: `${filename} is a recognized ${slot} shard but is not linked from index.md or ${slot}.md; incremental ingest must keep shard routes discoverable`,
        suggestedOwner: `docs/superpowers/memory/index.md and docs/superpowers/memory/${slot}.md`,
      });
    }
  }

  return findings;
}

function lintReferenceQueryCoverage(files) {
  const findings = [];
  const byName = new Map(files);

  const conventions = [...files].filter(([filename]) => knowledgeSlotForFile(filename) === "conventions");
  for (const [filename, content] of conventions) {
    const unreferencedConcern = content.split("\n")
      .find((line) => /^\*\*[^*]+:\*\*/.test(line.trim()) && !line.includes("→") && !/`[^`]+`/.test(line));
    if (unreferencedConcern) {
      findings.push({
        kind: "conventions_source_refs_missing",
        sample: `${filename} cross-cutting concern lacks canonical source reference: ${unreferencedConcern.trim().slice(0, 120)}`,
        suggestedOwner: `docs/superpowers/memory/${filename}`,
      });
    }
  }

  const techStack = byName.get("tech-stack.md");
  if (techStack) {
    const meaningfulRows = techStack.split("\n")
      .filter((line) => /^-\s+\S/.test(line.trim()) || (/^\|/.test(line.trim()) && !/^\|\s*-/.test(line.trim()) && !/Technology|Package|Purpose|Role|Version/i.test(line)));
    const hasRationale = /\b(Why Chosen|Why chosen|selection rationale|rationale|chosen because)\b/i.test(techStack);
    if (meaningfulRows.length >= 3 && !hasRationale) {
      findings.push({
        kind: "tech_stack_rationale_missing",
        sample: "tech-stack.md lists multiple technologies without explicit selection rationale; query can name dependencies but not why they matter",
        suggestedOwner: "docs/superpowers/memory/tech-stack.md",
      });
    }
  }

  const glossary = byName.get("glossary.md");
  if (glossary) {
    const unreferencedTerms = glossary.split("\n")
      .filter((line) => /^\*\*[^*]+\*\*\s+—/.test(line.trim()))
      .filter((line) => !line.includes("→") && !/`[^`]+`/.test(line));
    if (unreferencedTerms.length > 0) {
      findings.push({
        kind: "glossary_owner_refs_missing",
        sample: `glossary.md term(s) lack owner/source refs: ${unreferencedTerms.slice(0, 3).map((line) => line.trim().slice(0, 60)).join("; ")}`,
        suggestedOwner: "docs/superpowers/memory/glossary.md",
      });
    }

    const hasGlossaryShard = files.some(([filename]) =>
      knowledgeSlotForFile(filename) === "glossary" && filename !== "glossary.md"
    );
    const termCount = glossary.split("\n")
      .filter((line) => /^\*\*[^*]+\*\*\s+—/.test(line.trim()))
      .length;
    if (termCount >= 60 && !hasGlossaryShard) {
      findings.push({
        kind: "glossary_alias_router_recommended",
        sample: `glossary.md has ${termCount} terms and no glossary-<domain>.md shard routes; rebuild it as an alias router plus domain term shards`,
        suggestedOwner: "docs/superpowers/memory/glossary.md and docs/superpowers/memory/glossary-<domain>.md",
      });
    }
  }

  return findings;
}

function lintQueryCoverage(files) {
  return [
    ...lintShardRoutingCoverage(files),
    ...lintArchitectureCoverage(files),
    ...lintFeatureQueryCoverage(files),
    ...lintDecisionQueryCoverage(files),
    ...lintReferenceQueryCoverage(files),
  ];
}

function buildQualityGate({ ok, staleRefs, ssotViolations, shapeViolations, readinessWarnings, coverageGaps, splitCandidates, sizeWarnings }) {
  const blockingFindings =
    staleRefs.length +
    ssotViolations.length +
    shapeViolations.length +
    readinessWarnings.length;
  const advisoryFindings =
    coverageGaps.length +
    splitCandidates.length +
    sizeWarnings.length;

  return {
    ok,
    blockingFindings,
    advisoryFindings,
    coverageAdvisoryOnly: true,
  };
}

function buildKnowledgeStatus() {
  const currentBranch = getCurrentBranch();
  const currentSHA = getCurrentSHA();
  const covered = readCoversBranch();
  const resolvedStoredSHA = covered && covered.sha ? resolveStoredSHA(covered.sha) : null;
  const branchMatches = covered && covered.branch === currentBranch;
  const shaMatches = resolvedStoredSHA && currentSHA && resolvedStoredSHA === currentSHA;

  const status = {
    knowledgeBaseExists: hasKnowledgeBase(),
    indexPath: findIndexPath() ? relativePath(findIndexPath()) : null,
    currentBranch,
    currentSHA: currentSHA ? currentSHA.slice(0, 12) : null,
    coversBranch: covered ? { branch: covered.branch, sha: covered.sha } : null,
    stale: false,
    reason: "Knowledge base coverage matches HEAD.",
    nonKbCommitCount: 0,
    changedFiles: [],
    uncommittedNonKbFiles: [],
    uncommittedKbFiles: [],
  };

  const nonKbStatus = run("git", ["status", "--porcelain", "--", ...nonKnowledgePathspecs()]);
  if (nonKbStatus.code === 0 && nonKbStatus.stdout.trim()) {
    status.uncommittedNonKbFiles = nonKbStatus.stdout.trim().split("\n").map(parsePorcelainPath);
  }
  const kbStatus = run("git", ["status", "--porcelain", "--", MEMORY_REL_DIR]);
  if (kbStatus.code === 0 && kbStatus.stdout.trim()) {
    status.uncommittedKbFiles = kbStatus.stdout.trim().split("\n").map(parsePorcelainPath);
  }

  if (!status.knowledgeBaseExists || !status.indexPath) {
    status.stale = true;
    status.reason = "Knowledge base or index is missing.";
    return status;
  }
  if (!covered) {
    status.stale = true;
    status.reason = "Knowledge base has no covers_branch recorded.";
    return status;
  }
  if (!branchMatches) {
    status.stale = true;
    status.reason = "Knowledge base covers a different branch.";
    return status;
  }
  if (!covered.sha) {
    status.stale = true;
    status.reason = "Knowledge base uses legacy covers_branch format without SHA.";
    return status;
  }
  if (!resolvedStoredSHA) {
    status.stale = true;
    status.reason = "Stored covers_branch SHA is unresolvable.";
    return status;
  }
  if (shaMatches) {
    if (status.uncommittedNonKbFiles.length > 0) {
      status.stale = true;
      status.reason = "Uncommitted non-KB files exist after covers_branch.";
    }
    return status;
  }

  const range = resolvedStoredSHA + "..HEAD";
  const logResult = run("git", ["log", "--oneline", "--no-merges", range, "--", ...nonKnowledgePathspecs()]);
  const diffResult = run("git", ["diff", "--name-only", range, "--", ...nonKnowledgePathspecs()]);
  const commitLines = logResult.code === 0 && logResult.stdout.trim()
    ? logResult.stdout.trim().split("\n")
    : [];
  status.nonKbCommitCount = commitLines.length;
  status.changedFiles = diffResult.code === 0 && diffResult.stdout.trim()
    ? diffResult.stdout.trim().split("\n")
    : [];
  status.stale = status.nonKbCommitCount > 0 || status.changedFiles.length > 0;
  status.reason = status.stale
    ? "New non-KB commits exist after covers_branch."
    : "Only KB changes exist after covers_branch.";
  return status;
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
      "Project knowledge base not initialized. Run superpowers-memory:ingest bootstrap to create it."
    );
  }

  const indexPath = findIndexPath();
  if (!indexPath) {
    return hookPayload(
      "SessionStart",
      "Project knowledge base exists but no index file was found. Run superpowers-memory:ingest full-refresh to regenerate the knowledge base."
    );
  }

  return hookPayload(
    "SessionStart",
    "Project KB available at docs/superpowers/memory/.\n" +
      "Index: " + relativePath(indexPath) + " (read on demand by superpowers-memory:query).\n" +
      "Use superpowers-memory:query to query the project knowledge base when project knowledge would help."
  );
}

// Per-skill advisory messages. Adding a new skill = adding one map entry.
const skillAdvisory = {
  "superpowers:brainstorming":
    "Run superpowers-memory:query before brainstorming to understand the project context.",
  "superpowers:writing-plans":
    "Run superpowers-memory:query before writing plans to understand the project context.",
  "superpowers:executing-plans":
    "Run superpowers-memory:query before executing this plan to understand the project context.",
  "superpowers:subagent-driven-development":
    "Run superpowers-memory:query before dispatching subagents to understand the project context.",
  // Sentinel: actual content is built by buildFinishingRichContext() inside
  // buildPreToolUseOutput when KB does not cover HEAD. When KB does cover,
  // this string is used as the soft reminder.
  "superpowers:finishing-a-development-branch":
    "Knowledge base already covers this branch. You may proceed with finishing.",
};

// Shared classifier for finishing-a-development-branch, used by both
// PreToolUse (Skill tool invocation) and UserPromptExpansion (slash-command path).
// Handles the 4-way staleness classifier only (base-branch no-op, SHA-match soft
// reminder, KB-only-commits soft reminder, rich injection fallback).
// eventName must be "PreToolUse" or "UserPromptExpansion".
// Caller must verify KB is ready before invoking this.
function classifyFinishingState(eventName) {
  const currentBranch = getCurrentBranch();
  const baseBranch = getBaseBranch();

  // On base branch or detached HEAD — finishing-a-development-branch does not
  // apply; no KB-coverage check possible. Skip the advisory entirely.
  if (!currentBranch || currentBranch === baseBranch) {
    return {};
  }

  const advisory = skillAdvisory["superpowers:finishing-a-development-branch"];
  const covered = readCoversBranch();
  const currentSHA = getCurrentSHA();
  const resolvedStoredSHA = covered && covered.sha ? resolveStoredSHA(covered.sha) : null;
  const branchMatches = covered && covered.branch === currentBranch;
  const shaMatches = resolvedStoredSHA && currentSHA && resolvedStoredSHA === currentSHA;

  if (branchMatches && shaMatches) {
    // KB is current — soft reminder is enough.
    return hookPayload(eventName, advisory);
  }

  // KB-only commits don't count as staleness — if the only changes since
  // covers_branch@SHA are inside docs/superpowers/memory/ (e.g., the KB-update
  // commit itself), treat as covered. Mirrors ADR-008's stop-hook exclusion.
  if (resolvedStoredSHA) {
    const nonKBCheck = run("git", ["log", "--oneline", "--no-merges", "-n", "1",
      resolvedStoredSHA + "..HEAD", "--", ...nonKnowledgePathspecs()]);
    if (nonKBCheck.code === 0 && !nonKBCheck.stdout.trim()) {
      return hookPayload(eventName, advisory);
    }
  }

  // Stale or never-covered — inject rich context.
  let reasonDetail;
  if (!covered) reasonDetail = "Knowledge base has no covers_branch recorded.";
  else if (!branchMatches) reasonDetail = "Knowledge base covers a different branch.";
  else if (!covered.sha) reasonDetail = "Legacy covers_branch format (no SHA recorded).";
  else if (!resolvedStoredSHA) reasonDetail = "Stored SHA is unresolvable (amended or garbage-collected).";
  else reasonDetail = "New commits on this branch since last KB update.";

  const richContext = buildFinishingRichContext({
    currentBranch, currentSHA, covered, resolvedStoredSHA, reasonDetail,
  });
  return hookPayload(eventName, richContext);
}

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
      ? "Project knowledge base exists but the index file is missing. You MUST run superpowers-memory:ingest full-refresh before using this workflow."
      : "Project knowledge base not initialized. You MUST run superpowers-memory:ingest bootstrap before using this workflow.";
    return { decision: "block", reason };
  }

  if (skill === "superpowers:finishing-a-development-branch") {
    return classifyFinishingState("PreToolUse");
  }

  return hookPayload("PreToolUse", advisory);
}

function buildUserPromptExpansionOutput(input) {
  let parsed = {};
  try {
    parsed = JSON.parse(input || "{}");
  } catch {
    parsed = {};
  }
  // The hook matcher targets command_name. Defensively double-check here in case
  // the matcher pattern is broader than expected — only act on the finishing skill.
  // endsWith() handles all plausible formats: bare, namespaced, with leading slash.
  const commandName = parsed.command_name || "";
  if (!commandName.endsWith("finishing-a-development-branch")) return {};

  const kbExists = hasKnowledgeBase();
  const indexPath = findIndexPath();
  const kbReady = kbExists && indexPath;
  if (!kbReady) {
    const reason = kbExists
      ? "Project knowledge base exists but the index file is missing. You MUST run superpowers-memory:ingest full-refresh before using this workflow."
      : "Project knowledge base not initialized. You MUST run superpowers-memory:ingest bootstrap before using this workflow.";
    return { decision: "block", reason };
  }

  return classifyFinishingState("UserPromptExpansion");
}

function buildVerifyOutput() {
  if (!hasKnowledgeBase()) {
    return { ok: false, error: "Knowledge base not found" };
  }

  const INDEX_LINE_THRESHOLD = 50;
  const SPLIT_ADVISORY_LINE_THRESHOLD = 300;
  const SPLIT_ADVISORY_TOKEN_THRESHOLD = 8000;
  const sizeWarnings = [];
  const staleRefs = [];
  const refPattern = /`([a-zA-Z0-9_.][a-zA-Z0-9_./\-]*\/[a-zA-Z0-9_./\-]*)`/g;

  const fileContents = [];
  for (const filename of listKnowledgeEntryFiles()) {
    const filePath = path.join(knowledgeDir, filename);
    fileContents.push([filename, fs.readFileSync(filePath, "utf8")]);
  }

  const indexFile = fileContents.find(([filename]) => filename === "index.md");
  if (indexFile) {
    const lines = indexFile[1].split("\n").length;
    if (lines > INDEX_LINE_THRESHOLD) {
      sizeWarnings.push({
        file: "index.md",
        lines,
        threshold: INDEX_LINE_THRESHOLD,
        scope: "hot_path",
      });
    }
  }

  for (const [filename, content] of fileContents) {
    let match;
    while ((match = refPattern.exec(content)) !== null) {
      const ref = match[1];
      if (ref.includes("://") || ref.startsWith(MEMORY_REL_DIR + "/") || ref.includes("<")) continue;

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
  const ssotViolations = ssotCheckKnowledgeBase(fileContents);
  const shapeViolations = contentShapeLintKnowledgeBase(fileContents);
  for (const filename of listKnowledgeMarkdownFiles()) {
    if (!knowledgeSlotForFile(filename) && FORBIDDEN_KB_SLOT_PATTERN.test(filename)) {
      shapeViolations.push({
        file: filename,
        line: 1,
        kind: "forbidden_kb_slot",
        sample: `${filename} is not a Project Knowledge slot; route durable conclusions to specs/plans/ADRs or existing owner files`,
      });
    }
    if (!knowledgeSlotForFile(filename) && NONCANONICAL_MEMORY_INFRASTRUCTURE_SLOT_PATTERN.test(filename)) {
      shapeViolations.push({
        file: filename,
        line: 1,
        kind: "noncanonical_memory_infrastructure_slot",
        sample: `${filename} is LLM Wiki infrastructure, not a default code-agent KB slot; keep the KB as owner files plus query routing unless a future schema explicitly adds this layer`,
      });
    }
  }
  if (indexFile) {
    const lines = indexFile[1].split("\n").length;
    if (lines > INDEX_LINE_THRESHOLD) {
      shapeViolations.push({
        file: "index.md",
        line: 1,
        kind: "index_too_large",
        sample: `${lines} lines exceeds ${INDEX_LINE_THRESHOLD}-line hot-path limit`,
      });
    }
  }
  for (const [filename, content] of fileContents) {
    if (knowledgeSlotForFile(filename) === "decisions") {
      shapeViolations.push(...lintDecisionDetailLinks(filename, content));
    }
  }
  const readinessWarnings = lintReadinessWarnings(fileContents);
  const coverageGaps = lintQueryCoverage(fileContents);

  const totalBytes = fileContents.reduce((sum, [, content]) => sum + Buffer.byteLength(content, "utf8"), 0);
  const estimatedTokens = Math.ceil(totalBytes / 4);
  const perFileTokens = fileContents.map(([filename, content]) => ({
    file: filename,
    bytes: Buffer.byteLength(content, "utf8"),
    lines: content.split("\n").length,
    tokens: Math.ceil(Buffer.byteLength(content, "utf8") / 4),
  }));
  const retrievalCost = {
    estimatedTokens,
    bytes: totalBytes,
    perFile: perFileTokens,
    advisoryOnly: true,
  };
  const splitCandidates = perFileTokens
    .filter((entry) =>
      entry.file !== "index.md" &&
      (entry.lines > SPLIT_ADVISORY_LINE_THRESHOLD || entry.tokens > SPLIT_ADVISORY_TOKEN_THRESHOLD)
    )
    .map((entry) => ({
      file: entry.file,
      lines: entry.lines,
      tokens: entry.tokens,
      suggestion: "Consider splitting by stable domain/module if the content is hard to scan; do not delete valid knowledge to satisfy size.",
    }));

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

  const ok =
    staleRefs.length === 0 &&
    ssotViolations.length === 0 &&
    shapeViolations.length === 0 &&
    readinessWarnings.length === 0;
  const qualityGate = buildQualityGate({
    ok,
    staleRefs,
    ssotViolations,
    shapeViolations,
    readinessWarnings,
    coverageGaps,
    splitCandidates,
    sizeWarnings,
  });

  return {
    ok,
    sizeWarnings,
    staleRefs,
    ssotViolations,
    shapeViolations,
    readinessWarnings,
    coverageGaps,
    qualityGate,
    retrievalCost,
    splitCandidates,
    committable,
  };
}

function handleWritePreToolUse(toolName, toolInput) {
  const targetPath = toolInput.file_path || toolInput.notebook_path;
  if (!targetPath) return {};

  const absTarget = path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(repoRoot, targetPath);
  if (!isInsideKnowledgeTree(absTarget)) return {};

  if (isLockHeld()) return {};

  const relFromRepo = path.relative(repoRoot, absTarget).replace(/\\/g, "/");
  return {
    decision: "block",
    reason:
      "Direct edits to docs/superpowers/memory/ are forbidden. " +
      "This directory is owned by superpowers-memory:ingest. " +
      "To record an architectural decision: document it in your plan/spec under " +
      "docs/superpowers/plans/, then run superpowers-memory:ingest to materialize " +
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

  if (mode === "user-prompt-expansion") {
    const input = await readStdin();
    process.stdout.write(JSON.stringify(buildUserPromptExpansionOutput(input), null, 2) + "\n");
    return;
  }

  if (mode === "verify" || mode === "lint") {
    process.stdout.write(JSON.stringify(buildVerifyOutput(), null, 2) + "\n");
    return;
  }

  if (mode === "status") {
    process.stdout.write(JSON.stringify(buildKnowledgeStatus(), null, 2) + "\n");
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
