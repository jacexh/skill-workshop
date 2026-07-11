#!/usr/bin/env node

"use strict";

const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const EVAL_ROOT = path.join(ROOT, "evals", "ddd-expert");
const CASES_ROOT = path.join(EVAL_ROOT, "cases");
const RESULT_SCHEMA = path.join(EVAL_ROOT, "result.schema.json");
const CONTAINER_FILE = path.join(EVAL_ROOT, "Dockerfile");
const PLUGIN_ROOT = path.join(ROOT, "codex-plugins", "ddd-expert");
const DEFAULT_TIMEOUT_SECONDS = 240;
const DEFAULT_CONTAINER_IMAGE = "ddd-expert-eval:local";
const DEFAULT_INFRA_RETRIES = 2;
const VERDICT_FAMILIES = [
  "aggregate_boundary",
  "repository_shape",
  "cqrs_boundary",
  "model_evidence",
  "lifecycle_integrity",
  "collaboration",
  "runtime_recovery",
  "persistence_conformance",
  "layer_boundary",
];

function fail(message, exitCode = 1) {
  const error = new Error(message);
  error.exitCode = exitCode;
  throw error;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`cannot read JSON ${file}: ${error.message}`, 2);
  }
}

const RESULT_COMPLETIONS = readJson(RESULT_SCHEMA).properties?.completion?.enum;
if (!Array.isArray(RESULT_COMPLETIONS) || RESULT_COMPLETIONS.length === 0) {
  fail("result schema must define completion values", 2);
}

function completionError(phase, completion) {
  if (!RESULT_COMPLETIONS.includes(completion)) {
    return "completion is invalid";
  }
  if (completion === "checkpointed" && phase !== "explore") {
    return "checkpointed completion is valid only for Explore";
  }
  return null;
}

function hashTree(root) {
  const hash = crypto.createHash("sha256");

  function visit(current, relative) {
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      hash.update(`${entry.isDirectory() ? "d" : entry.isSymbolicLink() ? "l" : "f"}\0${childRelative}\0`);
      if (entry.isDirectory()) {
        visit(absolute, childRelative);
      } else if (entry.isSymbolicLink()) {
        hash.update(fs.readlinkSync(absolute));
      } else {
        hash.update(fs.readFileSync(absolute));
      }
      hash.update("\0");
    }
  }

  visit(root, "");
  return hash.digest("hex");
}

function hashFiles(files) {
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update(`${path.relative(ROOT, file)}\0`);
    hash.update(fs.readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function resolveExecutable(command) {
  const candidates = command.includes(path.sep)
    ? [path.resolve(command)]
    : (process.env.PATH || "").split(path.delimiter).filter(Boolean).map((directory) => path.join(directory, command));
  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return fs.realpathSync(candidate);
    } catch {
      // Continue through PATH.
    }
  }
  fail(`executable not found: ${command}`, 2);
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, allowed) {
  return isPlainObject(value) && Object.keys(value).every((key) => allowed.includes(key));
}

function safeChildPath(parent, relative, label) {
  if (typeof relative !== "string" || relative.length === 0) {
    fail(`${label} must be a non-empty relative path`, 2);
  }
  const resolved = path.resolve(parent, relative);
  const prefix = `${path.resolve(parent)}${path.sep}`;
  if (!resolved.startsWith(prefix)) {
    fail(`${label} escapes its case directory: ${relative}`, 2);
  }
  return resolved;
}

function stringArray(value, label, allowEmpty = true) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    fail(`${label} must be an array of non-empty strings`, 2);
  }
  if (!allowEmpty && value.length === 0) {
    fail(`${label} must not be empty`, 2);
  }
}

function validateCase(caseDir, config) {
  const requiredKeys = ["id", "phase", "suites", "sandbox", "prompt", "workspace", "expect"];
  if (!hasOnlyKeys(config, requiredKeys)) {
    fail(`${caseDir}/case.json contains unknown keys`, 2);
  }
  for (const key of requiredKeys) {
    if (!(key in config)) {
      fail(`${caseDir}/case.json is missing ${key}`, 2);
    }
  }

  const dirName = path.basename(caseDir);
  if (config.id !== dirName || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.id)) {
    fail(`${caseDir}/case.json id must match its kebab-case directory`, 2);
  }
  if (!["explore", "shape", "codify", "guard"].includes(config.phase)) {
    fail(`${config.id}: invalid phase ${config.phase}`, 2);
  }
  stringArray(config.suites, `${config.id}.suites`, false);
  if (config.suites.some((suite) => !["smoke", "full"].includes(suite))) {
    fail(`${config.id}: suites may contain only smoke or full`, 2);
  }
  if (!["read-only", "workspace-write"].includes(config.sandbox)) {
    fail(`${config.id}: invalid sandbox ${config.sandbox}`, 2);
  }

  const promptPath = safeChildPath(caseDir, config.prompt, `${config.id}.prompt`);
  const workspacePath = safeChildPath(caseDir, config.workspace, `${config.id}.workspace`);
  if (!fs.statSync(promptPath, { throwIfNoEntry: false })?.isFile()) {
    fail(`${config.id}: prompt file does not exist`, 2);
  }
  if (!fs.statSync(workspacePath, { throwIfNoEntry: false })?.isDirectory()) {
    fail(`${config.id}: workspace directory does not exist`, 2);
  }

  const expect = config.expect;
  const expectedKeys = ["completion", "review_conclusion", "questions", "routes", "verdicts", "forbid_verdicts", "git", "files", "checks"];
  if (!hasOnlyKeys(expect, expectedKeys)) {
    fail(`${config.id}.expect must be an object`, 2);
  }
  for (const key of expectedKeys) {
    if (!(key in expect)) {
      fail(`${config.id}.expect is missing ${key}`, 2);
    }
  }
  stringArray(expect.completion, `${config.id}.expect.completion`, false);
  for (const completion of expect.completion) {
    const error = completionError(config.phase, completion);
    if (error) {
      fail(`${config.id}: ${error === "completion is invalid" ? "invalid expected completion" : error}`, 2);
    }
  }
  stringArray(expect.review_conclusion, `${config.id}.expect.review_conclusion`, false);
  if (expect.review_conclusion.some((item) => !["not_applicable", "clear", "violations", "evidence_gaps", "incomplete"].includes(item))) {
    fail(`${config.id}: invalid expected review conclusion`, 2);
  }
  const questionExpectationKeys = ["min", "max", "contains", "contains_any", "excludes"];
  if (!hasOnlyKeys(expect.questions, questionExpectationKeys) || !Number.isInteger(expect.questions.min) || !Number.isInteger(expect.questions.max) || expect.questions.min < 0 || expect.questions.max < expect.questions.min) {
    fail(`${config.id}.expect.questions must define valid integer min/max`, 2);
  }
  for (const key of ["contains", "excludes"]) {
    if (key in expect.questions) {
      stringArray(expect.questions[key], `${config.id}.expect.questions.${key}`, false);
      if (expect.questions[key].some((item) => normalizeSemanticText(item).length === 0 || !isValidSemanticExpectation(item))) {
        fail(`${config.id}.expect.questions.${key} must contain valid semantic text`, 2);
      }
    }
  }
  if ("contains_any" in expect.questions) {
    if (!Array.isArray(expect.questions.contains_any) || expect.questions.contains_any.length === 0) {
      fail(`${config.id}.expect.questions.contains_any must be a non-empty array of groups`, 2);
    }
    for (const [index, group] of expect.questions.contains_any.entries()) {
      stringArray(group, `${config.id}.expect.questions.contains_any[${index}]`, false);
      if (group.some((item) => normalizeSemanticText(item).length === 0 || !isValidSemanticExpectation(item))) {
        fail(`${config.id}.expect.questions.contains_any[${index}] must contain valid semantic text`, 2);
      }
    }
  }
  if (questionExpectationKeys.slice(2).some((key) => key in expect.questions) && expect.questions.min < 1) {
    fail(`${config.id}.expect.questions semantic expectations require min >= 1`, 2);
  }
  if (!hasOnlyKeys(expect.routes, ["contains", "excludes"])) {
    fail(`${config.id}.expect.routes must be an object`, 2);
  }
  stringArray(expect.routes.contains, `${config.id}.expect.routes.contains`);
  stringArray(expect.routes.excludes, `${config.id}.expect.routes.excludes`);
  for (const target of [...expect.routes.contains, ...expect.routes.excludes]) {
    if (!["explore", "shape", "codify", "guard"].includes(target)) {
      fail(`${config.id}: invalid expected route ${target}`, 2);
    }
  }
  if (!Array.isArray(expect.verdicts)) {
    fail(`${config.id}.expect.verdicts must be an array`, 2);
  }
  for (const verdict of expect.verdicts) {
    const hasFamily = typeof verdict.family === "string";
    const hasFamilyAlternatives = "families_any" in verdict;
    if (!hasOnlyKeys(verdict, ["kind", "family", "families_any", "evidence_paths"]) || !["violation", "evidence_gap"].includes(verdict.kind) || hasFamily === hasFamilyAlternatives) {
      fail(`${config.id}: invalid expected verdict`, 2);
    }
    const families = hasFamily ? [verdict.family] : verdict.families_any;
    stringArray(families, `${config.id}.expect.verdicts.families_any`, false);
    if ((hasFamilyAlternatives && families.length < 2) || families.some((family) => !VERDICT_FAMILIES.includes(family)) || new Set(families).size !== families.length) {
      fail(`${config.id}: invalid expected verdict family`, 2);
    }
    stringArray(verdict.evidence_paths, `${config.id}.expect.verdicts.evidence_paths`);
  }
  stringArray(expect.forbid_verdicts, `${config.id}.expect.forbid_verdicts`);
  if (expect.forbid_verdicts.some((item) => !["violation", "evidence_gap"].includes(item))) {
    fail(`${config.id}: invalid forbidden verdict`, 2);
  }
  if (!hasOnlyKeys(expect.git, ["changed", "required_paths", "forbidden_paths"]) || !["none", "some"].includes(expect.git.changed)) {
    fail(`${config.id}.expect.git must define changed as none or some`, 2);
  }
  stringArray(expect.git.required_paths, `${config.id}.expect.git.required_paths`);
  stringArray(expect.git.forbidden_paths, `${config.id}.expect.git.forbidden_paths`);
  if (!Array.isArray(expect.files) || !Array.isArray(expect.checks)) {
    fail(`${config.id}.expect.files and checks must be arrays`, 2);
  }
  for (const assertion of expect.files) {
    if (!hasOnlyKeys(assertion, ["path", "exists", "contains", "excludes", "contains_words", "excludes_words"]) || typeof assertion.path !== "string" || typeof assertion.exists !== "boolean") {
      fail(`${config.id}: invalid file assertion`, 2);
    }
    safeChildPath(workspacePath, assertion.path, `${config.id}.expect.files.path`);
    stringArray(assertion.contains, `${config.id}.expect.files.contains`);
    stringArray(assertion.excludes, `${config.id}.expect.files.excludes`);
    stringArray(assertion.contains_words || [], `${config.id}.expect.files.contains_words`);
    stringArray(assertion.excludes_words || [], `${config.id}.expect.files.excludes_words`);
  }
  for (const check of expect.checks) {
    if (!hasOnlyKeys(check, ["argv", "exit", "timeout_seconds"])) {
      fail(`${config.id}: invalid check`, 2);
    }
    stringArray(check.argv, `${config.id}.expect.checks.argv`, false);
    if (!Number.isInteger(check.exit) || !Number.isInteger(check.timeout_seconds) || check.timeout_seconds < 1) {
      fail(`${config.id}: check exit and timeout_seconds must be integers`, 2);
    }
  }

  return { config, caseDir, promptPath, workspacePath };
}

