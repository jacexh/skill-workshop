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
const AUTOMATED_PHASES = Object.freeze(["codify", "guard"]);
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

const RESULT_SCHEMA_DOCUMENT = readJson(RESULT_SCHEMA);
const RESULT_COMPLETIONS = RESULT_SCHEMA_DOCUMENT.properties?.completion?.enum;
if (!Array.isArray(RESULT_COMPLETIONS) || RESULT_COMPLETIONS.length === 0) {
  fail("result schema must define completion values", 2);
}
const RESULT_QUESTION_MAX = RESULT_SCHEMA_DOCUMENT.properties?.questions?.maxItems;
if (!Number.isInteger(RESULT_QUESTION_MAX) || RESULT_QUESTION_MAX < 1) {
  fail("result schema must define a positive questions.maxItems", 2);
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

function inspectCaseInputPath(caseDir, relative, label, expectedType) {
  const resolved = safeChildPath(caseDir, relative, label);
  const caseRoot = path.resolve(caseDir);
  const caseRootReal = fs.realpathSync(caseRoot);
  const segments = path.relative(caseRoot, resolved).split(path.sep).filter(Boolean);
  let current = caseRoot;
  let stat = fs.lstatSync(current, { throwIfNoEntry: false });
  if (!stat?.isDirectory() || stat.isSymbolicLink()) {
    fail(`${label} case root must be a real directory`, 2);
  }
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat) {
      fail(`${label} does not exist`, 2);
    }
    if (stat.isSymbolicLink()) {
      fail(`${label} must not traverse or name a symlink`, 2);
    }
    if (index < segments.length - 1 && !stat.isDirectory()) {
      fail(`${label} has a non-directory ancestor`, 2);
    }
  }
  const validType = expectedType === "file" ? stat?.isFile() : stat?.isDirectory();
  if (!validType || (expectedType === "file" && stat.nlink !== 1)) {
    fail(`${label} must be a ${expectedType === "file" ? "non-hard-linked regular file" : "real directory"}`, 2);
  }
  const realPath = fs.realpathSync(resolved);
  if (realPath !== caseRootReal && !realPath.startsWith(`${caseRootReal}${path.sep}`)) {
    fail(`${label} resolves outside its case directory`, 2);
  }
  return { path: resolved, realPath, stat };
}

function sameFilesystemObject(left, right) {
  return left.stat.dev === right.stat.dev && left.stat.ino === right.stat.ino;
}

