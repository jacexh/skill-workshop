#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const mode = process.argv[2];
const repoRoot = process.cwd();
const knowledgeDir = path.join(repoRoot, "docs", "project-knowledge");
const statePath = path.join(knowledgeDir, ".state.json");
const ignoredPrefixes = [
  "node_modules/",
  "vendor/",
  "dist/",
  "build/",
  ".next/",
  "coverage/",
  ".git/",
];
const ignoredSuffixes = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".snap",
];
const lowImpactMarkers = [
  ".test.",
  ".spec.",
  "__tests__/",
  "__snapshots__/",
];
const lowImpactSuffixes = [".css", ".scss", ".sass", ".less"];

function run(command, args) {
  const result = cp.spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function insideGitRepo() {
  return run("git", ["rev-parse", "--is-inside-work-tree"]).code === 0;
}

function normalizePath(inputPath, baseDir = repoRoot) {
  if (!inputPath) return null;
  const cleaned = inputPath.trim().replace(/\\/g, "/");
  if (!cleaned || cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return null;
  }
  const withoutAnchor = cleaned.split("#")[0];
  if (!withoutAnchor) return null;
  const resolved = path.resolve(baseDir, withoutAnchor);
  const relative = path.relative(repoRoot, resolved).replace(/\\/g, "/");
  if (!relative || relative.startsWith("..")) {
    return cleaned.startsWith("/") ? null : withoutAnchor.replace(/^\.\//, "");
  }
  return relative;
}

function pathExists(relativePath) {
  if (!relativePath) return false;
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function listKnowledgeFiles() {
  if (!fs.existsSync(knowledgeDir)) return [];
  return fs
    .readdirSync(knowledgeDir)
    .filter((name) => name.endsWith(".md") && name !== "index.md" && name !== "MEMORY.md")
    .sort();
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

function loadState() {
  if (!fs.existsSync(statePath)) {
    return { state: null, error: "missing_state_file" };
  }
  try {
    return {
      state: JSON.parse(fs.readFileSync(statePath, "utf8")),
      error: null,
    };
  } catch {
    return { state: null, error: "corrupt_state" };
  }
}

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

function extractPathsFromMarkdown(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const baseDir = path.dirname(filePath);
  const refs = new Set();

  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const normalized = normalizePath(match[1], baseDir);
    if (
      normalized &&
      !normalized.startsWith("docs/project-knowledge/") &&
      pathExists(normalized)
    ) {
      refs.add(normalized);
    }
  }

  for (const match of content.matchAll(/`([^`\n]+)`/g)) {
    const raw = match[1].trim();
    if (!/[/.]/.test(raw)) continue;
    const normalized = normalizePath(raw, baseDir);
    if (
      normalized &&
      !normalized.startsWith("docs/project-knowledge/") &&
      pathExists(normalized)
    ) {
      refs.add(normalized);
    }
  }

  return [...refs].sort();
}

function deriveKnowledgeSourcesFromMarkdown() {
  const knowledgeFiles = {};
  for (const fileName of listKnowledgeFiles()) {
    knowledgeFiles[fileName] = {
      source_paths: extractPathsFromMarkdown(path.join(knowledgeDir, fileName)),
      source: "markdown_refs",
    };
  }
  return knowledgeFiles;
}

function normalizeSourcePath(sourcePath) {
  return normalizePath(sourcePath, repoRoot);
}

function getKnowledgeSources(state) {
  if (state && state.knowledge_files && typeof state.knowledge_files === "object") {
    const knowledgeFiles = {};
    for (const [name, metadata] of Object.entries(state.knowledge_files)) {
      const sourcePaths = Array.isArray(metadata?.source_paths)
        ? unique(metadata.source_paths.map((item) => normalizeSourcePath(item)))
        : [];
      knowledgeFiles[name] = {
        source_paths: sourcePaths.filter((item) => pathExists(item)),
        match_paths: [],
        source: "state",
      };
    }
    return finalizeKnowledgeSources(knowledgeFiles);
  }
  return finalizeKnowledgeSources(deriveKnowledgeSourcesFromMarkdown());
}

function finalizeKnowledgeSources(knowledgeFiles) {
  const finalized = {};
  for (const [name, metadata] of Object.entries(knowledgeFiles)) {
    const sourcePaths = unique(metadata.source_paths || []);
    const directoryCounts = new Map();
    for (const sourcePath of sourcePaths) {
      const absolutePath = path.join(repoRoot, sourcePath);
      if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
        const directoryPath = path.dirname(sourcePath).replace(/\\/g, "/");
        if (directoryPath && directoryPath !== ".") {
          directoryCounts.set(directoryPath, (directoryCounts.get(directoryPath) || 0) + 1);
        }
      }
    }
    const inferredDirectories = [...directoryCounts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([directoryPath]) => directoryPath);
    finalized[name] = {
      ...metadata,
      source_paths: sourcePaths,
      match_paths: unique([...sourcePaths, ...inferredDirectories]),
    };
  }
  return finalized;
}

function shouldIgnore(relativePath) {
  return (
    !relativePath ||
    ignoredPrefixes.some((prefix) => relativePath.startsWith(prefix)) ||
    ignoredSuffixes.some((suffix) => relativePath.endsWith(suffix))
  );
}

function isLowImpact(relativePath) {
  return (
    lowImpactMarkers.some((marker) => relativePath.includes(marker)) ||
    lowImpactSuffixes.some((suffix) => relativePath.endsWith(suffix))
  );
}

function parseNameStatus(output) {
  const changes = new Map();
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split("\t");
    const status = parts[0];
    if (status.startsWith("R") && parts.length >= 3) {
      mergeChange(changes, parts[1], "renamed_from");
      mergeChange(changes, parts[2], "renamed_to");
      continue;
    }
    if (parts.length < 2) continue;
    const kind = status.startsWith("A")
      ? "added"
      : status.startsWith("D")
        ? "deleted"
        : "modified";
    mergeChange(changes, parts[1], kind);
  }
  return changes;
}

function mergeChange(map, rawPath, kind) {
  const relativePath = normalizePath(rawPath, repoRoot);
  if (!relativePath) return;
  if (!map.has(relativePath)) {
    map.set(relativePath, new Set());
  }
  map.get(relativePath).add(kind);
}

function collectChanges(baseRevision) {
  const changes = new Map();
  const diagnostics = {
    workspace_dirty: false,
    has_staged_changes: false,
    has_unstaged_changes: false,
    has_untracked_files: false,
  };
  let invalidBaseRevision = false;

  if (baseRevision) {
    const committed = run("git", ["diff", "--name-status", `${baseRevision}...HEAD`]);
    if (committed.code !== 0) {
      invalidBaseRevision = true;
    } else {
      for (const [file, kinds] of parseNameStatus(committed.stdout).entries()) {
        if (!changes.has(file)) changes.set(file, new Set());
        for (const kind of kinds) changes.get(file).add(kind);
      }
    }
  }

  const staged = run("git", ["diff", "--cached", "--name-status"]);
  diagnostics.has_staged_changes = Boolean(staged.stdout.trim());
  for (const [file, kinds] of parseNameStatus(staged.stdout).entries()) {
    if (!changes.has(file)) changes.set(file, new Set());
    for (const kind of kinds) changes.get(file).add(kind);
  }

  const unstaged = run("git", ["diff", "--name-status"]);
  diagnostics.has_unstaged_changes = Boolean(unstaged.stdout.trim());
  for (const [file, kinds] of parseNameStatus(unstaged.stdout).entries()) {
    if (!changes.has(file)) changes.set(file, new Set());
    for (const kind of kinds) changes.get(file).add(kind);
  }

  const untracked = run("git", ["ls-files", "--others", "--exclude-standard"]);
  diagnostics.has_untracked_files = Boolean(untracked.stdout.trim());
  for (const rawLine of untracked.stdout.split(/\r?\n/)) {
    const relativePath = normalizePath(rawLine, repoRoot);
    if (!relativePath) continue;
    if (!changes.has(relativePath)) changes.set(relativePath, new Set());
    changes.get(relativePath).add("untracked");
  }

  diagnostics.workspace_dirty =
    diagnostics.has_staged_changes ||
    diagnostics.has_unstaged_changes ||
    diagnostics.has_untracked_files;

  return { changes, diagnostics, invalidBaseRevision };
}

function sourcePathMatches(sourcePath, changedPath) {
  return changedPath === sourcePath || changedPath.startsWith(`${sourcePath}/`);
}

function matchKnowledgeFiles(changedPath, knowledgeSources) {
  const matched = [];
  for (const [name, metadata] of Object.entries(knowledgeSources)) {
    for (const sourcePath of metadata.match_paths || metadata.source_paths || []) {
      if (sourcePathMatches(sourcePath, changedPath)) {
        matched.push(name);
        break;
      }
    }
  }
  return matched;
}

function genericDriftReason(changedPath, kinds, coveredTopLevels) {
  if (changedPath.startsWith("docs/project-knowledge/")) return null;
  if (![...kinds].some((kind) => kind !== "modified")) return null;
  const topLevel = changedPath.split("/")[0];
  if (!topLevel || !coveredTopLevels.has(topLevel)) return null;
  return `new uncovered path under tracked top-level ${topLevel}/ via ${changedPath}`;
}

function summarizeReasons(items) {
  return unique(items).slice(0, 6);
}

function analyzeState() {
  const indexPath = findIndexPath();
  const knowledgeExists = fs.existsSync(knowledgeDir);
  const { state, error: stateError } = loadState();
  const diagnostics = {
    git_repo: false,
    missing_knowledge_dir: !knowledgeExists,
    missing_index: !indexPath,
    missing_state_file: stateError === "missing_state_file",
    corrupt_state: stateError === "corrupt_state",
    invalid_base_revision: false,
    workspace_dirty: false,
    has_staged_changes: false,
    has_unstaged_changes: false,
    has_untracked_files: false,
    base_revision: state?.base_revision || null,
    state_path: path.relative(repoRoot, statePath).replace(/\\/g, "/"),
    index_path: indexPath ? path.relative(repoRoot, indexPath).replace(/\\/g, "/") : null,
  };

  const knowledgeSources = getKnowledgeSources(state);
  const reasons = [];
  const structuralChanges = [];
  const affectedKnowledge = new Set();
  let severityScore = 0;
  let onlyLowImpact = true;

  if (!knowledgeExists) {
    reasons.push("project knowledge directory is missing");
  }
  if (!indexPath) {
    reasons.push("project knowledge index is missing");
  }
  if (stateError === "corrupt_state") {
    reasons.push("state file docs/project-knowledge/.state.json is invalid");
  }

  diagnostics.git_repo = insideGitRepo();
  let baseRevision = state?.base_revision || null;
  if (!baseRevision && diagnostics.git_repo && knowledgeExists) {
    const fallback = run("git", ["log", "-1", "--format=%H", "--", "docs/project-knowledge/"]);
    if (fallback.code === 0 && fallback.stdout.trim()) {
      baseRevision = fallback.stdout.trim();
      diagnostics.base_revision = baseRevision;
    }
  }

  if (baseRevision && diagnostics.git_repo) {
    if (run("git", ["rev-parse", "--verify", baseRevision]).code !== 0) {
      diagnostics.invalid_base_revision = true;
      reasons.push(`base revision ${baseRevision} no longer exists`);
      baseRevision = null;
    }
  }

  if (diagnostics.git_repo && !diagnostics.invalid_base_revision) {
    const { changes, diagnostics: gitDiagnostics, invalidBaseRevision } = collectChanges(baseRevision);
    Object.assign(diagnostics, gitDiagnostics);
    if (invalidBaseRevision) {
      diagnostics.invalid_base_revision = true;
      reasons.push("unable to diff from stored base revision");
    } else {
      const coveredTopLevels = new Set();
      for (const metadata of Object.values(knowledgeSources)) {
        for (const sourcePath of metadata.source_paths || []) {
          const topLevel = sourcePath.split("/")[0];
          if (topLevel) coveredTopLevels.add(topLevel);
        }
      }

      for (const [changedPath, kinds] of [...changes.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        if (shouldIgnore(changedPath)) continue;
        const matched = matchKnowledgeFiles(changedPath, knowledgeSources);
        if (matched.length > 0) {
          severityScore += [...kinds].some((kind) => kind !== "modified") ? 2 : 1;
          if (!isLowImpact(changedPath)) {
            onlyLowImpact = false;
          }
          matched.forEach((name) => affectedKnowledge.add(name));
          reasons.push(`${changedPath} (${[...kinds].sort().join(", ")}) -> ${matched.join(", ")}`);
          continue;
        }
        if (isLowImpact(changedPath)) {
          continue;
        }
        const drift = genericDriftReason(changedPath, kinds, coveredTopLevels);
        if (drift) {
          structuralChanges.push(drift);
        }
      }
    }
  }

  let status = "fresh";
  if (!knowledgeExists || !indexPath || diagnostics.corrupt_state || diagnostics.invalid_base_revision) {
    status = "drifted";
  } else if (structuralChanges.length > 0) {
    status = "drifted";
  } else if (affectedKnowledge.size === 0) {
    status = diagnostics.missing_state_file ? "minor_stale" : "fresh";
  } else if (affectedKnowledge.size === 1 && severityScore <= 2) {
    status = "minor_stale";
  } else {
    status = "stale";
  }

  const recommendedAction =
    status === "drifted" ? "rebuild" : status === "fresh" ? "none" : "update";

  if (diagnostics.missing_state_file && status !== "drifted") {
    reasons.unshift(
      "state file docs/project-knowledge/.state.json is missing; source paths were inferred from markdown references"
    );
  }

  return {
    status,
    recommended_action: recommendedAction,
    affected_knowledge: [...affectedKnowledge].sort(),
    reasons: summarizeReasons(reasons),
    structural_changes: summarizeReasons(structuralChanges),
    diagnostics,
    knowledge_sources: knowledgeSources,
    only_low_impact: onlyLowImpact,
  };
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

function buildSessionStartOutput(analysis) {
  const parts = [];
  if (analysis.status === "fresh") {
    parts.push("Project knowledge base is in sync with the current codebase.");
  } else if (analysis.status === "minor_stale") {
    parts.push("WARNING: Project knowledge base may be partially stale. Run superpowers-memory:update soon.");
  } else if (analysis.status === "stale") {
    parts.push("WARNING: Project knowledge base is stale relative to the current codebase. Run superpowers-memory:update before relying on it.");
  } else {
    parts.push("Project knowledge base has structural drift, missing state, or missing core files. Run superpowers-memory:rebuild before relying on it.");
  }

  if (analysis.affected_knowledge.length > 0) {
    parts.push(`Affected knowledge files: ${analysis.affected_knowledge.join(", ")}`);
  }

  const details = analysis.structural_changes.length > 0 ? analysis.structural_changes : analysis.reasons;
  if (details.length > 0) {
    parts.push(`Why: ${details.slice(0, 3).join(" | ")}`);
  }

  if (analysis.diagnostics.index_path) {
    const content = fs.readFileSync(path.join(repoRoot, analysis.diagnostics.index_path), "utf8");
    parts.push(`Project knowledge index loaded from ${analysis.diagnostics.index_path}:\n\n${content}`);
  }

  return hookPayload("SessionStart", parts.join("\n\n"));
}

function buildPreToolUseOutput(analysis, input) {
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

  const detailLines = [];
  if (analysis.affected_knowledge.length > 0) {
    detailLines.push(`Affected knowledge files: ${analysis.affected_knowledge.join(", ")}`);
  }
  const reasons = analysis.structural_changes.length > 0 ? analysis.structural_changes : analysis.reasons;
  if (reasons.length > 0) {
    detailLines.push(`Why: ${reasons.slice(0, 3).join(" | ")}`);
  }
  const withDetails = (prefix) =>
    detailLines.length > 0 ? `${prefix}\n\n${detailLines.join("\n")}` : prefix;

  let decision = "inject";
  let message = "";

  if (skill === "superpowers:brainstorming") {
    if (analysis.status === "drifted") {
      decision = "block";
      message = withDetails("Project knowledge base has structural drift, missing state, or missing core files. You MUST run superpowers-memory:rebuild before brainstorming.");
    } else if (analysis.status === "stale") {
      message = withDetails("WARNING: The project knowledge base is stale. Prefer live code over KB assumptions and run superpowers-memory:update before relying on it.");
    } else if (analysis.status === "minor_stale") {
      message = withDetails("WARNING: The project knowledge base may be partially stale. Load the affected files and verify against live code before brainstorming.");
    } else {
      message = "Load the detail files from docs/project-knowledge/ relevant to this brainstorming task before proceeding.";
    }
  } else if (skill === "superpowers:writing-plans") {
    if (analysis.status === "drifted") {
      decision = "block";
      message = withDetails("Project knowledge base has structural drift, missing state, or missing core files. You MUST run superpowers-memory:rebuild before writing plans.");
    } else if (analysis.status === "stale") {
      message = withDetails("WARNING: The project knowledge base is stale. The plan should be based on actual code state, not KB alone. Run superpowers-memory:update before finalizing it.");
    } else if (analysis.status === "minor_stale") {
      message = withDetails("WARNING: The project knowledge base may be partially stale. Verify the plan against live code and refresh the KB soon.");
    } else {
      message = "Load the detail files from docs/project-knowledge/ relevant to this plan before proceeding.";
    }
  } else if (skill === "superpowers:finishing-a-development-branch") {
    if (analysis.status === "fresh") {
      message = "Before finishing this branch, verify whether current work changed any knowledge-relevant files and run superpowers-memory:update if needed.";
    } else if (analysis.recommended_action === "rebuild") {
      decision = "block";
      message = withDetails("Project knowledge base has structural drift, missing state, or missing core files. You MUST run superpowers-memory:rebuild before finishing this branch.");
    } else {
      decision = "block";
      message = withDetails("The project knowledge base is behind the current codebase. You MUST run superpowers-memory:update before finishing this branch.");
    }
  }

  if (!message) {
    return {};
  }
  if (decision === "block") {
    return { decision: "block", reason: message };
  }
  return hookPayload("PreToolUse", message);
}

function buildStopOutput(analysis) {
  if (analysis.status === "fresh") {
    return {};
  }
  const reasons = analysis.structural_changes.length > 0 ? analysis.structural_changes : analysis.reasons;
  const details = [];
  if (analysis.affected_knowledge.length > 0) {
    details.push(`Affected knowledge files: ${analysis.affected_knowledge.join(", ")}`);
  }
  if (reasons.length > 0) {
    details.push(`Why: ${reasons.slice(0, 3).join(" | ")}`);
  }

  const prefix =
    analysis.recommended_action === "rebuild"
      ? "This project knowledge base has structural drift, missing state, or missing core files. You MUST run superpowers-memory:rebuild before this session ends."
      : "This session changed knowledge-relevant files that are not yet reflected in the project knowledge base. You MUST run superpowers-memory:update before this session ends.";

  return {
    decision: "block",
    reason: details.length > 0 ? `${prefix}\n\n${details.join("\n")}` : prefix,
  };
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

async function main() {
  const analysis = analyzeState();
  if (mode === "analyze") {
    process.stdout.write(`${JSON.stringify(analysis, null, 2)}\n`);
    return;
  }
  if (mode === "session-start") {
    process.stdout.write(`${JSON.stringify(buildSessionStartOutput(analysis), null, 2)}\n`);
    return;
  }
  if (mode === "stop") {
    process.stdout.write(`${JSON.stringify(buildStopOutput(analysis), null, 2)}\n`);
    return;
  }
  if (mode === "pre-tool-use") {
    const input = await readStdin();
    process.stdout.write(`${JSON.stringify(buildPreToolUseOutput(analysis, input), null, 2)}\n`);
    return;
  }
  process.stderr.write(`Unknown hook mode: ${mode}\n`);
  process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