function loadCases() {
  if (!fs.statSync(CASES_ROOT, { throwIfNoEntry: false })?.isDirectory()) {
    fail(`cases directory not found: ${CASES_ROOT}`, 2);
  }
  const seen = new Set();
  const cases = fs.readdirSync(CASES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const caseDir = path.join(CASES_ROOT, entry.name);
      const loaded = validateCase(caseDir, readJson(path.join(caseDir, "case.json")));
      if (seen.has(loaded.config.id)) {
        fail(`duplicate case id: ${loaded.config.id}`, 2);
      }
      seen.add(loaded.config.id);
      return loaded;
    });
  if (cases.length === 0) {
    fail("no ddd-expert eval cases found", 2);
  }
  return cases;
}

function validateResultShape(result) {
  const errors = [];
  if (!isPlainObject(result)) {
    return ["result is not an object"];
  }
  const exactKeys = ["scenario_id", "phase", "completion", "review_conclusion", "questions", "routes", "verdicts", "changed_files", "verification"];
  for (const key of exactKeys) {
    if (!(key in result)) {
      errors.push(`missing result field ${key}`);
    }
  }
  for (const key of Object.keys(result)) {
    if (!exactKeys.includes(key)) {
      errors.push(`unexpected result field ${key}`);
    }
  }
  if (typeof result.scenario_id !== "string" || result.scenario_id.length === 0) {
    errors.push("scenario_id must be a non-empty string");
  }
  if (!["explore", "shape", "codify", "guard"].includes(result.phase)) {
    errors.push("phase is invalid");
  }
  const invalidCompletion = completionError(result.phase, result.completion);
  if (invalidCompletion) {
    errors.push(invalidCompletion);
  }
  if (!["not_applicable", "clear", "violations", "evidence_gaps", "incomplete"].includes(result.review_conclusion)) {
    errors.push("review_conclusion is invalid");
  }
  for (const key of ["questions", "routes", "verdicts", "changed_files", "verification"]) {
    if (!Array.isArray(result[key])) {
      errors.push(`${key} must be an array`);
    }
  }
  if (Array.isArray(result.questions)) {
    if (result.questions.length > 3 || result.questions.some((question) => typeof question !== "string" || question.length === 0)) {
      errors.push("questions must contain at most three non-empty strings");
    }
  }
  for (const route of Array.isArray(result.routes) ? result.routes : []) {
    if (!hasOnlyKeys(route, ["target", "reason"]) || !["explore", "shape", "codify", "guard"].includes(route.target) || typeof route.reason !== "string" || route.reason.length === 0) {
      errors.push("route is invalid");
    }
  }
  for (const verdict of Array.isArray(result.verdicts) ? result.verdicts : []) {
    if (!hasOnlyKeys(verdict, ["kind", "family", "summary", "evidence"]) || !["violation", "evidence_gap"].includes(verdict.kind) || !VERDICT_FAMILIES.includes(verdict.family) || typeof verdict.summary !== "string" || verdict.summary.length === 0 || !Array.isArray(verdict.evidence)) {
      errors.push("verdict is invalid");
      continue;
    }
    for (const evidence of verdict.evidence) {
      if (!hasOnlyKeys(evidence, ["path", "line", "detail"]) || typeof evidence.path !== "string" || evidence.path.length === 0 || !(evidence.line === null || (Number.isInteger(evidence.line) && evidence.line >= 1)) || typeof evidence.detail !== "string" || evidence.detail.length === 0) {
        errors.push("verdict evidence is invalid");
      }
    }
  }
  if (Array.isArray(result.changed_files) && result.changed_files.some((file) => typeof file !== "string" || file.length === 0)) {
    errors.push("changed_files must contain non-empty strings");
  }
  if (Array.isArray(result.changed_files) && new Set(result.changed_files).size !== result.changed_files.length) {
    errors.push("changed_files must not contain duplicates");
  }
  for (const verification of Array.isArray(result.verification) ? result.verification : []) {
    if (!hasOnlyKeys(verification, ["command", "outcome", "detail"]) || typeof verification.command !== "string" || verification.command.length === 0 || !["passed", "failed", "not_run"].includes(verification.outcome) || typeof verification.detail !== "string" || verification.detail.length === 0) {
      errors.push("verification is invalid");
    }
  }
  if (result.phase === "guard") {
    const kinds = Array.isArray(result.verdicts) ? result.verdicts.map((verdict) => verdict.kind) : [];
    if (result.review_conclusion === "not_applicable") {
      errors.push("guard review_conclusion must be clear, violations, evidence_gaps, or incomplete");
    } else if (result.review_conclusion === "clear" && kinds.length > 0) {
      errors.push("a clear guard review must not contain verdicts");
    } else if (result.review_conclusion === "violations" && !kinds.includes("violation")) {
      errors.push("violations conclusion requires a violation verdict");
    } else if (result.review_conclusion === "evidence_gaps" && (!kinds.includes("evidence_gap") || kinds.includes("violation"))) {
      errors.push("evidence_gaps conclusion requires evidence gaps and no violations");
    } else if (result.review_conclusion === "incomplete" && (result.completion !== "stopped" || kinds.length > 0 || (Array.isArray(result.routes) && result.routes.length > 0))) {
      errors.push("incomplete conclusion requires stopped completion with no verdicts or routes");
    }
  } else if (result.review_conclusion !== "not_applicable" || (Array.isArray(result.verdicts) && result.verdicts.length > 0)) {
    errors.push("non-guard results must use not_applicable with no verdicts");
  }
  return errors;
}