function pathIsInside(candidate, directory) {
  return candidate === directory || candidate.startsWith(`${directory}${path.sep}`);
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

function validateQuestionExpectation(value, label) {
  const allowedKeys = ["min", "max", "contains", "contains_any", "excludes", "propositions"];
  if (!hasOnlyKeys(value, allowedKeys) || !Number.isInteger(value.min) ||
      !Number.isInteger(value.max) || value.min < 0 || value.max < value.min ||
      value.min > RESULT_QUESTION_MAX || value.max > RESULT_QUESTION_MAX) {
    fail(`${label} must define integer min/max within result-schema maxItems ${RESULT_QUESTION_MAX}`, 2);
  }
  for (const key of ["contains", "excludes"]) {
    if (key in value) {
      stringArray(value[key], `${label}.${key}`, false);
      if (value[key].some((item) => normalizeSemanticText(item).length === 0 || !isValidSemanticExpectation(item))) {
        fail(`${label}.${key} must contain valid semantic text`, 2);
      }
    }
  }
  if ("contains_any" in value) {
    if (!Array.isArray(value.contains_any) || value.contains_any.length === 0) {
      fail(`${label}.contains_any must be a non-empty array of groups`, 2);
    }
    for (const [index, group] of value.contains_any.entries()) {
      stringArray(group, `${label}.contains_any[${index}]`, false);
      if (group.some((item) => normalizeSemanticText(item).length === 0 || !isValidSemanticExpectation(item))) {
        fail(`${label}.contains_any[${index}] must contain valid semantic text`, 2);
      }
    }
  }
  if ("propositions" in value) {
    validatePropositions(value.propositions, `${label}.propositions`);
  }
  if (allowedKeys.slice(2).some((key) => key in value) && value.min < 1) {
    fail(`${label} semantic expectations require min >= 1`, 2);
  }
}

function validateGitExpectation(value, label) {
  if (!hasOnlyKeys(value, ["changed", "required_paths", "forbidden_paths", "allowed_paths"]) ||
      !["none", "some"].includes(value.changed)) {
    fail(`${label} must define changed as none or some`, 2);
  }
  stringArray(value.required_paths, `${label}.required_paths`);
  stringArray(value.forbidden_paths, `${label}.forbidden_paths`);
  if ("allowed_paths" in value) {
    stringArray(value.allowed_paths, `${label}.allowed_paths`);
    if (value.required_paths.some((required) =>
      !value.allowed_paths.some((allowed) => pathMatches(required, allowed)))) {
      fail(`${label}.required_paths must be included in allowed_paths`, 2);
    }
  }
}

function validateFileExpectations(value, label, workspacePath) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`, 2);
  }
  for (const [fileIndex, assertion] of value.entries()) {
    const fileLabel = `${label}[${fileIndex}]`;
    if (!hasOnlyKeys(assertion, ["path", "exists", "contains", "contains_any", "excludes", "excludes_semantic", "propositions", "identifiers_without_format", "forbid_temporary_trace", "contains_words", "excludes_words"]) ||
        typeof assertion.path !== "string" || typeof assertion.exists !== "boolean") {
      fail(`${fileLabel} is invalid`, 2);
    }
    safeChildPath(workspacePath, assertion.path, `${fileLabel}.path`);
    stringArray(assertion.contains, `${fileLabel}.contains`);
    stringArray(assertion.excludes, `${fileLabel}.excludes`);
    stringArray(assertion.excludes_semantic || [], `${fileLabel}.excludes_semantic`);
    validatePropositions(assertion.propositions || [], `${fileLabel}.propositions`);
    stringArray(assertion.identifiers_without_format || [], `${fileLabel}.identifiers_without_format`);
    if ("forbid_temporary_trace" in assertion && typeof assertion.forbid_temporary_trace !== "boolean") {
      fail(`${fileLabel}.forbid_temporary_trace must be boolean`, 2);
    }
    stringArray(assertion.contains_words || [], `${fileLabel}.contains_words`);
    stringArray(assertion.excludes_words || [], `${fileLabel}.excludes_words`);
    for (const [index, group] of (assertion.contains_any || []).entries()) {
      stringArray(group, `${fileLabel}.contains_any[${index}]`, false);
      if (group.some((item) => !isValidSemanticExpectation(item))) {
        fail(`${fileLabel}.contains_any[${index}] contains an invalid semantic expectation`, 2);
      }
    }
    if ((assertion.excludes_semantic || []).some((item) => !isValidSemanticExpectation(item))) {
      fail(`${fileLabel}.excludes_semantic contains an invalid semantic expectation`, 2);
    }
  }
}

function validateCheckExpectations(value, label) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`, 2);
  }
  for (const [index, check] of value.entries()) {
    const checkLabel = `${label}[${index}]`;
    if (!hasOnlyKeys(check, ["argv", "exit", "timeout_seconds"])) {
      fail(`${checkLabel} is invalid`, 2);
    }
    stringArray(check.argv, `${checkLabel}.argv`, false);
    if (!Number.isInteger(check.exit) || !Number.isInteger(check.timeout_seconds) || check.timeout_seconds < 1) {
      fail(`${checkLabel}.exit and timeout_seconds must be integers`, 2);
    }
  }
}

