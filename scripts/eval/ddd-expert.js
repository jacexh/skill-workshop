#!/usr/bin/env node

"use strict";

const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { StringDecoder } = require("string_decoder");

const ROOT = path.resolve(__dirname, "../..");
const EVAL_ROOT = path.join(ROOT, "evals", "ddd-expert");
const CASES_ROOT = path.join(EVAL_ROOT, "cases");
const RESULT_SCHEMA = path.join(EVAL_ROOT, "result.schema.json");
const CONTAINER_FILE = path.join(EVAL_ROOT, "Dockerfile");
const PLUGIN_ROOT = path.join(ROOT, "codex-plugins", "ddd-expert");
const AUTH_BROKER = path.join(__dirname, "support", "codex-auth-fifo-broker.js");
const AUTH_BROKER_READY_LINE = "codex-auth-fifo-ready\n";
const RUNNER_FILES = [__filename, AUTH_BROKER];
const ACTIVE_ASYNC_DOCKER_CONTROLLERS = new Set();
const ACTIVE_RUNTIME_ROOTS = new Set();
const TERMINATION_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 };
const DEFAULT_TIMEOUT_SECONDS = 240;
const DEFAULT_CONTAINER_IMAGE = "ddd-expert-eval:local";
const DEFAULT_INFRA_RETRIES = 2;
const BASELINE_WORKSPACE_SNAPSHOTS = new Map();
const BASELINE_GIT_METADATA_SNAPSHOTS = new Map();
const SNAPSHOT_MAX_ENTRIES = 20000;
const SNAPSHOT_MAX_FILE_BYTES = 8 * 1024 * 1024;
const SNAPSHOT_MAX_TOTAL_HASH_BYTES = 128 * 1024 * 1024;
const RESULT_MAX_FILE_BYTES = 1024 * 1024;
const COMMAND_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const BROKER_MAX_BUFFER_BYTES = 64 * 1024;
const SNAPSHOT_LIMIT_KEY = "//snapshot-limit//";
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
let requestedTerminationSignal = null;
let terminationHandlersInstalled = false;

function fail(message, exitCode = 1) {
  const error = new Error(message);
  error.exitCode = exitCode;
  throw error;
}

function terminationExitCode(signal = requestedTerminationSignal) {
  return TERMINATION_EXIT_CODES[signal] || 1;
}

function throwIfRunnerTerminating() {
  if (requestedTerminationSignal) {
    fail(`evaluation runner received ${requestedTerminationSignal}`, terminationExitCode());
  }
}

function trackAsyncDockerController(controller) {
  ACTIVE_ASYNC_DOCKER_CONTROLLERS.add(controller);
  controller.completion.then(
    () => ACTIVE_ASYNC_DOCKER_CONTROLLERS.delete(controller),
    () => ACTIVE_ASYNC_DOCKER_CONTROLLERS.delete(controller),
  );
  if (requestedTerminationSignal) {
    controller.abort(`evaluation runner received ${requestedTerminationSignal}`);
  }
  return controller;
}

function registerRuntimeRoot(runtimeRoot) {
  ACTIVE_RUNTIME_ROOTS.add(runtimeRoot);
  return runtimeRoot;
}

function removeTrackedRuntimeRoot(runtimeRoot) {
  try {
    removeUntrustedTree(runtimeRoot);
  } finally {
    if (!fs.lstatSync(runtimeRoot, { throwIfNoEntry: false })) {
      ACTIVE_RUNTIME_ROOTS.delete(runtimeRoot);
    }
  }
}

function requestRunnerTermination(signal) {
  if (requestedTerminationSignal) {
    for (const controller of ACTIVE_ASYNC_DOCKER_CONTROLLERS) {
      controller.abort(`evaluation runner received a second termination signal (${signal})`);
    }
    process.exit(terminationExitCode(signal));
  }
  requestedTerminationSignal = signal;
  process.exitCode = terminationExitCode(signal);
  for (const controller of ACTIVE_ASYNC_DOCKER_CONTROLLERS) {
    controller.abort(`evaluation runner received ${signal}`);
  }
}

function installTerminationHandlers() {
  if (terminationHandlersInstalled) return;
  terminationHandlersInstalled = true;
  process.on("SIGINT", () => requestRunnerTermination("SIGINT"));
  process.on("SIGTERM", () => requestRunnerTermination("SIGTERM"));
}