function normalizeRelativePath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//, "");
}

function pathMatches(actual, expected) {
  return normalizeRelativePath(actual) === normalizeRelativePath(expected);
}

function workspacePathInfo(workspace, relative, allowRoot = false) {
  if (typeof relative !== "string" || relative.length === 0 || path.isAbsolute(relative) || /^[A-Za-z]:[\\/]/.test(relative)) {
    return null;
  }
  const normalized = normalizeRelativePath(relative);
  if ((!allowRoot && normalized === ".") || normalized.split("/").includes("..")) {
    return null;
  }
  const absolute = path.resolve(workspace, normalized);
  const root = path.resolve(workspace);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  return { normalized, absolute };
}

function inspectWorkspacePath(workspace, relative, allowRoot = false) {
  const info = workspacePathInfo(workspace, relative, allowRoot);
  if (!info) {
    return { valid: false, exists: false, info: null, stat: null };
  }
  if (info.normalized === ".") {
    return { valid: true, exists: true, info, stat: fs.lstatSync(workspace) };
  }
  let current = path.resolve(workspace);
  for (const segment of info.normalized.split("/")) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat) {
      return { valid: true, exists: false, info, stat: null };
    }
    if (stat.isSymbolicLink()) {
      return { valid: false, exists: true, info, stat };
    }
  }
  return { valid: true, exists: true, info, stat: fs.lstatSync(info.absolute) };
}

function workspaceSymlinks(workspace) {
  const found = [];
  function visit(directory, relative) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (relative === "" && entry.name === ".git") {
        continue;
      }
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) {
        found.push(childRelative);
      } else if (entry.isDirectory()) {
        visit(path.join(directory, entry.name), childRelative);
      }
    }
  }
  visit(workspace, "");
  return found.sort();
}

function runCommand(argv, options = {}) {
  const [command, ...args] = argv;
  const result = childProcess.spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    input: options.input,
    encoding: "utf8",
    timeout: (options.timeoutSeconds || DEFAULT_TIMEOUT_SECONDS) * 1000,
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    argv,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error ? result.error.message : null,
  };
}