function validateCase(caseDir, config) {
  const requiredKeys = ["id", "phase", "suites", "sandbox", "prompt", "workspace", "expect"];
  const allowedKeys = requiredKeys;
  if (!hasOnlyKeys(config, allowedKeys)) {
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
  if (!AUTOMATED_PHASES.includes(config.phase)) {
    fail(`${config.id}: invalid phase ${config.phase}`, 2);
  }
  if (!config.id.startsWith(`${config.phase}-`)) {
    fail(`${config.id}: case id must use its ${config.phase} phase prefix`, 2);
  }
  stringArray(config.suites, `${config.id}.suites`, false);
  if (config.suites.some((suite) => !["smoke", "full"].includes(suite))) {
    fail(`${config.id}: suites may contain only smoke or full`, 2);
  }
  if (!["read-only", "workspace-write"].includes(config.sandbox)) {
    fail(`${config.id}: invalid sandbox ${config.sandbox}`, 2);
  }

  const promptInput = inspectCaseInputPath(caseDir, config.prompt, `${config.id}.prompt`, "file");
  const workspaceInput = inspectCaseInputPath(caseDir, config.workspace, `${config.id}.workspace`, "directory");
  const promptPath = promptInput.path;
  const workspacePath = workspaceInput.path;
  if (pathIsInside(promptInput.realPath, workspaceInput.realPath)) {
    fail(`${config.id}: prompt must be separate from the model-visible workspace`, 2);
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
  validateQuestionExpectation(expect.questions, `${config.id}.expect.questions`);
  if (!hasOnlyKeys(expect.routes, ["contains", "excludes"])) {
    fail(`${config.id}.expect.routes must be an object`, 2);
  }
  stringArray(expect.routes.contains, `${config.id}.expect.routes.contains`);
  stringArray(expect.routes.excludes, `${config.id}.expect.routes.excludes`);
  for (const target of [...expect.routes.contains, ...expect.routes.excludes]) {
    if (!["event-storming", "codify", "guard"].includes(target)) {
      fail(`${config.id}: invalid expected route ${target}`, 2);
    }
  }
  const contradictoryRoutes = expect.routes.contains.filter((target) => expect.routes.excludes.includes(target));
  if (contradictoryRoutes.length > 0) {
    fail(`${config.id}: expected routes both contain and exclude ${contradictoryRoutes.join(", ")}`, 2);
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
  validateGitExpectation(expect.git, `${config.id}.expect.git`);
  validateFileExpectations(expect.files, `${config.id}.expect.files`, workspacePath);
  validateCheckExpectations(expect.checks, `${config.id}.expect.checks`);

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
  if (!AUTOMATED_PHASES.includes(result.phase)) {
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
    if (result.questions.length > RESULT_QUESTION_MAX || result.questions.some((question) => typeof question !== "string" || question.length === 0)) {
      errors.push(`questions must contain at most ${RESULT_QUESTION_MAX} non-empty strings`);
    }
  }
  for (const route of Array.isArray(result.routes) ? result.routes : []) {
    if (!hasOnlyKeys(route, ["target", "reason"]) || !["event-storming", "codify", "guard"].includes(route.target) || typeof route.reason !== "string" || route.reason.length === 0) {
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

function propositionAssertionAcrossEntries(prefix, contents, proposition) {
  const acceptedEvidence = proposition.accepts.flatMap((phrase) =>
    contents.flatMap((content) => semanticPhraseEvidence(content, phrase)
      .map((item) => ({ ...item, phrase }))));
  const rejectedEvidence = proposition.rejects.flatMap((phrase) =>
    contents.flatMap((content) => semanticPhraseEvidence(content, phrase)
      .map((item) => ({ ...item, phrase }))));
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

function propositionAssertion(prefix, content, proposition) {
  return propositionAssertionAcrossEntries(prefix, [content], proposition);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSemanticText(value) {
  return value
    .normalize("NFKC")
    .replace(/\p{Default_Ignorable_Code_Point}/gu, "")
    .toLowerCase()
    .replace(/(?:<-+>|↔|⟷)/gu, " arrow_both ")
    .replace(/(?:-+>|→|⟶)/gu, " arrow_right ")
    .replace(/(?:<-+|←|⟵)/gu, " arrow_left ")
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
  const questionSet = result.questions.join("\n");
  const normalizedQuestionEntries = result.questions.map((question) => normalizeSemanticText(question));
  for (const needle of expect.questions.contains || []) {
    assertions.push(assertion(
      `question set contains ${needle}`,
      normalizedQuestionEntries.some((entry) => normalizedSemanticContains(entry, needle)),
      `got ${questionSet || "(none)"}`,
    ));
  }
  for (const group of expect.questions.contains_any || []) {
    assertions.push(assertion(
      `question set contains any of ${group.join(" | ")}`,
      group.some((needle) => normalizedQuestionEntries.some((entry) =>
        normalizedSemanticContains(entry, needle))),
      `got ${questionSet || "(none)"}`,
    ));
  }
  for (const needle of expect.questions.excludes || []) {
    assertions.push(assertion(
      `question set excludes ${needle}`,
      normalizedQuestionEntries.every((entry) => !normalizedSemanticContains(entry, needle)),
      `got ${questionSet || "(none)"}`,
    ));
  }
  for (const proposition of expect.questions.propositions || []) {
    assertions.push(propositionAssertionAcrossEntries("question set", result.questions, proposition));
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

function buildTrialExecutionArgs(
  loadedCase,
  context,
  trialCodexHome,
  trialPluginCache,
  authFile,
  workspace,
  modelOutput,
) {
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
  if (context.model) codexArgs.push("-m", context.model);
  if (context.reasoning) {
    codexArgs.push("-c", `model_reasoning_effort=\"${context.reasoning}\"`);
  }
  codexArgs.push("-");

  const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
  const gid = typeof process.getgid === "function" ? process.getgid() : 1000;
  const workspaceMode = loadedCase.config.sandbox === "read-only" ? "ro" : "rw";
  const containerPluginCache = `/eval-home/${context.pluginCacheRelative.split(path.sep).join("/")}`;
  return [
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
}

async function executeTrialTurn({
  loadedCase,
  context,
  trialCodexHome,
  trialPluginCache,
  authFile,
  workspace,
  modelOutput,
  prompt,
  promptFile,
  traceFile,
  stderrFile,
}) {
  if (fs.lstatSync(authFile, { throwIfNoEntry: false })) {
    fail("trial home contains a turn auth path before broker startup", 2);
  }
  fs.mkdirSync(modelOutput, { recursive: true, mode: 0o700 });
  fs.chmodSync(modelOutput, 0o700);
  const executionArgs = buildTrialExecutionArgs(
    loadedCase,
    context,
    trialCodexHome,
    trialPluginCache,
    authFile,
    workspace,
    modelOutput,
  );
  writePrivateFile(promptFile, `${prompt}\n`);
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
  writePrivateFile(traceFile, execution.stdout);
  writePrivateFile(stderrFile, execution.stderr);

  let parsed = null;
  let parseError = null;
  const resultRead = readBoundedTextFile(path.join(modelOutput, "result.json"), RESULT_MAX_FILE_BYTES);
  if (!resultRead.ok) {
    parseError = resultRead.error;
  } else {
    try {
      parsed = JSON.parse(resultRead.content);
    } catch (error) {
      parseError = `cannot parse model result JSON: ${error.message}`;
    }
  }
  return { execution, parsed, parseError };
}

function inspectTurnState(turn, workspace, baseline, trialCodexHome, trialPluginCache, expectedPluginHash) {
  let pluginUnchanged = false;
  let pluginIntegrityError = null;
  try {
    restoreDirectoryChain(trialCodexHome, path.relative(trialCodexHome, trialPluginCache));
    pluginUnchanged = hashTree(trialPluginCache) === expectedPluginHash;
  } catch (error) {
    pluginIntegrityError = error.message;
  }
  const gitMetadataMutation = gitMetadataChanges(workspace, baseline);
  const workspaceSnapshot = workspaceFileSnapshot(workspace);
  const unsafeWorkspaceEntries = workspaceUnsafeEntries(workspace, workspaceSnapshot);
  const executionInfrastructureFailure = turn.execution.status !== 0 ||
    Boolean(turn.execution.error) || !pluginUnchanged;
  return {
    pluginReadObserved: /\/ddd-expert\/[^/\s]+\/(?:skills|references)\//.test(turn.execution.stdout),
    pluginUnchanged,
    pluginIntegrityError,
    gitMetadataMutation,
    workspaceSnapshot,
    unsafeWorkspaceEntries,
    infrastructureFailure: executionInfrastructureFailure &&
      gitMetadataMutation.length === 0 && unsafeWorkspaceEntries.length === 0,
  };
}

function gradeTurn(loadedCase, turn, state, workspace, baseline, context, trialPluginCache) {
  if (state.gitMetadataMutation.length > 0) {
    return {
      passed: false,
      assertions: [assertion(
        "git metadata unchanged",
        false,
        `changed ${state.gitMetadataMutation.join(",")}`,
      )],
      changedPaths: [...new Set([
        ...workspaceFilesystemChanges(workspace, baseline),
        ...state.gitMetadataMutation,
      ])].sort(),
      checks: [],
    };
  }
  if (state.unsafeWorkspaceEntries.length > 0) {
    return {
      passed: false,
      assertions: [assertion(
        "workspace contains no unsafe entries",
        false,
        state.unsafeWorkspaceEntries.join(","),
      )],
      changedPaths: workspaceFilesystemChanges(workspace, baseline, state.workspaceSnapshot),
      checks: [],
    };
  }
  if (state.infrastructureFailure) {
    const reasons = [
      turn.execution.status !== 0 || turn.execution.error
        ? `exit=${turn.execution.status}; signal=${turn.execution.signal}; error=${turn.execution.error || "none"}`
        : null,
      !turn.parsed ? turn.execution.error || turn.parseError || "missing structured result" : null,
      !state.pluginUnchanged
        ? state.pluginIntegrityError || "installed ddd-expert cache changed during the trial"
        : null,
    ].filter(Boolean);
    return {
      passed: false,
      assertions: [assertion(
        "valid model trial",
        false,
        `${reasons.join("; ")}; ${[turn.execution.stderr, turn.execution.stdout].filter(Boolean).join("\n").slice(-1200)}`,
      )],
      changedPaths: changedPaths(workspace, baseline, state.workspaceSnapshot),
      checks: [],
    };
  }
  return scoreResult(loadedCase, turn.parsed, workspace, {
    baseline,
    executeCheck: (check) => runContainerCheck(check, workspace, context, trialPluginCache),
  });
}

async function runTrial(loadedCase, trialNumber, infrastructureAttempt, context) {
  throwIfRunnerTerminating();
  const retrySuffix = infrastructureAttempt === 1 ? "" : `-infra-${infrastructureAttempt}`;
  const trialName = `${loadedCase.config.id}-run-${trialNumber}${retrySuffix}`;
  const trialRoot = path.join(context.outputDir, "trials", trialName);
  const workspace = path.join(trialRoot, "workspace");
  const modelOutput = path.join(trialRoot, "model-output");
  const trialCodexHome = path.join(context.runtimeRoot, "trial-homes", trialName);
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
  if (fs.lstatSync(path.join(trialCodexHome, "auth.json"), { throwIfNoEntry: false })) {
    fail("trial home copied the retained auth source before broker startup", 2);
  }
  fs.cpSync(loadedCase.workspacePath, workspace, { recursive: true });
  const baseline = initializeGit(workspace);
  const trialPluginCache = path.join(trialCodexHome, context.pluginCacheRelative);
  const startedAt = Date.now();
  const nextAuthFile = () => path.join(
    trialCodexHome,
    `auth-${crypto.randomBytes(16).toString("hex")}.fifo`,
  );
  const firstTurn = await executeTrialTurn({
    loadedCase,
    context,
    trialCodexHome,
    trialPluginCache,
    authFile: nextAuthFile(),
    workspace,
    modelOutput,
    prompt: buildPrompt(loadedCase),
    promptFile: path.join(trialRoot, "prompt.txt"),
    traceFile: path.join(trialRoot, "trace.jsonl"),
    stderrFile: path.join(trialRoot, "stderr.log"),
  });
  throwIfRunnerTerminating();

  const firstState = inspectTurnState(
    firstTurn,
    workspace,
    baseline,
    trialCodexHome,
    trialPluginCache,
    context.pluginHash,
  );
  const firstGrade = gradeTurn(
    loadedCase,
    firstTurn,
    firstState,
    workspace,
    baseline,
    context,
    trialPluginCache,
  );

  const finalTurn = firstTurn;
  const finalState = firstState;
  const grade = firstGrade;
  const infrastructureFailure = finalState.infrastructureFailure;
  const pluginReadObserved = firstState.pluginReadObserved;

  const trialResult = {
    scenarioId: loadedCase.config.id,
    trial: trialNumber,
    infrastructureAttempt,
    infrastructureFailure,
    passed: grade.passed,
    durationMs: Date.now() - startedAt,
    execution: {
      exit: finalTurn.execution.status,
      signal: finalTurn.execution.signal,
      error: finalTurn.execution.error,
      explicitSkill: `ddd-expert:${loadedCase.config.phase}`,
      pluginReadObserved,
      pluginUnchanged: finalState.pluginUnchanged,
      pluginIntegrityError: finalState.pluginIntegrityError,
      gitMetadataUnchanged: finalState.gitMetadataMutation.length === 0,
      containerCleanup: finalTurn.execution.containerCleanup,
    },
    result: finalTurn.parsed,
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
  const phaseCounts = Object.fromEntries(AUTOMATED_PHASES.map((phase) => [phase, 0]));
  for (const loadedCase of cases) {
    phaseCounts[loadedCase.config.phase] += 1;
  }
  for (const phase of AUTOMATED_PHASES) {
    if (phaseCounts[phase] < 2) {
      fail(`expected at least two ${phase} cases, found ${phaseCounts[phase]}`, 2);
    }
  }
  console.log(`ddd-expert evals valid: ${cases.length} cases (${Object.entries(phaseCounts).map(([phase, count]) => `${phase}=${count}`).join(", ")})`);
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
      schemaVersion: 3,
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