async function cleanupActiveEvaluatorResources() {
  while (ACTIVE_ASYNC_DOCKER_CONTROLLERS.size > 0) {
    const controllers = [...ACTIVE_ASYNC_DOCKER_CONTROLLERS];
    for (const controller of controllers) {
      controller.abort("evaluation runner is shutting down");
    }
    await Promise.all(controllers.map((controller) => controller.completion));
  }
  const errors = [];
  for (const runtimeRoot of [...ACTIVE_RUNTIME_ROOTS]) {
    try {
      removeTrackedRuntimeRoot(runtimeRoot);
    } catch (error) {
      errors.push(`${runtimeRoot}: ${error.message}`);
    }
  }
  if (errors.length > 0) {
    fail(`failed to remove evaluator runtime roots: ${errors.join("; ")}`, 2);
  }
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

function completionError(completion) {
  if (!RESULT_COMPLETIONS.includes(completion)) {
    return "completion is invalid";
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

function validatePropositions(value, label) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`, 2);
  }
  for (const [index, proposition] of value.entries()) {
    const itemLabel = `${label}[${index}]`;
    if (!hasOnlyKeys(proposition, ["name", "accepts", "rejects"]) ||
        typeof proposition.name !== "string" || proposition.name.length === 0) {
      fail(`${itemLabel} must define only a non-empty name, accepts, and rejects`, 2);
    }
    stringArray(proposition.accepts, `${itemLabel}.accepts`, false);
    stringArray(proposition.rejects, `${itemLabel}.rejects`, false);
    for (const phrase of [...proposition.accepts, ...proposition.rejects]) {
      if (normalizeSemanticText(phrase).length === 0 || !isValidSemanticExpectation(phrase)) {
        fail(`${itemLabel} contains invalid semantic text`, 2);
      }
    }
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
    const error = completionError(completion);
    if (error) {
      fail(`${config.id}: ${error === "completion is invalid" ? "invalid expected completion" : error}`, 2);
    }
  }
  stringArray(expect.review_conclusion, `${config.id}.expect.review_conclusion`, false);
  if (expect.review_conclusion.some((item) => !["not_applicable", "clear", "violations", "evidence_gaps", "incomplete"].includes(item))) {
    fail(`${config.id}: invalid expected review conclusion`, 2);
  }
  const questionExpectationKeys = ["min", "max", "contains", "contains_any", "excludes", "propositions"];
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
  if ("propositions" in expect.questions) {
    validatePropositions(expect.questions.propositions, `${config.id}.expect.questions.propositions`);
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
  if (!hasOnlyKeys(expect.git, ["changed", "required_paths", "forbidden_paths", "allowed_paths"]) || !["none", "some"].includes(expect.git.changed)) {
    fail(`${config.id}.expect.git must define changed as none or some`, 2);
  }
  stringArray(expect.git.required_paths, `${config.id}.expect.git.required_paths`);
  stringArray(expect.git.forbidden_paths, `${config.id}.expect.git.forbidden_paths`);
  if ("allowed_paths" in expect.git) {
    stringArray(expect.git.allowed_paths, `${config.id}.expect.git.allowed_paths`);
    if (expect.git.required_paths.some((required) =>
      !expect.git.allowed_paths.some((allowed) => pathMatches(required, allowed)))) {
      fail(`${config.id}.expect.git.required_paths must be included in allowed_paths`, 2);
    }
  }
  if (!Array.isArray(expect.files) || !Array.isArray(expect.checks)) {
    fail(`${config.id}.expect.files and checks must be arrays`, 2);
  }
  for (const assertion of expect.files) {
    if (!hasOnlyKeys(assertion, ["path", "exists", "contains", "contains_any", "excludes", "excludes_semantic", "propositions", "identifiers_without_format", "forbid_temporary_trace", "contains_words", "excludes_words"]) || typeof assertion.path !== "string" || typeof assertion.exists !== "boolean") {
      fail(`${config.id}: invalid file assertion`, 2);
    }
    safeChildPath(workspacePath, assertion.path, `${config.id}.expect.files.path`);
    stringArray(assertion.contains, `${config.id}.expect.files.contains`);
    stringArray(assertion.excludes, `${config.id}.expect.files.excludes`);
    stringArray(assertion.excludes_semantic || [], `${config.id}.expect.files.excludes_semantic`);
    validatePropositions(assertion.propositions || [], `${config.id}.expect.files.propositions`);
    stringArray(assertion.identifiers_without_format || [], `${config.id}.expect.files.identifiers_without_format`);
    if ("forbid_temporary_trace" in assertion && typeof assertion.forbid_temporary_trace !== "boolean") {
      fail(`${config.id}.expect.files.forbid_temporary_trace must be boolean`, 2);
    }
    stringArray(assertion.contains_words || [], `${config.id}.expect.files.contains_words`);
    stringArray(assertion.excludes_words || [], `${config.id}.expect.files.excludes_words`);
    for (const [index, group] of (assertion.contains_any || []).entries()) {
      stringArray(group, `${config.id}.expect.files.contains_any[${index}]`, false);
      if (group.some((value) => !isValidSemanticExpectation(value))) {
        fail(`${config.id}.expect.files.contains_any[${index}] contains an invalid semantic expectation`, 2);
      }
    }
    if ((assertion.excludes_semantic || []).some((value) => !isValidSemanticExpectation(value))) {
      fail(`${config.id}.expect.files.excludes_semantic contains an invalid semantic expectation`, 2);
    }
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
  const invalidCompletion = completionError(result.completion);
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
  let absolute;
  let root;
  try {
    absolute = path.resolve(workspace, normalized);
    root = path.resolve(workspace);
  } catch {
    return null;
  }
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
    try {
      return { valid: true, exists: true, info, stat: fs.lstatSync(workspace) };
    } catch {
      return { valid: false, exists: false, info, stat: null };
    }
  }
  let current = path.resolve(workspace);
  let stat = null;
  for (const segment of info.normalized.split("/")) {
    current = path.join(current, segment);
    try {
      stat = fs.lstatSync(current, { throwIfNoEntry: false });
    } catch {
      return { valid: false, exists: false, info, stat: null };
    }
    if (!stat) {
      return { valid: true, exists: false, info, stat: null };
    }
    if (stat.isSymbolicLink()) {
      return { valid: false, exists: true, info, stat };
    }
  }
  return { valid: true, exists: true, info, stat };
}

function unsafeSnapshotEntries(snapshot) {
  return [...snapshot.entries()]
    .filter(([relative, token]) => {
      if (relative === SNAPSHOT_LIMIT_KEY ||
          /^(?:bounded-|hardlinked-|link|unreadable-|unstable-|special:)/.test(token)) {
        return true;
      }
      const modeMatch = /^(?:dir|file):([0-7]+)(?::|$)/.exec(token);
      // This repository can legitimately be group-writable in a shared
      // workspace. Special permission bits and world-writable entries are the
      // unsafe cases; ordinary mode changes are still visible to the exact
      // filesystem diff below.
      return modeMatch ? (Number.parseInt(modeMatch[1], 8) & 0o7002) !== 0 : false;
    })
    .map(([relative]) => relative)
    .sort();
}

function workspaceUnsafeEntries(workspace, snapshot = workspaceFileSnapshot(workspace)) {
  return unsafeSnapshotEntries(snapshot);
}

function boundedTreeSnapshot(root, rootRelative, skipRootEntry = null) {
  const snapshot = new Map();
  const state = { entries: 0, hashedBytes: 0, limited: false };

  function modeOf(stat) {
    return (stat.mode & 0o7777).toString(8);
  }

  function fileToken(absolute, stat) {
    const metadata = `${modeOf(stat)}:${stat.size}:${stat.dev}:${stat.ino}:${stat.nlink}:${stat.ctimeMs}`;
    if (stat.nlink !== 1) {
      return `hardlinked-file:${metadata}`;
    }
    if (stat.size > SNAPSHOT_MAX_FILE_BYTES ||
        state.hashedBytes + stat.size > SNAPSHOT_MAX_TOTAL_HASH_BYTES) {
      return `bounded-file:${metadata}`;
    }
    let descriptor;
    try {
      const flags = fs.constants.O_RDONLY |
        (fs.constants.O_NOFOLLOW || 0) |
        (fs.constants.O_NONBLOCK || 0);
      descriptor = fs.openSync(absolute, flags);
      const openedStat = fs.fstatSync(descriptor);
      const openedMetadata = `${modeOf(openedStat)}:${openedStat.size}:${openedStat.dev}:${openedStat.ino}:${openedStat.nlink}:${openedStat.ctimeMs}`;
      if (!openedStat.isFile() || openedStat.dev !== stat.dev || openedStat.ino !== stat.ino ||
          openedStat.nlink !== 1) {
        return `unreadable-file:${openedMetadata}:identity-changed`;
      }
      const remainingBudget = Math.min(
        SNAPSHOT_MAX_FILE_BYTES,
        SNAPSHOT_MAX_TOTAL_HASH_BYTES - state.hashedBytes,
      );
      if (openedStat.size > remainingBudget) {
        return `bounded-file:${openedMetadata}`;
      }
      const hash = crypto.createHash("sha256");
      const buffer = Buffer.allocUnsafe(64 * 1024);
      let total = 0;
      while (true) {
        const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
        if (bytesRead === 0) break;
        total += bytesRead;
        if (total > remainingBudget) {
          return `bounded-file:${openedMetadata}:grew-while-reading`;
        }
        hash.update(buffer.subarray(0, bytesRead));
      }
      const finalStat = fs.fstatSync(descriptor);
      if (finalStat.nlink !== 1) {
        return `hardlinked-file:${modeOf(finalStat)}:${finalStat.size}:${finalStat.dev}:${finalStat.ino}:${finalStat.nlink}:${finalStat.ctimeMs}`;
      }
      if (finalStat.dev !== openedStat.dev || finalStat.ino !== openedStat.ino ||
          finalStat.size !== openedStat.size || total !== openedStat.size ||
          finalStat.ctimeMs !== openedStat.ctimeMs) {
        return `unstable-file:${modeOf(finalStat)}:${finalStat.size}:${finalStat.ino}:${finalStat.ctimeMs}`;
      }
      state.hashedBytes += total;
      return `file:${modeOf(finalStat)}:${total}:${finalStat.dev}:${finalStat.ino}:${finalStat.nlink}:${finalStat.ctimeMs}:${hash.digest("hex")}`;
    } catch (error) {
      return `unreadable-file:${metadata}:${error.code || error.name}`;
    } finally {
      if (descriptor !== undefined) {
        try {
          fs.closeSync(descriptor);
        } catch {
          // The returned token already fails closed for unreadable or unstable files.
        }
      }
    }
  }

  function markLimit(detail) {
    state.limited = true;
    snapshot.set(SNAPSHOT_LIMIT_KEY, `limit:${detail}`);
  }

  function visit(absolute, relative, isRoot = false) {
    if (state.limited) return;
    if (state.entries >= SNAPSHOT_MAX_ENTRIES) {
      markLimit(`entries>${SNAPSHOT_MAX_ENTRIES}`);
      return;
    }
    let stat;
    try {
      stat = fs.lstatSync(absolute);
    } catch (error) {
      snapshot.set(relative, `unreadable-entry:${error.code || error.name}`);
      state.entries += 1;
      return;
    }
    state.entries += 1;
    if (stat.isSymbolicLink()) {
      try {
        snapshot.set(relative, `link:${modeOf(stat)}:${fs.readlinkSync(absolute)}`);
      } catch (error) {
        snapshot.set(relative, `unreadable-link:${modeOf(stat)}:${error.code || error.name}`);
      }
      return;
    }
    if (stat.isFile()) {
      snapshot.set(relative, fileToken(absolute, stat));
      return;
    }
    if (!stat.isDirectory()) {
      snapshot.set(relative, `special:${modeOf(stat)}:${stat.mode & 0o170000}:${stat.rdev}`);
      return;
    }

    snapshot.set(relative, `dir:${modeOf(stat)}`);
    let directory;
    const entries = [];
    try {
      directory = fs.opendirSync(absolute);
      let entry;
      while ((entry = directory.readSync()) !== null) {
        if (isRoot && skipRootEntry && skipRootEntry(entry.name)) continue;
        entries.push(entry.name);
        if (state.entries + entries.length > SNAPSHOT_MAX_ENTRIES) {
          markLimit(`entries>${SNAPSHOT_MAX_ENTRIES}`);
          break;
        }
      }
    } catch (error) {
      snapshot.set(relative, `unreadable-dir:${modeOf(stat)}:${error.code || error.name}`);
      return;
    } finally {
      if (directory) directory.closeSync();
    }
    entries.sort((left, right) => left.localeCompare(right));
    for (const entry of entries) {
      const childRelative = relative === "." ? entry : `${relative}/${entry}`;
      visit(path.join(absolute, entry), childRelative, false);
    }
  }

  visit(root, rootRelative, true);
  return snapshot;
}

function workspaceFileSnapshot(workspace) {
  return boundedTreeSnapshot(workspace, ".", (name) => name === ".git");
}

function gitMetadataSnapshot(workspace) {
  return boundedTreeSnapshot(path.join(workspace, ".git"), ".git");
}

function snapshotChanges(baselineSnapshot, currentSnapshot) {
  if (!baselineSnapshot) return [];
  const changed = [];
  for (const relative of new Set([...baselineSnapshot.keys(), ...currentSnapshot.keys()])) {
    if (baselineSnapshot.get(relative) !== currentSnapshot.get(relative)) {
      changed.push(relative);
    }
  }
  return changed.sort();
}

function baselineSnapshotKey(workspace, baseline) {
  return `${path.resolve(workspace)}\0${baseline}`;
}

function runCommand(argv, options = {}) {
  const [command, ...args] = argv;
  const result = childProcess.spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    input: options.input,
    encoding: "utf8",
    timeout: (options.timeoutSeconds || DEFAULT_TIMEOUT_SECONDS) * 1000,
    killSignal: options.killSignal || "SIGTERM",
    maxBuffer: COMMAND_MAX_BUFFER_BYTES,
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

function appendCommandError(result, message) {
  return {
    ...result,
    status: result.status === 0 ? 125 : result.status,
    error: [result.error, message].filter(Boolean).join("; "),
  };
}

function dockerControlIdentity(runtimeRoot, prefix) {
  const token = crypto.randomBytes(16).toString("hex");
  const controlRoot = path.join(runtimeRoot, "container-control");
  fs.mkdirSync(controlRoot, { recursive: true, mode: 0o700 });
  fs.chmodSync(controlRoot, 0o700);
  return {
    name: `ddd-expert-${prefix}-${process.pid}-${token}`,
    label: `ddd-expert.eval.control=${token}`,
    cidFile: path.join(controlRoot, `${token}.cid`),
  };
}

function dockerContainerIdsByLabel(label) {
  const listed = runCommand([
    "docker", "container", "ls", "--all", "--quiet", "--filter", `label=${label}`,
  ], { timeoutSeconds: 30 });
  if (listed.status !== 0) {
    return { ids: [], error: `cannot list evaluator containers: ${listed.error || listed.stderr.trim() || `exit ${listed.status}`}` };
  }
  const ids = listed.stdout.split(/\s+/u).filter(Boolean);
  const invalid = ids.find((id) => !/^[0-9a-f]{12,64}$/u.test(id));
  return invalid
    ? { ids: [], error: `docker returned an invalid container ID for ${label}` }
    : { ids, error: null };
}

function readDockerCidFile(cidFile) {
  const stat = fs.lstatSync(cidFile, { throwIfNoEntry: false });
  if (!stat) return { id: null, error: null };
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 ||
      (typeof process.getuid === "function" && stat.uid !== process.getuid()) || stat.size > 128) {
    return { id: null, error: "Docker cidfile is not a trusted owner-only regular file" };
  }
  fs.chmodSync(cidFile, 0o600);
  const secured = fs.lstatSync(cidFile);
  if (secured.dev !== stat.dev || secured.ino !== stat.ino || secured.nlink !== 1 ||
      (secured.mode & 0o7777) !== 0o600) {
    return { id: null, error: "Docker cidfile changed while securing it" };
  }
  const read = readBoundedTextFile(cidFile, 128);
  if (!read.ok) return { id: null, error: `cannot read Docker cidfile: ${read.error}` };
  const id = read.content.trim();
  return /^[0-9a-f]{12,64}$/u.test(id)
    ? { id, error: null }
    : { id: null, error: "Docker cidfile contains an invalid container ID" };
}

function forceRemoveManagedDockerContainer(control) {
  const errors = [];
  let cid;
  try {
    cid = readDockerCidFile(control.cidFile);
  } catch (error) {
    cid = { id: null, error: `cannot inspect Docker cidfile: ${error.message}` };
  }
  if (cid.error) errors.push(cid.error);
  const before = dockerContainerIdsByLabel(control.label);
  if (before.error) errors.push(before.error);
  const identifiers = [...new Set([control.name, cid.id, ...before.ids].filter(Boolean))];
  for (const identifier of identifiers) {
    const removed = runCommand(["docker", "container", "rm", "--force", identifier], { timeoutSeconds: 30 });
    const absentAlready = /no such container/u.test(`${removed.stderr}\n${removed.stdout}`.toLowerCase());
    if (removed.status !== 0 && !absentAlready) {
      errors.push(`cannot force-remove evaluator container: ${removed.error || removed.stderr.trim() || `exit ${removed.status}`}`);
    }
  }
  const after = dockerContainerIdsByLabel(control.label);
  if (after.error) {
    errors.push(after.error);
  } else if (after.ids.length > 0) {
    errors.push(`evaluator containers remain after cleanup: ${after.ids.join(",")}`);
  }
  const named = runCommand(["docker", "container", "inspect", control.name], { timeoutSeconds: 30 });
  if (named.status === 0) {
    errors.push(`evaluator container remains after cleanup: ${control.name}`);
  }
  try {
    const cidStat = fs.lstatSync(control.cidFile, { throwIfNoEntry: false });
    if (cidStat && !cidStat.isSymbolicLink()) {
      fs.rmSync(control.cidFile, { force: true });
    } else if (cidStat) {
      errors.push("refusing to remove an untrusted Docker cidfile symlink");
    }
  } catch (error) {
    errors.push(`cannot remove Docker cidfile: ${error.message}`);
  }
  return { error: errors.length > 0 ? errors.join("; ") : null, label: control.label, name: control.name };
}

function runManagedDockerContainer(argv, options) {
  if (argv[0] !== "docker" || argv[1] !== "run") {
    fail("managed Docker command must start with docker run", 2);
  }
  const control = dockerControlIdentity(options.runtimeRoot, options.prefix || "trial");
  const managedArgv = [
    "docker", "run",
    "--name", control.name,
    "--cidfile", control.cidFile,
    "--label", control.label,
    ...argv.slice(2),
  ];
  const originalUmask = process.umask(0o077);
  let result;
  try {
    result = runCommand(managedArgv, { ...options, killSignal: "SIGKILL" });
  } catch (error) {
    result = {
      argv: managedArgv,
      status: null,
      signal: null,
      stdout: "",
      stderr: "",
      error: error.message,
    };
  } finally {
    process.umask(originalUmask);
  }
  const cleanup = forceRemoveManagedDockerContainer(control);
  if (cleanup.error) {
    result = appendCommandError(result, cleanup.error);
  }
  return { ...result, containerCleanup: cleanup };
}

function startManagedDockerContainerAsync(argv, options) {
  if (argv[0] !== "docker" || argv[1] !== "run") {
    fail("managed Docker command must start with docker run", 2);
  }
  const control = dockerControlIdentity(options.runtimeRoot, options.prefix || "trial");
  const managedArgv = [
    "docker", "run",
    "--name", control.name,
    "--cidfile", control.cidFile,
    "--label", control.label,
    ...argv.slice(2),
  ];
  const stdoutChunks = [];
  const stderrChunks = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let child;
  let timeout;
  let failureReason = null;
  let abortNotified = false;
  let finish;

  const completion = new Promise((resolve) => {
    finish = resolve;
  });

  const notifyAbort = (reason) => {
    if (!failureReason) failureReason = reason;
    if (!abortNotified) {
      abortNotified = true;
      try {
        options.onAbort?.(failureReason);
      } catch {
        failureReason = `${failureReason}; Docker abort hook failed`;
      }
    }
  };

  const abort = (reason) => {
    notifyAbort(reason);
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
  };

  const capture = (chunk, chunks, streamName) => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const current = streamName === "stdout" ? stdoutBytes : stderrBytes;
    if (current + buffer.length > COMMAND_MAX_BUFFER_BYTES) {
      abort(`Docker ${streamName} exceeded ${COMMAND_MAX_BUFFER_BYTES} bytes`);
      return false;
    }
    chunks.push(buffer);
    if (streamName === "stdout") stdoutBytes += buffer.length;
    else stderrBytes += buffer.length;
    return true;
  };

  const originalUmask = process.umask(0o077);
  let spawnError = null;
  try {
    child = childProcess.spawn(managedArgv[0], managedArgv.slice(1), {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    spawnError = error;
  } finally {
    process.umask(originalUmask);
  }
  if (spawnError) {
    const cleanup = forceRemoveManagedDockerContainer(control);
    finish({
      argv: managedArgv,
      status: null,
      signal: null,
      stdout: "",
      stderr: "",
      error: [spawnError.message, cleanup.error].filter(Boolean).join("; "),
      containerCleanup: cleanup,
    });
    return trackAsyncDockerController({ completion, abort });
  }

  child.stdout.on("data", (chunk) => {
    if (!capture(chunk, stdoutChunks, "stdout")) return;
    try {
      options.onStdoutChunk?.(chunk);
    } catch {
      abort("Codex JSONL stream handler failed");
    }
  });
  child.stderr.on("data", (chunk) => {
    capture(chunk, stderrChunks, "stderr");
  });
  child.stdin.on("error", (error) => {
    if (child.exitCode === null && child.signalCode === null) {
      abort(`cannot write Codex prompt (${error.code || "unknown error"})`);
    }
  });
  child.once("error", (error) => {
    abort(`cannot start Docker client (${error.code || "unknown error"})`);
  });
  child.once("close", (status, signal) => {
    clearTimeout(timeout);
    try {
      options.onStdoutEnd?.();
    } catch {
      notifyAbort("Codex JSONL stream finalization failed");
    }
    const cleanup = forceRemoveManagedDockerContainer(control);
    const stdout = Buffer.concat(stdoutChunks, stdoutBytes).toString("utf8");
    const stderr = Buffer.concat(stderrChunks, stderrBytes).toString("utf8");
    const result = {
      argv: managedArgv,
      status,
      signal,
      stdout,
      stderr,
      error: failureReason,
      containerCleanup: cleanup,
    };
    finish(cleanup.error ? appendCommandError(result, cleanup.error) : result);
  });

  timeout = setTimeout(() => {
    abort(`Docker client timed out after ${options.timeoutSeconds}s (ETIMEDOUT)`);
  }, options.timeoutSeconds * 1000);
  timeout.unref?.();
  try {
    child.stdin.end(options.input || "");
  } catch (error) {
    abort(`cannot write Codex prompt (${error.code || "unknown error"})`);
  }
  return trackAsyncDockerController({ completion, abort });
}

function authFifoIdentity(authFile, expected = null) {
  const stat = fs.lstatSync(authFile, { throwIfNoEntry: false });
  if (!stat || !stat.isFIFO() || stat.isSymbolicLink() || stat.nlink !== 1 ||
      (stat.mode & 0o7777) !== 0o600 ||
      (typeof process.getuid === "function" && stat.uid !== process.getuid()) ||
      (expected && (stat.dev !== expected.dev || stat.ino !== expected.ino))) {
    fail(`trial auth path is not the expected owner-only FIFO: ${authFile}`, 2);
  }
  return { dev: stat.dev, ino: stat.ino };
}

function verifyEmptyAuthFifo(authFile, expected) {
  authFifoIdentity(authFile, expected);
  let descriptor;
  const probe = Buffer.alloc(1);
  try {
    descriptor = fs.openSync(
      authFile,
      fs.constants.O_RDONLY | fs.constants.O_NONBLOCK | (fs.constants.O_NOFOLLOW || 0),
    );
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFIFO() || opened.dev !== expected.dev || opened.ino !== expected.ino) {
      fail(`trial auth FIFO changed while verifying it: ${authFile}`, 2);
    }
    if (fs.readSync(descriptor, probe, 0, probe.length, null) !== 0) {
      fail(`trial auth FIFO retained credential bytes: ${authFile}`, 2);
    }
  } finally {
    probe.fill(0);
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  authFifoIdentity(authFile, expected);
}

function startAuthFifoBroker(sourceAuth, authFile) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = childProcess.spawn(
        process.execPath,
        [AUTH_BROKER, "--source", sourceAuth, "--fifo", authFile],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
    } catch (error) {
      reject(new Error(`cannot start auth FIFO broker (${error.code || "unknown error"})`));
      return;
    }

    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let ready = false;
    let expectedStop = false;
    let stopPromise = null;
    let failureResolved = false;
    let resolveFailure;
    let resolveExit;
    let readySettled = false;
    let readyError = null;
    const failure = new Promise((failureResolve) => {
      resolveFailure = failureResolve;
    });
    const exit = new Promise((exitResolve) => {
      resolveExit = exitResolve;
    });

    const stdoutText = () => Buffer.concat(stdoutChunks, stdoutBytes).toString("utf8");
    const stderrText = () => Buffer.concat(stderrChunks, stderrBytes).toString("utf8");
    const reportFailure = (message) => {
      if (!failureResolved) {
        failureResolved = true;
        resolveFailure(message);
      }
    };
    const rejectReady = (message) => {
      if (ready || readySettled) return;
      if (!readyError) readyError = message;
      child.kill("SIGKILL");
    };
    const readyTimer = setTimeout(() => {
      rejectReady("auth FIFO broker did not become ready");
    }, 5000);

    const append = (chunk, chunks, streamName) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if ((streamName === "stdout" ? stdoutBytes : stderrBytes) + buffer.length > BROKER_MAX_BUFFER_BYTES) {
        reportFailure(`auth FIFO broker ${streamName} exceeded its bound`);
        rejectReady(`auth FIFO broker ${streamName} exceeded its bound`);
        child.kill("SIGKILL");
        return false;
      }
      chunks.push(buffer);
      if (streamName === "stdout") stdoutBytes += buffer.length;
      else stderrBytes += buffer.length;
      return true;
    };

    child.stdout.on("data", (chunk) => {
      if (!append(chunk, stdoutChunks, "stdout")) return;
      const output = stdoutText();
      if (!ready) {
        if (!AUTH_BROKER_READY_LINE.startsWith(output)) {
          rejectReady("auth FIFO broker emitted an invalid ready line");
        } else if (output === AUTH_BROKER_READY_LINE && !readyError) {
          ready = true;
          readySettled = true;
          clearTimeout(readyTimer);
          resolve(handle);
        }
      } else if (output !== AUTH_BROKER_READY_LINE) {
        reportFailure("auth FIFO broker emitted output after its ready line");
      }
    });
    child.stderr.on("data", (chunk) => {
      if (!append(chunk, stderrChunks, "stderr")) return;
      const message = "auth FIFO broker emitted stderr";
      reportFailure(message);
      rejectReady(message);
    });
    child.stdin.on("error", (error) => {
      if (expectedStop) return;
      const message = `auth FIFO broker liveness pipe failed (${error.code || "unknown error"})`;
      reportFailure(message);
      rejectReady(message);
    });
    child.once("error", (error) => {
      const message = `auth FIFO broker process error (${error.code || "unknown error"})`;
      reportFailure(message);
      rejectReady(message);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(readyTimer);
      resolveExit({ code, signal });
      if (!ready) {
        const message = readyError ||
          `auth FIFO broker exited before ready (exit=${code}; signal=${signal})`;
        reportFailure(message);
        if (!readySettled) {
          readySettled = true;
          reject(new Error(message));
        }
        return;
      }
      if (!expectedStop) {
        const message = `auth FIFO broker exited before credential cutoff (exit=${code}; signal=${signal})`;
        reportFailure(message);
        rejectReady(message);
      } else if (!failureResolved) {
        failureResolved = true;
        resolveFailure(null);
      }
    });

    const handle = {
      child,
      exit,
      failure,
      stdoutText,
      stderrText,
      markExpectedStop() {
        const exitedEarly = child.exitCode !== null || child.signalCode !== null;
        expectedStop = true;
        return exitedEarly;
      },
      get stopPromise() {
        return stopPromise;
      },
      set stopPromise(value) {
        stopPromise = value;
      },
    };
  });
}

async function stopAuthFifoBroker(broker) {
  if (broker.stopPromise) return broker.stopPromise;
  const exitedBeforeStop = broker.markExpectedStop();
  broker.stopPromise = (async () => {
    if (!exitedBeforeStop) {
      broker.child.stdin.end();
      broker.child.kill("SIGTERM");
    }
    let timeout;
    const timedOut = Symbol("broker-timeout");
    let result = await Promise.race([
      broker.exit,
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve(timedOut), 2000);
      }),
    ]);
    clearTimeout(timeout);
    if (result === timedOut) {
      broker.child.kill("SIGKILL");
      result = await broker.exit;
      return { ...result, error: "auth FIFO broker did not stop after credential cutoff" };
    }
    if (exitedBeforeStop) {
      return { ...result, error: "auth FIFO broker exited before credential cutoff" };
    }
    if (result.code !== 0 || result.signal !== null ||
        broker.stdoutText() !== AUTH_BROKER_READY_LINE || broker.stderrText() !== "") {
      return { ...result, error: "auth FIFO broker shutdown failed its protocol checks" };
    }
    return { ...result, error: null };
  })();
  return broker.stopPromise;
}

async function runCodexWithAuthFifo(executionArgs, prompt, context, sourceAuth, authFile) {
  throwIfRunnerTerminating();
  const broker = await startAuthFifoBroker(sourceAuth, authFile);
  let fifoIdentity;
  try {
    throwIfRunnerTerminating();
    fifoIdentity = authFifoIdentity(authFile);
  } catch (error) {
    await stopAuthFifoBroker(broker);
    throw error;
  }
  const decoder = new StringDecoder("utf8");
  let pending = "";
  let firstEventSeen = false;
  let cutoffObserved = false;
  let controller;

  const stopBrokerAndCheck = async () => {
    const stopped = await stopAuthFifoBroker(broker);
    return stopped.error;
  };
  const stopBrokerNow = () => {
    const stopped = stopBrokerAndCheck();
    stopped.then((error) => {
      if (error) controller?.abort(error);
    }).catch(() => {
      controller?.abort("auth FIFO broker shutdown threw unexpectedly");
    });
    return stopped;
  };

  const processFirstEvent = (line) => {
    if (firstEventSeen) return;
    firstEventSeen = true;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      stopBrokerNow();
      controller.abort("Codex JSONL compatibility gate received invalid JSON");
      return;
    }
    if (!isPlainObject(event) || event.type !== "thread.started") {
      stopBrokerNow();
      controller.abort("Codex JSONL compatibility gate expected thread.started first");
      return;
    }
    cutoffObserved = true;
    stopBrokerNow();
  };

  const onStdoutChunk = (chunk) => {
    pending += decoder.write(chunk);
    while (!firstEventSeen) {
      const newline = pending.indexOf("\n");
      if (newline < 0) return;
      const line = pending.slice(0, newline).replace(/\r$/u, "");
      pending = pending.slice(newline + 1);
      if (line.trim() === "") continue;
      processFirstEvent(line.trim());
    }
  };
  const onStdoutEnd = () => {
    pending += decoder.end();
    if (!firstEventSeen && pending.trim() !== "") {
      controller.abort("Codex JSONL compatibility gate received an unterminated first event");
    } else if (!cutoffObserved) {
      controller.abort("Codex JSONL compatibility gate never observed thread.started");
    }
  };

  try {
    controller = startManagedDockerContainerAsync(executionArgs, {
      env: process.env,
      input: prompt,
      timeoutSeconds: context.timeoutSeconds + 15,
      runtimeRoot: context.runtimeRoot,
      prefix: "trial",
      onStdoutChunk,
      onStdoutEnd,
      onAbort: stopBrokerNow,
    });
  } catch (error) {
    await stopAuthFifoBroker(broker);
    throw error;
  }
  broker.failure.then((reason) => {
    if (reason) controller.abort(reason);
  }).catch(() => {
    controller.abort("auth FIFO broker monitoring failed");
  });

  let execution = await controller.completion;
  const brokerError = await stopBrokerAndCheck();
  if (brokerError) execution = appendCommandError(execution, brokerError);
  if (!cutoffObserved) {
    execution = appendCommandError(execution, "credential cutoff was not established at thread.started");
  }
  try {
    verifyEmptyAuthFifo(authFile, fifoIdentity);
  } catch (error) {
    execution = appendCommandError(execution, error.message);
  }
  return execution;
}

function preparePrivateOutputRoot(outputDir) {
  const resolved = path.resolve(outputDir);
  const parsed = path.parse(resolved);
  const expectedUid = typeof process.getuid === "function" ? process.getuid() : null;
  let current = parsed.root;
  for (const segment of resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    const next = path.join(current, segment);
    const existing = fs.lstatSync(next, { throwIfNoEntry: false });
    if (existing) {
      if (!existing.isDirectory() || existing.isSymbolicLink()) {
        fail(`output path must contain only real directories, not symlinks or hard-linked files: ${next}`, 2);
      }
      const trustedOwner = expectedUid === null || existing.uid === expectedUid || existing.uid === 0;
      const writableByOthers = (existing.mode & 0o022) !== 0;
      const stickyDirectory = (existing.mode & 0o1000) !== 0;
      if (!trustedOwner || (writableByOthers && !stickyDirectory)) {
        fail(`output path traverses an untrusted writable directory: ${next}`, 2);
      }
    } else {
      if (fs.realpathSync(current) !== current) {
        fail(`output directory path must not traverse a symlink: ${current}`, 2);
      }
      fs.mkdirSync(next, { mode: 0o700 });
      const created = fs.lstatSync(next);
      if (!created.isDirectory() || created.isSymbolicLink() || fs.realpathSync(next) !== next) {
        fail(`created output path is not a real directory: ${next}`, 2);
      }
    }
    current = next;
  }
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink() ||
      (typeof process.getuid === "function" && stat.uid !== process.getuid())) {
    fail(`output directory must be an owned real directory: ${resolved}`, 2);
  }
  if (fs.realpathSync(resolved) !== resolved) {
    fail(`output directory path must not traverse a symlink: ${resolved}`, 2);
  }
  if (fs.readdirSync(resolved).length > 0) {
    fail(`output directory is not empty: ${resolved}`, 2);
  }
  fs.chmodSync(resolved, 0o700);
  const secured = fs.lstatSync(resolved);
  if ((secured.mode & 0o7777) !== 0o700) {
    fail(`cannot secure output directory to mode 0700: ${resolved}`, 2);
  }
  return resolved;
}

function createDefaultPrivateOutputRoot() {
  const originalUmask = process.umask(0o077);
  let created;
  try {
    created = fs.mkdtempSync(path.join(os.tmpdir(), "ddd-expert-evals-"));
  } finally {
    process.umask(originalUmask);
  }
  return preparePrivateOutputRoot(created);
}

function hardenArtifactTree(root) {
  const expectedUid = typeof process.getuid === "function" ? process.getuid() : null;

  function visit(current) {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) {
      fail(`retained artifact must not be a symlink: ${current}`, 2);
    }
    if (expectedUid !== null && stat.uid !== expectedUid) {
      fail(`retained artifact is not owned by the evaluator user: ${current}`, 2);
    }
    if (stat.isDirectory()) {
      fs.chmodSync(current, 0o700);
      const directory = fs.opendirSync(current);
      try {
        let entry;
        while ((entry = directory.readSync()) !== null) {
          visit(path.join(current, entry.name));
        }
      } finally {
        directory.closeSync();
      }
      return;
    }
    if (!stat.isFile() || stat.nlink !== 1) {
      fail(`retained artifact must be a non-hard-linked regular file: ${current}`, 2);
    }
    let descriptor;
    try {
      descriptor = fs.openSync(current, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      const opened = fs.fstatSync(descriptor);
      if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino || opened.nlink !== 1) {
        fail(`retained artifact changed while securing it: ${current}`, 2);
      }
      fs.fchmodSync(descriptor, 0o600);
      const secured = fs.fstatSync(descriptor);
      if ((secured.mode & 0o7777) !== 0o600 || secured.nlink !== 1) {
        fail(`cannot secure retained artifact to mode 0600: ${current}`, 2);
      }
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
    }
  }

  visit(root);
}

function writePrivateFile(file, content) {
  fs.writeFileSync(file, content, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

function readBoundedTextFile(file, maxBytes = SNAPSHOT_MAX_FILE_BYTES) {
  let initialStat;
  try {
    initialStat = fs.lstatSync(file);
  } catch (error) {
    return { ok: false, content: "", error: `cannot inspect file: ${error.code || error.message}` };
  }
  if (!initialStat.isFile()) {
    return { ok: false, content: "", error: "path is not a regular file" };
  }
  if (initialStat.size > maxBytes) {
    return { ok: false, content: "", error: `file exceeds ${maxBytes} bytes` };
  }

  let descriptor;
  try {
    const flags = fs.constants.O_RDONLY |
      (fs.constants.O_NOFOLLOW || 0) |
      (fs.constants.O_NONBLOCK || 0);
    descriptor = fs.openSync(file, flags);
    const openedStat = fs.fstatSync(descriptor);
    if (!openedStat.isFile() || openedStat.dev !== initialStat.dev || openedStat.ino !== initialStat.ino) {
      return { ok: false, content: "", error: "opened path is not the inspected regular file" };
    }
    if (openedStat.size > maxBytes) {
      return { ok: false, content: "", error: `file exceeds ${maxBytes} bytes` };
    }

    const chunks = [];
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let total = 0;
    while (true) {
      const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > maxBytes) {
        return { ok: false, content: "", error: `file grew beyond ${maxBytes} bytes while reading` };
      }
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
    const finalStat = fs.fstatSync(descriptor);
    if (finalStat.dev !== openedStat.dev || finalStat.ino !== openedStat.ino ||
        finalStat.size !== openedStat.size || finalStat.ctimeMs !== openedStat.ctimeMs ||
        total !== openedStat.size) {
      return { ok: false, content: "", error: "file changed while reading" };
    }
    return { ok: true, content: Buffer.concat(chunks, total).toString("utf8"), error: null };
  } catch (error) {
    return { ok: false, content: "", error: `cannot read file: ${error.code || error.message}` };
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // A failed close does not make an unreadable artifact acceptable.
      }
    }
  }
}

function countTextLines(content) {
  let count = 1;
  for (let index = 0; index < content.length; index += 1) {
    if (content.charCodeAt(index) === 10) count += 1;
  }
  return count;
}

function restoreDirectoryChain(root, relative) {
  if (typeof relative !== "string" || path.isAbsolute(relative) || relative.split(path.sep).includes("..")) {
    fail(`unsafe directory chain: ${relative}`, 2);
  }
  let current = path.resolve(root);
  for (const segment of ["", ...relative.split(path.sep).filter(Boolean)]) {
    if (segment) current = path.join(current, segment);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat?.isDirectory() || stat.isSymbolicLink()) {
      fail(`untrusted home replaced or removed directory: ${current}`, 2);
    }
    fs.chmodSync(current, 0o700);
  }
}

function removeUntrustedTree(root) {
  function repair(current) {
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat?.isDirectory() || stat.isSymbolicLink()) return;
    fs.chmodSync(current, 0o700);
    const directory = fs.opendirSync(current);
    try {
      let entry;
      while ((entry = directory.readSync()) !== null) {
        repair(path.join(current, entry.name));
      }
    } finally {
      directory.closeSync();
    }
  }

  if (!fs.lstatSync(root, { throwIfNoEntry: false })) return;
  repair(root);
  fs.rmSync(root, { recursive: true, force: true });
  if (fs.lstatSync(root, { throwIfNoEntry: false })) {
    fail(`failed to remove untrusted runtime tree: ${root}`, 2);
  }
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
  const commit = baseline.stdout.trim();
  const workspaceSnapshot = workspaceFileSnapshot(workspace);
  const metadataSnapshot = gitMetadataSnapshot(workspace);
  const baselineIssues = [
    ...unsafeSnapshotEntries(workspaceSnapshot),
    ...unsafeSnapshotEntries(metadataSnapshot),
  ];
  if (baselineIssues.length > 0) {
    fail(`eval baseline contains entries that cannot be snapshotted safely: ${baselineIssues.join(",")}`, 2);
  }
  BASELINE_WORKSPACE_SNAPSHOTS.set(
    baselineSnapshotKey(workspace, commit),
    workspaceSnapshot,
  );
  BASELINE_GIT_METADATA_SNAPSHOTS.set(
    baselineSnapshotKey(workspace, commit),
    metadataSnapshot,
  );
  return commit;
}

function gitMetadataChanges(workspace, baseline) {
  const baselineSnapshot = BASELINE_GIT_METADATA_SNAPSHOTS.get(baselineSnapshotKey(workspace, baseline));
  if (!baselineSnapshot) {
    fail("missing immutable Git metadata baseline", 2);
  }
  return snapshotChanges(
    baselineSnapshot,
    gitMetadataSnapshot(workspace),
  );
}

function workspaceFilesystemChanges(workspace, baseline, currentSnapshot = workspaceFileSnapshot(workspace)) {
  const baselineSnapshot = BASELINE_WORKSPACE_SNAPSHOTS.get(baselineSnapshotKey(workspace, baseline));
  if (!baselineSnapshot) {
    fail("missing immutable workspace baseline", 2);
  }
  const changed = snapshotChanges(baselineSnapshot, currentSnapshot);
  return changed.filter((relative) => {
    const before = baselineSnapshot?.get(relative);
    const after = currentSnapshot.get(relative);
    const structuralDirectoryChange =
      (before === undefined && after?.startsWith("dir:")) ||
      (after === undefined && before?.startsWith("dir:"));
    if (!structuralDirectoryChange) return true;
    const prefix = `${relative}/`;
    return !changed.some((other) => other.startsWith(prefix));
  });
}

function changedPaths(workspace, baseline, currentSnapshot = workspaceFileSnapshot(workspace)) {
  const metadataChanges = gitMetadataChanges(workspace, baseline);
  if (metadataChanges.length > 0) {
    fail(`Git metadata changed after the immutable baseline: ${metadataChanges.join(",")}`, 2);
  }
  const unsafeEntries = workspaceUnsafeEntries(workspace, currentSnapshot);
  if (unsafeEntries.length > 0) {
    fail(`workspace contains entries that cannot be inspected safely: ${unsafeEntries.join(",")}`, 2);
  }
  return workspaceFilesystemChanges(workspace, baseline, currentSnapshot)
    .map(normalizeRelativePath)
    .sort();
}

function assertion(name, passed, detail) {
  return { name, passed: Boolean(passed), detail };
}

function propositionAssertion(prefix, content, proposition) {
  const acceptedEvidence = proposition.accepts.flatMap((phrase) =>
    semanticPhraseEvidence(content, phrase).map((item) => ({ ...item, phrase })));
  const rejectedEvidence = proposition.rejects.flatMap((phrase) =>
    semanticPhraseEvidence(content, phrase).map((item) => ({ ...item, phrase })));
  const accepted = [
    ...acceptedEvidence.filter((item) => !item.negated).map((item) => item.phrase),
    ...rejectedEvidence.filter((item) => item.negated).map((item) => `not (${item.phrase})`),
  ];
  const rejected = [
    ...rejectedEvidence.filter((item) => !item.negated).map((item) => item.phrase),
    ...acceptedEvidence.filter((item) => item.negated).map((item) => `not (${item.phrase})`),
  ];
  return assertion(
    `${prefix} establishes ${proposition.name}`,
    accepted.length > 0 && rejected.length === 0,
    `accepted=${accepted.join(" | ") || "none"}; rejected=${rejected.join(" | ") || "none"}`,
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSemanticText(value) {
  return value
    .normalize("NFKC")
    .replace(/\p{Default_Ignorable_Code_Point}/gu, "")
    .toLowerCase()
    .replace(/[_`~[\](){}<>\\|]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function isValidSemanticExpectation(value) {
  const tokens = normalizeSemanticText(value).split(" ");
  if (tokens[0] === "..." || tokens[tokens.length - 1] === "..." ||
      tokens.some((token, index) => token === "..." && tokens[index - 1] === "...")) {
    return false;
  }
  return tokens.every((token) => token === "..." ||
    !token.includes("*") || /^[a-z0-9][a-z0-9_-]*\*$/u.test(token));
}

function semanticMatchRanges(normalizedText, value) {
  const searchableText = normalizedText.replace(/\*/gu, " ");
  const normalizedValue = normalizeSemanticText(value);
  if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(normalizedValue)) {
    const ranges = [];
    let start = 0;
    while (start <= searchableText.length) {
      const index = searchableText.indexOf(normalizedValue, start);
      if (index < 0) break;
      ranges.push({ start: index, end: index + normalizedValue.length });
      start = index + Math.max(1, normalizedValue.length);
    }
    return ranges;
  }
  const separator = "(?:\\s|[-‐‑‒–—―])+";
  let phrase = "";
  let boundedGap = false;
  for (const part of normalizedValue.split(" ")) {
    if (part === "...") {
      boundedGap = true;
      continue;
    }
    const wordFamily = part.endsWith("*");
    const literal = wordFamily ? part.slice(0, -1) : part;
    const escaped = escapeRegExp(literal);
    const tokenPattern = wordFamily ? `${escaped}[\\p{L}\\p{N}_]*` : escaped;
    if (phrase) {
      phrase += boundedGap
        ? `(?:[^.!?;]{0,200}?${separator})`
        : separator;
    }
    phrase += tokenPattern;
    boundedGap = false;
  }
  const matcher = new RegExp(`(^|[^\\p{L}\\p{N}_])(${phrase})(?=$|[^\\p{L}\\p{N}_])`, "gu");
  const ranges = [];
  let match;
  while ((match = matcher.exec(searchableText)) !== null) {
    const start = match.index + match[1].length;
    ranges.push({ start, end: start + match[2].length });
    if (matcher.lastIndex === match.index) matcher.lastIndex += 1;
  }
  return ranges;
}

function normalizedSemanticContains(normalizedText, value) {
  return semanticMatchRanges(normalizedText, value).length > 0;
}

function semanticOccurrenceIsNegated(normalizedClause, occurrenceStart) {
  const prefix = normalizedClause.slice(0, occurrenceStart).trimEnd();
  const epistemicNegation = new RegExp(
    "(?:\\b(?:there\\s+(?:is|was)|i\\s+have|we\\s+have)\\s+no\\s+(?:(?:credible|sufficient|reliable|accepted|clear|direct|convincing|available)\\s+)?(?:evidence|reason|basis|support)(?:\\s+(?:to\\s+(?:believe|conclude|infer|establish|say)|that))?|" +
    "\\b(?:no|insufficient)\\s+(?:(?:credible|sufficient|reliable|accepted|clear|direct|convincing|available)\\s+)?(?:evidence|reason|basis|support)(?:\\s+(?:to\\s+(?:believe|conclude|infer|establish|say)(?:\\s+that)?|that))?|" +
    "\\b(?:it\\s+is\\s+)?(?:doubtful|unclear|unproven|unsupported|unestablished)\\s+that|" +
    "\\b(?:i|we|they|the\\s+model|the\\s+(?:(?:available|current|repository|code|documented)\\s+)?evidence)\\s+(?:cannot|can't|could\\s+not|do(?:es)?\\s+not)\\s+(?:conclude|establish|infer|say|show|demonstrate|verify|confirm)(?:\\s+with\\s+confidence)?\\s+that|" +
    "\\b(?:has|have)\\s+not\\s+been\\s+(?:established|shown|demonstrated|verified|confirmed)\\s+that)$",
    "u",
  );
  if (epistemicNegation.test(prefix)) return true;
  const decisionVerb = "(?:recommend(?:s|ed|ing)?|propose(?:s|d|ing)?|support(?:s|ed|ing)?|endorse(?:s|d|ing)?|accept(?:s|ed|ing)?|approve(?:s|d|ing)?|authorize(?:s|d|ing)?|confirm(?:s|ed|ing)?|choose|chooses|chose|chosen|prefer(?:s|red|ring)?)";
  const withheldDecision = new RegExp(
    `(?:\\b(?:i|we|they|he|she|it|the\\s+model)\\s+)?(?:` +
    `(?:don|doesn|didn|can|couldn|won|wouldn|shouldn|mustn|needn|isn|aren|wasn|weren|hasn|haven|hadn)['’]t(?:\\s+${decisionVerb})?|` +
    `(?:refuse|refuses|refused|decline|declines|declined|hesitate|hesitates|hesitated)\\s+to(?:\\s+${decisionVerb})?|` +
    `(?:am|is|are|was|were|remain|remains|remained)\\s+(?:unable|unwilling|reluctant|hesitant)\\s+to(?:\\s+${decisionVerb})?` +
    ")$",
    "u",
  );
  if (withheldDecision.test(prefix)) return true;
  const decisionBridge = "(?:[\\p{L}\\p{N}_]+ly|recommend(?:s|ed|ing)?|accept(?:s|ed|ing)?|approve(?:s|d|ing)?|authorize(?:s|d|ing)?|propose(?:s|d|ing)?|support(?:s|ed|ing)?|confirm(?:s|ed|ing)?|endorse(?:s|d|ing)?|choose|chooses|chose|chosen|prefer(?:s|red|ring)?|that)";
  return new RegExp(
    `(?:\\b(?:cannot|can't|never)(?:\\s+${decisionBridge}){0,4}|` +
    `\\b(?:do|does|did|is|are|was|were|has|have|had|can|could|should|would|will|must|may|might|need|needs)\\s+not(?:\\s+${decisionBridge}){0,4}|` +
    "\\b(?:not|no)|" +
    "\\b(?:reject|rejects|rejected|deny|denies|denied|dispute|disputes|disputed)(?:\\s+(?:the|this))?(?:\\s+(?:claim|proposal|idea|conclusion))?(?:\\s+that)?|" +
    "\\b(?:false|incorrect|wrong)\\s+(?:that|to)|\\b(?:not|hardly)\\s+true\\s+that)$",
    "u",
  ).test(prefix);
}

function semanticPhraseEvidence(content, phrase) {
  const normalizedContent = normalizeSemanticText(content);
  const evidence = [];
  for (const range of semanticMatchRanges(normalizedContent, phrase)) {
    const prefix = normalizedContent.slice(0, range.start);
    const boundaries = [...prefix.matchAll(/(?:[!?;]|\.(?=\s|$))\s*/gu)];
    const clauseStart = boundaries.length > 0
      ? boundaries[boundaries.length - 1].index + boundaries[boundaries.length - 1][0].length
      : 0;
    const clause = normalizedContent.slice(clauseStart);
    const occurrence = normalizedContent.slice(range.start, range.end);
    const internalNegation = /\b(?:lack|lacks|lacked|lacking)\b[^.!?;]{0,80}\b(?:authority|ownership|evidence|basis|support)\b/u.test(occurrence) ||
      /\bwithout\b[^.!?;]{0,80}\b(?:authority|ownership|evidence|basis|support)\b/u.test(occurrence);
    evidence.push({
      clause,
      negated: internalNegation || semanticOccurrenceIsNegated(clause, range.start - clauseStart),
    });
  }
  return evidence;
}

function focusedQuestionFindings(question) {
  const normalized = normalizeSemanticText(question).replace(/？/gu, "?");
  const findings = [];
  const explicitAdditionalDecision = normalized.match(
    /\band\s+also\s+(?:(?:do|would|will|should)\s+you\s+|please\s+)?(?:accept|approve|authorize|confirm|choose|decide|select|determine|prefer)\b/u,
  );
  if (explicitAdditionalDecision) findings.push(explicitAdditionalDecision[0]);
  const additionalChoice = normalized.match(
    /\b(?:and|plus|as well as)\s+(?:(?:do|would|will|should)\s+you\s+|please\s+)?(?:choose|decide|select|determine|prefer)\s+(?:whether|between|among)\b/u,
  );
  if (additionalChoice && !findings.includes(additionalChoice[0])) {
    findings.push(additionalChoice[0]);
  }
  const questionEnd = normalized.lastIndexOf("?");
  const sentenceStart = Math.max(
    normalized.lastIndexOf(".", questionEnd - 1),
    normalized.lastIndexOf("!", questionEnd - 1),
    normalized.lastIndexOf(";", questionEnd - 1),
  );
  const interrogative = normalized.slice(sentenceStart + 1, questionEnd >= 0 ? questionEnd : undefined);
  const secondInterrogative = interrogative.match(
    /(?:,\s*)?\b(?:and|plus|as\s+well\s+as)\s+(?:(?:whether|who|when|where|how|what|which)\b|(?:should|must|will|would|may|can|could)\s+(?:(?:the|a|an|this|that|these|those|any|each|every)\s+)?[\p{L}\p{N}_-]+\s+(?:be|use|adopt|remain|become|occur|happen|start|end|expire|renew|extend|allow|permit|require|own|decide|establish|publish|send|notify|retry|cancel|complete|accept|reject)\b|(?:do|does|did|is|are|was|were|has|have)\s+(?:you|we|they|it|this|that|these|those|the\s+[\p{L}\p{N}_-]+|an?\s+[\p{L}\p{N}_-]+)\b)/u,
  );
  if (secondInterrogative && !findings.includes(secondInterrogative[0])) {
    findings.push(secondInterrogative[0]);
  }
  const secondChineseInterrogative = interrogative.match(
    /(?:并且|而且|以及|同时)[^?。；;]{0,32}(?:是否|谁|何时|哪里|哪儿|如何|怎么|什么|哪(?:个|些|种|一))/u,
  );
  if (secondChineseInterrogative && !findings.includes(secondChineseInterrogative[0])) {
    findings.push(secondChineseInterrogative[0]);
  }
  const coupledImplementation = interrogative.match(
    /\band\s+(?:(?:the|a|an|our)\s+)?(?:mysql|postgres(?:ql)?|sqlite|mongodb|redis|kafka|rabbitmq|database|persistence(?:\s+engine)?|storage(?:\s+engine)?|repository\s+implementation|framework|transport|wire\s+format|schema)\b/u,
  );
  if (coupledImplementation && !findings.includes(coupledImplementation[0])) {
    findings.push(coupledImplementation[0]);
  }
  const implementationAction = interrogative.match(
    /\band\s+(?:use|using|adopt|choose|select|implement(?:\s+it)?\s+with|persist(?:\s+it)?\s+(?:with|in|using)|store(?:\s+it)?\s+(?:with|in|using))\s+(?:mysql|postgres(?:ql)?|sqlite|mongodb|redis|kafka|rabbitmq|go|golang|java|python|typescript|rust|dotnet|a\s+database|a\s+repository|a\s+framework)\b/u,
  );
  if (implementationAction && !findings.includes(implementationAction[0])) {
    findings.push(implementationAction[0]);
  }
  const implementationPurpose = interrogative.match(
    /\band\s+(?:use|using|adopt|choose|select|implement(?:\s+it)?\s+with|persist(?:\s+it)?\s+(?:with|in|using)|store(?:\s+it)?\s+(?:with|in|using))\s+[\p{L}\p{N}_.+-]+(?:\s+[\p{L}\p{N}_.+-]+){0,2}\s+(?:for|as)\s+(?:the\s+)?(?:persistence|storage|database|repository|messaging|transport|framework|implementation)\b/u,
  );
  if (implementationPurpose && !findings.includes(implementationPurpose[0])) {
    findings.push(implementationPurpose[0]);
  }
  const implementationSubjectChoice = interrogative.match(
    /\band\s+(?:should|must|will)\s+(?:persistence|storage|the\s+repository|messaging|transport|the\s+implementation)\s+(?:use|adopt|be)\b/u,
  );
  if (implementationSubjectChoice && !findings.includes(implementationSubjectChoice[0])) {
    findings.push(implementationSubjectChoice[0]);
  }
  const mandatoryMechanism = interrogative.match(
    /\band\s+(?:[\p{L}\p{N}_.+-]+\s+){0,5}(?:as\s+)?(?:the\s+)?(?:mandatory|required|default|chosen)\s+(?:persistence|storage|database|repository|messaging|transport|framework|implementation)\b/u,
  );
  if (mandatoryMechanism && !findings.includes(mandatoryMechanism[0])) {
    findings.push(mandatoryMechanism[0]);
  }
  return findings;
}

function normalizedProseClauses(content) {
  const clauses = [];
  for (const line of content
    .normalize("NFKC")
    .replace(/[’]/gu, "'")
    .replace(/\b(does|is|are|was|were|has|have|can|must|should|would|need)n't\b/giu, "$1 not")
    .split(/\r?\n/u)) {
    if (line.trim() === "") {
      clauses.push("");
      continue;
    }
    clauses.push(...line.split(/[.!?;]+/u).map((clause) => clause.trim()).filter(Boolean));
  }
  return clauses;
}

function proseTokens(clause) {
  const tokens = [];
  const matcher = /[\p{L}\p{N}_]+/gu;
  let match;
  while ((match = matcher.exec(clause)) !== null) {
    tokens.push({ value: match[0].toLowerCase(), start: match.index, end: matcher.lastIndex });
  }
  return tokens;
}

function identifierFormatFindings(content, expectedIdentifiers) {
  const expected = expectedIdentifiers.map((value) => value.toLowerCase());
  const relevantVerbs = new Set([
    "is", "are", "be", "being", "has", "have", "use", "uses", "used",
    "require", "requires", "required", "define", "defines", "defined",
    "must", "shall", "should", "may", "can", "conform", "conforms",
    "conformed", "consist", "consists", "match", "matches", "matched",
    "normalize", "normalizes", "normalized", "encode", "encodes", "encoded",
    "store", "stores", "stored", "generate", "generates", "generated",
    "represent", "represents", "represented", "prescribe", "prescribes",
    "prescribed", "mandate", "mandates", "mandated", "enforce", "enforces",
    "enforced", "apply", "applies", "applied", "accept", "accepts",
    "accepted", "start", "starts", "started", "begin", "begins", "began",
    "end", "ends", "ended",
  ]);
  const denialVerbs = new Set([
    "reject", "rejects", "rejected", "forbid", "forbids", "forbidden",
    "prohibit", "prohibits", "prohibited", "exclude", "excludes", "excluded",
    "avoid", "avoids", "avoided", "disallow", "disallows", "disallowed",
  ]);
  const formatSignal = /\b(?:UUID(?:[ -]?v?\d+)?|GUID|ULID|KSUID|CUID2?|NanoID|Snowflake(?:[ -]ID)?|ObjectID|RFC[ -]?\d{3,5}|regex|regular[ -]expression|pattern|fixed[ -]length|lowercase|uppercase|base(?:16|32|36|58|62|64)|hex(?:adecimal)?|format(?:ted|ting)?|normaliz(?:e[ds]?|ation|ing)|prefix(?:ed)?|suffix(?:ed)?|auto[ -]increment(?:ed|ing)?|sequential(?:ly)?|numeric|integer|alphanumeric|validity)\b|\b(?:length|size)(?:\s+(?:is|of|equals?))?\s*[:=]?\s*\d+\b|\b(?:starts?|begins?|ends?)\s+with\s+[`'"]?[\p{L}\p{N}_-]+|\[[^\]\r\n]{1,80}\]\s*(?:[+*?]|\{\d+(?:,\d*)?\})|\b\d+\s*[- ]?(?:character|char|digit|symbol|byte|bit)s?\b|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s\-‐‑‒–—―]+(?:one|two|three|four|five|six|seven|eight|nine))?|hundred)\s+(?:character|char|digit|symbol|byte|bit)s?\b|\b(?:ASCII[\s\-‐‑‒–—―]+)?(?:capital|small|upper[\s\-‐‑‒–—―]*case|lower[\s\-‐‑‒–—―]*case)\s+letters?\b|\bdecimal\s+(?:digits?|numerals?)\b/giu;
  const findings = [];

  function signalIsNegated(clause, tokens, signalStart) {
    const prefix = clause.slice(Math.max(0, signalStart - 80), signalStart);
    const before = tokens.filter((token) => token.end <= signalStart);
    const leadingNegativeNominal = ["no", "neither"].includes(before[0]?.value) &&
      !before.some((token) => relevantVerbs.has(token.value) || denialVerbs.has(token.value));
    return leadingNegativeNominal ||
      /\b(?:no|not|never|without|neither|nor)\s+(?:an?\s+)?$/iu.test(prefix) ||
      /\b(?:rather than|instead of|as opposed to)\s+(?:an?\s+)?$/iu.test(prefix);
  }

  function relationshipIsNegated(clause, verb, signal, direction) {
    if (!verb) return false;
    if (direction === "forward") {
      const prefix = clause.slice(Math.max(0, verb.start - 24), verb.start);
      const between = clause.slice(verb.end, signal.index);
      return /\b(?:does?|is|are|was|were|need|needs|must|shall|should|may|can)\s+not\s*$/iu.test(prefix) ||
        /\bnever\s*$/iu.test(prefix) ||
        /\b(?:no|not|never|without|neither|nor)\b/iu.test(between);
    }
    const between = clause.slice(signal.index + signal.text.length, verb.start);
    return /\b(?:does?|is|are|was|were|need|needs|must|shall|should|may|can)\s+not\b/iu.test(between) ||
      /\bnever\b/iu.test(between);
  }

  let activeIdentifiers = [];
  let identifierCarryBudget = 0;
  for (const clause of normalizedProseClauses(content)) {
    if (clause === "") {
      activeIdentifiers = [];
      identifierCarryBudget = 0;
      continue;
    }
    const tokens = proseTokens(clause);
    const explicitIdentifiers = tokens.filter((token) => expected.some((name) =>
      token.value === name || (token.value.endsWith(name) && /^[a-z][a-z0-9]*id$/u.test(token.value))));
    const carriesIdentifier = /^(?:it|its|this\s+(?:identity|identifier|value)|the\s+(?:identity|identifier|value))\b/iu.test(clause);
    const identifiers = explicitIdentifiers.length > 0
      ? explicitIdentifiers
      : carriesIdentifier && identifierCarryBudget > 0
        ? activeIdentifiers.map((value) => ({ value, start: 0, end: 0 }))
        : [];
    if (identifiers.length === 0) {
      activeIdentifiers = [];
      identifierCarryBudget = 0;
      continue;
    }

    formatSignal.lastIndex = 0;
    let match;
    while ((match = formatSignal.exec(clause)) !== null) {
      const signal = { text: match[0], index: match.index, end: formatSignal.lastIndex };
      const identifier = identifiers.reduce((nearest, candidate) => {
        const distance = candidate.end <= signal.index
          ? signal.index - candidate.end
          : candidate.start - signal.end;
        return !nearest || distance < nearest.distance ? { ...candidate, distance } : nearest;
      }, null);
      if (!identifier || signalIsNegated(clause, tokens, signal.index)) continue;

      const forward = identifier.end <= signal.index;
      const betweenTokens = tokens.filter((token) => forward
        ? token.start >= identifier.end && token.end <= signal.index
        : token.start >= signal.end && token.end <= identifier.start);
      const relationshipTokens = betweenTokens.filter((token) =>
        relevantVerbs.has(token.value) || denialVerbs.has(token.value));
      const relationship = relationshipTokens.length > 0
        ? relationshipTokens[relationshipTokens.length - 1]
        : null;
      const verb = relationship && relevantVerbs.has(relationship.value) ? relationship : null;
      const direction = forward ? "forward" : "reverse";
      if (relationship && denialVerbs.has(relationship.value)) continue;
      if (relationshipIsNegated(clause, verb, signal, direction)) continue;
      if (!verb && identifier.distance > 60) continue;

      findings.push(`${identifier.value} ${signal.text}: ${clause.slice(0, 240)}`);
    }
    if (explicitIdentifiers.length > 0) {
      activeIdentifiers = [...new Set(explicitIdentifiers.map((identifier) => identifier.value))];
      identifierCarryBudget = 3;
    } else if (carriesIdentifier) {
      identifierCarryBudget -= 1;
    }
  }
  return findings;
}

function temporaryTraceFindings(content) {
  const findings = [];
  const heading = /^#{1,6}\s+(.+)$/gmu;
  let match;
  while ((match = heading.exec(content)) !== null) {
    const title = normalizeSemanticText(match[1]);
    const subject = /\b(?:source(?:[\s\-‐‑‒–—―]+(?:item|locator))?|story|scenario|discovery|requirements?|acceptance[\s\-‐‑‒–—―]+criteria|use[\s\-‐‑‒–—―]+case|provenance|input)\b/u;
    const traceKind = /\b(?:coverage|trace|traceability|ledger|mapping|matrix|index|status|crosswalk|reconciliation|accounting|disposition|register)\b/u;
    if ((subject.test(title) && traceKind.test(title)) ||
        /^(?:traceability|coverage ledger|discovery ledger|requirements matrix|traceability matrix|story crosswalk|source reconciliation)$/u.test(title)) {
      findings.push(`heading: ${match[0]}`);
    }
  }
  let sourceContainerDepth = null;
  let traceTableActive = false;
  for (const line of content.split(/\r?\n/u)) {
    const normalized = normalizeSemanticText(line);
    const atxHeading = line.match(/^(#{1,6})\s+(.+)$/u);
    if (atxHeading) {
      traceTableActive = false;
      const depth = atxHeading[1].length;
      const title = normalizeSemanticText(atxHeading[2]);
      if (sourceContainerDepth !== null && depth <= sourceContainerDepth) {
        sourceContainerDepth = null;
      }
      if (/^(?:inputs?|source(?: items?| locators?)?|stories|scenarios|requirements?|acceptance criteria|use cases?)$/u.test(title)) {
        sourceContainerDepth = depth;
      }
      continue;
    }
    if (!/^\s*\|.*\|\s*$/u.test(line) && line.trim() !== "") {
      traceTableActive = false;
    }
    const projectSourceMapping = line.match(
      /^\s*(?:(?:[-+*]|\d+[.)])\s+)?(?:#\d+|[A-Z][A-Z0-9]{1,15}[-_]\d+[A-Z0-9_-]*)\s*(?:->|→|=>|maps?\s+to|mapped\s+to|traces?\s+to|corresponds?\s+to|(?:is\s+)?(?:covered|represented|realized|satisfied)\s+by|(?:is\s+)?accounted\s+for)\s+(.+)$/u,
    );
    if (projectSourceMapping &&
        /\b(?:aggregate|lifecycle|model|context\s+map|design|section|invariant|policy|domain\s+event|integration\s+message|value\s+object|entity|bounded\s+context)\b/iu.test(projectSourceMapping[1])) {
      findings.push(`trace project-id mapping: ${line.slice(0, 240)}`);
    }
    const sourceLocatorMapping = line.match(
      /^\s*(?:(?:[-+*]|\d+[.)])\s+)?(?:[\p{L}\p{N}_.-]+\/)*[\p{L}\p{N}_.-]+\.(?:md|txt|feature)(?::\d+(?:-\d+)?)?\s*(?:->|→|=>|maps?\s+to|mapped\s+to|traces?\s+to|corresponds?\s+to|(?:is\s+)?(?:covered|represented|realized|satisfied)\s+by|(?:is\s+)?accounted\s+for)\s+(.+)$/iu,
    );
    if (sourceLocatorMapping &&
        /\b(?:aggregate|lifecycle|model|context\s+map|design|section|invariant|policy|domain\s+event|integration\s+message|value\s+object|entity|bounded\s+context)\b/iu.test(sourceLocatorMapping[1])) {
      findings.push(`trace source-locator mapping: ${line.slice(0, 240)}`);
    }
    if (sourceContainerDepth !== null) {
      const sourceDescriptionMapping = line.match(
        /^\s*(?:(?:[-+*]|\d+[.)])\s+)?(.{2,160}?)\s*(?:->|→|=>|maps?\s+to|mapped\s+to|traces?\s+to|corresponds?\s+to|(?:is\s+)?(?:covered|represented|realized|satisfied)\s+by|(?:is\s+)?accounted\s+for)\s+(.+)$/iu,
      );
      if (sourceDescriptionMapping &&
          /\b(?:aggregate|lifecycle|model|context\s+map|design|section|invariant|policy|domain\s+event|integration\s+message|value\s+object|entity|bounded\s+context)\b/iu.test(sourceDescriptionMapping[2])) {
        findings.push(`trace source-description mapping: ${line.slice(0, 240)}`);
      }
    }
    if (/^\s*(?:(?:[-+*]|\d+[.)])\s+)?#?(?:us|ac|req|fr|nfr|story|scenario|uc|br)[- ]?\d+[a-z0-9-]*\s*(?:-(?=\s)|→(?=\s)|=>(?=\s)|(?:maps? to|mapped to|traces? to|corresponds? to|(?:is )?(?:covered|represented|realized|satisfied) by|(?:is )?accounted for)\b)/u.test(normalized)) {
      findings.push(`trace source-id mapping: ${line.slice(0, 240)}`);
    }
    if (/\b(?:story|source(?:[\s\-‐‑‒–—―]+item)|scenario)\s+(?:id\s+)?[#a-z0-9_-]+\s*(?:-|→|=>|maps? to|traces? to|corresponds? to|(?:is )?(?:covered|represented|realized|satisfied) by|(?:is )?accounted for)/u.test(normalized) ||
        /\b(?:covered|uncovered|deferred)\s+(?:source(?:[\s\-‐‑‒–—―]+item)|story|scenario)\b/u.test(normalized)) {
      findings.push(`trace row: ${line.slice(0, 240)}`);
    }
    if (/^\s*(?:[-+*]|\d+[.)])\s+(?:source(?:[\s\-‐‑‒–—―]+item)?|story|scenario|requirements?|acceptance[\s\-‐‑‒–—―]+criteria|use[\s\-‐‑‒–—―]+case|input)\s+(?:id\s+)?[#a-z0-9_-]+\s+(?:is\s+)?(?:represented|included|incorporated|addressed|accounted(?:[\s\-‐‑‒–—―]+for)?|mapped)\s+(?:in|into|by)\s+(?:the\s+)?(?:domain\s+)?(?:model|aggregate(?:[\s\-‐‑‒–—―]+design)?|context[\s\-‐‑‒–—―]+map|design|section)\b/u.test(normalized)) {
      findings.push(`trace mapping row: ${line.slice(0, 240)}`);
    }
    if (/^\s*\|.*\|\s*$/u.test(line)) {
      const cells = line.split("|").slice(1, -1).map((cell) => normalizeSemanticText(cell));
      const declaresSourceColumn = cells.some((cell) =>
        /^(?:item|input|source(?: item| locator)?|story|scenario|requirement|acceptance criteria|use case)$/u.test(cell));
      const declaresTraceColumn = cells.some((cell) =>
        /^(?:coverage|status|disposition|mapped to|represented by|realized in|satisfied by|model target|design target|trace)$/u.test(cell));
      if (declaresSourceColumn && declaresTraceColumn) traceTableActive = true;
      const hasCoverageStatus = cells.some((cell) =>
        /^(?:covered|uncovered|deferred|mapped|accounted(?: for)?|not covered|pending coverage|included|excluded|represented|incorporated|addressed|omitted)$/u.test(cell));
      const hasSourceLocator = cells.some((cell) =>
        /^(?:[#a-z]{0,12}-?\d+[a-z0-9_-]*|[^|]+\.(?:md|txt|feature)(?::\d+(?:-\d+)?)?)$/u.test(cell));
      const hasTacticalTarget = cells.some((cell) =>
        /\b(?:aggregate|lifecycle|model|context map|design|section|invariant|policy|domain event|integration message|value object|entity|bounded context)\b/u.test(cell));
      if (cells.length >= 3 && hasCoverageStatus &&
          (hasSourceLocator || ((sourceContainerDepth !== null || traceTableActive) && hasTacticalTarget))) {
        findings.push(`trace matrix row: ${line.slice(0, 240)}`);
      }
    }
  }
  return findings;
}

function scoreResult(loadedCase, result, workspace, options = {}) {
  const { config } = loadedCase;
  const expect = config.expect;
  const baseline = options.baseline;
  if (typeof baseline !== "string" || baseline.length === 0) {
    fail("scoreResult requires an immutable baseline", 2);
  }
  const executeCheck = options.executeCheck;
  if (expect.checks.length > 0 && typeof executeCheck !== "function") {
    fail("scoreResult requires an isolated check executor when checks are configured", 2);
  }
  const assertions = [];
  const textReads = new Map();
  const readWorkspaceText = (absolute) => {
    if (!textReads.has(absolute)) {
      textReads.set(absolute, readBoundedTextFile(absolute));
    }
    return textReads.get(absolute);
  };
  const currentWorkspaceSnapshot = workspaceFileSnapshot(workspace);
  const metadataChanges = gitMetadataChanges(workspace, baseline);
  assertions.push(assertion(
    "git metadata unchanged",
    metadataChanges.length === 0,
    metadataChanges.join(",") || "unchanged",
  ));
  const unsafeEntries = workspaceUnsafeEntries(workspace, currentWorkspaceSnapshot);
  assertions.push(assertion(
    "workspace contains no unsafe entries",
    unsafeEntries.length === 0,
    unsafeEntries.join(",") || "none",
  ));
  if (metadataChanges.length > 0 || unsafeEntries.length > 0) {
    return {
      passed: false,
      assertions,
      changedPaths: workspaceFilesystemChanges(workspace, baseline, currentWorkspaceSnapshot),
      checks: [],
    };
  }

  const shapeErrors = validateResultShape(result);
  assertions.push(assertion("result schema", shapeErrors.length === 0, shapeErrors.join("; ") || "valid"));
  if (shapeErrors.length > 0) {
    return { passed: false, assertions, changedPaths: changedPaths(workspace, baseline, currentWorkspaceSnapshot), checks: [] };
  }

  assertions.push(assertion("scenario id", result.scenario_id === config.id, `got ${result.scenario_id}`));
  assertions.push(assertion("phase", result.phase === config.phase, `got ${result.phase}`));
  assertions.push(assertion("completion", expect.completion.includes(result.completion), `got ${result.completion}`));
  assertions.push(assertion("review conclusion", expect.review_conclusion.includes(result.review_conclusion), `got ${result.review_conclusion}`));
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
  for (const proposition of expect.questions.propositions || []) {
    assertions.push(propositionAssertion("first question", firstQuestion, proposition));
  }
  if (result.questions.length > 0) {
    const questionMarks = (firstQuestion.match(/[?？]/gu) || []).length;
    assertions.push(assertion(
      "first question is a single question",
      questionMarks === 1,
      `found ${questionMarks} question marks`,
    ));
    const focusFindings = focusedQuestionFindings(firstQuestion);
    assertions.push(assertion(
      "first question requests one focused decision",
      focusFindings.length === 0,
      focusFindings.join(" | ") || "one decision focus",
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
        const read = isFile ? readWorkspaceText(inspected.info.absolute) : null;
        const lineCount = read?.ok ? countTextLines(read.content) : 0;
        assertions.push(assertion(
          `evidence line ${evidence.path}:${evidence.line}`,
          isFile && read.ok && evidence.line <= lineCount,
          !isFile ? "evidence line requires a file" : read.ok ? `file has ${lineCount} lines` : read.error,
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

  const actualChanged = changedPaths(workspace, baseline, currentWorkspaceSnapshot);
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
  if (expect.git.allowed_paths) {
    const unexpected = actualChanged.filter((actual) =>
      !expect.git.allowed_paths.some((allowed) => pathMatches(actual, allowed)));
    assertions.push(assertion(
      "git changed only allowed paths",
      unexpected.length === 0,
      unexpected.length === 0 ? "exact write set" : `unexpected ${unexpected.join(",")}`,
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
    const read = readWorkspaceText(inspected.info.absolute);
    assertions.push(assertion(
      `file ${fileExpectation.path} is bounded readable text`,
      read.ok,
      read.ok ? `read at most ${SNAPSHOT_MAX_FILE_BYTES} bytes` : read.error,
    ));
    if (!read.ok) {
      continue;
    }
    const content = read.content;
    const normalizedContent = normalizeSemanticText(content);
    for (const needle of fileExpectation.contains) {
      assertions.push(assertion(`file ${fileExpectation.path} contains ${needle}`, content.includes(needle), "content check"));
    }
    for (const group of fileExpectation.contains_any || []) {
      assertions.push(assertion(
        `file ${fileExpectation.path} contains any of ${group.join(" | ")}`,
        group.some((needle) => normalizedSemanticContains(normalizedContent, needle)),
        "semantic content check",
      ));
    }
    for (const needle of fileExpectation.excludes) {
      assertions.push(assertion(`file ${fileExpectation.path} excludes ${needle}`, !content.includes(needle), "exact content check"));
    }
    for (const needle of fileExpectation.excludes_semantic || []) {
      assertions.push(assertion(
        `file ${fileExpectation.path} semantically excludes ${needle}`,
        !normalizedSemanticContains(normalizedContent, needle),
        "normalized semantic exclusion check",
      ));
    }
    for (const proposition of fileExpectation.propositions || []) {
      assertions.push(propositionAssertion(
        `file ${fileExpectation.path}`,
        content,
        proposition,
      ));
    }
    if ((fileExpectation.identifiers_without_format || []).length > 0) {
      const findings = identifierFormatFindings(content, fileExpectation.identifiers_without_format);
      assertions.push(assertion(
        `file ${fileExpectation.path} invents no identifier format`,
        findings.length === 0,
        findings.join(" | ") || "no positive format rule",
      ));
    }
    if (fileExpectation.forbid_temporary_trace) {
      const findings = temporaryTraceFindings(content);
      assertions.push(assertion(
        `file ${fileExpectation.path} persists no temporary discovery trace`,
        findings.length === 0,
        findings.join(" | ") || "no source-item coverage trace",
      ));
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
  const installedAuth = path.join(codexHome, "auth.json");
  fs.copyFileSync(sourceAuth, installedAuth);
  fs.chmodSync(installedAuth, 0o600);
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
    authSource: installedAuth,
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
  const imageId = id.stdout.trim();
  if (!/^sha256:[0-9a-f]{64}$/u.test(imageId)) {
    fail(`docker image inspect returned a non-immutable image ID for ${image}`, 2);
  }
  return imageId;
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

function readOnlyGitMetadataMount(workspace) {
  return `type=bind,src=${path.join(workspace, ".git")},dst=/workspace/.git,readonly`;
}

function buildContainerCheckArgs(check, workspace, context, trialPluginCache) {
  const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
  const gid = typeof process.getgid === "function" ? process.getgid() : 1000;
  const validator = path.join(trialPluginCache, "scripts", "validate-context-map.mjs");
  const validatorMount = `type=bind,src=${validator},dst=/eval/validate-context-map.mjs,readonly`;
  return [
    "docker", "run", "--rm", "--network", "none", "--read-only",
    "--tmpfs", "/tmp:rw,exec,nosuid,nodev,size=256m",
    "--cap-drop=ALL", "--security-opt", "no-new-privileges",
    "--user", `${uid}:${gid}`,
    "-e", "HOME=/tmp/eval-home", "-e", "GOCACHE=/tmp/go-build",
    "--mount", validatorMount,
    "-v", `${workspace}:/workspace:ro`, "-w", "/workspace",
    "--mount", readOnlyGitMetadataMount(workspace),
    context.containerImage,
    "/usr/bin/timeout", "--signal=TERM", "--kill-after=5s", `${check.timeout_seconds}s`,
    ...check.argv,
  ];
}

function runContainerCheck(check, workspace, context, trialPluginCache) {
  return runManagedDockerContainer(
    buildContainerCheckArgs(check, workspace, context, trialPluginCache),
    {
      timeoutSeconds: check.timeout_seconds + 10,
      runtimeRoot: context.runtimeRoot,
      prefix: "check",
    },
  );
}

async function runTrial(loadedCase, trialNumber, infrastructureAttempt, context) {
  throwIfRunnerTerminating();
  const retrySuffix = infrastructureAttempt === 1 ? "" : `-infra-${infrastructureAttempt}`;
  const trialName = `${loadedCase.config.id}-run-${trialNumber}${retrySuffix}`;
  const trialRoot = path.join(context.outputDir, "trials", trialName);
  const workspace = path.join(trialRoot, "workspace");
  const modelOutput = path.join(trialRoot, "model-output");
  const trialCodexHome = path.join(context.runtimeRoot, "trial-homes", trialName);
  const authFile = path.join(trialCodexHome, "auth.json");
  const installedAuth = path.resolve(context.authSource);
  if (installedAuth !== path.join(path.resolve(context.codexHome), "auth.json")) {
    fail("installed auth source must be the root auth.json in the isolated Codex home", 2);
  }
  fs.mkdirSync(trialRoot, { recursive: true, mode: 0o700 });
  fs.mkdirSync(modelOutput, { recursive: true, mode: 0o700 });
  fs.chmodSync(path.join(context.outputDir, "trials"), 0o700);
  fs.chmodSync(trialRoot, 0o700);
  fs.chmodSync(modelOutput, 0o700);
  fs.cpSync(context.codexHome, trialCodexHome, {
    recursive: true,
    filter: (source) => path.resolve(source) !== installedAuth,
  });
  fs.chmodSync(trialCodexHome, 0o700);
  fs.cpSync(loadedCase.workspacePath, workspace, { recursive: true });
  const baseline = initializeGit(workspace);
  const trialPluginCache = path.join(trialCodexHome, context.pluginCacheRelative);
  if (fs.lstatSync(authFile, { throwIfNoEntry: false })) {
    fail("trial home copied the retained auth source before broker startup", 2);
  }

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
    "--mount", readOnlyGitMetadataMount(workspace),
    "-v", `${modelOutput}:/artifacts:rw`,
    "-v", `${context.resultSchema}:/eval/result.schema.json:ro`,
    "-v", `${context.codexBinary}:/usr/local/bin/codex:ro`,
    "-w", "/workspace", context.containerImage,
    "/usr/bin/timeout", "--signal=TERM", "--kill-after=10s", `${context.timeoutSeconds}s`,
    "/usr/local/bin/codex",
    ...codexArgs.slice(0, 1), "--dangerously-bypass-approvals-and-sandbox", ...codexArgs.slice(1),
  ];

  const startedAt = Date.now();
  const prompt = buildPrompt(loadedCase);
  writePrivateFile(path.join(trialRoot, "prompt.txt"), `${prompt}\n`);
  let execution;
  try {
    execution = await runCodexWithAuthFifo(
      executionArgs,
      prompt,
      context,
      context.authSource,
      authFile,
    );
  } catch (error) {
    if (requestedTerminationSignal) throw error;
    execution = {
      argv: executionArgs,
      status: null,
      signal: null,
      stdout: "",
      stderr: "",
      error: `auth FIFO trial setup failed: ${error.message}`,
      containerCleanup: { error: null, label: null, name: null },
    };
  }
  throwIfRunnerTerminating();
  writePrivateFile(path.join(trialRoot, "trace.jsonl"), execution.stdout);
  writePrivateFile(path.join(trialRoot, "stderr.log"), execution.stderr);

  let parsed = null;
  let parseError = null;
  const resultRead = readBoundedTextFile(resultFile, RESULT_MAX_FILE_BYTES);
  if (!resultRead.ok) {
    parseError = resultRead.error;
  } else {
    try {
      parsed = JSON.parse(resultRead.content);
    } catch (error) {
      parseError = `cannot parse model result JSON: ${error.message}`;
    }
  }

  const pluginReadObserved = /\/ddd-expert\/[^/\s]+\/(?:skills|references)\//.test(execution.stdout);
  let pluginUnchanged = false;
  let pluginIntegrityError = null;
  try {
    restoreDirectoryChain(trialCodexHome, context.pluginCacheRelative);
    pluginUnchanged = hashTree(trialPluginCache) === context.pluginHash;
  } catch (error) {
    pluginIntegrityError = error.message;
  }
  const gitMetadataMutation = gitMetadataChanges(workspace, baseline);
  const postTrialWorkspaceSnapshot = workspaceFileSnapshot(workspace);
  const unsafeWorkspaceEntries = workspaceUnsafeEntries(workspace, postTrialWorkspaceSnapshot);
  const executionInfrastructureFailure = execution.status !== 0 || Boolean(execution.error) || !parsed || !pluginUnchanged;
  const infrastructureFailure = executionInfrastructureFailure &&
    gitMetadataMutation.length === 0 && unsafeWorkspaceEntries.length === 0;
  let grade;
  if (gitMetadataMutation.length > 0) {
    grade = {
      passed: false,
      assertions: [assertion(
        "git metadata unchanged",
        false,
        `changed ${gitMetadataMutation.join(",")}`,
      )],
      changedPaths: [...new Set([
        ...workspaceFilesystemChanges(workspace, baseline),
        ...gitMetadataMutation,
      ])].sort(),
      checks: [],
    };
  } else if (unsafeWorkspaceEntries.length > 0) {
    grade = {
      passed: false,
      assertions: [assertion(
        "workspace contains no unsafe entries",
        false,
        unsafeWorkspaceEntries.join(","),
      )],
      changedPaths: workspaceFilesystemChanges(workspace, baseline, postTrialWorkspaceSnapshot),
      checks: [],
    };
  } else if (infrastructureFailure) {
    const reasons = [
      execution.status !== 0 || execution.error ? `exit=${execution.status}; signal=${execution.signal}; error=${execution.error || "none"}` : null,
      !parsed ? execution.error || parseError || "missing structured result" : null,
      !pluginUnchanged ? pluginIntegrityError || "installed ddd-expert cache changed during the trial" : null,
    ].filter(Boolean);
    grade = {
      passed: false,
      assertions: [assertion(
        "valid model trial",
        false,
        `${reasons.join("; ")}; ${[execution.stderr, execution.stdout].filter(Boolean).join("\n").slice(-1200)}`,
      )],
      changedPaths: changedPaths(workspace, baseline, postTrialWorkspaceSnapshot),
      checks: [],
    };
  } else {
    grade = scoreResult(loadedCase, parsed, workspace, {
      baseline,
      executeCheck: (check) => runContainerCheck(check, workspace, context, trialPluginCache),
    });
  }

  const trialResult = {
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
      pluginIntegrityError,
      gitMetadataUnchanged: gitMetadataMutation.length === 0,
      containerCleanup: execution.containerCleanup,
    },
    result: parsed,
    grade,
    artifactPath: trialRoot,
  };
  hardenArtifactTree(trialRoot);
  return trialResult;
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
    const expectedCompletions = ["completed", "stopped", "needs_clarification"];
    if (JSON.stringify([...RESULT_COMPLETIONS].sort()) !== JSON.stringify(expectedCompletions.sort())) {
      fail(`result schema completion values differ: ${RESULT_COMPLETIONS.join(", ")}`, 2);
    }
    const expectFailure = (operation, pattern, label) => {
      try {
        operation();
      } catch (error) {
        if (pattern.test(error.message)) return;
        fail(`${label} failed for the wrong reason: ${error.message}`, 2);
      }
      fail(`${label} unexpectedly succeeded`, 2);
    };
    const originalUmask = process.umask(0o002);
    try {
      const privateOutput = preparePrivateOutputRoot(path.join(tempRoot, "private-output"));
      const nestedOutput = path.join(privateOutput, "trials", "one");
      fs.mkdirSync(nestedOutput, { recursive: true, mode: 0o777 });
      fs.writeFileSync(path.join(nestedOutput, "copied.txt"), "private\n", { mode: 0o666 });
      writePrivateFile(path.join(privateOutput, "summary.json"), "{}\n");
      hardenArtifactTree(privateOutput);
      for (const directory of [privateOutput, path.join(privateOutput, "trials"), nestedOutput]) {
        if ((fs.lstatSync(directory).mode & 0o7777) !== 0o700) {
          fail(`private artifact directory does not have mode 0700: ${directory}`, 2);
        }
      }
      for (const file of [path.join(nestedOutput, "copied.txt"), path.join(privateOutput, "summary.json")]) {
        if ((fs.lstatSync(file).mode & 0o7777) !== 0o600) {
          fail(`private artifact file does not have mode 0600: ${file}`, 2);
        }
      }

      const linkTarget = path.join(tempRoot, "output-link-target");
      fs.mkdirSync(linkTarget, { mode: 0o700 });
      const linkedOutput = path.join(tempRoot, "linked-output");
      fs.symlinkSync(linkTarget, linkedOutput);
      expectFailure(
        () => preparePrivateOutputRoot(linkedOutput),
        /symlink|real directory/u,
        "private output symlink check",
      );

      const traversalTarget = path.join(tempRoot, "output-traversal-target");
      fs.mkdirSync(traversalTarget, { mode: 0o700 });
      const traversalLink = path.join(tempRoot, "output-traversal-link");
      fs.symlinkSync(traversalTarget, traversalLink);
      expectFailure(
        () => preparePrivateOutputRoot(path.join(traversalLink, "created")),
        /symlink|real director/u,
        "private output ancestor symlink check",
      );
      if (fs.existsSync(path.join(traversalTarget, "created"))) {
        fail("private output ancestor symlink check wrote through the symlink before rejecting it", 2);
      }

      const writableParent = path.join(tempRoot, "untrusted-writable-output-parent");
      fs.mkdirSync(writableParent, { mode: 0o777 });
      fs.chmodSync(writableParent, 0o777);
      expectFailure(
        () => preparePrivateOutputRoot(path.join(writableParent, "created")),
        /untrusted writable directory/u,
        "private output writable ancestor check",
      );
      if (fs.existsSync(path.join(writableParent, "created"))) {
        fail("private output writable ancestor check created a directory before rejecting its parent", 2);
      }

      const hardlinkSource = path.join(tempRoot, "output-hardlink-source");
      fs.writeFileSync(hardlinkSource, "source\n", { mode: 0o644 });
      const hardlinkedOutput = path.join(tempRoot, "hardlinked-output");
      fs.linkSync(hardlinkSource, hardlinkedOutput);
      expectFailure(
        () => preparePrivateOutputRoot(hardlinkedOutput),
        /hard-linked|real directory/u,
        "private output hardlink check",
      );

      const hardlinkTree = preparePrivateOutputRoot(path.join(tempRoot, "hardlink-tree"));
      const outsideArtifact = path.join(tempRoot, "outside-artifact");
      fs.writeFileSync(outsideArtifact, "outside\n", { mode: 0o644 });
      fs.linkSync(outsideArtifact, path.join(hardlinkTree, "linked-artifact"));
      expectFailure(
        () => hardenArtifactTree(hardlinkTree),
        /non-hard-linked/u,
        "retained artifact hardlink check",
      );
      if ((fs.lstatSync(outsideArtifact).mode & 0o7777) !== 0o644) {
        fail("retained artifact hardlink check changed the outside inode mode", 2);
      }
    } finally {
      process.umask(originalUmask);
    }
    const trialPluginCache = path.join(tempRoot, "trial-plugin-cache");
    const selfTestImageId = `sha256:${"a".repeat(64)}`;
    const containerCheckArgs = buildContainerCheckArgs(
      {
        argv: ["node", "/eval/validate-context-map.mjs", "docs/ddd-expert/context-map.md"],
        timeout_seconds: 30,
      },
      "/tmp/trial-workspace",
      { containerImage: selfTestImageId },
      trialPluginCache,
    );
    const imageIndex = containerCheckArgs.indexOf(selfTestImageId);
    if (imageIndex < 0 || containerCheckArgs[imageIndex + 1] !== "/usr/bin/timeout") {
      fail(`container check did not execute the immutable image with an in-container timeout: ${containerCheckArgs.join(" ")}`, 2);
    }
    const expectedValidatorMount = `type=bind,src=${path.join(trialPluginCache, "scripts", "validate-context-map.mjs")},dst=/eval/validate-context-map.mjs,readonly`;
    const validatorMountIndex = containerCheckArgs.indexOf(expectedValidatorMount);
    if (validatorMountIndex < 1 || containerCheckArgs[validatorMountIndex - 1] !== "--mount") {
      fail(`container check omitted the trial validator mount: ${containerCheckArgs.join(" ")}`, 2);
    }
    const expectedGitMetadataMount = readOnlyGitMetadataMount("/tmp/trial-workspace");
    const gitMetadataMountIndex = containerCheckArgs.indexOf(expectedGitMetadataMount);
    if (gitMetadataMountIndex < 1 || containerCheckArgs[gitMetadataMountIndex - 1] !== "--mount") {
      fail(`container check omitted the read-only Git metadata mount: ${containerCheckArgs.join(" ")}`, 2);
    }
    if (!containerCheckArgs.includes("/tmp/trial-workspace:/workspace:ro")) {
      fail(`container check did not mount the post-run workspace read-only: ${containerCheckArgs.join(" ")}`, 2);
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
    const exactWriteWorkspace = path.join(tempRoot, "exact-write-workspace");
    fs.mkdirSync(exactWriteWorkspace, { recursive: true });
    fs.writeFileSync(path.join(exactWriteWorkspace, ".gitignore"), "source-coverage.md\n");
    const exactWriteBaseline = initializeGit(exactWriteWorkspace);
    fs.writeFileSync(path.join(exactWriteWorkspace, "expected.md"), "accepted artifact\n");
    fs.writeFileSync(path.join(exactWriteWorkspace, "source-coverage.md"), "temporary trace\n");
    const exactWriteCase = {
      config: {
        id: "exact-write-set",
        phase: "shape",
        expect: {
          completion: ["completed"],
          review_conclusion: ["not_applicable"],
          questions: { min: 0, max: 0 },
          routes: { contains: [], excludes: [] },
          verdicts: [],
          forbid_verdicts: [],
          git: {
            changed: "some",
            required_paths: ["expected.md"],
            forbidden_paths: [],
            allowed_paths: ["expected.md"],
          },
          files: [],
          checks: [],
        },
      },
    };
    const exactWriteResult = {
      scenario_id: "exact-write-set",
      phase: "shape",
      completion: "completed",
      review_conclusion: "not_applicable",
      questions: [],
      routes: [],
      verdicts: [],
      changed_files: ["expected.md", "source-coverage.md"],
      verification: [],
    };
    const ignoredExtraWriteGrade = scoreResult(
      exactWriteCase,
      exactWriteResult,
      exactWriteWorkspace,
      { baseline: exactWriteBaseline },
    );
    const ignoredExactSetAssertion = ignoredExtraWriteGrade.assertions.find((item) =>
      item.name === "git changed only allowed paths");
    if (ignoredExtraWriteGrade.passed || !ignoredExactSetAssertion || ignoredExactSetAssertion.passed) {
      fail("scorer failed to expose an ignored file outside the declared exact write set", 2);
    }
    fs.rmSync(path.join(exactWriteWorkspace, "source-coverage.md"));
    const allowedWriteGrade = scoreResult(
      exactWriteCase,
      { ...exactWriteResult, changed_files: ["expected.md"] },
      exactWriteWorkspace,
      { baseline: exactWriteBaseline },
    );
    if (!allowedWriteGrade.passed) {
      fail(`scorer rejected the declared exact write set: ${JSON.stringify(allowedWriteGrade.assertions)}`, 2);
    }
    fs.chmodSync(path.join(exactWriteWorkspace, "expected.md"), 0o4644);
    const specialModeGrade = scoreResult(
      exactWriteCase,
      { ...exactWriteResult, changed_files: ["expected.md"] },
      exactWriteWorkspace,
      { baseline: exactWriteBaseline },
    );
    if (specialModeGrade.passed || !specialModeGrade.assertions.some((item) =>
      item.name === "workspace contains no unsafe entries" && !item.passed)) {
      fail("scorer accepted a set-ID mode on a model-controlled artifact", 2);
    }
    fs.chmodSync(path.join(exactWriteWorkspace, "expected.md"), 0o644);
    const unsafeParent = path.join(exactWriteWorkspace, "unsafe-parent");
    fs.mkdirSync(unsafeParent, { mode: 0o777 });
    fs.chmodSync(unsafeParent, 0o2777);
    fs.writeFileSync(path.join(unsafeParent, "artifact.md"), "unsafe parent\n");
    const unsafeParentGrade = scoreResult(
      exactWriteCase,
      {
        ...exactWriteResult,
        changed_files: ["expected.md", "unsafe-parent/artifact.md"],
      },
      exactWriteWorkspace,
      { baseline: exactWriteBaseline },
    );
    if (unsafeParentGrade.passed || !unsafeParentGrade.assertions.some((item) =>
      item.name === "workspace contains no unsafe entries" && !item.passed)) {
      fail("scorer suppressed an unsafe mode on a new artifact directory", 2);
    }
    fs.rmSync(unsafeParent, { recursive: true, force: true });
    const hardlinkWorkspace = path.join(tempRoot, "hardlink-workspace");
    fs.mkdirSync(hardlinkWorkspace, { recursive: true });
    fs.writeFileSync(path.join(hardlinkWorkspace, "left.md"), "same bytes\n");
    fs.writeFileSync(path.join(hardlinkWorkspace, "right.md"), "same bytes\n");
    const hardlinkBaseline = initializeGit(hardlinkWorkspace);
    fs.rmSync(path.join(hardlinkWorkspace, "right.md"));
    fs.linkSync(
      path.join(hardlinkWorkspace, "left.md"),
      path.join(hardlinkWorkspace, "right.md"),
    );
    let refusedHardlinkTopology = false;
    try {
      changedPaths(hardlinkWorkspace, hardlinkBaseline);
    } catch (error) {
      refusedHardlinkTopology = error.exitCode === 2 &&
        error.message.includes("cannot be inspected safely");
    }
    if (!refusedHardlinkTopology ||
        !workspaceUnsafeEntries(hardlinkWorkspace).includes("left.md") ||
        !workspaceUnsafeEntries(hardlinkWorkspace).includes("right.md")) {
      fail("bounded workspace traversal accepted a hard-link topology substitution", 2);
    }
    const metadataWorkspace = path.join(tempRoot, "git-metadata-workspace");
    fs.mkdirSync(metadataWorkspace, { recursive: true });
    fs.writeFileSync(path.join(metadataWorkspace, "domain.md"), "accepted baseline\n");
    const metadataBaseline = initializeGit(metadataWorkspace);
    const fsmonitorProbe = path.join(tempRoot, "fsmonitor-probe.sh");
    const fsmonitorMarker = path.join(tempRoot, "fsmonitor-executed");
    fs.writeFileSync(fsmonitorProbe, `#!/bin/sh\ntouch "${fsmonitorMarker}"\nprintf '\\n'\n`);
    fs.chmodSync(fsmonitorProbe, 0o755);
    fs.appendFileSync(
      path.join(metadataWorkspace, ".git", "config"),
      `\n[core]\n\tfsmonitor = "${fsmonitorProbe}"\n`,
    );
    let refusedMutatedMetadata = false;
    try {
      changedPaths(metadataWorkspace, metadataBaseline);
    } catch (error) {
      refusedMutatedMetadata = error.exitCode === 2 &&
        error.message.includes("Git metadata changed after the immutable baseline");
    }
    if (!refusedMutatedMetadata || fs.existsSync(fsmonitorMarker)) {
      fail("scorer invoked Git after workspace-controlled metadata changed", 2);
    }
    const hostileHome = path.join(tempRoot, "hostile-codex-home");
    const hostilePluginRelative = path.join("plugins", "cache", "ddd-expert", "1.0.0");
    const hostilePlugin = path.join(hostileHome, hostilePluginRelative);
    fs.mkdirSync(hostilePlugin, { recursive: true });
    fs.writeFileSync(path.join(hostilePlugin, "SKILL.md"), "immutable plugin\n");
    const hostilePluginHash = hashTree(hostilePlugin);
    fs.chmodSync(path.join(hostileHome, "plugins"), 0o000);
    fs.chmodSync(hostileHome, 0o000);
    restoreDirectoryChain(hostileHome, hostilePluginRelative);
    if (hashTree(hostilePlugin) !== hostilePluginHash) {
      fail("permission repair changed the protected plugin cache", 2);
    }
    const cleanupSentinel = path.join(tempRoot, "cleanup-sentinel");
    fs.writeFileSync(cleanupSentinel, "must survive\n");
    fs.symlinkSync(cleanupSentinel, path.join(hostileHome, "external-link"));
    fs.chmodSync(path.join(hostileHome, "plugins"), 0o000);
    fs.chmodSync(hostileHome, 0o000);
    removeUntrustedTree(hostileHome);
    if (fs.existsSync(hostileHome) || !fs.statSync(cleanupSentinel).isFile()) {
      fail("untrusted CODEX_HOME cleanup failed or followed an external symlink", 2);
    }
    const hostileEntryWorkspace = path.join(tempRoot, "hostile-entry-workspace");
    fs.mkdirSync(hostileEntryWorkspace, { recursive: true });
    if (process.platform !== "win32") {
      const fifoPath = path.join(hostileEntryWorkspace, "model-created.fifo");
      requireSuccess(runCommand(["mkfifo", fifoPath], { timeoutSeconds: 5 }), "mkfifo scorer self-test");
      const hostileSnapshot = workspaceFileSnapshot(hostileEntryWorkspace);
      if (!hostileSnapshot.get("model-created.fifo")?.startsWith("special:") ||
          !workspaceUnsafeEntries(hostileEntryWorkspace).includes("model-created.fifo")) {
        fail("bounded workspace traversal did not classify a model-created FIFO as unsafe", 2);
      }
      const fifoRead = readBoundedTextFile(fifoPath);
      if (fifoRead.ok || !fifoRead.error.includes("not a regular file")) {
        fail("bounded text reader attempted to accept a model-created FIFO", 2);
      }
      const resultSymlink = path.join(hostileEntryWorkspace, "result.json");
      fs.symlinkSync("result.json", resultSymlink);
      const symlinkRead = readBoundedTextFile(resultSymlink, RESULT_MAX_FILE_BYTES);
      if (symlinkRead.ok || !symlinkRead.error.includes("not a regular file")) {
        fail("bounded model-result reader followed a model-created symlink", 2);
      }
    }
    const oversizedWorkspace = path.join(tempRoot, "oversized-artifact-workspace");
    fs.mkdirSync(oversizedWorkspace, { recursive: true });
    const oversizedPath = path.join(oversizedWorkspace, "oversized.md");
    fs.writeFileSync(oversizedPath, "baseline\n");
    const oversizedBaseline = initializeGit(oversizedWorkspace);
    const oversizedDescriptor = fs.openSync(oversizedPath, "w");
    try {
      fs.ftruncateSync(oversizedDescriptor, SNAPSHOT_MAX_FILE_BYTES + 1);
    } finally {
      fs.closeSync(oversizedDescriptor);
    }
    const oversizedRead = readBoundedTextFile(oversizedPath);
    if (oversizedRead.ok || !oversizedRead.error.includes("file exceeds")) {
      fail("bounded text reader accepted an oversized model-controlled artifact", 2);
    }
    const oversizedCase = {
      config: {
        id: "oversized-artifact",
        phase: "guard",
        expect: {
          completion: ["completed"],
          review_conclusion: ["clear"],
          questions: { min: 0, max: 0 },
          routes: { contains: [], excludes: [] },
          verdicts: [],
          forbid_verdicts: ["violation", "evidence_gap"],
          git: {
            changed: "some",
            required_paths: ["oversized.md"],
            forbidden_paths: [],
            allowed_paths: ["oversized.md"],
          },
          files: [{ path: "oversized.md", exists: true, contains: ["required marker"], excludes: [] }],
          checks: [],
        },
      },
    };
    const oversizedResult = {
      scenario_id: "oversized-artifact",
      phase: "guard",
      completion: "completed",
      review_conclusion: "clear",
      questions: [],
      routes: [],
      verdicts: [],
      changed_files: ["oversized.md"],
      verification: [],
    };
    const oversizedGrade = scoreResult(
      oversizedCase,
      oversizedResult,
      oversizedWorkspace,
      { baseline: oversizedBaseline },
    );
    const oversizedSafetyAssertion = oversizedGrade.assertions.find((item) =>
      item.name === "workspace contains no unsafe entries");
    if (oversizedGrade.passed || !oversizedSafetyAssertion || oversizedSafetyAssertion.passed) {
      fail("scorer accepted an oversized model-controlled artifact", 2);
    }
    const nulEvidenceGrade = scoreResult(
      loadedCase,
      {
        ...good,
        verdicts: [{
          ...good.verdicts[0],
          evidence: [{ path: "internal/\0evidence.go", line: 1, detail: "invalid path" }],
        }],
      },
      workspace,
      scoreOptions,
    );
    if (nulEvidenceGrade.passed || !nulEvidenceGrade.assertions.some((item) =>
      item.name.startsWith("evidence path internal/") && !item.passed)) {
      fail("scorer accepted or crashed on a NUL-bearing evidence path", 2);
    }
    let rejectedMissingBaseline = false;
    try {
      scoreResult(loadedCase, good, workspace, { baseline: "missing-baseline" });
    } catch (error) {
      rejectedMissingBaseline = error.exitCode === 2 &&
        error.message.includes("missing immutable Git metadata baseline");
    }
    if (!rejectedMissingBaseline) {
      fail("scorer accepted a baseline without immutable snapshots", 2);
    }
    if (typeof process.getuid !== "function" || process.getuid() !== 0) {
      const unreadableWorkspace = path.join(tempRoot, "unreadable-workspace");
      const unreadableDirectory = path.join(unreadableWorkspace, "locked");
      fs.mkdirSync(unreadableDirectory, { recursive: true });
      fs.writeFileSync(path.join(unreadableDirectory, "evidence.md"), "evidence\n");
      const unreadableBaseline = initializeGit(unreadableWorkspace);
      fs.chmodSync(unreadableDirectory, 0o000);
      try {
        const unreadableCase = {
          config: {
            ...loadedCase.config,
            id: "unreadable-workspace",
            expect: {
              ...loadedCase.config.expect,
              git: { changed: "some", required_paths: [], forbidden_paths: [] },
              files: [],
            },
          },
        };
        const unreadableResult = {
          ...good,
          scenario_id: "unreadable-workspace",
          changed_files: ["locked"],
          verdicts: [{
            ...good.verdicts[0],
            evidence: [{ path: "locked/evidence.md", line: 1, detail: "must fail safely" }],
          }],
        };
        const unreadableGrade = scoreResult(
          unreadableCase,
          unreadableResult,
          unreadableWorkspace,
          { baseline: unreadableBaseline },
        );
        if (unreadableGrade.passed || !unreadableGrade.assertions.some((item) =>
          item.name === "workspace contains no unsafe entries" && !item.passed)) {
          fail("scorer did not fail closed on an unreadable artifact directory", 2);
        }
      } finally {
        fs.chmodSync(unreadableDirectory, 0o700);
      }
    }
    const invalidCompletionCaseDir = path.join(tempRoot, "guard-invalid-completion");
    fs.mkdirSync(path.join(invalidCompletionCaseDir, "workspace"), { recursive: true });
    fs.writeFileSync(path.join(invalidCompletionCaseDir, "prompt.md"), "Guard the implementation.\n");
    let rejectedInvalidCompletionCase = false;
    try {
      validateCase(invalidCompletionCaseDir, {
        id: "guard-invalid-completion",
        phase: "guard",
        suites: ["smoke"],
        sandbox: "read-only",
        prompt: "prompt.md",
        workspace: "workspace",
        expect: { ...loadedCase.config.expect, completion: ["invalid"] },
      });
    } catch (error) {
      rejectedInvalidCompletionCase = error.exitCode === 2 && error.message.includes("invalid expected completion");
    }
    if (!rejectedInvalidCompletionCase) {
      fail("case validator accepted an invalid completion", 2);
    }
    let rejectedIncompleteAllowedSet = false;
    try {
      validateCase(invalidCompletionCaseDir, {
        id: "guard-invalid-completion",
        phase: "guard",
        suites: ["smoke"],
        sandbox: "read-only",
        prompt: "prompt.md",
        workspace: "workspace",
        expect: {
          ...loadedCase.config.expect,
          git: {
            changed: "some",
            required_paths: ["domain.md"],
            forbidden_paths: [],
            allowed_paths: [],
          },
        },
      });
    } catch (error) {
      rejectedIncompleteAllowedSet = error.exitCode === 2 &&
        error.message.includes("required_paths must be included in allowed_paths");
    }
    if (!rejectedIncompleteAllowedSet) {
      fail("case validator accepted required paths outside allowed_paths", 2);
    }
    if (validateResultShape({ ...good, completion: "invalid" }).length === 0) {
      fail("result validator accepted an invalid completion", 2);
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
      ["Its stable `LineId` provides identity.", "stable LineId"],
      ["| Pending | `AllocateLine` |", "Pending AllocateLine"],
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
    const baselineLifecycleConfig = readJson(path.join(
      CASES_ROOT,
      "explore-baseline-with-open-lifecycle",
      "case.json",
    ));
    const baselineLifecycleCase = { ...loadedCase, config: baselineLifecycleConfig };
    const baselineLifecycleResult = {
      ...goodExplore,
      scenario_id: baselineLifecycleConfig.id,
      completion: "needs_clarification",
      questions: [
        "docs/stories.md says Purchase acceptance follows stock and fraud checks but leaves the failed-check outcome unresolved. I recommend deciding this before retries: when either check fails, does Purchase remain pending for review and retry, or reach a terminal outcome?",
      ],
    };
    if (!scoreResult(baselineLifecycleCase, baselineLifecycleResult, workspace, scoreOptions).passed) {
      fail("scorer rejected an evidence-bearing Purchase failure-lifecycle question", 2);
    }
    const fundsOnlyLifecycleResult = {
      ...baselineLifecycleResult,
      questions: ["When may treasury confirm, reverse, or expire Funds Settled?"],
    };
    if (scoreResult(baselineLifecycleCase, fundsOnlyLifecycleResult, workspace, scoreOptions).passed) {
      fail("scorer accepted a Funds-only question that skipped the first unresolved Purchase path", 2);
    }
    const deferredCoverageResult = {
      ...baselineLifecycleResult,
      questions: [
        "I reviewed the story list but still need to review the Purchase acceptance and fulfillment release paths. The remaining unresolved Funds lifecycle question concerns when treasury may confirm, reverse, or expire Funds Settled.",
      ],
    };
    if (scoreResult(baselineLifecycleCase, deferredCoverageResult, workspace, scoreOptions).passed) {
      fail("scorer accepted planned Purchase coverage as already completed coverage", 2);
    }
    const existingBaselineConfig = readJson(path.join(
      CASES_ROOT,
      "explore-existing-system-baseline",
      "case.json",
    ));
    const existingBaselineCase = { ...loadedCase, config: existingBaselineConfig };
    const existingBaselineResult = {
      ...goodExplore,
      scenario_id: existingBaselineConfig.id,
      completion: "needs_clarification",
      questions: [
        "Repository evidence in README and docs/architecture.md suggests this provisional candidate baseline: Agent Execution owns run admission, execution identity, lease fencing, and terminal execution outcomes; Agent Execution is upstream and fans out to Work, which owns business completion, and Project Knowledge, which owns Candidate acceptance. Package names and calls are evidence rather than authority. Do you confirm this baseline?",
      ],
    };
    if (!scoreResult(existingBaselineCase, existingBaselineResult, workspace, scoreOptions).passed) {
      fail("scorer rejected a complete evidence-qualified three-context baseline", 2);
    }
    const incompleteExecutionAuthorityGrade = scoreResult(
      existingBaselineCase,
      {
        ...existingBaselineResult,
        questions: [existingBaselineResult.questions[0].replace(
          ", execution identity",
          "",
        )],
      },
      workspace,
      scoreOptions,
    );
    if (incompleteExecutionAuthorityGrade.passed ||
        !incompleteExecutionAuthorityGrade.assertions.some((item) =>
          item.name === "first question establishes Agent Execution owns execution identity" &&
          !item.passed)) {
      fail("scorer accepted a reconstructed baseline with incomplete Agent Execution authority", 2);
    }
    const projectedRecoveryChangeGrade = scoreResult(
      existingBaselineCase,
      {
        ...existingBaselineResult,
        questions: [existingBaselineResult.questions[0].replace(
          "Do you confirm this baseline?",
          "I recommend publishing LeaseRecovered as a recovery event. Do you confirm this baseline and accept external recovery visibility?",
        )],
      },
      workspace,
      scoreOptions,
    );
    if (projectedRecoveryChangeGrade.passed ||
        !projectedRecoveryChangeGrade.assertions.some((item) =>
          (item.name === "first question excludes publish* ... recovery" ||
           item.name === "first question excludes recovery event") && !item.passed)) {
      fail("scorer accepted a requested recovery change inside baseline confirmation", 2);
    }
    if (scoreResult(
      existingBaselineCase,
      { ...existingBaselineResult, questions: ["Is the current Work boundary accepted?"] },
      workspace,
      scoreOptions,
    ).passed) {
      fail("scorer accepted a trivial existing-system boundary question", 2);
    }
    const reversedExistingBaselineGrade = scoreResult(
      existingBaselineCase,
      {
        ...existingBaselineResult,
        questions: [
          "Repository evidence suggests this candidate baseline: Agent Execution does not own run admission; Work does not own business completion; Project Knowledge does not own Candidate acceptance; Agent Execution is upstream and fans out to both contexts. Package names and calls are evidence rather than authority. Do you confirm this baseline?",
        ],
      },
      workspace,
      scoreOptions,
    );
    if (reversedExistingBaselineGrade.passed ||
        !reversedExistingBaselineGrade.assertions.some((item) =>
          item.name.startsWith("first question establishes") && !item.passed)) {
      fail("scorer accepted a candidate baseline that reversed every context authority", 2);
    }
    const ambiguousUpstreamBaselineGrade = scoreResult(
      existingBaselineCase,
      {
        ...existingBaselineResult,
        questions: [
          "Repository evidence suggests this candidate baseline: Agent Execution owns run admission; Work owns business completion; Project Knowledge owns Candidate acceptance; it is upstream and fans out to Work and Agent Execution. Package names and calls are evidence rather than authority. Do you confirm this baseline?",
        ],
      },
      workspace,
      scoreOptions,
    );
    if (ambiguousUpstreamBaselineGrade.passed ||
        !ambiguousUpstreamBaselineGrade.assertions.some((item) =>
          item.name === "first question establishes Agent Execution is upstream of Project Knowledge" && !item.passed)) {
      fail("scorer accepted a pronoun that assigned upstream fan-out to Project Knowledge", 2);
    }
    const reversedProjectKnowledgeEdgeGrade = scoreResult(
      existingBaselineCase,
      {
        ...existingBaselineResult,
        questions: [
          "Repository evidence suggests this candidate baseline: Agent Execution owns run admission; Work owns business completion; Project Knowledge owns Candidate acceptance; Agent Execution -> Work; Project Knowledge -> Agent Execution. Package names and calls are evidence rather than authority. Do you confirm this baseline?",
        ],
      },
      workspace,
      scoreOptions,
    );
    if (reversedProjectKnowledgeEdgeGrade.passed ||
        !reversedProjectKnowledgeEdgeGrade.assertions.some((item) =>
          item.name === "first question establishes Agent Execution is upstream of Project Knowledge" &&
          !item.passed)) {
      fail("scorer accepted a reversed Project Knowledge -> Agent Execution edge", 2);
    }
    const integratedExploreConfig = readJson(path.join(
      CASES_ROOT,
      "explore-integrated-model-acceptance",
      "case.json",
    ));
    const integratedExploreCase = { ...loadedCase, config: integratedExploreConfig };
    const integratedExploreWorkspace = path.join(tempRoot, "integrated-explore-workspace");
    fs.cpSync(
      path.join(CASES_ROOT, "explore-integrated-model-acceptance", "workspace"),
      integratedExploreWorkspace,
      { recursive: true },
    );
    const integratedExploreBaseline = initializeGit(integratedExploreWorkspace);
    const integratedMapRelative = "docs/ddd-expert/context-map.md";
    const integratedPaymentRelative = "docs/ddd-expert/context/payment/model.md";
    const integratedOrderRelative = "docs/ddd-expert/context/order/model.md";
    const acceptedIntegratedMap = `# Context Map

## Global View

Arrow direction: \`U -> D\` (Upstream model/published-contract influence -> Downstream model). It does not describe runtime call flow.

\`\`\`mermaid
graph LR
    payment["Payment"]
    order["Order"]
    payment --> order
\`\`\`

## Bounded Contexts

### Payment

- **Core responsibility:** Own payment processing and its outcomes.
- **Business authority:** Payment owns the Payment Capture lifecycle and Payment Captured.

#### Local View

- \`Payment -> Order [D]\`

#### Downstream Contracts

##### Payment Captured

- **Downstream:** Order
- **Published meaning:** A Payment Capture reached its terminal Captured outcome.
- **Guarantee:** Payment is authoritative and gives Order no authority to redefine that outcome.

### Order

- **Core responsibility:** Own customer orders and fulfillment readiness.
- **Business authority:** Order owns its local reaction and readiness decision.

#### Local View

- \`Payment [U] -> Order\`

#### Upstream Dependencies

##### Payment Captured

- **Upstream:** Payment
- **Accepted meaning:** Payment authoritatively established its terminal Captured outcome.
- **Local translation:** Order records Captured Payment Evidence; it does not itself mean fulfillment readiness.
`;
    const acceptedPaymentModel = `---
context: Payment
model_revision: 2
---

# Payment Domain Model

Payment is the sole authority for the Payment Capture lifecycle and its terminal Captured outcome. Payment establishes and publishes Payment Captured, while publication gives Order no authority to redefine its meaning.
`;
    const acceptedOrderModel = `---
context: Order
model_revision: 2
---

# Order Domain Model

Order owns fulfillment readiness and translates Payment Captured into Captured Payment Evidence. That evidence does not by itself mean readiness: only an active Order may become Ready for Fulfillment. Duplicate delivery is idempotent, and a cancelled Order remains cancelled and cannot become Ready for Fulfillment.
`;
    fs.writeFileSync(path.join(integratedExploreWorkspace, integratedMapRelative), acceptedIntegratedMap);
    fs.writeFileSync(path.join(integratedExploreWorkspace, integratedPaymentRelative), acceptedPaymentModel);
    fs.writeFileSync(path.join(integratedExploreWorkspace, integratedOrderRelative), acceptedOrderModel);
    const integratedChangedFiles = [
      integratedMapRelative,
      integratedOrderRelative,
      integratedPaymentRelative,
    ];
    const integratedExploreResult = {
      ...goodExplore,
      scenario_id: integratedExploreConfig.id,
      completion: "completed",
      questions: [],
      routes: [{ target: "shape", reason: "the accepted integrated Model is ready" }],
      changed_files: integratedChangedFiles,
    };
    const executeIntegratedCheck = (check) => {
      const argv = [...check.argv];
      if (argv[0] === "node" && argv[1] === "/eval/validate-context-map.mjs") {
        argv[1] = path.join(PLUGIN_ROOT, "scripts", "validate-context-map.mjs");
      }
      return runCommand(argv, {
        cwd: integratedExploreWorkspace,
        timeoutSeconds: check.timeout_seconds,
      });
    };
    const integratedExploreOptions = {
      baseline: integratedExploreBaseline,
      executeCheck: executeIntegratedCheck,
    };
    const acceptedIntegratedGrade = scoreResult(
      integratedExploreCase,
      integratedExploreResult,
      integratedExploreWorkspace,
      integratedExploreOptions,
    );
    if (!acceptedIntegratedGrade.passed) {
      fail(`scorer rejected accepted integrated Model facts: ${JSON.stringify(acceptedIntegratedGrade.assertions)}`, 2);
    }
    fs.appendFileSync(
      path.join(integratedExploreWorkspace, integratedPaymentRelative),
      "\npayment has no\nauthority over captured outcomes.\n",
    );
    const lowercaseContradictionGrade = scoreResult(
      integratedExploreCase,
      integratedExploreResult,
      integratedExploreWorkspace,
      integratedExploreOptions,
    );
    const lowercaseContradictionAssertion = lowercaseContradictionGrade.assertions.find((item) =>
      item.name === `file ${integratedPaymentRelative} semantically excludes Payment has no authority`);
    if (lowercaseContradictionGrade.passed ||
        !lowercaseContradictionAssertion || lowercaseContradictionAssertion.passed) {
      fail("scorer accepted a lowercase line-wrapped contradiction", 2);
    }
    fs.writeFileSync(
      path.join(integratedExploreWorkspace, integratedPaymentRelative),
      acceptedPaymentModel,
    );
    const sourceCoverageRelative = "docs/ddd-expert/source-coverage.md";
    fs.writeFileSync(
      path.join(integratedExploreWorkspace, sourceCoverageRelative),
      "temporary source coverage must not be persisted\n",
    );
    const extraTraceGrade = scoreResult(
      integratedExploreCase,
      {
        ...integratedExploreResult,
        changed_files: [...integratedChangedFiles, sourceCoverageRelative].sort(),
      },
      integratedExploreWorkspace,
      integratedExploreOptions,
    );
    const exactSetAssertion = extraTraceGrade.assertions.find((item) =>
      item.name === "git changed only allowed paths");
    if (extraTraceGrade.passed || !exactSetAssertion || exactSetAssertion.passed) {
      fail("integrated Explore scorer accepted a persisted source-coverage trace", 2);
    }
    fs.rmSync(path.join(integratedExploreWorkspace, sourceCoverageRelative));
    fs.appendFileSync(
      path.join(integratedExploreWorkspace, integratedPaymentRelative),
      "\n## Source Coverage\n\n- Story S-1 covered.\n",
    );
    const embeddedTraceGrade = scoreResult(
      integratedExploreCase,
      integratedExploreResult,
      integratedExploreWorkspace,
      integratedExploreOptions,
    );
    const embeddedTraceAssertion = embeddedTraceGrade.assertions.find((item) =>
      item.name === `file ${integratedPaymentRelative} excludes ## Source Coverage`);
    if (embeddedTraceGrade.passed || !embeddedTraceAssertion || embeddedTraceAssertion.passed) {
      fail("integrated Explore scorer accepted source coverage embedded in an allowed Model", 2);
    }
    fs.writeFileSync(
      path.join(integratedExploreWorkspace, integratedPaymentRelative),
      acceptedPaymentModel,
    );
    fs.appendFileSync(
      path.join(integratedExploreWorkspace, integratedMapRelative),
      "\n## Story Coverage\n\n- Story S-1 covered.\n",
    );
    const embeddedMapTraceGrade = scoreResult(
      integratedExploreCase,
      integratedExploreResult,
      integratedExploreWorkspace,
      integratedExploreOptions,
    );
    const embeddedMapTraceAssertion = embeddedMapTraceGrade.assertions.find((item) =>
      item.name === `file ${integratedMapRelative} excludes ## Story Coverage`);
    if (embeddedMapTraceGrade.passed || !embeddedMapTraceAssertion || embeddedMapTraceAssertion.passed) {
      fail("integrated Explore scorer accepted story coverage embedded in the Context Map", 2);
    }
    fs.writeFileSync(
      path.join(integratedExploreWorkspace, integratedMapRelative),
      acceptedIntegratedMap,
    );
    for (const [relative, trace] of [
      [integratedPaymentRelative, "\n## Source Item Traceability\n\n- Story S-1 -> Payment lifecycle\n"],
      [integratedPaymentRelative, "\n## Source-item Ledger\n\n- Source-item SPEC-7 covered by Payment\n"],
      [integratedMapRelative, "\n## Scenario Traceability\n\n- Scenario capture-1 maps to Payment\n"],
      [integratedMapRelative, "\n## Discovery Ledger\n\n- Story checkout-2 -> Order\n"],
      [integratedMapRelative, "\n## Traceability\n\n- Story checkout-3 -> Order\n"],
      [integratedPaymentRelative, "\n## Requirements Matrix\n\n| Requirement | Model fact | Status |\n|---|---|---|\n| S-1 | Payment lifecycle | covered |\n"],
      [integratedPaymentRelative, "\n## Story Crosswalk\n\n| Requirement | Model section | Disposition |\n|---|---|---|\n| REQ-1 | Aggregate | Included |\n"],
      [integratedPaymentRelative, "\n## Source Reconciliation\n\n- Input A is represented in Aggregate Design.\n"],
      [integratedPaymentRelative, "\n## Accepted Facts\n\n| Requirement | Model section | Disposition |\n|---|---|---|\n| REQ-2 | Lifecycle | Included |\n"],
      [integratedPaymentRelative, "\n## Accepted Facts\n\n- Input B is represented in the Model.\n"],
      [integratedPaymentRelative, "\n## Evidence\n\n- US-1 -> Reservation Aggregate\n"],
      [integratedPaymentRelative, "\n## Decisions\n\n- AC-7 maps to terminal exclusivity\n"],
      [integratedPaymentRelative, "\n## Evidence\n\n- PAY-42 -> Payment Aggregate\n"],
      [integratedPaymentRelative, "\n## Evidence\n\n- PAY-42 corresponds to Reservation Aggregate\n"],
      [integratedPaymentRelative, "\n## Evidence\n\n- PAY-42 is realized by the Reservation Aggregate\n"],
      [integratedPaymentRelative, "\n## Evidence\n\n- PAY-42 is satisfied by the Reservation lifecycle\n"],
      [integratedPaymentRelative, "\n## Evidence\n\n- PAY-42 traces to Reservation Aggregate\n"],
      [integratedPaymentRelative, "\n## Decisions\n\n- JIRA-265 maps to Work lifecycle\n"],
      [integratedPaymentRelative, "\n## Evidence\n\n- #265 represented by the Payment Model\n"],
      [integratedPaymentRelative, "\n## Evidence\n\n- docs/spec.md:12 -> Payment Aggregate\n"],
      [integratedPaymentRelative, "\n## Evidence\n\n- docs/spec.md:12 corresponds to the Reservation Aggregate\n"],
      [integratedPaymentRelative, "\n## Decisions\n\n- stories.feature:27 maps to Work lifecycle\n"],
      [integratedPaymentRelative, "\n## Inputs\n\n- Checkout cancellation => Order lifecycle\n"],
      [integratedPaymentRelative, "\n## Inputs\n\n| Input | Status | Model target |\n|---|---|---|\n| Checkout cancellation | covered | Order lifecycle |\n"],
      [integratedPaymentRelative, "\n## Reviewed Material\n\n| Item | Disposition | Realized In |\n|---|---|---|\n| Checkout cancellation | covered | Order lifecycle |\n"],
    ]) {
      const accepted = relative === integratedMapRelative ? acceptedIntegratedMap : acceptedPaymentModel;
      fs.writeFileSync(path.join(integratedExploreWorkspace, relative), `${accepted}${trace}`);
      const alternateTraceGrade = scoreResult(
        integratedExploreCase,
        integratedExploreResult,
        integratedExploreWorkspace,
        integratedExploreOptions,
      );
      const temporaryTraceAssertion = alternateTraceGrade.assertions.find((item) =>
        item.name === `file ${relative} persists no temporary discovery trace`);
      if (alternateTraceGrade.passed || !temporaryTraceAssertion || temporaryTraceAssertion.passed) {
        fail(`integrated Explore scorer accepted an alternate temporary trace in ${relative}: ${trace.trim()}`, 2);
      }
      fs.writeFileSync(path.join(integratedExploreWorkspace, relative), accepted);
    }
    if (temporaryTraceFindings(
      "Payment input is represented as a captured-payment fact in normal Domain Model prose.",
    ).length > 0) {
      fail("temporary trace scanner confused ordinary Model prose with source accounting", 2);
    }
    const contradictoryIntegratedMap = acceptedIntegratedMap
      .replace(
        "Payment owns the Payment Capture lifecycle and Payment Captured.",
        "Payment has no authority; Order owns every Captured payment fact.",
      )
      .replace(
        "Payment is authoritative and gives Order no authority to redefine that outcome.",
        "Order may redefine Payment Captured and every cancelled Order becomes ready.",
      )
      .replace(
        "Order records Captured Payment Evidence; it does not itself mean fulfillment readiness.",
        "Order records Captured Payment Evidence and every cancelled Order becomes ready.",
      );
    fs.writeFileSync(path.join(integratedExploreWorkspace, integratedMapRelative), contradictoryIntegratedMap);
    fs.writeFileSync(
      path.join(integratedExploreWorkspace, integratedPaymentRelative),
      `---
context: Payment
model_revision: 2
---
# Payment Domain Model
Order, not Payment, owns every Captured payment fact. Payment has no authority, and Order may redefine Payment Captured.
`,
    );
    fs.writeFileSync(
      path.join(integratedExploreWorkspace, integratedOrderRelative),
      `---
context: Order
model_revision: 2
---
# Order Domain Model
Payment Captured Evidence always makes a cancelled Order ready. Payment decides fulfillment readiness.
`,
    );
    const contradictoryIntegratedGrade = scoreResult(
      integratedExploreCase,
      integratedExploreResult,
      integratedExploreWorkspace,
      integratedExploreOptions,
    );
    if (contradictoryIntegratedGrade.passed ||
        contradictoryIntegratedGrade.checks.some((check) => check.status !== 0) ||
        !contradictoryIntegratedGrade.assertions.some((item) =>
          !item.passed && item.name.startsWith("file docs/ddd-expert/"))) {
      fail("scorer did not reject contradictory integrated Model facts at the file-assertion seam", 2);
    }
    const migrationExploreConfig = readJson(path.join(
      CASES_ROOT,
      "explore-migrates-legacy-context-map",
      "case.json",
    ));
    const migrationExploreCase = { ...loadedCase, config: migrationExploreConfig };
    const migrationExploreWorkspace = path.join(tempRoot, "migration-explore-workspace");
    fs.cpSync(
      path.join(CASES_ROOT, "explore-migrates-legacy-context-map", "workspace"),
      migrationExploreWorkspace,
      { recursive: true },
    );
    const migrationExploreBaseline = initializeGit(migrationExploreWorkspace);
    const migrationReadmeRelative = "docs/ddd-expert/README.md";
    const migrationMapRelative = "docs/ddd-expert/context-map.md";
    const migrationAgentRelative = "docs/ddd-expert/context/agent-execution/model.md";
    const migrationWorkRelative = "docs/ddd-expert/context/work/model.md";
    const migrationKnowledgeRelative = "docs/ddd-expert/context/project-knowledge/model.md";
    const acceptedMigrationReadme = fs.readFileSync(
      path.join(migrationExploreWorkspace, migrationReadmeRelative),
      "utf8",
    ).replace(
      "Context relationships are authoritative",
      "Context dependencies and named contracts are authoritative",
    );
    const acceptedMigrationMap = `# Context Map

## Global View

Arrow direction: \`U -> D\` (Upstream model/published-contract influence -> Downstream model). It does not describe runtime call flow.

\`\`\`mermaid
graph LR
    agent_execution["Agent Execution"]
    work["Work"]
    project_knowledge["Project Knowledge"]
    agent_execution --> work
    agent_execution --> project_knowledge
\`\`\`

## Bounded Contexts

### Agent Execution

- **Core responsibility:** Govern Agent Run admission, identity, lifecycle, and terminal outcomes.
- **Business authority:** Agent Execution owns Agent Run meaning; no dependency between Work and Project Knowledge exists.

#### Local View

- \`Agent Execution -> Work [D]\`
- \`Agent Execution -> Project Knowledge [D]\`

#### Downstream Contracts

##### Work Agent Run Outcome

- **Downstream:** Work
- **Published meaning:** Agent Execution publishes the authoritative terminal Agent Run outcome with a stable Agent Run identity.
- **Guarantee:** Work retains authority over completion; an Agent Run outcome never completes a Work.

##### Knowledge Agent Run Outcome

- **Downstream:** Project Knowledge
- **Published meaning:** Agent Execution publishes the authoritative terminal Agent Run outcome with a stable Agent Run identity.
- **Guarantee:** Project Knowledge retains authority over Candidate acceptance; an Agent Run outcome never accepts a Knowledge Candidate.

### Work

- **Core responsibility:** Govern Work and its business lifecycle.
- **Business authority:** Work owns Work lifecycle and completion.

#### Local View

- \`Agent Execution [U] -> Work\`

#### Upstream Dependencies

##### Work Agent Run Outcome

- **Upstream:** Agent Execution
- **Accepted meaning:** Work accepts an authoritative Agent Run outcome only as execution evidence.
- **Local translation:** Work translates the evidence into its own language; it does not by itself complete Work.

### Project Knowledge

- **Core responsibility:** Govern canonical project knowledge and Candidate evaluation.
- **Business authority:** Project Knowledge owns Knowledge Candidate evaluation and acceptance.

#### Local View

- \`Agent Execution [U] -> Project Knowledge\`

#### Upstream Dependencies

##### Knowledge Agent Run Outcome

- **Upstream:** Agent Execution
- **Accepted meaning:** Project Knowledge accepts an authoritative Agent Run outcome only as execution evidence.
- **Local translation:** Project Knowledge translates the evidence into Candidate evaluation language; it does not by itself accept a Candidate.
`;
    const acceptedMigrationAgentModel = `---
context: Agent Execution
model_revision: 2
---

# Agent Execution Domain Model

## Authority and Ownership

Agent Execution owns Agent Run admission, identity, lifecycle, and terminal outcomes.

## Context Dependencies

Agent Execution publishes an authoritative Agent Run Outcome with a stable Agent Run identity. Work accepts it only as execution evidence, and it does not by itself complete Work. Project Knowledge accepts it only as execution evidence, and it does not by itself accept a Candidate.
`;
    const acceptedMigrationWorkModel = `---
context: Work
model_revision: 2
---

# Work Domain Model

## Authority and Ownership

Work owns Work lifecycle and completion.

## Context Dependencies

Work accepts Agent Execution's authoritative Agent Run outcome only as execution evidence. It does not by itself complete Work.
`;
    const acceptedMigrationKnowledgeModel = `---
context: Project Knowledge
model_revision: 2
---

# Project Knowledge Domain Model

## Authority and Ownership

Project Knowledge owns Knowledge Candidate evaluation and acceptance.

## Context Dependencies

Project Knowledge accepts Agent Execution's authoritative Agent Run outcome only as execution evidence. It does not by itself accept a Candidate.
`;
    fs.writeFileSync(path.join(migrationExploreWorkspace, migrationReadmeRelative), acceptedMigrationReadme);
    fs.writeFileSync(path.join(migrationExploreWorkspace, migrationMapRelative), acceptedMigrationMap);
    fs.writeFileSync(path.join(migrationExploreWorkspace, migrationAgentRelative), acceptedMigrationAgentModel);
    fs.writeFileSync(path.join(migrationExploreWorkspace, migrationWorkRelative), acceptedMigrationWorkModel);
    fs.writeFileSync(path.join(migrationExploreWorkspace, migrationKnowledgeRelative), acceptedMigrationKnowledgeModel);
    const migrationChangedFiles = [
      migrationReadmeRelative,
      migrationMapRelative,
      migrationAgentRelative,
      migrationWorkRelative,
      migrationKnowledgeRelative,
    ];
    const migrationExploreResult = {
      ...goodExplore,
      scenario_id: migrationExploreConfig.id,
      completion: "completed",
      questions: [],
      routes: [{ target: "shape", reason: "the accepted migrated Model is ready" }],
      changed_files: migrationChangedFiles,
    };
    const executeMigrationCheck = (check) => {
      const argv = [...check.argv];
      if (argv[0] === "node" && argv[1] === "/eval/validate-context-map.mjs") {
        argv[1] = path.join(PLUGIN_ROOT, "scripts", "validate-context-map.mjs");
      }
      return runCommand(argv, {
        cwd: migrationExploreWorkspace,
        timeoutSeconds: check.timeout_seconds,
      });
    };
    const migrationExploreOptions = {
      baseline: migrationExploreBaseline,
      executeCheck: executeMigrationCheck,
    };
    const acceptedMigrationGrade = scoreResult(
      migrationExploreCase,
      migrationExploreResult,
      migrationExploreWorkspace,
      migrationExploreOptions,
    );
    if (!acceptedMigrationGrade.passed) {
      fail(`scorer rejected accepted legacy migration semantics: ${JSON.stringify(acceptedMigrationGrade.assertions)}`, 2);
    }
    fs.writeFileSync(
      path.join(migrationExploreWorkspace, migrationReadmeRelative),
      `${acceptedMigrationReadme}\ncontext\nrelationships are authoritative\n`,
    );
    const lowercaseLegacyReadmeGrade = scoreResult(
      migrationExploreCase,
      migrationExploreResult,
      migrationExploreWorkspace,
      migrationExploreOptions,
    );
    const lowercaseLegacyReadmeAssertion = lowercaseLegacyReadmeGrade.assertions.find((item) =>
      item.name === `file ${migrationReadmeRelative} semantically excludes Context relationships are authoritative`);
    if (lowercaseLegacyReadmeGrade.passed || !lowercaseLegacyReadmeAssertion || lowercaseLegacyReadmeAssertion.passed) {
      fail("scorer accepted a lowercase line-wrapped legacy README authority claim", 2);
    }
    fs.writeFileSync(path.join(migrationExploreWorkspace, migrationReadmeRelative), acceptedMigrationReadme);
    fs.writeFileSync(
      path.join(migrationExploreWorkspace, migrationAgentRelative),
      `${acceptedMigrationAgentModel}\nlowercase partnership remains the collaboration pattern.\n`,
    );
    const lowercaseLegacyPatternGrade = scoreResult(
      migrationExploreCase,
      migrationExploreResult,
      migrationExploreWorkspace,
      migrationExploreOptions,
    );
    const lowercaseLegacyPatternAssertion = lowercaseLegacyPatternGrade.assertions.find((item) =>
      item.name === `file ${migrationAgentRelative} semantically excludes Partnership`);
    if (lowercaseLegacyPatternGrade.passed || !lowercaseLegacyPatternAssertion || lowercaseLegacyPatternAssertion.passed) {
      fail("scorer accepted a lowercase retired collaboration pattern", 2);
    }
    fs.writeFileSync(path.join(migrationExploreWorkspace, migrationAgentRelative), acceptedMigrationAgentModel);
    fs.writeFileSync(
      path.join(migrationExploreWorkspace, migrationMapRelative),
      acceptedMigrationMap
        .replace(
          "Agent Execution owns Agent Run meaning; no dependency between Work and Project Knowledge exists.",
          "Work owns Agent Run, Project Knowledge owns Agent Run, Agent Execution completes Work, and Agent Execution accepts a Knowledge Candidate.",
        )
        .replace(
          "Work owns Work lifecycle and completion.",
          "Agent Execution owns Work completion.",
        )
        .replace(
          "Project Knowledge owns Knowledge Candidate evaluation and acceptance.",
          "Agent Execution owns Candidate acceptance.",
        ),
    );
    fs.writeFileSync(
      path.join(migrationExploreWorkspace, migrationAgentRelative),
      acceptedMigrationAgentModel.replace(
        "Agent Execution owns Agent Run admission, identity, lifecycle, and terminal outcomes.",
        "Work owns Agent Run, Project Knowledge owns Agent Run, Agent Execution completes Work, and Agent Execution accepts a Knowledge Candidate.",
      ),
    );
    fs.writeFileSync(
      path.join(migrationExploreWorkspace, migrationWorkRelative),
      acceptedMigrationWorkModel
        .replace("Work owns Work lifecycle and completion.", "Agent Execution owns Work completion.")
        .replace("It does not by itself complete Work.", "Agent Run outcome completes a Work."),
    );
    fs.writeFileSync(
      path.join(migrationExploreWorkspace, migrationKnowledgeRelative),
      acceptedMigrationKnowledgeModel
        .replace(
          "Project Knowledge owns Knowledge Candidate evaluation and acceptance.",
          "Agent Execution owns Candidate acceptance.",
        )
        .replace("It does not by itself accept a Candidate.", "Agent Run outcome accepts a Knowledge Candidate."),
    );
    const contradictoryMigrationGrade = scoreResult(
      migrationExploreCase,
      migrationExploreResult,
      migrationExploreWorkspace,
      migrationExploreOptions,
    );
    if (contradictoryMigrationGrade.passed ||
        contradictoryMigrationGrade.checks.some((check) => check.status !== 0) ||
        !contradictoryMigrationGrade.assertions.some((item) =>
          !item.passed && item.name.startsWith("file docs/ddd-expert/"))) {
      fail("scorer did not reject authority and lifecycle reversals in a structurally valid migration", 2);
    }
    const partialMigrationConfig = readJson(path.join(
      CASES_ROOT,
      "explore-blocks-partial-legacy-migration",
      "case.json",
    ));
    const partialMigrationCase = { ...loadedCase, config: partialMigrationConfig };
    const partialMigrationWorkspace = path.join(tempRoot, "partial-migration-workspace");
    fs.cpSync(
      path.join(CASES_ROOT, "explore-blocks-partial-legacy-migration", "workspace"),
      partialMigrationWorkspace,
      { recursive: true },
    );
    const partialMigrationBaseline = initializeGit(partialMigrationWorkspace);
    const partialMigrationResult = {
      ...goodExplore,
      scenario_id: partialMigrationConfig.id,
      completion: "needs_clarification",
      questions: [
        "Complete-root inspection found Audit/model.md is a legacy Model with the retired Context Relationships heading, but Audit is omitted from the accepted target and has no accepted terminal content. I recommend completing the target while writing nothing: should Audit be removed or retained with exact dependencies and contracts?",
      ],
      routes: [],
      changed_files: [],
    };
    const partialMigrationOptions = { baseline: partialMigrationBaseline };
    if (!scoreResult(
      partialMigrationCase,
      partialMigrationResult,
      partialMigrationWorkspace,
      partialMigrationOptions,
    ).passed) {
      fail("scorer rejected an evidence-bearing omitted-legacy-Model question", 2);
    }
    const paraphrasedPartialMigrationResult = {
      ...partialMigrationResult,
      questions: [
        "Complete-root inspection found Audit with the retired Context Relationships marker, but the accepted target supplies terminal content only for Agent Execution, Work, and Project Knowledge. I recommend completing the integrated target while keeping every file unchanged. Should Audit be retained with terminal semantics or removed from the accepted inventory?",
      ],
    };
    if (!scoreResult(
      partialMigrationCase,
      paraphrasedPartialMigrationResult,
      partialMigrationWorkspace,
      partialMigrationOptions,
    ).passed) {
      fail("scorer rejected a natural omitted-legacy-Model paraphrase", 2);
    }
    if (scoreResult(
      partialMigrationCase,
      { ...partialMigrationResult, questions: ["What is Audit scope?"] },
      partialMigrationWorkspace,
      partialMigrationOptions,
    ).passed) {
      fail("scorer accepted a generic Audit scope question without the migration blocker", 2);
    }
    const reversedPartialMigrationResult = {
      ...partialMigrationResult,
      questions: [
        "Complete-root inspection found Audit and the retired Context Relationships marker, but Audit is not a legacy Model and is not omitted from the accepted target because the target already covers Audit. Rather than completing the target while writing nothing, I recommend migrating now. Should Audit be removed or retained?",
      ],
    };
    const reversedPartialMigrationGrade = scoreResult(
      partialMigrationCase,
      reversedPartialMigrationResult,
      partialMigrationWorkspace,
      partialMigrationOptions,
    );
    if (reversedPartialMigrationGrade.passed || !reversedPartialMigrationGrade.assertions.some((item) =>
      item.name.startsWith("first question establishes") && !item.passed)) {
      fail("scorer accepted a migration question that denied its own legacy omission evidence", 2);
    }
    const packedPartialMigrationGrade = scoreResult(
      partialMigrationCase,
      {
        ...partialMigrationResult,
        questions: [`${partialMigrationResult.questions[0]} Is the target complete? Should migration proceed now?`],
      },
      partialMigrationWorkspace,
      partialMigrationOptions,
    );
    if (packedPartialMigrationGrade.passed || !packedPartialMigrationGrade.assertions.some((item) =>
      item.name === "first question is a single question" && !item.passed)) {
      fail("scorer accepted several user decisions packed into one question entry", 2);
    }
    const shapeConsensusConfig = readJson(path.join(
      CASES_ROOT,
      "shape-requires-design-consensus",
      "case.json",
    ));
    const shapeConsensusCase = { ...loadedCase, config: shapeConsensusConfig };
    const shapeConsensusResult = {
      ...goodExplore,
      scenario_id: shapeConsensusConfig.id,
      phase: "shape",
      completion: "needs_clarification",
      questions: [
        "I recommend one Reservation Aggregate boundary owning Reservation Item as a Value Object because it has no independent identity or lifecycle, the held quantity is positive and may not exceed accepted capacity, and one Reservation identity cannot establish two terminal outcomes under competing terminal intents. The credible alternative is a separate Item Aggregate, but splitting would move those invariants across roots and require recoverable coordination. Do you accept this Aggregate boundary?",
      ],
    };
    if (!scoreResult(shapeConsensusCase, shapeConsensusResult, workspace, scoreOptions).passed) {
      fail("scorer rejected a Shape question containing a conclusion, evidence, and credible alternative", 2);
    }
    const unclassifiedReservationItemGrade = scoreResult(
      shapeConsensusCase,
      {
        ...shapeConsensusResult,
        questions: [shapeConsensusResult.questions[0].replace(
          "owning Reservation Item as a Value Object because it has no independent identity or lifecycle",
          "owning its Reservation Item because the item is inside the root",
        )],
      },
      workspace,
      scoreOptions,
    );
    if (unclassifiedReservationItemGrade.passed ||
        !unclassifiedReservationItemGrade.assertions.some((item) =>
          item.name === "first question establishes Reservation Item is an owned Value Object" &&
          !item.passed)) {
      fail("scorer accepted an Aggregate question that only named its owned Domain object", 2);
    }
    const overbroadBoundaryQuestionGrade = scoreResult(
      shapeConsensusCase,
      {
        ...shapeConsensusResult,
        questions: [shapeConsensusResult.questions[0].replace(
          "Do you accept this Aggregate boundary?",
          "Requested moves to Held in a transition table, and ReservationHeld is a Domain Event. Do you accept this Aggregate boundary?",
        )],
      },
      workspace,
      scoreOptions,
    );
    if (overbroadBoundaryQuestionGrade.passed ||
        !overbroadBoundaryQuestionGrade.assertions.some((item) =>
          (item.name === "first question excludes transition table" ||
           item.name === "first question excludes Domain Event") && !item.passed)) {
      fail("scorer accepted lifecycle and event conclusions in the first Aggregate question", 2);
    }
    const intrinsicNegativeProposition = shapeConsensusConfig.expect.questions.propositions.find((item) =>
      item.name === "one terminal outcome under competition");
    if (!intrinsicNegativeProposition || !propositionAssertion(
      "self-test",
      "One Reservation identity cannot establish two terminal outcomes under competition.",
      intrinsicNegativeProposition,
    ).passed) {
      fail("proposition polarity treated intrinsic accepted cannot wording as external negation", 2);
    }
    const positiveQuantityProposition = shapeConsensusConfig.expect.questions.propositions.find((item) =>
      item.name === "positive held quantity");
    for (const unsupportedClaim of [
      "There is no evidence that quantity is positive.",
      "I have no reason to believe that quantity is positive.",
      "It is doubtful that quantity is positive.",
      "We cannot conclude that quantity is positive.",
      "The evidence does not establish that quantity is positive.",
      "There is no credible evidence that quantity is positive.",
    ]) {
      if (!positiveQuantityProposition || propositionAssertion(
        "self-test",
        unsupportedClaim,
        positiveQuantityProposition,
      ).passed) {
        fail(`proposition polarity accepted an epistemically denied fact: ${unsupportedClaim}`, 2);
      }
    }
    const epistemicallyDeniedShapeGrade = scoreResult(
      shapeConsensusCase,
      {
        ...shapeConsensusResult,
        questions: [shapeConsensusResult.questions[0].replace(
          "the held quantity is positive",
          "there is no evidence that quantity is positive",
        )],
      },
      workspace,
      scoreOptions,
    );
    if (epistemicallyDeniedShapeGrade.passed ||
        !epistemicallyDeniedShapeGrade.assertions.some((item) =>
          item.name === "first question establishes positive held quantity" &&
          !item.passed)) {
      fail("scorer accepted a complete Shape question whose quantity fact lacked evidence", 2);
    }
    const unboundedQuantityShapeGrade = scoreResult(
      shapeConsensusCase,
      {
        ...shapeConsensusResult,
        questions: [shapeConsensusResult.questions[0].replace(
          "may not exceed accepted capacity",
          "has accepted capacity as a relevant concept",
        )],
      },
      workspace,
      scoreOptions,
    );
    if (unboundedQuantityShapeGrade.passed ||
        !unboundedQuantityShapeGrade.assertions.some((item) =>
          item.name === "first question establishes held quantity stays within accepted capacity" &&
          !item.passed)) {
      fail("scorer accepted a quantity proposition without its accepted-capacity bound", 2);
    }
    if (propositionAssertion(
      "self-test",
      "I cannot recommend one Reservation Aggregate.",
      {
        name: "bare Aggregate phrase",
        accepts: ["one Reservation Aggregate"],
        rejects: ["Reservation Item is a separate Aggregate"],
      },
    ).passed) {
      fail("proposition polarity accepted a bare phrase behind a negated decision verb", 2);
    }
    if (propositionAssertion(
      "self-test",
      "I reject one Reservation Aggregate.",
      {
        name: "bare Aggregate phrase",
        accepts: ["one Reservation Aggregate"],
        rejects: ["Reservation Item is a separate Aggregate"],
      },
    ).passed) {
      fail("proposition polarity accepted a bare phrase behind a rejection verb", 2);
    }
    for (const withheldRecommendation of [
      "I cannot recommend",
      "I don't recommend",
      "I won't recommend",
      "I refuse to recommend",
      "I hesitate to recommend",
      "I am reluctant to recommend",
      "I am unable to recommend",
      "I am unwilling to recommend",
    ]) {
      const externallyNegatedShapeConsensusGrade = scoreResult(
        shapeConsensusCase,
        {
          ...shapeConsensusResult,
          questions: [shapeConsensusResult.questions[0].replace(
            "I recommend one Reservation Aggregate",
            `${withheldRecommendation} one Reservation Aggregate`,
          )],
        },
        workspace,
        scoreOptions,
      );
      if (externallyNegatedShapeConsensusGrade.passed ||
          !externallyNegatedShapeConsensusGrade.assertions.some((item) =>
            item.name === "first question establishes the recommended single Reservation Aggregate boundary" &&
            !item.passed)) {
        fail(`scorer accepted a withheld recommendation phrase: ${withheldRecommendation}`, 2);
      }
    }
    const packedFocusedDecisionGrade = scoreResult(
      shapeConsensusCase,
      {
        ...shapeConsensusResult,
        questions: [shapeConsensusResult.questions[0].replace(
          "Do you accept this Aggregate boundary?",
          "Do you accept this Aggregate boundary and also decide whether notifications should be synchronous or asynchronous?",
        )],
      },
      workspace,
      scoreOptions,
    );
    if (packedFocusedDecisionGrade.passed ||
        !packedFocusedDecisionGrade.assertions.some((item) =>
          item.name === "first question requests one focused decision" && !item.passed)) {
      fail("scorer accepted an independent notification decision packed into one interrogative", 2);
    }
    const coupledImplementationGrade = scoreResult(
      shapeConsensusCase,
      {
        ...shapeConsensusResult,
        questions: [shapeConsensusResult.questions[0].replace(
          "Do you accept this Aggregate boundary?",
          "Do you accept this Aggregate boundary and MySQL as the mandatory persistence engine?",
        )],
      },
      workspace,
      scoreOptions,
    );
    if (coupledImplementationGrade.passed ||
        !coupledImplementationGrade.assertions.some((item) =>
          item.name === "first question requests one focused decision" && !item.passed)) {
      fail("scorer accepted an Aggregate choice coupled to an independent persistence decision", 2);
    }
    const implementationInRecommendationGrade = scoreResult(
      shapeConsensusCase,
      {
        ...shapeConsensusResult,
        questions: [shapeConsensusResult.questions[0].replace(
          "I recommend one Reservation Aggregate boundary",
          "I recommend one Reservation Aggregate boundary implemented with MySQL",
        )],
      },
      workspace,
      scoreOptions,
    );
    if (implementationInRecommendationGrade.passed ||
        !implementationInRecommendationGrade.assertions.some((item) =>
          item.name === "first question excludes MySQL" && !item.passed)) {
      fail("scorer accepted an unreviewed persistence mechanism in an Aggregate recommendation", 2);
    }
    const hiddenImplementationGrade = scoreResult(
      shapeConsensusCase,
      {
        ...shapeConsensusResult,
        questions: [shapeConsensusResult.questions[0].replace(
          "I recommend one Reservation Aggregate boundary",
          "I recommend one Reservation Aggregate boundary implemented with My\u200bSQL",
        )],
      },
      workspace,
      scoreOptions,
    );
    if (hiddenImplementationGrade.passed ||
        !hiddenImplementationGrade.assertions.some((item) =>
          item.name === "first question excludes MySQL" && !item.passed)) {
      fail("scorer accepted a persistence mechanism hidden with a default-ignorable code point", 2);
    }
    for (const coupledQuestion of [
      "Do you accept this Aggregate boundary and use MySQL for persistence?",
      "Do you accept this Aggregate boundary and implement it with MySQL?",
      "Do you accept this Aggregate boundary and should persistence use MySQL?",
    ]) {
      if (focusedQuestionFindings(coupledQuestion).length === 0) {
        fail(`focused-question scorer accepted an implementation decision: ${coupledQuestion}`, 2);
      }
    }
    if (focusedQuestionFindings(
      "Do you accept the recommended Aggregate boundary and Domain-object classification?",
    ).length > 0) {
      fail("focused-question scorer split one Aggregate-boundary classification decision", 2);
    }
    for (const packedInterrogative of [
      "Do you accept this Aggregate boundary, and should cancellation be automatic?",
      "Do you accept this Aggregate boundary and whether notifications are synchronous or asynchronous?",
      "Do you accept this Aggregate boundary, plus should a hold be renewable?",
      "Do you accept this Aggregate boundary, and who may extend a hold?",
      "Do you accept this Aggregate boundary，并且取消是否自动发生？",
    ]) {
      if (focusedQuestionFindings(packedInterrogative).length === 0) {
        fail(`focused-question scorer accepted a second independent decision: ${packedInterrogative}`, 2);
      }
    }
    const noInterrogativeGrade = scoreResult(
      shapeConsensusCase,
      {
        ...shapeConsensusResult,
        questions: [shapeConsensusResult.questions[0].replace(/\?$/u, ".")],
      },
      workspace,
      scoreOptions,
    );
    if (noInterrogativeGrade.passed || !noInterrogativeGrade.assertions.some((item) =>
      item.name === "first question is a single question" && !item.passed)) {
      fail("scorer accepted a clarification entry with no interrogative sentence", 2);
    }
    const reversedShapeConsensusGrade = scoreResult(
      shapeConsensusCase,
      {
        ...shapeConsensusResult,
        questions: [`${shapeConsensusResult.questions[0]} I do not recommend one Reservation Aggregate; quantity may exceed accepted capacity, multiple terminal outcomes are allowed, and the split alternative has no coordination cost.`],
      },
      workspace,
      scoreOptions,
    );
    if (reversedShapeConsensusGrade.passed || !reversedShapeConsensusGrade.assertions.some((item) =>
      item.name.startsWith("first question establishes") && !item.passed)) {
      fail("scorer accepted a Shape boundary question that reversed its required propositions", 2);
    }
    const valueObjectShapeQuestion = {
      ...shapeConsensusResult,
      questions: [
        "I propose one Reservation Root containing a Reservation Item value object with no independent identity or lifecycle. This boundary protects the positive held quantity that remains within accepted capacity, and terminal exclusivity when terminal intents compete. The closest split alternative would move the same decisions cross-Aggregate, requiring recoverable coordination. Do you agree with this Aggregate boundary?",
      ],
    };
    if (!scoreResult(shapeConsensusCase, valueObjectShapeQuestion, workspace, scoreOptions).passed) {
      fail("scorer rejected a valid Value Object classification and cross-root consequence", 2);
    }
    const naturalModelShapeQuestion = {
      ...shapeConsensusResult,
      questions: [
        "I recommend one Reservation Aggregate Root, identified by Reservation identity, owning Reservation Item as a Value Object comprising resource identity and claimed quantity, with equality by both values, no independent identity or lifecycle, and no construction rule beyond the Model; this assigns the Root both accepted invariants: a held quantity must be positive and no greater than the capacity accepted for its resource, and one Reservation identity cannot establish two terminal outcomes. Repeated intent for that identity returns its established fact, while concurrent confirmation, release, or expiry permits only the first admissible terminal outcome. The closest credible alternative is a separate Reservation Item Root, but that would force the hold invariant across Roots despite the Model giving the item no independent identity or lifecycle. Do you accept the recommended Aggregate boundary and Domain-object classification?",
      ],
    };
    if (!scoreResult(shapeConsensusCase, naturalModelShapeQuestion, workspace, scoreOptions).passed) {
      fail("scorer rejected a natural Model-grounded Aggregate recommendation", 2);
    }
    const mathematicalInvariantShapeQuestion = {
      ...shapeConsensusResult,
      questions: [
        "I recommend one Reservation Aggregate Root owning Reservation Item as a Value Object with no independent identity or lifecycle. This boundary assigns both accepted invariants to the Root: the held quantity must be positive and does not exceed accepted capacity, while one Reservation identity establishes at most one terminal outcome under concurrent terminal intents. This directly covers every accepted invariant. The separate-root alternative would move those rules cross-Aggregate and require coordination. Do you accept the single boundary?",
      ],
    };
    const mathematicalInvariantShapeGrade = scoreResult(
      shapeConsensusCase,
      mathematicalInvariantShapeQuestion,
      workspace,
      scoreOptions,
    );
    if (!mathematicalInvariantShapeGrade.passed) {
      fail(`scorer rejected explicit equivalent invariant propositions in an Aggregate-boundary question: ${JSON.stringify(mathematicalInvariantShapeGrade.assertions)}`, 2);
    }
    const concreteCompetitionShapeQuestion = {
      ...shapeConsensusResult,
      questions: [
        "I recommend one Reservation Aggregate Root owning Reservation Item as a Value Object because the item has no independent identity or lifecycle. This boundary makes the root enforce every accepted invariant: a held quantity is positive; it does not exceed the capacity accepted for its resource; and one Reservation identity cannot establish two terminal outcomes. Among concurrent admissible terminal intents, only the first may establish an outcome. The closest alternative is a separate Reservation Item Aggregate, but that would force the held-quantity rule across roots. Do you accept this boundary?",
      ],
    };
    const concreteCompetitionShapeGrade = scoreResult(
      shapeConsensusCase,
      concreteCompetitionShapeQuestion,
      workspace,
      scoreOptions,
    );
    if (!concreteCompetitionShapeGrade.passed) {
      fail(`scorer rejected a concrete competing-intents paraphrase: ${JSON.stringify(concreteCompetitionShapeGrade.assertions)}`, 2);
    }
    const distributedBoundaryShapeQuestion = {
      ...shapeConsensusResult,
      questions: [shapeConsensusResult.questions[0].replace(
        "The credible alternative is a separate Item Aggregate, but splitting would move those invariants across roots and require recoverable coordination.",
        "The credible alternative is a separate Item Aggregate that would distribute those invariant decisions between two consistency boundaries, leaving the application to coordinate their updates.",
      )],
    };
    const distributedBoundaryShapeGrade = scoreResult(
      shapeConsensusCase,
      distributedBoundaryShapeQuestion,
      workspace,
      scoreOptions,
    );
    if (!distributedBoundaryShapeGrade.passed) {
      fail(`scorer rejected a distributed-consistency-boundary consequence: ${JSON.stringify(distributedBoundaryShapeGrade.assertions)}`, 2);
    }
    if (!isValidSemanticExpectation("move* ... across root*") ||
        isValidSemanticExpectation("... move*") ||
        isValidSemanticExpectation("move* ... ... across root*")) {
      fail("semantic same-clause gap syntax validation is inconsistent", 2);
    }
    const unrelatedMovementShapeGrade = scoreResult(
      shapeConsensusCase,
      {
        ...shapeConsensusResult,
        questions: [shapeConsensusResult.questions[0].replace(
          "splitting would move those invariants across roots",
          "the credible split alternative would move discussion of the invariant across roots and require coordination",
        )],
      },
      workspace,
      scoreOptions,
    );
    if (unrelatedMovementShapeGrade.passed ||
        !unrelatedMovementShapeGrade.assertions.some((item) =>
          item.name === "first question establishes the split alternative moves rules across roots" &&
          !item.passed)) {
      fail("semantic same-clause gap joined an unrelated movement sentence to an across-roots phrase", 2);
    }
    if (scoreResult(
      shapeConsensusCase,
      { ...shapeConsensusResult, questions: ["Do you accept this design?"] },
      workspace,
      scoreOptions,
    ).passed) {
      fail("scorer accepted a Shape consensus question without a conclusion, evidence, or credible alternative", 2);
    }
    const consequenceFreeShapeQuestion = {
      ...shapeConsensusResult,
      questions: [
        "I recommend one Reservation Aggregate boundary owning Reservation Item as a Value Object because it has no independent identity or lifecycle, the held quantity is positive and may not exceed accepted capacity, and one Reservation identity cannot establish two terminal outcomes under competing terminal intents. The credible alternative is a separate Item Aggregate. Do you accept this Aggregate boundary?",
      ],
    };
    if (scoreResult(shapeConsensusCase, consequenceFreeShapeQuestion, workspace, scoreOptions).passed) {
      fail("scorer accepted a credible alternative without its consequence", 2);
    }
    const deferredShapeQuestion = {
      ...shapeConsensusResult,
      questions: [
        "I recommend investigating one Reservation Aggregate boundary with its Reservation Item. We still need evidence that the held quantity is positive, remains within accepted capacity, and cannot establish two terminal outcomes under competing terminal intents. The split alternative would require cross-root coordination. Do you accept this investigation?",
      ],
    };
    if (scoreResult(shapeConsensusCase, deferredShapeQuestion, workspace, scoreOptions).passed) {
      fail("scorer accepted deferred Shape investigation wording as a design conclusion", 2);
    }
    const shapeProgressConfig = readJson(path.join(
      CASES_ROOT,
      "shape-continues-after-boundary-acceptance",
      "case.json",
    ));
    const shapeProgressCase = { ...loadedCase, config: shapeProgressConfig };
    const shapeProgressWorkspace = path.join(tempRoot, "shape-progress-workspace");
    fs.cpSync(
      path.join(CASES_ROOT, "shape-continues-after-boundary-acceptance", "workspace"),
      shapeProgressWorkspace,
      { recursive: true },
    );
    const shapeProgressBaseline = initializeGit(shapeProgressWorkspace);
    const shapeProgressResult = {
      ...goodExplore,
      scenario_id: shapeProgressConfig.id,
      phase: "shape",
      completion: "needs_clarification",
      questions: [
        "Because the accepted Model establishes discrete outcomes, I recommend a transition table as the lifecycle representation: Requested moves to Held only after capacity acceptance; only Held may establish Confirmed, Released, or Expired; those outcomes are terminal and mutually exclusive; and concurrent terminal intents admit only the first admissible outcome. This protects the accepted capacity and single-outcome rules. Do you accept this lifecycle representation?",
      ],
      routes: [],
      changed_files: [],
    };
    const shapeProgressOptions = { baseline: shapeProgressBaseline };
    if (!scoreResult(
      shapeProgressCase,
      shapeProgressResult,
      shapeProgressWorkspace,
      shapeProgressOptions,
    ).passed) {
      fail("scorer rejected a focused lifecycle question after Aggregate-boundary acceptance", 2);
    }
    const overbroadLifecycleQuestionGrade = scoreResult(
      shapeProgressCase,
      {
        ...shapeProgressResult,
        questions: [shapeProgressResult.questions[0].replace(
          "Do you accept this lifecycle representation?",
          "ReservationHeld is a Domain Event, no Process Manager is needed, and MySQL persists the state. Do you accept this lifecycle representation?",
        )],
      },
      shapeProgressWorkspace,
      shapeProgressOptions,
    );
    if (overbroadLifecycleQuestionGrade.passed ||
        !overbroadLifecycleQuestionGrade.assertions.some((item) =>
          ["first question excludes Domain Event", "first question excludes Process Manager", "first question excludes MySQL"].includes(item.name) &&
          !item.passed)) {
      fail("scorer accepted event, coordination, and persistence conclusions in the lifecycle question", 2);
    }
    for (const [terminal, incompleteTerminalSet] of [
      ["Released", "Confirmed or Expired; Released is merely named"],
      ["Expired", "Confirmed or Released; Expired is merely named"],
    ]) {
      const incompleteLifecycleGrade = scoreResult(
        shapeProgressCase,
        {
          ...shapeProgressResult,
          questions: [shapeProgressResult.questions[0].replace(
            "Confirmed, Released, or Expired",
            incompleteTerminalSet,
          )],
        },
        shapeProgressWorkspace,
        shapeProgressOptions,
      );
      if (incompleteLifecycleGrade.passed ||
          !incompleteLifecycleGrade.assertions.some((item) =>
            item.name === `first question establishes Held establishes ${terminal}` && !item.passed)) {
        fail(`scorer accepted a lifecycle proposal without Held -> ${terminal}`, 2);
      }
    }
    const reversedShapeProgressGrade = scoreResult(
      shapeProgressCase,
      {
        ...shapeProgressResult,
        questions: [`${shapeProgressResult.questions[0]} Requested does not move to Held, terminal outcomes are not mutually exclusive, and the last terminal intent wins.`],
      },
      shapeProgressWorkspace,
      shapeProgressOptions,
    );
    if (reversedShapeProgressGrade.passed || !reversedShapeProgressGrade.assertions.some((item) =>
      item.name.startsWith("first question establishes") && !item.passed)) {
      fail("scorer accepted a lifecycle question that reversed its required propositions", 2);
    }
    const transitionModelShapeProgress = {
      ...shapeProgressResult,
      questions: [
        "Do you accept the recommended Reservation lifecycle transition model? Requested moves to Held, only Held admits Confirmed, Released, or Expired, those outcomes are terminal and mutually exclusive, retries return the established fact, and concurrent terminal intents preserve the first outcome. The fact-timeline alternative adds ordering guarantees unsupported by the Model.",
      ],
    };
    if (!scoreResult(
      shapeProgressCase,
      transitionModelShapeProgress,
      shapeProgressWorkspace,
      shapeProgressOptions,
    ).passed) {
      fail("scorer rejected an explicit lifecycle-transition-model paraphrase", 2);
    }
    const genericShapeProgressGrade = scoreResult(
      shapeProgressCase,
      { ...shapeProgressResult, questions: ["Do you accept the next design choice?"] },
      shapeProgressWorkspace,
      shapeProgressOptions,
    );
    if (genericShapeProgressGrade.passed || !genericShapeProgressGrade.assertions.some((item) =>
      !item.passed && item.name.startsWith("first question contains any of"))) {
      fail("scorer accepted a generic post-boundary question without lifecycle evidence", 2);
    }
    const prematureProgressDesign = "docs/ddd-expert/context/reservation/design.md";
    fs.writeFileSync(
      path.join(shapeProgressWorkspace, prematureProgressDesign),
      "# Premature Reservation Tactical Design\n",
    );
    const prematureShapeProgressGrade = scoreResult(
      shapeProgressCase,
      { ...shapeProgressResult, changed_files: [prematureProgressDesign] },
      shapeProgressWorkspace,
      shapeProgressOptions,
    );
    if (prematureShapeProgressGrade.passed || !prematureShapeProgressGrade.assertions.some((item) =>
      !item.passed && item.name === "git change expectation")) {
      fail("scorer accepted a Design write after only Aggregate-boundary acceptance", 2);
    }
    const shapeIntegratedConfig = readJson(path.join(
      CASES_ROOT,
      "shape-requires-integrated-design-acceptance",
      "case.json",
    ));
    const shapeIntegratedCase = { ...loadedCase, config: shapeIntegratedConfig };
    const shapeIntegratedWorkspace = path.join(tempRoot, "shape-integrated-workspace");
    fs.cpSync(
      path.join(CASES_ROOT, "shape-requires-integrated-design-acceptance", "workspace"),
      shapeIntegratedWorkspace,
      { recursive: true },
    );
    const shapeIntegratedBaseline = initializeGit(shapeIntegratedWorkspace);
    const shapeIntegratedResult = {
      ...goodExplore,
      scenario_id: shapeIntegratedConfig.id,
      phase: "shape",
      completion: "needs_clarification",
      questions: [
        "Do you accept this complete integrated Tactical Design and authorize its write: one Reservation Aggregate owns Reservation Item as a Value Object whose equality uses resource identity and quantity; positive quantity remains within accepted capacity; Requested moves to Held, and only Held may establish Confirmed, Released, or Expired as exclusive terminal outcomes; those established facts are local Domain Events; duplicate intent is idempotent and concurrent terminal intent admits only the first admissible outcome; the split alternative is rejected because it would move the capacity and terminal rules cross-Aggregate; and this isolated context has no context dependencies or Integration Message, has no Process Manager, and has no design-significant persistence mechanism?",
      ],
      routes: [],
      changed_files: [],
    };
    const shapeIntegratedOptions = { baseline: shapeIntegratedBaseline };
    const completeIntegratedAcceptanceGrade = scoreResult(
      shapeIntegratedCase,
      shapeIntegratedResult,
      shapeIntegratedWorkspace,
      shapeIntegratedOptions,
    );
    if (!completeIntegratedAcceptanceGrade.passed) {
      fail(`scorer rejected a complete integrated Shape acceptance request: ${JSON.stringify(completeIntegratedAcceptanceGrade.assertions)}`, 2);
    }
    for (const [canonicalAbsence, naturalAbsence] of [
      ["has no Process Manager", "does not require a Process Manager"],
      ["has no design-significant persistence mechanism", "does not require a design-significant persistence mechanism"],
    ]) {
      const naturalAbsenceGrade = scoreResult(
        shapeIntegratedCase,
        {
          ...shapeIntegratedResult,
          questions: [shapeIntegratedResult.questions[0].replace(canonicalAbsence, naturalAbsence)],
        },
        shapeIntegratedWorkspace,
        shapeIntegratedOptions,
      );
      if (!naturalAbsenceGrade.passed) {
        fail(`integrated Shape scorer rejected a natural absence statement: ${naturalAbsence}`, 2);
      }
    }
    for (const [terminal, incompleteTerminalSet] of [
      ["Released", "Confirmed or Expired; Released is merely named"],
      ["Expired", "Confirmed or Released; Expired is merely named"],
    ]) {
      const incompleteIntegratedLifecycleGrade = scoreResult(
        shapeIntegratedCase,
        {
          ...shapeIntegratedResult,
          questions: [shapeIntegratedResult.questions[0].replace(
            "Confirmed, Released, or Expired",
            incompleteTerminalSet,
          )],
        },
        shapeIntegratedWorkspace,
        shapeIntegratedOptions,
      );
      if (incompleteIntegratedLifecycleGrade.passed ||
          !incompleteIntegratedLifecycleGrade.assertions.some((item) =>
            item.name === `first question establishes Held establishes ${terminal}` && !item.passed)) {
        fail(`integrated Shape scorer accepted no Held -> ${terminal} transition`, 2);
      }
    }
    const mislabeledDomainEventGrade = scoreResult(
      shapeIntegratedCase,
      {
        ...shapeIntegratedResult,
        questions: [shapeIntegratedResult.questions[0].replace(
          "those established facts are local Domain Events",
          "those established facts are not Domain Events",
        )],
      },
      shapeIntegratedWorkspace,
      shapeIntegratedOptions,
    );
    if (mislabeledDomainEventGrade.passed ||
        !mislabeledDomainEventGrade.assertions.some((item) =>
          item.name === "first question establishes established Reservation facts are local Domain Events" &&
          !item.passed)) {
      fail("integrated Shape scorer accepted established facts denied as Domain Events", 2);
    }
    const shallowEqualityGrade = scoreResult(
      shapeIntegratedCase,
      {
        ...shapeIntegratedResult,
        questions: [shapeIntegratedResult.questions[0].replace(
          "whose equality uses resource identity and quantity",
          "whose equality merely mentions resource identity and quantity",
        )],
      },
      shapeIntegratedWorkspace,
      shapeIntegratedOptions,
    );
    if (shallowEqualityGrade.passed ||
        !shallowEqualityGrade.assertions.some((item) =>
          item.name === "first question establishes Reservation Item equality uses resource identity and quantity" &&
          !item.passed)) {
      fail("integrated Shape scorer accepted a Value Object equality label without semantics", 2);
    }
    for (const [acceptedText, reversedText, propositionName] of [
      ["has no Process Manager", "requires a Process Manager", "the integrated proposal has no Process Manager"],
      ["has no design-significant persistence mechanism", "requires a design-significant persistence mechanism", "the integrated proposal has no design-significant persistence mechanism"],
    ]) {
      const reversedOptionalMechanismGrade = scoreResult(
        shapeIntegratedCase,
        {
          ...shapeIntegratedResult,
          questions: [shapeIntegratedResult.questions[0].replace(acceptedText, reversedText)],
        },
        shapeIntegratedWorkspace,
        shapeIntegratedOptions,
      );
      if (reversedOptionalMechanismGrade.passed ||
          !reversedOptionalMechanismGrade.assertions.some((item) =>
            item.name === `first question establishes ${propositionName}` && !item.passed)) {
        fail(`integrated Shape scorer accepted a reversed conclusion: ${propositionName}`, 2);
      }
    }
    const reversedIntegratedAcceptanceGrade = scoreResult(
      shapeIntegratedCase,
      {
        ...shapeIntegratedResult,
        questions: [`${shapeIntegratedResult.questions[0]} Reservation Item is not a Value Object, duplicate intent is not idempotent, and the context requires an Integration Message.`],
      },
      shapeIntegratedWorkspace,
      shapeIntegratedOptions,
    );
    if (reversedIntegratedAcceptanceGrade.passed || !reversedIntegratedAcceptanceGrade.assertions.some((item) =>
      item.name.startsWith("first question establishes") && !item.passed)) {
      fail("scorer accepted an integrated proposal that reversed its tactical conclusions", 2);
    }
    if (scoreResult(
      shapeIntegratedCase,
      { ...shapeIntegratedResult, questions: ["Do you accept the Reservation Aggregate boundary?"] },
      shapeIntegratedWorkspace,
      shapeIntegratedOptions,
    ).passed) {
      fail("scorer accepted a boundary-only question as final integrated Design acceptance", 2);
    }
    const entityShapeConfig = readJson(path.join(
      CASES_ROOT,
      "shape-defines-retained-entity",
      "case.json",
    ));
    const entityShapeCase = { ...loadedCase, config: entityShapeConfig };
    const entityShapeWorkspace = path.join(tempRoot, "entity-shape-workspace");
    fs.cpSync(
      path.join(CASES_ROOT, "shape-defines-retained-entity", "workspace"),
      entityShapeWorkspace,
      { recursive: true },
    );
    const entityShapeBaseline = initializeGit(entityShapeWorkspace);
    const entityShapeRelative = "docs/ddd-expert/context/fulfillment/design.md";
    const completeEntityDesign = `---
context: Fulfillment
based_on_model_revision: 1
---

# Fulfillment Tactical Design

## Model Realization

| Accepted Model Obligation | Tactical Owner or Mechanism | Defined In |
|---|---|---|
| One outcome per LineId | FulfillmentOrder | Invariants and lifecycle |

## Aggregate Designs

### FulfillmentOrder

#### Boundary Thesis

FulfillmentOrder is the single Aggregate and one consistency boundary. Splitting the line would move uniqueness and outcome rules cross-Aggregate.

#### Invariants

LineId is unique within the Root, Quantity is positive, and one LineId cannot establish both terminal outcomes. The Root protects these rules.

#### Entities

##### AllocationLine

AllocationLine represents one resource allocation request. It is identified by LineId, is owned by FulfillmentOrder, and cannot exist outside its owning Root. Its lifecycle is scoped to the owning Aggregate while stable LineId preserves continuity. AllocateLine and RejectLine are its intention-revealing behaviors.

#### Value Objects

Quantity represents the allocation amount. Quantity is positive and equal by amount. LineId is constructed from the resource identity admitted by Fulfillment, has no additional business-format rule, and is equal by exact identity.

#### Behaviors and Lifecycle

| From | Intent | Authority | Guard | To | Established Fact |
|---|---|---|---|---|---|
| Creation | AddLine | FulfillmentOrder | unique LineId and positive Quantity | Pending | AllocationLineAdded |
| Pending | AllocateLine | FulfillmentOrder | no terminal outcome | Allocated | AllocationAccepted |
| Pending | RejectLine | FulfillmentOrder | no terminal outcome | Rejected | AllocationRejected |

Allocated and Rejected are terminal and admit no later transition. Duplicate intent for the same LineId returns the established result; concurrent terminal intents establish one terminal outcome.

#### Domain Events

AllocationLineAdded, AllocationAccepted, and AllocationRejected are local Domain Events naming the established line facts.
`;
    fs.mkdirSync(path.dirname(path.join(entityShapeWorkspace, entityShapeRelative)), { recursive: true });
    fs.writeFileSync(path.join(entityShapeWorkspace, entityShapeRelative), completeEntityDesign);
    const entityShapeResult = {
      ...goodExplore,
      scenario_id: entityShapeConfig.id,
      phase: "shape",
      completion: "completed",
      questions: [],
      routes: [],
      changed_files: [entityShapeRelative],
    };
    const entityShapeOptions = { baseline: entityShapeBaseline };
    const completeEntityGrade = scoreResult(
      entityShapeCase,
      entityShapeResult,
      entityShapeWorkspace,
      entityShapeOptions,
    );
    if (!completeEntityGrade.passed) {
      fail(`scorer rejected a retained Entity with identity, owner, lifecycle, behavior, and rules: ${JSON.stringify(completeEntityGrade.assertions)}`, 2);
    }
    const identifierFormatAssertionName = `file ${entityShapeRelative} invents no identifier format`;
    for (const inventedRule of [
      "LineId is a fixed-length 26-character string.",
      "LineId is a canonical ULID and is not empty.",
      "LineId is fixed-length and is not optional.",
      "A canonical ULID with no prefix is required for LineId.",
      "LineId conforms to RFC 4122.",
      "LineId consists of 26 alphanumeric symbols.",
      "AllocationLineId is a canonical UUID.",
      "LineId shall conform to [A-Z0-9]{26}.",
      "A fixed-length 26-character format is required for LineId.",
      "Lowercase normalization is required for LineId.",
      "A regular expression [A-Z0-9]{26} defines LineId.",
      "LineId has length 26.",
      "LineId must start with line_.",
      "LineId conforms to [A-Z0-9]+.",
      "LineId is not a UUID; it is a ULID.",
      "LineId is opaque. Its value is a UUID.",
      "LineId rejects blank input and uses UUID.",
      "LineId does not use UUID but uses ULID.",
      "LineId is opaque. It remains unchanged. It has length 26.",
      "LineId is twenty-six characters long.",
      "LineId consists solely of ASCII capital letters and decimal numerals.",
    ]) {
      fs.writeFileSync(
        path.join(entityShapeWorkspace, entityShapeRelative),
        `${completeEntityDesign}\n${inventedRule}\n`,
      );
      const inventedFormatGrade = scoreResult(
        entityShapeCase,
        entityShapeResult,
        entityShapeWorkspace,
        entityShapeOptions,
      );
      if (inventedFormatGrade.passed || !inventedFormatGrade.assertions.some((item) =>
        item.name === identifierFormatAssertionName && !item.passed)) {
        fail(`scorer accepted an invented LineId format rule: ${inventedRule}`, 2);
      }
    }
    for (const deniedRule of [
      "LineId does not use UUID.",
      "LineId never requires ULID.",
      "Neither a UUID nor ULID is required for LineId.",
      "No UUID format is required for LineId.",
      "LineId is not normalized to lowercase.",
      "LineId rejects UUID-formatted input.",
      "LineId is opaque rather than a UUID.",
      "LineId defines no format, normalization, or additional validity rule.",
    ]) {
      fs.writeFileSync(
        path.join(entityShapeWorkspace, entityShapeRelative),
        `${completeEntityDesign}\n${deniedRule}\n`,
      );
      const deniedFormatGrade = scoreResult(
        entityShapeCase,
        entityShapeResult,
        entityShapeWorkspace,
        entityShapeOptions,
      );
      if (!deniedFormatGrade.passed) {
        fail(`scorer rejected an explicit denial of a LineId format: ${deniedRule}` , 2);
      }
    }
    const entityValueObjectLine = "Quantity represents the allocation amount. Quantity is positive and equal by amount. LineId is constructed from the resource identity admitted by Fulfillment, has no additional business-format rule, and is equal by exact identity.";
    const missingLineIdConstruction = completeEntityDesign.replace(
      entityValueObjectLine,
      "Quantity represents the allocation amount. Quantity is positive and equal by amount. LineId has no additional business-format rule and is equal by exact identity.",
    );
    fs.writeFileSync(path.join(entityShapeWorkspace, entityShapeRelative), missingLineIdConstruction);
    const missingLineIdConstructionGrade = scoreResult(
      entityShapeCase,
      entityShapeResult,
      entityShapeWorkspace,
      entityShapeOptions,
    );
    if (missingLineIdConstructionGrade.passed || !missingLineIdConstructionGrade.assertions.some((item) =>
      item.name.includes("LineId is constructed from") && !item.passed)) {
      fail("scorer accepted LineId semantics without construction", 2);
    }
    const missingLineIdNoFormat = completeEntityDesign.replace(
      entityValueObjectLine,
      "Quantity represents the allocation amount. Quantity is positive and equal by amount. LineId is constructed from the resource identity admitted by Fulfillment and is equal by exact identity.",
    );
    fs.writeFileSync(path.join(entityShapeWorkspace, entityShapeRelative), missingLineIdNoFormat);
    const missingLineIdNoFormatGrade = scoreResult(
      entityShapeCase,
      entityShapeResult,
      entityShapeWorkspace,
      entityShapeOptions,
    );
    if (missingLineIdNoFormatGrade.passed || !missingLineIdNoFormatGrade.assertions.some((item) =>
      item.name.includes("no additional business-format rule") && !item.passed)) {
      fail("scorer accepted LineId semantics without an explicit no-format rule", 2);
    }
    const missingLineIdEquality = completeEntityDesign.replace(
      entityValueObjectLine,
      "Quantity represents the allocation amount. Quantity is positive and equal by amount. LineId is constructed from the resource identity admitted by Fulfillment and has no additional business-format rule.",
    );
    fs.writeFileSync(path.join(entityShapeWorkspace, entityShapeRelative), missingLineIdEquality);
    const missingLineIdEqualityGrade = scoreResult(
      entityShapeCase,
      entityShapeResult,
      entityShapeWorkspace,
      entityShapeOptions,
    );
    if (missingLineIdEqualityGrade.passed || !missingLineIdEqualityGrade.assertions.some((item) =>
      item.name.includes("LineId values are equal when") && !item.passed)) {
      fail("scorer accepted LineId construction without equality semantics", 2);
    }
    const missingQuantityMeaning = completeEntityDesign.replace(
      entityValueObjectLine,
      "Quantity is positive and equal by amount. LineId is constructed from the resource identity admitted by Fulfillment, has no additional business-format rule, and is equal by exact identity.",
    );
    fs.writeFileSync(path.join(entityShapeWorkspace, entityShapeRelative), missingQuantityMeaning);
    const missingQuantityMeaningGrade = scoreResult(
      entityShapeCase,
      entityShapeResult,
      entityShapeWorkspace,
      entityShapeOptions,
    );
    if (missingQuantityMeaningGrade.passed || !missingQuantityMeaningGrade.assertions.some((item) =>
      item.name.includes("Quantity represents the allocation amount") && !item.passed)) {
      fail("scorer accepted Quantity without its Domain meaning", 2);
    }
    const missingQuantityEquality = completeEntityDesign.replace(
      entityValueObjectLine,
      "Quantity represents the allocation amount and is positive. LineId is constructed from the resource identity admitted by Fulfillment, has no additional business-format rule, and is equal by exact identity.",
    );
    fs.writeFileSync(path.join(entityShapeWorkspace, entityShapeRelative), missingQuantityEquality);
    const missingQuantityEqualityGrade = scoreResult(
      entityShapeCase,
      entityShapeResult,
      entityShapeWorkspace,
      entityShapeOptions,
    );
    if (missingQuantityEqualityGrade.passed || !missingQuantityEqualityGrade.assertions.some((item) =>
      item.name.includes("Quantity values are equal when") && !item.passed)) {
      fail("scorer accepted Quantity construction without equality semantics", 2);
    }
    fs.writeFileSync(
      path.join(entityShapeWorkspace, entityShapeRelative),
      `${completeEntityDesign}\nLineId construction is unspecified. LineId equality is undefined. Quantity equality is unspecified.\n`,
    );
    const unspecifiedValueObjectsGrade = scoreResult(
      entityShapeCase,
      entityShapeResult,
      entityShapeWorkspace,
      entityShapeOptions,
    );
    if (unspecifiedValueObjectsGrade.passed || !unspecifiedValueObjectsGrade.assertions.some((item) =>
      item.name.includes("semantically excludes") && !item.passed)) {
      fail("scorer accepted unspecified Value Object semantics as definitions", 2);
    }
    fs.writeFileSync(
      path.join(entityShapeWorkspace, entityShapeRelative),
      `${completeEntityDesign}\nQuantity values are equal when their amounts differ. LineId is constructed from arbitrary input.\n`,
    );
    const reversedValueObjectGrade = scoreResult(
      entityShapeCase,
      entityShapeResult,
      entityShapeWorkspace,
      entityShapeOptions,
    );
    if (reversedValueObjectGrade.passed || !reversedValueObjectGrade.assertions.some((item) =>
      item.name.startsWith(`file ${entityShapeRelative} establishes`) && !item.passed)) {
      fail("scorer accepted contradictory Value Object construction and equality propositions", 2);
    }
    fs.writeFileSync(path.join(entityShapeWorkspace, entityShapeRelative), completeEntityDesign);
    const paraphrasedEntityDesign = completeEntityDesign.replace(
      "AllocationLine represents one resource allocation request. It is identified by LineId, is owned by FulfillmentOrder, and cannot exist outside its owning Root. Its lifecycle is scoped to the owning Aggregate while stable LineId preserves continuity. AllocateLine and RejectLine are its intention-revealing behaviors.",
      "AllocationLine represents one resource allocation request. Its LineId preserves its identity and continuity. It is owned by exactly one FulfillmentOrder, cannot exist outside that Root, and changes only through Root behavior. AllocateLine and RejectLine are its intention-revealing behaviors.",
    );
    fs.writeFileSync(path.join(entityShapeWorkspace, entityShapeRelative), paraphrasedEntityDesign);
    if (!scoreResult(
      entityShapeCase,
      entityShapeResult,
      entityShapeWorkspace,
      entityShapeOptions,
    ).passed) {
      fail("scorer rejected an equivalent retained Entity definition", 2);
    }
    fs.writeFileSync(path.join(entityShapeWorkspace, entityShapeRelative), completeEntityDesign);
    fs.writeFileSync(
      path.join(entityShapeWorkspace, entityShapeRelative),
      completeEntityDesign.replace(
        "AllocationLine represents one resource allocation request. It is identified by LineId, is owned by FulfillmentOrder, and cannot exist outside its owning Root. Its lifecycle is scoped to the owning Aggregate while stable LineId preserves continuity. AllocateLine and RejectLine are its intention-revealing behaviors.",
        "AllocationLine.",
      ),
    );
    const undefinedEntityGrade = scoreResult(
      entityShapeCase,
      entityShapeResult,
      entityShapeWorkspace,
      entityShapeOptions,
    );
    if (undefinedEntityGrade.passed || !undefinedEntityGrade.assertions.some((item) =>
      !item.passed && item.name.includes("design.md contains any of"))) {
      fail("scorer accepted a retained Entity heading without its Domain definition", 2);
    }
    const shapeWriteConfig = readJson(path.join(
      CASES_ROOT,
      "shape-mysql-default-handoff",
      "case.json",
    ));
    const shapeWriteWorkspace = path.join(tempRoot, "shape-write-workspace");
    fs.mkdirSync(shapeWriteWorkspace, { recursive: true });
    const shapeWriteBaseline = initializeGit(shapeWriteWorkspace);
    const shapeWriteRelative = "docs/ddd-expert/context/inventory/design.md";
    const shapeWritePath = path.join(shapeWriteWorkspace, shapeWriteRelative);
    fs.mkdirSync(path.dirname(shapeWritePath), { recursive: true });
    const minimalShapeDesign = `---
context: Inventory
based_on_model_revision: 1
---

# Inventory Tactical Design

MySQL

## Model Realization

## Aggregate Designs

#### Boundary Thesis

#### Value Objects

#### Behaviors and Lifecycle

#### Domain Events

## Context Dependencies and Contracts
`;
    fs.writeFileSync(shapeWritePath, minimalShapeDesign);
    const shapeWriteCase = { ...loadedCase, config: shapeWriteConfig };
    const shapeWriteResult = {
      ...goodExplore,
      scenario_id: shapeWriteConfig.id,
      phase: "shape",
      completion: "completed",
      questions: [],
      changed_files: [shapeWriteRelative],
    };
    if (scoreResult(
      shapeWriteCase,
      shapeWriteResult,
      shapeWriteWorkspace,
      { baseline: shapeWriteBaseline },
    ).passed) {
      fail("scorer accepted a Shape write that had headings but omitted accepted tactical decisions", 2);
    }
    const completeShapeDesign = `---
context: Inventory
based_on_model_revision: 1
---

# Inventory Tactical Design

## Model Realization

InventoryReservation realizes Inventory's accepted reservation obligations using the MySQL house-style default.

## Aggregate Designs

### InventoryReservation

#### Boundary Thesis

InventoryReservation remains separate from Order because Inventory is the upstream owner of stock authority. The Aggregate retains no Entity.

#### Value Objects

ReservationId is the immutable identity of one reservation. It is constructed only from an identity admitted by Inventory. The Model defines no format, normalization, or additional validity rule. ReservationId values are equal when they denote the same reservation identity.

Quantity is the immutable amount of stock accepted for the reservation. Quantity construction requires a positive amount, and Quantity equality is by that amount.

#### Behaviors and Lifecycle

| From | Intent | Authority | Guard | To | Established Fact |
|---|---|---|---|---|---|
| Creation | Reserve | Inventory | new identity | Reserved | StockReserved |
| Reserved | Confirm | Inventory | not terminal | Confirmed | StockReservationConfirmed |
| Reserved | Expire | Inventory | not terminal | Expired | StockReservationExpired |

The reservation starts in Reserved; only transitions from Reserved establish Confirmed or Expired, and both outcomes are terminal. Work with the same reservation identity returns the established result without another transition.

#### Domain Events

StockReserved, StockReservationConfirmed, and StockReservationExpired are local Domain Events, translated rather than reused for the cross-context Integration Message.

#### Consistency, Concurrency, and Failure

Identity uniqueness and an optimistic version make duplicate work idempotent and protect terminal outcomes.

## Context Dependencies and Contracts

Inventory publishes a distinct reservation outcome Integration Message to Order. A transactional outbox records the outcome in the local transaction; a relay publishes once the transaction commits and retries without changing it. Notification failure leaves the established Inventory outcome intact, and the direct handoff works without a Process Manager.
`;
    fs.writeFileSync(shapeWritePath, completeShapeDesign);
    const completeShapeGrade = scoreResult(
      shapeWriteCase,
      shapeWriteResult,
      shapeWriteWorkspace,
      { baseline: shapeWriteBaseline },
    );
    if (!completeShapeGrade.passed) {
      fail(`scorer rejected a Shape write containing the accepted tactical decisions: ${JSON.stringify(completeShapeGrade.assertions)}`, 2);
    }
    const paraphrasedValueObjectsDesign = completeShapeDesign.replace(
      "ReservationId is the immutable identity of one reservation. It is constructed only from an identity admitted by Inventory. The Model defines no format, normalization, or additional validity rule. ReservationId values are equal when they denote the same reservation identity.\n\nQuantity is the immutable amount of stock accepted for the reservation. Quantity construction requires a positive amount, and Quantity equality is by that amount.",
      "ReservationId is the Domain identity value that denotes the same reservation throughout its lifecycle. Construction accepts an identity admitted by Inventory. The Model defines no format, normalization, or additional validity rule. Two values are equal when they denote the same reservation identity.\n\nQuantity is the accepted quantity owned by one reservation. Construction succeeds only for a positive quantity. Two values are equal when their represented quantities are equal.",
    );
    fs.writeFileSync(shapeWritePath, paraphrasedValueObjectsDesign);
    if (!scoreResult(
      shapeWriteCase,
      shapeWriteResult,
      shapeWriteWorkspace,
      { baseline: shapeWriteBaseline },
    ).passed) {
      fail("scorer rejected equivalent Value Object construction and equality semantics", 2);
    }
    const reverseNegatedIdentifierFormat = completeShapeDesign.replace(
      "ReservationId is the immutable identity of one reservation. It is constructed only from an identity admitted by Inventory. The Model defines no format, normalization, or additional validity rule. ReservationId values are equal when they denote the same reservation identity.",
      "ReservationId is the immutable identity of one reservation. ReservationId is constructed from an identity admitted by Inventory. No UUID format is required for ReservationId. The Model defines no additional business validity rule. ReservationId values are equal when they denote the same reservation identity.",
    );
    fs.writeFileSync(shapeWritePath, reverseNegatedIdentifierFormat);
    const reverseNegatedIdentifierGrade = scoreResult(
      shapeWriteCase,
      shapeWriteResult,
      shapeWriteWorkspace,
      { baseline: shapeWriteBaseline },
    );
    if (!reverseNegatedIdentifierGrade.passed) {
      fail(`scorer rejected a reverse-order statement that explicitly denies an identifier format: ${JSON.stringify(reverseNegatedIdentifierGrade.assertions.filter((item) => !item.passed))}`, 2);
    }
    fs.writeFileSync(shapeWritePath, completeShapeDesign);
    fs.writeFileSync(
      shapeWritePath,
      completeShapeDesign.replace(
        "It is constructed only from an identity admitted by Inventory. The Model defines no format, normalization, or additional validity rule. ReservationId values are equal when they denote the same reservation identity.",
        "Construction requires a canonical UUIDv7. ReservationId values are equal by that UUID.",
      ),
    );
    const inventedIdentifierGrade = scoreResult(
      shapeWriteCase,
      shapeWriteResult,
      shapeWriteWorkspace,
      { baseline: shapeWriteBaseline },
    );
    const inventoryIdentifierFormatAssertionName =
      "file docs/ddd-expert/context/inventory/design.md invents no identifier format";
    const inventedIdentifierAssertion = inventedIdentifierGrade.assertions.find((item) =>
      item.name === inventoryIdentifierFormatAssertionName);
    if (inventedIdentifierGrade.passed || !inventedIdentifierAssertion || inventedIdentifierAssertion.passed) {
      fail("scorer accepted a House Style invented as a Domain identifier rule", 2);
    }
    fs.writeFileSync(shapeWritePath, completeShapeDesign);
    for (const [label, inventedRule] of [
      ["ULID", "ReservationId construction requires a canonical ULID."],
      ["regular expression", "ReservationId must match regex [A-Z0-9]{26}."],
      ["normalization", "ReservationId is normalized to lowercase."],
      ["reverse ULID", "A canonical ULID with no prefix is required for ReservationId."],
      ["RFC", "ReservationId conforms to RFC 4122."],
      ["alphanumeric length", "ReservationId consists of 26 alphanumeric symbols."],
      ["qualified UUID", "InventoryReservationId is a canonical UUID."],
      ["reverse fixed length", "A fixed-length 26-character format is required for ReservationId."],
    ]) {
      fs.writeFileSync(shapeWritePath, `${completeShapeDesign}\n${inventedRule}\n`);
      const inventedRuleGrade = scoreResult(
        shapeWriteCase,
        shapeWriteResult,
        shapeWriteWorkspace,
        { baseline: shapeWriteBaseline },
      );
      if (inventedRuleGrade.passed || !inventedRuleGrade.assertions.some((item) =>
        item.name === inventoryIdentifierFormatAssertionName && !item.passed)) {
        fail(`scorer accepted an invented ${label} Domain identifier rule`, 2);
      }
    }
    for (const deniedRule of [
      "ReservationId does not use UUID.",
      "ReservationId never requires ULID.",
      "Neither UUID nor ULID is required for ReservationId.",
      "No UUID format is required for ReservationId.",
      "ReservationId is not normalized to lowercase.",
    ]) {
      fs.writeFileSync(shapeWritePath, `${completeShapeDesign}\n${deniedRule}\n`);
      const deniedFormatGrade = scoreResult(
        shapeWriteCase,
        shapeWriteResult,
        shapeWriteWorkspace,
        { baseline: shapeWriteBaseline },
      );
      if (!deniedFormatGrade.passed) {
        fail(`scorer rejected an explicit denial of a ReservationId format: ${deniedRule}`, 2);
      }
    }
    fs.writeFileSync(shapeWritePath, completeShapeDesign);
    const undefinedValueObjectsDesign = completeShapeDesign.replace(
      "ReservationId is the immutable identity of one reservation. It is constructed only from an identity admitted by Inventory. The Model defines no format, normalization, or additional validity rule. ReservationId values are equal when they denote the same reservation identity.\n\nQuantity is the immutable amount of stock accepted for the reservation. Quantity construction requires a positive amount, and Quantity equality is by that amount.",
      "ReservationId. Quantity is positive.",
    );
    fs.writeFileSync(shapeWritePath, undefinedValueObjectsDesign);
    const undefinedValueObjectsGrade = scoreResult(
      shapeWriteCase,
      shapeWriteResult,
      shapeWriteWorkspace,
      { baseline: shapeWriteBaseline },
    );
    if (undefinedValueObjectsGrade.passed || !undefinedValueObjectsGrade.assertions.some((item) =>
      !item.passed && item.name.includes("design.md contains any of"))) {
      fail("scorer accepted Value Object names without Domain definitions", 2);
    }
    const inventoryValueObjects = "ReservationId is the immutable identity of one reservation. It is constructed only from an identity admitted by Inventory. The Model defines no format, normalization, or additional validity rule. ReservationId values are equal when they denote the same reservation identity.\n\nQuantity is the immutable amount of stock accepted for the reservation. Quantity construction requires a positive amount, and Quantity equality is by that amount.";
    for (const [label, replacement, assertionFragment] of [
      [
        "ReservationId construction",
        "ReservationId is the immutable identity of one reservation. The Model defines no format, normalization, or additional validity rule. ReservationId values are equal when they denote the same reservation identity.\n\nQuantity is the immutable amount of stock accepted for the reservation. Quantity construction requires a positive amount, and Quantity equality is by that amount.",
        "ReservationId is constructed from",
      ],
      [
        "ReservationId no-format rule",
        "ReservationId is the immutable identity of one reservation. It is constructed only from an identity admitted by Inventory. ReservationId values are equal when they denote the same reservation identity.\n\nQuantity is the immutable amount of stock accepted for the reservation. Quantity construction requires a positive amount, and Quantity equality is by that amount.",
        "defines no format",
      ],
      [
        "ReservationId equality",
        "ReservationId is the immutable identity of one reservation. It is constructed only from an identity admitted by Inventory. The Model defines no format, normalization, or additional validity rule.\n\nQuantity is the immutable amount of stock accepted for the reservation. Quantity construction requires a positive amount, and Quantity equality is by that amount.",
        "ReservationId values are equal",
      ],
      [
        "Quantity meaning",
        "ReservationId is the immutable identity of one reservation. It is constructed only from an identity admitted by Inventory. The Model defines no format, normalization, or additional validity rule. ReservationId values are equal when they denote the same reservation identity.\n\nQuantity construction requires a positive amount, and Quantity equality is by that amount.",
        "Quantity is the immutable amount",
      ],
      [
        "Quantity equality",
        "ReservationId is the immutable identity of one reservation. It is constructed only from an identity admitted by Inventory. The Model defines no format, normalization, or additional validity rule. ReservationId values are equal when they denote the same reservation identity.\n\nQuantity is the immutable amount of stock accepted for the reservation. Quantity construction requires a positive amount.",
        "Quantity values are equal",
      ],
    ]) {
      fs.writeFileSync(shapeWritePath, completeShapeDesign.replace(inventoryValueObjects, replacement));
      const omissionGrade = scoreResult(
        shapeWriteCase,
        shapeWriteResult,
        shapeWriteWorkspace,
        { baseline: shapeWriteBaseline },
      );
      if (omissionGrade.passed || !omissionGrade.assertions.some((item) =>
        item.name.includes(assertionFragment) && !item.passed)) {
        fail(`scorer accepted Inventory Value Objects without ${label}`, 2);
      }
    }
    fs.writeFileSync(
      shapeWritePath,
      `${completeShapeDesign}\nReservationId construction is unspecified. ReservationId equality is undefined. Quantity meaning is unspecified. Quantity equality is undefined.\n`,
    );
    const unspecifiedInventoryValueObjectsGrade = scoreResult(
      shapeWriteCase,
      shapeWriteResult,
      shapeWriteWorkspace,
      { baseline: shapeWriteBaseline },
    );
    if (unspecifiedInventoryValueObjectsGrade.passed || !unspecifiedInventoryValueObjectsGrade.assertions.some((item) =>
      item.name.includes("semantically excludes") && !item.passed)) {
      fail("scorer accepted unspecified Inventory Value Object semantics as definitions", 2);
    }
    fs.writeFileSync(shapeWritePath, completeShapeDesign);
    const negatedShapeDesign = completeShapeDesign
      .replace("Quantity is positive", "positive Quantity is not required")
      .replace("The Aggregate retains no Entity.", "InventoryReservation has a child Entity.")
      .replace(
        "are local Domain Events, translated rather than reused for the cross-context Integration Message",
        "are contradicted: StockReserved is not a Domain Event, and Inventory does not publish a Reservation Outcome Integration Message",
      )
      .replace(
        "A transactional outbox records the outcome in the local transaction; a relay publishes once the transaction commits and retries without changing it.",
        "The design does not use a transactional outbox or a local transaction; The relay publishes before commit and does not retry.",
      )
      .replace(
        "Identity uniqueness and an optimistic version make duplicate work idempotent",
        "Uniqueness is not required, optimistic concurrency is forbidden, and idempotency is not required",
      );
    fs.writeFileSync(shapeWritePath, negatedShapeDesign);
    const negatedShapeGrade = scoreResult(
      shapeWriteCase,
      shapeWriteResult,
      shapeWriteWorkspace,
      { baseline: shapeWriteBaseline },
    );
    if (negatedShapeGrade.passed || !negatedShapeGrade.assertions.some((item) =>
      !item.passed && item.name.includes("design.md semantically excludes"))) {
      fail("scorer accepted a Shape design that negated accepted tactical decisions", 2);
    }
    fs.writeFileSync(
      shapeWritePath,
      `${completeShapeDesign}\n#### Entities\n\nReservation Item is a child Entity.\n`,
    );
    const headingBypassShapeGrade = scoreResult(
      shapeWriteCase,
      shapeWriteResult,
      shapeWriteWorkspace,
      { baseline: shapeWriteBaseline },
    );
    const headingBypassAssertion = headingBypassShapeGrade.assertions.find((item) =>
      item.name === "file docs/ddd-expert/context/inventory/design.md semantically excludes Reservation Item is a child Entity");
    if (headingBypassShapeGrade.passed || !headingBypassAssertion || headingBypassAssertion.passed) {
      fail("scorer accepted a child Entity hidden behind a shallower heading", 2);
    }
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
  const runtimeRoot = registerRuntimeRoot(
    fs.mkdtempSync(path.join(os.tmpdir(), "ddd-expert-doctor-")),
  );
  try {
    const codexBinary = resolveExecutable(process.env.CODEX_BIN || "codex");
    const codexVersion = runCommand([codexBinary, "--version"], { timeoutSeconds: 30 });
    requireSuccess(codexVersion, "codex --version");
    const imageId = ensureContainerImage(options.containerImage);
    const mountSmokeWorkspace = path.join(runtimeRoot, "mount-smoke-workspace");
    fs.mkdirSync(mountSmokeWorkspace, { recursive: true });
    fs.writeFileSync(path.join(mountSmokeWorkspace, "baseline.md"), "baseline\n");
    const mountSmokeBaseline = initializeGit(mountSmokeWorkspace);
    const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
    const gid = typeof process.getgid === "function" ? process.getgid() : 1000;
    const mountSmoke = runManagedDockerContainer([
      "docker", "run", "--rm", "--network", "none", "--read-only",
      "--tmpfs", "/tmp:rw,exec,nosuid,nodev,size=16m",
      "--cap-drop=ALL", "--security-opt", "no-new-privileges",
      "--user", `${uid}:${gid}`,
      "-v", `${mountSmokeWorkspace}:/workspace:rw`,
      "--mount", readOnlyGitMetadataMount(mountSmokeWorkspace),
      "-w", "/workspace", imageId, "sh", "-c",
      "touch /workspace/worktree-write-ok && if printf 'tamper\\n' >> /workspace/.git/config; then exit 41; fi",
    ], { timeoutSeconds: 30, runtimeRoot, prefix: "doctor-mount" });
    requireSuccess(mountSmoke, "container nested read-only Git metadata mount");
    if (!fs.statSync(path.join(mountSmokeWorkspace, "worktree-write-ok"), { throwIfNoEntry: false })?.isFile() ||
        gitMetadataChanges(mountSmokeWorkspace, mountSmokeBaseline).length > 0) {
      fail("container mount smoke did not preserve writable worktree and read-only Git metadata", 2);
    }
    for (const command of [["go", "version"], ["git", "--version"], ["rg", "--version"], ["timeout", "--version"]]) {
      requireSuccess(
        runManagedDockerContainer(
          ["docker", "run", "--rm", "--network", "none", imageId, ...command],
          { timeoutSeconds: 30, runtimeRoot, prefix: "doctor-tool" },
        ),
        `container ${command.join(" ")}`,
      );
    }
    const timeoutProbeStartedAt = Date.now();
    const timeoutCleanupProbe = runManagedDockerContainer([
      "docker", "run", "--rm", "--network", "none", imageId,
      "sh", "-c", "trap '' TERM; sleep 30",
    ], {
      runtimeRoot,
      prefix: "doctor-timeout",
      timeoutSeconds: 1,
    });
    const timeoutProbeDurationMs = Date.now() - timeoutProbeStartedAt;
    if (!/ETIMEDOUT/u.test(timeoutCleanupProbe.error || "") ||
        timeoutCleanupProbe.containerCleanup.error || timeoutProbeDurationMs >= 10000) {
      fail(`container timeout cleanup probe failed: duration=${timeoutProbeDurationMs}ms; status=${timeoutCleanupProbe.status}; cleanup=${timeoutCleanupProbe.containerCleanup.error || "ok"}; command=${timeoutCleanupProbe.error || "no timeout"}`, 2);
    }
    const expectedHash = hashTree(PLUGIN_ROOT);
    const marketplaceRoot = snapshotMarketplace(runtimeRoot);
    const installed = installCodexPlugin(runtimeRoot, codexBinary, marketplaceRoot, expectedHash);
    const doctorHome = path.join(runtimeRoot, "doctor-home");
    fs.cpSync(installed.codexHome, doctorHome, { recursive: true });
    const doctorPluginCache = path.join(doctorHome, installed.pluginCacheRelative);
    const containerPluginCache = `/eval-home/${installed.pluginCacheRelative.split(path.sep).join("/")}`;
    const inContainer = runManagedDockerContainer([
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
      imageId, "/usr/local/bin/codex", "plugin", "list", "--json",
    ], { timeoutSeconds: 60, runtimeRoot, prefix: "doctor-codex" });
    parsePluginList(inContainer, "container codex plugin list");
    if (hashTree(doctorPluginCache) !== expectedHash) {
      fail("container doctor observed a changed ddd-expert cache", 2);
    }
    console.log(`ddd-expert eval doctor passed: ${codexVersion.stdout.trim()}, image=${imageId}, plugin=${installed.pluginVersion}, sha256=${expectedHash}`);
  } finally {
    removeTrackedRuntimeRoot(runtimeRoot);
  }
}

async function runCommandMain(options) {
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
  const outputDir = options.output
    ? preparePrivateOutputRoot(options.output)
    : createDefaultPrivateOutputRoot();
  const runtimeRoot = registerRuntimeRoot(
    fs.mkdtempSync(path.join(os.tmpdir(), "ddd-expert-runtime-")),
  );
  const pluginFingerprint = hashTree(PLUGIN_ROOT);
  const evalSourceFingerprint = hashTree(EVAL_ROOT);
  const runnerFingerprint = hashFiles(RUNNER_FILES);
  try {
    throwIfRunnerTerminating();
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
      authSource: installed.authSource,
      marketplaceRoot,
      resultSchema: snapshot.resultSchema,
      model: options.model,
      reasoning: options.reasoning,
      timeoutSeconds: options.timeoutSeconds,
      containerImage: containerImageId,
    };

    const trials = [];
    const infrastructureAttempts = [];
    for (const loadedCase of selected) {
      for (let trial = 1; trial <= runs; trial += 1) {
        throwIfRunnerTerminating();
        process.stdout.write(`RUN ${loadedCase.config.id} ${trial}/${runs} ... `);
        let result;
        for (let attempt = 1; attempt <= options.infrastructureRetries + 1; attempt += 1) {
          throwIfRunnerTerminating();
          result = await runTrial(loadedCase, trial, attempt, context);
          throwIfRunnerTerminating();
          if (!result.infrastructureFailure) {
            break;
          }
          infrastructureAttempts.push(result);
          if (attempt <= options.infrastructureRetries) {
            console.log(`INFRA_RETRY ${attempt}/${options.infrastructureRetries}`);
            sleep(1000 * (2 ** (attempt - 1)));
            throwIfRunnerTerminating();
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

    throwIfRunnerTerminating();

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
      sourceChangedDuringRun: pluginFingerprint !== hashTree(PLUGIN_ROOT) || evalSourceFingerprint !== hashTree(EVAL_ROOT) || runnerFingerprint !== hashFiles(RUNNER_FILES),
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
    writePrivateFile(path.join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    hardenArtifactTree(outputDir);
    console.log(`SUMMARY ${status.toUpperCase()}: ${caseResults.filter((item) => item.status === "pass").length}/${caseResults.length} cases passed`);
    console.log(`ARTIFACTS ${outputDir}`);
    process.exitCode = status === "pass" ? 0 : status === "fail" ? 1 : 2;
  } finally {
    try {
      hardenArtifactTree(outputDir);
    } finally {
      removeTrackedRuntimeRoot(runtimeRoot);
    }
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === "validate") {
    validateCommand();
  } else if (options.command === "self-test") {
    selfTestCommand();
  } else if (options.command === "doctor") {
    doctorCommand(options);
  } else if (options.command === "run") {
    await runCommandMain(options);
  } else if (["help", "--help", "-h"].includes(options.command)) {
    printHelp();
  } else {
    fail(`unknown command ${options.command}`, 2);
  }
}

async function runCli() {
  installTerminationHandlers();
  let failure = null;
  try {
    await main();
  } catch (error) {
    failure = error;
  }
  try {
    await cleanupActiveEvaluatorResources();
  } catch (error) {
    if (failure) {
      failure.message = `${failure.message}; cleanup failed: ${error.message}`;
    } else {
      failure = error;
    }
  }
  if (!failure && requestedTerminationSignal) {
    try {
      throwIfRunnerTerminating();
    } catch (error) {
      failure = error;
    }
  }
  if (failure) throw failure;
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(`ERROR ${error.message}`);
    process.exitCode = error.exitCode || terminationExitCode() || 1;
  });
}

module.exports = {
  loadCases,
  pathMatches,
  scoreResult,
  validateResultShape,
};