function requireSuccess(result, label) {
  if (result.status !== 0) {
    const detail = [result.error, result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    fail(`${label} failed with exit ${result.status}: ${detail}`, 2);
  }
}

function initializeGit(workspace) {
  for (const command of [
    ["git", "init", "-q"],
    ["git", "config", "user.email", "ddd-expert-eval@example.invalid"],
    ["git", "config", "user.name", "ddd-expert-eval"],
    ["git", "add", "-A"],
    ["git", "commit", "-q", "--allow-empty", "-m", "eval baseline"],
  ]) {
    requireSuccess(runCommand(command, { cwd: workspace, timeoutSeconds: 30 }), `${command.join(" ")}`);
  }
  const baseline = runCommand(["git", "rev-parse", "HEAD"], { cwd: workspace, timeoutSeconds: 30 });
  requireSuccess(baseline, "git rev-parse HEAD");
  return baseline.stdout.trim();
}

function changedPaths(workspace, baseline) {
  const tracked = runCommand(["git", "diff", "--name-only", "-z", baseline, "--"], { cwd: workspace, timeoutSeconds: 30 });
  const untracked = runCommand(["git", "ls-files", "--others", "--exclude-standard", "-z"], { cwd: workspace, timeoutSeconds: 30 });
  requireSuccess(tracked, "git diff baseline");
  requireSuccess(untracked, "git ls-files --others");
  return [...new Set([...tracked.stdout.split("\0"), ...untracked.stdout.split("\0")]
    .filter(Boolean)
    .map(normalizeRelativePath))].sort();
}

function assertion(name, passed, detail) {
  return { name, passed: Boolean(passed), detail };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSemanticText(value) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

function isValidSemanticExpectation(value) {
  return normalizeSemanticText(value).split(" ").every((token) =>
    !token.includes("*") || /^[a-z0-9][a-z0-9_-]*\*$/u.test(token)
  );
}

function normalizedSemanticContains(normalizedText, value) {
  const normalizedValue = normalizeSemanticText(value);
  if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(normalizedValue)) {
    return normalizedText.includes(normalizedValue);
  }
  const phrase = normalizedValue
    .split(" ")
    .map((part) => {
      const wordFamily = part.endsWith("*");
      const literal = wordFamily ? part.slice(0, -1) : part;
      const escaped = escapeRegExp(literal);
      return wordFamily ? `${escaped}[\\p{L}\\p{N}_]*` : escaped;
    })
    .join("(?:\\s|[-‐‑‒–—―])+");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${phrase}(?=$|[^\\p{L}\\p{N}_])`, "u").test(normalizedText);
}

function scoreResult(loadedCase, result, workspace, options = {}) {
  const { config } = loadedCase;
  const expect = config.expect;
  const baseline = options.baseline || runCommand(["git", "rev-parse", "HEAD"], { cwd: workspace, timeoutSeconds: 30 }).stdout.trim();
  const executeCheck = options.executeCheck || ((check) => runCommand(check.argv, { cwd: workspace, timeoutSeconds: check.timeout_seconds }));
  const assertions = [];
  const shapeErrors = validateResultShape(result);
  assertions.push(assertion("result schema", shapeErrors.length === 0, shapeErrors.join("; ") || "valid"));
  if (shapeErrors.length > 0) {
    return { passed: false, assertions, changedPaths: changedPaths(workspace, baseline), checks: [] };
  }

  assertions.push(assertion("scenario id", result.scenario_id === config.id, `got ${result.scenario_id}`));
  assertions.push(assertion("phase", result.phase === config.phase, `got ${result.phase}`));
  assertions.push(assertion("completion", expect.completion.includes(result.completion), `got ${result.completion}`));
  assertions.push(assertion("review conclusion", expect.review_conclusion.includes(result.review_conclusion), `got ${result.review_conclusion}`));
  const symlinks = workspaceSymlinks(workspace);
  assertions.push(assertion("workspace contains no symlinks", symlinks.length === 0, symlinks.join(",") || "none"));
  assertions.push(assertion(
    "question count",
    result.questions.length >= expect.questions.min && result.questions.length <= expect.questions.max,
    `got ${result.questions.length}, expected ${expect.questions.min}..${expect.questions.max}`,
  ));
  const firstQuestion = result.questions[0] || "";
  const normalizedFirstQuestion = normalizeSemanticText(firstQuestion);
  for (const needle of expect.questions.contains || []) {
    assertions.push(assertion(
      `first question contains ${needle}`,
      normalizedSemanticContains(normalizedFirstQuestion, needle),
      `got ${firstQuestion || "(none)"}`,
    ));
  }
  for (const group of expect.questions.contains_any || []) {
    assertions.push(assertion(
      `first question contains any of ${group.join(" | ")}`,
      group.some((needle) => normalizedSemanticContains(normalizedFirstQuestion, needle)),
      `got ${firstQuestion || "(none)"}`,
    ));
  }
  for (const needle of expect.questions.excludes || []) {
    assertions.push(assertion(
      `first question excludes ${needle}`,
      !normalizedSemanticContains(normalizedFirstQuestion, needle),
      `got ${firstQuestion || "(none)"}`,
    ));
  }

  const routeTargets = result.routes.map((route) => route.target);
  for (const target of expect.routes.contains) {
    assertions.push(assertion(`route contains ${target}`, routeTargets.includes(target), `got ${routeTargets.join(",") || "none"}`));
  }
  for (const target of expect.routes.excludes) {
    assertions.push(assertion(`route excludes ${target}`, !routeTargets.includes(target), `got ${routeTargets.join(",") || "none"}`));
  }

  for (const verdict of result.verdicts) {
    for (const evidence of verdict.evidence) {
      const inspected = inspectWorkspacePath(workspace, evidence.path, true);
      assertions.push(assertion(
        `evidence path ${evidence.path}`,
        inspected.valid && inspected.exists,
        inspected.valid && inspected.exists ? "exists in workspace" : "must be a non-symlink workspace-relative existing path",
      ));
      if (inspected.valid && inspected.exists && evidence.line !== null) {
        const isFile = inspected.stat.isFile();
        const lineCount = isFile ? fs.readFileSync(inspected.info.absolute, "utf8").split(/\r?\n/).length : 0;
        assertions.push(assertion(
          `evidence line ${evidence.path}:${evidence.line}`,
          isFile && evidence.line <= lineCount,
          isFile ? `file has ${lineCount} lines` : "evidence line requires a file",
        ));
      }
    }
  }

  for (const expectedVerdict of expect.verdicts) {
    const expectedFamilies = expectedVerdict.family ? [expectedVerdict.family] : expectedVerdict.families_any;
    const candidates = result.verdicts.filter((verdict) => verdict.kind === expectedVerdict.kind && expectedFamilies.includes(verdict.family));
    const matching = candidates.find((candidate) => expectedVerdict.evidence_paths.every((expectedPath) =>
      candidate.evidence.some((evidence) => pathMatches(evidence.path, expectedPath))
    ));
    assertions.push(assertion(
      `verdict ${expectedVerdict.kind}/${expectedFamilies.join("|")}`,
      Boolean(matching),
      matching ? "matched" : `no matching verdict with evidence ${expectedVerdict.evidence_paths.join(",") || "(none required)"}`,
    ));
  }
  for (const forbidden of expect.forbid_verdicts) {
    assertions.push(assertion(
      `forbid verdict ${forbidden}`,
      !result.verdicts.some((verdict) => verdict.kind === forbidden),
      `got ${result.verdicts.map((verdict) => verdict.kind).join(",") || "none"}`,
    ));
  }

  const actualChanged = changedPaths(workspace, baseline);
  assertions.push(assertion(
    "git change expectation",
    expect.git.changed === "none" ? actualChanged.length === 0 : actualChanged.length > 0,
    `changed ${actualChanged.join(",") || "none"}`,
  ));
  for (const requiredPath of expect.git.required_paths) {
    assertions.push(assertion(
      `git changed ${requiredPath}`,
      actualChanged.some((actual) => pathMatches(actual, requiredPath)),
      `changed ${actualChanged.join(",") || "none"}`,
    ));
  }
  for (const forbiddenPath of expect.git.forbidden_paths) {
    assertions.push(assertion(
      `git did not change ${forbiddenPath}`,
      !actualChanged.some((actual) => pathMatches(actual, forbiddenPath)),
      `changed ${actualChanged.join(",") || "none"}`,
    ));
  }
  const reportedInfos = result.changed_files.map((file) => workspacePathInfo(workspace, file));
  const reportedChanged = reportedInfos.filter(Boolean).map((info) => info.normalized).sort();
  assertions.push(assertion(
    "changed file paths are relative",
    reportedInfos.every(Boolean),
    `reported ${result.changed_files.join(",") || "none"}`,
  ));
  assertions.push(assertion(
    "changed files reported",
    actualChanged.length === reportedChanged.length && actualChanged.every((actual, index) => actual === reportedChanged[index]),
    `actual ${actualChanged.join(",") || "none"}; reported ${reportedChanged.join(",") || "none"}`,
  ));

  for (const fileExpectation of expect.files) {
    const inspected = inspectWorkspacePath(workspace, fileExpectation.path);
    assertions.push(assertion(`file ${fileExpectation.path} path is safe`, inspected.valid, inspected.valid ? "safe" : "invalid or symlinked path"));
    const exists = inspected.valid && inspected.exists && inspected.stat.isFile();
    assertions.push(assertion(`file ${fileExpectation.path} exists=${fileExpectation.exists}`, exists === fileExpectation.exists, `exists=${exists}`));
    if (!exists) {
      continue;
    }
    const content = fs.readFileSync(inspected.info.absolute, "utf8");
    for (const needle of fileExpectation.contains) {
      assertions.push(assertion(`file ${fileExpectation.path} contains ${needle}`, content.includes(needle), "content check"));
    }
    for (const needle of fileExpectation.excludes) {
      assertions.push(assertion(`file ${fileExpectation.path} excludes ${needle}`, !content.includes(needle), "content check"));
    }
    for (const word of fileExpectation.contains_words || []) {
      assertions.push(assertion(`file ${fileExpectation.path} contains word ${word}`, new RegExp(`\\b${escapeRegExp(word)}\\b`).test(content), "word check"));
    }
    for (const word of fileExpectation.excludes_words || []) {
      assertions.push(assertion(`file ${fileExpectation.path} excludes word ${word}`, !new RegExp(`\\b${escapeRegExp(word)}\\b`).test(content), "word check"));
    }
  }

  const checks = [];
  for (const check of expect.checks) {
    const executed = executeCheck(check);
    checks.push(executed);
    assertions.push(assertion(
      `check ${check.argv.join(" ")}`,
      executed.status === check.exit,
      `exit=${executed.status}; ${[executed.stderr, executed.stdout].filter(Boolean).join("\n").trim().slice(-2000)}`,
    ));
  }

  return {
    passed: assertions.every((item) => item.passed),
    assertions,
    changedPaths: actualChanged,
    checks,
  };
}

function buildPrompt(loadedCase) {
  const scenario = fs.readFileSync(loadedCase.promptPath, "utf8").trim();
  return [
    `$ddd-expert:${loadedCase.config.phase}`,
    "",
    "Use the named skill and work only in the current workspace.",
    "Do not read files outside the workspace except the installed skill and its references.",
    "Follow the skill normally, including edits or verification when the scenario calls for them.",
    "Your final response must conform to the supplied JSON schema.",
    `Set scenario_id to ${loadedCase.config.id} and phase to ${loadedCase.config.phase}.`,
    `Set review_conclusion to ${loadedCase.config.phase === "guard" ? "clear, violations, evidence_gaps, or incomplete when required workers cannot complete" : "not_applicable"}.`,
    "Use questions only for questions that must be answered before work can continue.",
    "Use routes only for an explicit phase handoff required by the named skill.",
    "For guard, classify each violation or evidence gap with the closest schema-defined family.",
    "Report only workspace-relative evidence and changed-file paths.",
    "",
    "Scenario:",
    scenario,
  ].join("\n");
}

function parsePluginList(result, label) {
  requireSuccess(result, label);
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    fail(`${label} returned invalid JSON: ${error.message}`, 2);
  }
  const enabled = Array.isArray(parsed.installed) ? parsed.installed.filter((plugin) => plugin.installed && plugin.enabled) : [];
  if (enabled.length !== 1 || enabled[0].pluginId !== "ddd-expert@skill-workshop-codex") {
    fail(`${label} expected only ddd-expert to be enabled; got ${enabled.map((plugin) => plugin.pluginId).join(", ") || "none"}`, 2);
  }
  return enabled[0];
}

function snapshotMarketplace(runtimeRoot) {
  const marketplaceRoot = path.join(runtimeRoot, "marketplace");
  const manifestSource = readJson(path.join(ROOT, ".agents", "plugins", "marketplace.json"));
  const dddPlugin = manifestSource.plugins.find((plugin) => plugin.name === "ddd-expert");
  if (!dddPlugin) {
    fail("ddd-expert is missing from the Codex marketplace manifest", 2);
  }
  const manifestPath = path.join(marketplaceRoot, ".agents", "plugins", "marketplace.json");
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify({ ...manifestSource, plugins: [dddPlugin] }, null, 2)}\n`);
  fs.cpSync(PLUGIN_ROOT, path.join(marketplaceRoot, "codex-plugins", "ddd-expert"), { recursive: true });
  return marketplaceRoot;
}

function installCodexPlugin(tempRoot, codexBin, marketplaceRoot, expectedPluginHash) {
  const codexHome = path.join(tempRoot, "codex-home");
  fs.mkdirSync(codexHome, { recursive: true });
  const sourceHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const sourceAuth = path.join(sourceHome, "auth.json");
  if (!fs.statSync(sourceAuth, { throwIfNoEntry: false })?.isFile()) {
    fail(`Codex auth not found at ${sourceAuth}; run codex login first`, 2);
  }
  fs.copyFileSync(sourceAuth, path.join(codexHome, "auth.json"));
  fs.chmodSync(path.join(codexHome, "auth.json"), 0o600);
  const env = { ...process.env, CODEX_HOME: codexHome };
  requireSuccess(
    runCommand([codexBin, "plugin", "marketplace", "add", marketplaceRoot, "--json"], { env, timeoutSeconds: 60 }),
    "codex plugin marketplace add",
  );
  requireSuccess(
    runCommand([codexBin, "plugin", "add", "ddd-expert@skill-workshop-codex", "--json"], { env, timeoutSeconds: 60 }),
    "codex plugin add",
  );
  const plugin = parsePluginList(
    runCommand([codexBin, "plugin", "list", "--json"], { env, timeoutSeconds: 60 }),
    "codex plugin list",
  );
  const pluginCache = path.join(codexHome, "plugins", "cache", plugin.marketplaceName, plugin.name, plugin.version);
  if (!fs.statSync(pluginCache, { throwIfNoEntry: false })?.isDirectory()) {
    fail(`installed ddd-expert cache not found: ${pluginCache}`, 2);
  }
  const installedHash = hashTree(pluginCache);
  if (installedHash !== expectedPluginHash) {
    fail(`installed ddd-expert hash ${installedHash} does not match checkout ${expectedPluginHash}`, 2);
  }
  return {
    codexHome,
    env,
    pluginVersion: plugin.version,
    pluginCache,
    pluginCacheRelative: path.relative(codexHome, pluginCache),
    pluginHash: installedHash,
    marketplaceRoot,
  };
}

function ensureContainerImage(image) {
  if (image === DEFAULT_CONTAINER_IMAGE) {
    requireSuccess(
      runCommand(["docker", "build", "-t", image, "-f", CONTAINER_FILE, EVAL_ROOT], { timeoutSeconds: 600 }),
      `docker build ${image}`,
    );
  } else {
    requireSuccess(runCommand(["docker", "image", "inspect", image], { timeoutSeconds: 30 }), `docker image inspect ${image}`);
  }
  const id = runCommand(["docker", "image", "inspect", image, "--format", "{{.Id}}"], { timeoutSeconds: 30 });
  requireSuccess(id, `docker image inspect ${image}`);
  return id.stdout.trim();
}

function snapshotCases(cases, runtimeRoot) {
  const snapshotRoot = path.join(runtimeRoot, "eval-snapshot");
  const snapshotCasesRoot = path.join(snapshotRoot, "cases");
  fs.mkdirSync(snapshotCasesRoot, { recursive: true });
  const resultSchema = path.join(snapshotRoot, "result.schema.json");
  fs.copyFileSync(RESULT_SCHEMA, resultSchema);
  const loadedCases = cases.map((loadedCase) => {
    const caseDir = path.join(snapshotCasesRoot, loadedCase.config.id);
    fs.cpSync(loadedCase.caseDir, caseDir, { recursive: true });
    return validateCase(caseDir, readJson(path.join(caseDir, "case.json")));
  });
  return { loadedCases, resultSchema, hash: hashTree(snapshotRoot) };
}

function runContainerCheck(check, workspace, context) {
  const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
  const gid = typeof process.getgid === "function" ? process.getgid() : 1000;
  return runCommand([
    "docker", "run", "--rm", "--network", "none", "--read-only",
    "--tmpfs", "/tmp:rw,exec,nosuid,nodev,size=256m",
    "--cap-drop=ALL", "--security-opt", "no-new-privileges",
    "--user", `${uid}:${gid}`,
    "-e", "HOME=/tmp/eval-home", "-e", "GOCACHE=/tmp/go-build",
    "-v", `${workspace}:/workspace:rw`, "-w", "/workspace",
    context.containerImage, ...check.argv,
  ], { timeoutSeconds: check.timeout_seconds });
}

function runTrial(loadedCase, trialNumber, infrastructureAttempt, context) {
  const retrySuffix = infrastructureAttempt === 1 ? "" : `-infra-${infrastructureAttempt}`;
  const trialName = `${loadedCase.config.id}-run-${trialNumber}${retrySuffix}`;
  const trialRoot = path.join(context.outputDir, "trials", trialName);
  const workspace = path.join(trialRoot, "workspace");
  const modelOutput = path.join(trialRoot, "model-output");
  const trialCodexHome = path.join(context.runtimeRoot, "trial-homes", trialName);
  fs.mkdirSync(trialRoot, { recursive: true });
  fs.mkdirSync(modelOutput, { recursive: true });
  fs.cpSync(context.codexHome, trialCodexHome, { recursive: true });
  fs.cpSync(loadedCase.workspacePath, workspace, { recursive: true });
  const baseline = initializeGit(workspace);
  const trialPluginCache = path.join(trialCodexHome, context.pluginCacheRelative);
  const authFile = path.join(trialCodexHome, "auth.json");

  const resultFile = path.join(modelOutput, "result.json");
  // Collaboration resolves child workers through the registered root thread.
  // The disposable per-trial CODEX_HOME provides isolation without --ephemeral.
  const codexArgs = [
    "exec",
    "--ignore-rules",
    "--output-schema",
    "/eval/result.schema.json",
    "--json",
    "-o",
    "/artifacts/result.json",
    "--skip-git-repo-check",
    "-C",
    "/workspace",
  ];
  if (context.model) {
    codexArgs.push("-m", context.model);
  }
  if (context.reasoning) {
    codexArgs.push("-c", `model_reasoning_effort=\"${context.reasoning}\"`);
  }
  codexArgs.push("-");

  const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
  const gid = typeof process.getgid === "function" ? process.getgid() : 1000;
  const workspaceMode = loadedCase.config.sandbox === "read-only" ? "ro" : "rw";
  const containerPluginCache = `/eval-home/${context.pluginCacheRelative.split(path.sep).join("/")}`;
  const executionArgs = [
    "docker", "run", "--rm", "-i", "--read-only",
    "--tmpfs", "/tmp:rw,exec,nosuid,nodev,size=256m",
    "--cap-drop=ALL", "--security-opt", "no-new-privileges",
    "--user", `${uid}:${gid}`,
    "-e", "HOME=/eval-home", "-e", "CODEX_HOME=/eval-home",
    "-v", `${trialCodexHome}:/eval-home:rw`,
    "-v", `${authFile}:/eval-home/auth.json:ro`,
    "-v", `${trialPluginCache}:${containerPluginCache}:ro`,
    "-v", `${context.marketplaceRoot}:${context.marketplaceRoot}:ro`,
    "-v", `${workspace}:/workspace:${workspaceMode}`,
    "-v", `${modelOutput}:/artifacts:rw`,
    "-v", `${context.resultSchema}:/eval/result.schema.json:ro`,
    "-v", `${context.codexBinary}:/usr/local/bin/codex:ro`,
    "-w", "/workspace", context.containerImage, "/usr/local/bin/codex",
    ...codexArgs.slice(0, 1), "--dangerously-bypass-approvals-and-sandbox", ...codexArgs.slice(1),
  ];

  const startedAt = Date.now();
  const prompt = buildPrompt(loadedCase);
  fs.writeFileSync(path.join(trialRoot, "prompt.txt"), `${prompt}\n`);
  const execution = runCommand(executionArgs, {
    env: process.env,
    input: prompt,
    timeoutSeconds: context.timeoutSeconds,
  });
  fs.writeFileSync(path.join(trialRoot, "trace.jsonl"), execution.stdout);
  fs.writeFileSync(path.join(trialRoot, "stderr.log"), execution.stderr);

  let parsed = null;
  let parseError = null;
  if (fs.statSync(resultFile, { throwIfNoEntry: false })?.isFile()) {
    try {
      parsed = readJson(resultFile);
    } catch (error) {
      parseError = error.message;
    }
  } else {
    parseError = "Codex did not write result.json";
  }

  const pluginReadObserved = /\/ddd-expert\/[^/\s]+\/(?:skills|references)\//.test(execution.stdout);
  const pluginUnchanged = hashTree(trialPluginCache) === context.pluginHash;
  const infrastructureFailure = execution.status !== 0 || !parsed || !pluginUnchanged;
  let grade;
  if (infrastructureFailure) {
    const reasons = [
      execution.status !== 0 ? `exit=${execution.status}; signal=${execution.signal}` : null,
      !parsed ? execution.error || parseError || "missing structured result" : null,
      !pluginUnchanged ? "installed ddd-expert cache changed during the trial" : null,
    ].filter(Boolean);
    grade = {
      passed: false,
      assertions: [assertion(
        "valid model trial",
        false,
        `${reasons.join("; ")}; ${[execution.stderr, execution.stdout].filter(Boolean).join("\n").slice(-1200)}`,
      )],
      changedPaths: changedPaths(workspace, baseline),
      checks: [],
    };
  } else {
    grade = scoreResult(loadedCase, parsed, workspace, {
      baseline,
      executeCheck: (check) => runContainerCheck(check, workspace, context),
    });
  }

  return {
    scenarioId: loadedCase.config.id,
    trial: trialNumber,
    infrastructureAttempt,
    infrastructureFailure,
    passed: grade.passed,
    durationMs: Date.now() - startedAt,
    execution: {
      exit: execution.status,
      signal: execution.signal,
      error: execution.error,
      explicitSkill: `ddd-expert:${loadedCase.config.phase}`,
      pluginReadObserved,
      pluginUnchanged,
    },
    result: parsed,
    grade,
    artifactPath: trialRoot,
  };
}

function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const options = {
    command,
    suite: "smoke",
    caseIds: [],
    runs: null,
    model: process.env.DDD_EVAL_MODEL || "",
    reasoning: process.env.DDD_EVAL_REASONING || "",
    timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
    infrastructureRetries: DEFAULT_INFRA_RETRIES,
    output: "",
    containerImage: process.env.DDD_EVAL_CONTAINER_IMAGE || DEFAULT_CONTAINER_IMAGE,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const take = () => {
      index += 1;
      if (index >= rest.length) {
        fail(`missing value for ${arg}`, 2);
      }
      return rest[index];
    };
    if (arg === "--suite") {
      options.suite = take();
    } else if (arg === "--case") {
      options.caseIds.push(take());
    } else if (arg === "--runs") {
      options.runs = Number.parseInt(take(), 10);
    } else if (arg === "--model") {
      options.model = take();
    } else if (arg === "--reasoning") {
      options.reasoning = take();
    } else if (arg === "--timeout") {
      options.timeoutSeconds = Number.parseInt(take(), 10);
    } else if (arg === "--infra-retries") {
      options.infrastructureRetries = Number.parseInt(take(), 10);
    } else if (arg === "--output") {
      options.output = take();
    } else if (arg === "--container-image") {
      options.containerImage = take();
    } else {
      fail(`unknown argument ${arg}`, 2);
    }
  }
  if (!["smoke", "full"].includes(options.suite)) {
    fail("--suite must be smoke or full", 2);
  }
  if (options.runs !== null && (!Number.isInteger(options.runs) || options.runs < 1)) {
    fail("--runs must be a positive integer", 2);
  }
  if (!Number.isInteger(options.timeoutSeconds) || options.timeoutSeconds < 1) {
    fail("--timeout must be a positive integer", 2);
  }
  if (!Number.isInteger(options.infrastructureRetries) || options.infrastructureRetries < 0) {
    fail("--infra-retries must be a non-negative integer", 2);
  }
  if (options.reasoning && !["low", "medium", "high", "xhigh"].includes(options.reasoning)) {
    fail("--reasoning must be low, medium, high, or xhigh", 2);
  }
  return options;
}

function validateCommand() {
  readJson(RESULT_SCHEMA);
  const cases = loadCases();
  const phaseCounts = Object.fromEntries(["explore", "shape", "codify", "guard"].map((phase) => [phase, 0]));
  for (const loadedCase of cases) {
    phaseCounts[loadedCase.config.phase] += 1;
  }
  for (const [phase, count] of Object.entries(phaseCounts)) {
    if (count < 2) {
      fail(`expected at least two ${phase} cases, found ${count}`, 2);
    }
  }
  console.log(`ddd-expert evals valid: ${cases.length} cases (${Object.entries(phaseCounts).map(([phase, count]) => `${phase}=${count}`).join(", ")})`);
}

function selfTestCommand() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ddd-expert-scorer-"));
  try {
    if (!RESULT_COMPLETIONS.includes("checkpointed")) {
      fail("result schema rejected the checkpointed Explore completion", 2);
    }
    const workspace = path.join(tempRoot, "workspace");
    fs.mkdirSync(path.join(workspace, "internal"), { recursive: true });
    fs.writeFileSync(path.join(workspace, "internal", "repository.go"), "package internal\n");
    fs.writeFileSync(path.join(workspace, "domain.md"), "Temporary inconsistency is acceptable.\n");
    const baseline = initializeGit(workspace);
    const loadedCase = {
      caseDir: tempRoot,
      workspacePath: workspace,
      config: {
        id: "self-test",
        phase: "guard",
        expect: {
          completion: ["completed"],
          review_conclusion: ["violations"],
          questions: { min: 0, max: 0 },
          routes: { contains: ["codify"], excludes: ["shape"] },
          verdicts: [{ kind: "violation", family: "aggregate_boundary", evidence_paths: ["internal/repository.go"] }],
          forbid_verdicts: ["evidence_gap"],
          git: { changed: "none", required_paths: [], forbidden_paths: [] },
          files: [{ path: "domain.md", exists: true, contains: [], excludes: [], excludes_words: ["table"] }],
          checks: [],
        },
      },
    };
    const good = {
      scenario_id: "self-test",
      phase: "guard",
      completion: "completed",
      review_conclusion: "violations",
      questions: [],
      routes: [{ target: "codify", reason: "repair the implementation" }],
      verdicts: [{
        kind: "violation",
        family: "aggregate_boundary",
        summary: "repository crosses accepted aggregate boundaries",
        evidence: [{ path: "internal/repository.go", line: 1, detail: "combined save" }],
      }],
      changed_files: [],
      verification: [],
    };
    const scoreOptions = { baseline };
    const goodGrade = scoreResult(loadedCase, good, workspace, scoreOptions);
    if (!goodGrade.passed) {
      fail(`scorer rejected passing result: ${JSON.stringify(goodGrade.assertions)}`, 2);
    }
    const invalidCompletionCaseDir = path.join(tempRoot, "guard-checkpointed");
    fs.mkdirSync(path.join(invalidCompletionCaseDir, "workspace"), { recursive: true });
    fs.writeFileSync(path.join(invalidCompletionCaseDir, "prompt.md"), "Guard the implementation.\n");
    let rejectedInvalidCompletionCase = false;
    try {
      validateCase(invalidCompletionCaseDir, {
        id: "guard-checkpointed",
        phase: "guard",
        suites: ["smoke"],
        sandbox: "read-only",
        prompt: "prompt.md",
        workspace: "workspace",
        expect: { ...loadedCase.config.expect, completion: ["checkpointed"] },
      });
    } catch (error) {
      rejectedInvalidCompletionCase = error.exitCode === 2 && error.message.includes("checkpointed completion is valid only for Explore");
    }
    if (!rejectedInvalidCompletionCase) {
      fail("case validator accepted checkpointed outside Explore", 2);
    }
    if (validateResultShape({ ...good, completion: "checkpointed" }).length === 0) {
      fail("result validator accepted checkpointed outside Explore", 2);
    }
    const wrongFamily = {
      ...good,
      verdicts: [{ ...good.verdicts[0], family: "layer_boundary", summary: "tabs instead of spaces" }],
    };
    if (scoreResult(loadedCase, wrongFamily, workspace, scoreOptions).passed) {
      fail("scorer accepted a verdict from the wrong reason family", 2);
    }
    const alternativeFamilyCase = {
      ...loadedCase,
      config: {
        ...loadedCase.config,
        expect: {
          ...loadedCase.config.expect,
          verdicts: [{ kind: "violation", families_any: ["aggregate_boundary", "repository_shape"], evidence_paths: ["internal/repository.go"] }],
        },
      },
    };
    const alternativeFamilyResult = {
      ...good,
      verdicts: [{ ...good.verdicts[0], family: "repository_shape" }],
    };
    if (!scoreResult(alternativeFamilyCase, alternativeFamilyResult, workspace, scoreOptions).passed) {
      fail("scorer rejected a declared equivalent reason family", 2);
    }
    if (scoreResult(alternativeFamilyCase, wrongFamily, workspace, scoreOptions).passed) {
      fail("scorer accepted a reason family outside the declared alternatives", 2);
    }
    const invalidLine = {
      ...good,
      verdicts: [{ ...good.verdicts[0], evidence: [{ ...good.verdicts[0].evidence[0], line: 9999 }] }],
    };
    if (scoreResult(loadedCase, invalidLine, workspace, scoreOptions).passed) {
      fail("scorer accepted evidence outside the source file", 2);
    }
    const extraReportedFile = { ...good, changed_files: ["not-created.go"] };
    if (scoreResult(loadedCase, extraReportedFile, workspace, scoreOptions).passed) {
      fail("scorer accepted an unobserved reported file", 2);
    }
    const exploreCase = {
      ...loadedCase,
      config: {
        ...loadedCase.config,
        phase: "explore",
        expect: {
          ...loadedCase.config.expect,
          review_conclusion: ["not_applicable"],
          questions: {
            min: 1,
            max: 1,
            contains: ["authority"],
            contains_any: [["payment", "支付"], ["captured", "settled"]],
            excludes: ["order"],
          },
          routes: { contains: [], excludes: ["shape"] },
          verdicts: [],
          forbid_verdicts: ["violation", "evidence_gap"],
        },
      },
    };
    const goodExplore = {
      ...good,
      phase: "explore",
      review_conclusion: "not_applicable",
      questions: ["Which Ｐａｙｍｅｎｔ\nauthority distinguishes CAPTURED from authorized or settled states?"],
      routes: [],
      verdicts: [],
    };
    const requireExploreGrade = (caseToScore, resultToScore, expected, message) => {
      const grade = scoreResult(caseToScore, resultToScore, workspace, scoreOptions);
      if (grade.passed !== expected) {
        fail(`${message}: ${JSON.stringify(grade.assertions)}`, 2);
      }
    };
    requireExploreGrade(exploreCase, goodExplore, true, "scorer rejected a normalized semantic first question");
    for (const [text, pattern] of [
      ["Who owns each confirmation fact?", "own*"],
      ["Which authority accepts the published fact?", "accept*"],
      ["How many bounded-contexts are implied?", "how many bounded context*"],
      ["Which API-call carries the fact?", "api call"],
    ]) {
      if (!normalizedSemanticContains(normalizeSemanticText(text), pattern)) {
        fail(`semantic question matcher rejected ${pattern} in ${text}`, 2);
      }
    }
    if (!isValidSemanticExpectation("own*") || isValidSemanticExpectation("o*n")) {
      fail("semantic question matcher accepted an invalid word-family pattern", 2);
    }
    if (normalizedSemanticContains(normalizeSemanticText("Are these confirmed facts in the same downstream system?"), "own*")) {
      fail("semantic question matcher treated own as a substring of downstream", 2);
    }
    const checkpointedExplore = { ...goodExplore, completion: "checkpointed" };
    if (validateResultShape(checkpointedExplore).length > 0) {
      fail("result validator rejected a checkpointed Explore result", 2);
    }
    const checkpointedExploreCase = {
      ...exploreCase,
      config: {
        ...exploreCase.config,
        expect: { ...exploreCase.config.expect, completion: ["checkpointed"] },
      },
    };
    requireExploreGrade(checkpointedExploreCase, checkpointedExplore, true, "scorer rejected a checkpointed Explore result");
    for (const [message, question] of [
      ["scorer accepted a first question from the wrong bounded context", "How should the Order react after payment succeeds?"],
      ["scorer accepted a downstream-first question with upstream terms", "After Payment authority reports Captured, what makes Order ready for fulfillment?"],
      ["scorer ignored a required semantic term", "Which Payment decision distinguishes captured from settled states?"],
      ["scorer ignored an alternative group", "Which Payment authority defines an authorized state?"],
      ["scorer ignored a forbidden semantic term", "Which Payment authority distinguishes captured states for Order?"],
    ]) {
      requireExploreGrade(exploreCase, { ...goodExplore, questions: [question] }, false, message);
    }
    const relationshipQuestionCase = {
      ...exploreCase,
      config: {
        ...exploreCase.config,
        expect: {
          ...exploreCase.config.expect,
          questions: {
            min: 1,
            max: 1,
            contains_any: [["registration"], ["delivery"], ["authorit*", "own*", "sufficient", "publish*", "translate*"]],
            excludes: ["accept* attendance"],
          },
        },
      },
    };
    requireExploreGrade(
      relationshipQuestionCase,
      { ...goodExplore, questions: ["When does Delivery record attendance after Registration evidence arrives?"] },
      false,
      "scorer accepted a local lifecycle question that skipped relationship authority",
    );
    requireExploreGrade(
      relationshipQuestionCase,
      { ...goodExplore, questions: ["Should Delivery accept attendance for a Registration seat?"] },
      false,
      "scorer accepted a local attendance question as relationship discovery",
    );
    const boundaryQuestionCase = {
      ...exploreCase,
      config: {
        ...exploreCase.config,
        expect: {
          ...exploreCase.config.expect,
          questions: {
            min: 1,
            max: 1,
            contains_any: [["confirm*"], ["authorit*", "own*", "decid*"], ["different", "separate", "each"], ["workshop", "program"], ["seat", "registration"]],
            excludes: [],
          },
        },
      },
    };
    requireExploreGrade(
      boundaryQuestionCase,
      { ...goodExplore, questions: ["Should each confirmed seat use a different allocation decision?"] },
      false,
      "scorer accepted one local responsibility as topology discovery",
    );
    const lateSemanticMatchCase = {
      ...exploreCase,
      config: {
        ...exploreCase.config,
        expect: {
          ...exploreCase.config.expect,
          questions: { ...exploreCase.config.expect.questions, max: 2 },
        },
      },
    };
    const lateSemanticMatch = {
      ...goodExplore,
      questions: [
        "How should Order react after payment succeeds?",
        "Which Payment authority distinguishes captured from settled states?",
      ],
    };
    requireExploreGrade(lateSemanticMatchCase, lateSemanticMatch, false, "scorer accepted a semantic match after the first question");
    const incomplete = {
      ...good,
      completion: "stopped",
      review_conclusion: "incomplete",
      routes: [],
      verdicts: [],
    };
    if (validateResultShape(incomplete).length > 0) {
      fail("result validator rejected a stopped Guard execution", 2);
    }
    const routedIncomplete = {
      ...incomplete,
      routes: [{ target: "codify", reason: "worker failed" }],
    };
    if (validateResultShape(routedIncomplete).length === 0) {
      fail("result validator accepted a phase route from an incomplete Guard execution", 2);
    }
    const malformedIncomplete = { ...incomplete, routes: null };
    if (validateResultShape(malformedIncomplete).length === 0) {
      fail("result validator accepted malformed routes on an incomplete Guard execution", 2);
    }
    fs.writeFileSync(path.join(workspace, "internal", "repository.go"), "package broken\n");
    fs.writeFileSync(path.join(workspace, "domain.md"), "A table was selected.\n");
    const dirtyGrade = scoreResult(loadedCase, good, workspace, scoreOptions);
    if (dirtyGrade.passed) {
      fail("scorer accepted an unexpected workspace edit", 2);
    }
    const wordAssertion = dirtyGrade.assertions.find((item) => item.name === "file domain.md excludes word table");
    if (!wordAssertion || wordAssertion.passed) {
      fail("word-boundary assertion did not detect a standalone forbidden word", 2);
    }
    console.log("ddd-expert eval scorer self-test passed");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function doctorCommand(options) {
  loadCases();
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ddd-expert-doctor-"));
  try {
    const codexBinary = resolveExecutable(process.env.CODEX_BIN || "codex");
    const codexVersion = runCommand([codexBinary, "--version"], { timeoutSeconds: 30 });
    requireSuccess(codexVersion, "codex --version");
    const imageId = ensureContainerImage(options.containerImage);
    for (const command of [["go", "version"], ["git", "--version"], ["rg", "--version"]]) {
      requireSuccess(
        runCommand(["docker", "run", "--rm", "--network", "none", options.containerImage, ...command], { timeoutSeconds: 30 }),
        `container ${command.join(" ")}`,
      );
    }
    const expectedHash = hashTree(PLUGIN_ROOT);
    const marketplaceRoot = snapshotMarketplace(runtimeRoot);
    const installed = installCodexPlugin(runtimeRoot, codexBinary, marketplaceRoot, expectedHash);
    const doctorHome = path.join(runtimeRoot, "doctor-home");
    fs.cpSync(installed.codexHome, doctorHome, { recursive: true });
    const doctorPluginCache = path.join(doctorHome, installed.pluginCacheRelative);
    const containerPluginCache = `/eval-home/${installed.pluginCacheRelative.split(path.sep).join("/")}`;
    const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
    const gid = typeof process.getgid === "function" ? process.getgid() : 1000;
    const inContainer = runCommand([
      "docker", "run", "--rm", "--read-only",
      "--tmpfs", "/tmp:rw,exec,nosuid,nodev,size=64m",
      "--cap-drop=ALL", "--security-opt", "no-new-privileges",
      "--user", `${uid}:${gid}`,
      "-e", "HOME=/eval-home", "-e", "CODEX_HOME=/eval-home",
      "-v", `${doctorHome}:/eval-home:rw`,
      "-v", `${path.join(doctorHome, "auth.json")}:/eval-home/auth.json:ro`,
      "-v", `${doctorPluginCache}:${containerPluginCache}:ro`,
      "-v", `${marketplaceRoot}:${marketplaceRoot}:ro`,
      "-v", `${codexBinary}:/usr/local/bin/codex:ro`,
      options.containerImage, "/usr/local/bin/codex", "plugin", "list", "--json",
    ], { timeoutSeconds: 60 });
    parsePluginList(inContainer, "container codex plugin list");
    if (hashTree(doctorPluginCache) !== expectedHash) {
      fail("container doctor observed a changed ddd-expert cache", 2);
    }
    console.log(`ddd-expert eval doctor passed: ${codexVersion.stdout.trim()}, image=${imageId}, plugin=${installed.pluginVersion}, sha256=${expectedHash}`);
  } finally {
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
  }
}

function runCommandMain(options) {
  const allCases = loadCases();
  let selected = allCases.filter((loadedCase) => loadedCase.config.suites.includes(options.suite));
  if (options.caseIds.length > 0) {
    const requested = new Set(options.caseIds);
    selected = allCases.filter((loadedCase) => requested.has(loadedCase.config.id));
    const missing = options.caseIds.filter((id) => !selected.some((loadedCase) => loadedCase.config.id === id));
    if (missing.length > 0) {
      fail(`unknown case(s): ${missing.join(", ")}`, 2);
    }
  }
  if (selected.length === 0) {
    fail("no cases selected", 2);
  }

  const runs = options.runs || (options.suite === "full" ? 3 : 1);
  if (!options.model) {
    fail("runs require --model or DDD_EVAL_MODEL so results remain comparable", 2);
  }
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const outputDir = path.resolve(options.output || path.join(os.tmpdir(), "ddd-expert-evals", timestamp));
  if (fs.statSync(outputDir, { throwIfNoEntry: false }) && fs.readdirSync(outputDir).length > 0) {
    fail(`output directory is not empty: ${outputDir}`, 2);
  }
  fs.mkdirSync(outputDir, { recursive: true });
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ddd-expert-runtime-"));
  const pluginFingerprint = hashTree(PLUGIN_ROOT);
  const evalSourceFingerprint = hashTree(EVAL_ROOT);
  const runnerFingerprint = hashFiles([__filename]);
  try {
    const codexBin = process.env.CODEX_BIN || "codex";
    const codexBinary = resolveExecutable(codexBin);
    const codexVersion = runCommand([codexBinary, "--version"], { timeoutSeconds: 30 });
    requireSuccess(codexVersion, "codex --version");
    const containerImageId = ensureContainerImage(options.containerImage);
    const snapshot = snapshotCases(selected, runtimeRoot);
    selected = snapshot.loadedCases;
    const marketplaceRoot = snapshotMarketplace(runtimeRoot);
    const installed = installCodexPlugin(runtimeRoot, codexBinary, marketplaceRoot, pluginFingerprint);
    const context = {
      outputDir,
      runtimeRoot,
      codexBinary,
      codexHome: installed.codexHome,
      pluginCacheRelative: installed.pluginCacheRelative,
      pluginHash: installed.pluginHash,
      marketplaceRoot,
      resultSchema: snapshot.resultSchema,
      model: options.model,
      reasoning: options.reasoning,
      timeoutSeconds: options.timeoutSeconds,
      containerImage: options.containerImage,
    };

    const trials = [];
    const infrastructureAttempts = [];
    for (const loadedCase of selected) {
      for (let trial = 1; trial <= runs; trial += 1) {
        process.stdout.write(`RUN ${loadedCase.config.id} ${trial}/${runs} ... `);
        let result;
        for (let attempt = 1; attempt <= options.infrastructureRetries + 1; attempt += 1) {
          result = runTrial(loadedCase, trial, attempt, context);
          if (!result.infrastructureFailure) {
            break;
          }
          infrastructureAttempts.push(result);
          if (attempt <= options.infrastructureRetries) {
            console.log(`INFRA_RETRY ${attempt}/${options.infrastructureRetries}`);
            sleep(1000 * (2 ** (attempt - 1)));
            process.stdout.write(`RETRY ${loadedCase.config.id} ${trial}/${runs} ... `);
          }
        }
        trials.push(result);
        console.log(result.infrastructureFailure ? "INCONCLUSIVE" : result.passed ? "PASS" : "FAIL");
        if (result.infrastructureFailure || !result.passed) {
          for (const failedAssertion of result.grade.assertions.filter((item) => !item.passed)) {
            console.log(`  - ${failedAssertion.name}: ${failedAssertion.detail}`);
          }
        }
      }
    }

    const requiredPasses = Math.ceil((runs * 2) / 3);
    const caseResults = selected.map((loadedCase) => {
      const attempts = trials.filter((trial) => trial.scenarioId === loadedCase.config.id);
      const validAttempts = attempts.filter((trial) => !trial.infrastructureFailure);
      const passedAttempts = validAttempts.filter((trial) => trial.passed).length;
      const status = validAttempts.length < runs ? "inconclusive" : passedAttempts >= requiredPasses ? "pass" : "fail";
      return {
        id: loadedCase.config.id,
        phase: loadedCase.config.phase,
        status,
        passedAttempts,
        validAttempts: validAttempts.length,
        requiredPasses,
      };
    });
    const status = caseResults.some((item) => item.status === "fail")
      ? "fail"
      : caseResults.some((item) => item.status === "inconclusive") ? "inconclusive" : "pass";
    const gitHead = runCommand(["git", "rev-parse", "HEAD"], { cwd: ROOT, timeoutSeconds: 30 });
    const gitStatus = runCommand(["git", "status", "--short"], { cwd: ROOT, timeoutSeconds: 30 });
    const summary = {
      schemaVersion: 2,
      startedAt: timestamp,
      completedAt: new Date().toISOString(),
      repository: {
        head: gitHead.status === 0 ? gitHead.stdout.trim() : null,
        dirty: gitStatus.status === 0 ? gitStatus.stdout.trim().length > 0 : null,
        changedPaths: gitStatus.status === 0 ? gitStatus.stdout.trim().split("\n").filter(Boolean) : [],
      },
      provider: "codex",
      model: options.model || "codex-default",
      reasoning: options.reasoning || "codex-default",
      codexVersion: codexVersion.stdout.trim(),
      execution: "container",
      containerImage: options.containerImage,
      containerImageId,
      dockerfileFingerprint: hashFiles([CONTAINER_FILE]),
      pluginVersion: installed.pluginVersion,
      pluginFingerprint,
      installedPluginFingerprint: installed.pluginHash,
      evalSourceFingerprint,
      runnerFingerprint,
      snapshotFingerprint: snapshot.hash,
      sourceChangedDuringRun: pluginFingerprint !== hashTree(PLUGIN_ROOT) || evalSourceFingerprint !== hashTree(EVAL_ROOT) || runnerFingerprint !== hashFiles([__filename]),
      suite: options.suite,
      runs,
      infrastructureRetries: options.infrastructureRetries,
      requiredPasses,
      status,
      passed: status === "pass",
      cases: caseResults,
      trials,
      infrastructureAttempts,
    };
    fs.writeFileSync(path.join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`SUMMARY ${status.toUpperCase()}: ${caseResults.filter((item) => item.status === "pass").length}/${caseResults.length} cases passed`);
    console.log(`ARTIFACTS ${outputDir}`);
    process.exitCode = status === "pass" ? 0 : status === "fail" ? 1 : 2;
  } finally {
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
  }
}

function printHelp() {
  console.log(`Usage:
  node scripts/eval/ddd-expert.js validate
  node scripts/eval/ddd-expert.js self-test
  node scripts/eval/ddd-expert.js doctor
  node scripts/eval/ddd-expert.js run [options]

Run options:
  --suite smoke|full       smoke defaults to 1 run; full defaults to 3
  --case ID                run one case; may be repeated
  --runs N                 override trial count
  --model MODEL            required for behavior runs; or set DDD_EVAL_MODEL
  --reasoning LEVEL        low, medium, high, or xhigh
  --timeout SECONDS        per-model-call timeout (default ${DEFAULT_TIMEOUT_SECONDS})
  --infra-retries N        retries for invalid provider/CLI trials (default ${DEFAULT_INFRA_RETRIES})
  --output PATH            artifact directory (default: system temp)
  --container-image IMAGE  evaluator image (default: ${DEFAULT_CONTAINER_IMAGE})
`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === "validate") {
    validateCommand();
  } else if (options.command === "self-test") {
    selfTestCommand();
  } else if (options.command === "doctor") {
    doctorCommand(options);
  } else if (options.command === "run") {
    runCommandMain(options);
  } else if (["help", "--help", "-h"].includes(options.command)) {
    printHelp();
  } else {
    fail(`unknown command ${options.command}`, 2);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exit(error.exitCode || 1);
  }
}

module.exports = {
  loadCases,
  pathMatches,
  scoreResult,
  validateResultShape,
};
