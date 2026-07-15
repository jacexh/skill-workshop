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

function validateQuestionExpectation(value, label, options = {}) {
  const allowedKeys = ["min", "max", "contains", "contains_any", "excludes", "propositions"];
  if (!hasOnlyKeys(value, allowedKeys) || !Number.isInteger(value.min) ||
      !Number.isInteger(value.max) || value.min < 0 || value.max < value.min ||
      value.min > RESULT_QUESTION_MAX || value.max > RESULT_QUESTION_MAX) {
    fail(`${label} must define integer min/max within result-schema maxItems ${RESULT_QUESTION_MAX}`, 2);
  }
  if (options.requireQuestion && value.min < 1) {
    fail(`${label}.min must be at least 1 for a dialogue turn`, 2);
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
  const allowedKeys = [...requiredKeys, "dialogue"];
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
  if (!["event-storming", "codify", "guard"].includes(config.phase)) {
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

  let dialogue = null;
  let answerPath = null;
  if ("dialogue" in config) {
    if (config.phase !== "event-storming") {
      fail(`${config.id}: dialogue is supported only for EventStorming cases`, 2);
    }
    dialogue = config.dialogue;
    if (!hasOnlyKeys(dialogue, ["answer", "first_turn"]) ||
        typeof dialogue.answer !== "string" || dialogue.answer.length === 0 ||
        !isPlainObject(dialogue.first_turn)) {
      fail(`${config.id}.dialogue must define only answer and first_turn`, 2);
    }
    const answerInput = inspectCaseInputPath(
      caseDir,
      dialogue.answer,
      `${config.id}.dialogue.answer`,
      "file",
    );
    answerPath = answerInput.path;
    if (sameFilesystemObject(answerInput, promptInput) ||
        answerInput.realPath === promptInput.realPath ||
        pathIsInside(answerInput.realPath, workspaceInput.realPath)) {
      fail(`${config.id}: dialogue answer must have a distinct real path and inode outside the turn-1 prompt and workspace`, 2);
    }
    if (!hasOnlyKeys(dialogue.first_turn, ["completion", "questions", "git", "files", "checks"])) {
      fail(`${config.id}.dialogue.first_turn may define only completion, questions, git, files, and checks`, 2);
    }
    for (const key of ["completion", "questions", "git"]) {
      if (!(key in dialogue.first_turn)) {
        fail(`${config.id}.dialogue.first_turn is missing ${key}`, 2);
      }
    }
    stringArray(dialogue.first_turn.completion, `${config.id}.dialogue.first_turn.completion`, false);
    for (const completion of dialogue.first_turn.completion) {
      const error = completionError(completion);
      if (error) fail(`${config.id}: invalid first-turn completion`, 2);
    }
    if (dialogue.first_turn.completion.length !== 1 ||
        dialogue.first_turn.completion[0] !== "needs_clarification") {
      fail(`${config.id}: dialogue first turn completion must be exactly needs_clarification`, 2);
    }
    validateQuestionExpectation(
      dialogue.first_turn.questions,
      `${config.id}.dialogue.first_turn.questions`,
      { requireQuestion: true },
    );
    validateGitExpectation(dialogue.first_turn.git, `${config.id}.dialogue.first_turn.git`);
    validateFileExpectations(
      dialogue.first_turn.files || [],
      `${config.id}.dialogue.first_turn.files`,
      workspacePath,
    );
    validateCheckExpectations(
      dialogue.first_turn.checks || [],
      `${config.id}.dialogue.first_turn.checks`,
    );
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

  return { config, caseDir, promptPath, workspacePath, answerPath };
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
  if (!["event-storming", "codify", "guard"].includes(result.phase)) {
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

function buildContinuationPrompt(loadedCase, firstResult) {
  const answer = readBoundedTextFile(loadedCase.answerPath);
  if (!answer.ok) {
    fail(`${loadedCase.config.id}: cannot read dialogue answer: ${answer.error}`, 2);
  }
  return [
    buildPrompt(loadedCase),
    "",
    "Continuation:",
    "This is the second turn of the same EventStorming conversation.",
    "The current workspace is unchanged between turns except for any accepted slice you applied in turn 1.",
    "The domain participant's answer below is authoritative only for the active HotSpot raised in turn 1.",
    "Continue the scenario from that answer. Do not reopen already accepted facts or restart discovery.",
    "Apply the newly accepted business facts and continue until another material business HotSpot remains or the scoped scenario is ready.",
    "In changed_files, report every path changed since the original scenario baseline, including files changed in turn 1.",
    "",
    "Turn 1 structured response (conversation context, not new domain authority):",
    JSON.stringify(firstResult, null, 2),
    "",
    "Domain participant answer to the active HotSpot:",
    answer.content.trim(),
  ].join("\n");
}

function dialogueFirstTurnCase(loadedCase) {
  const firstTurn = loadedCase.config.dialogue.first_turn;
  return {
    ...loadedCase,
    config: {
      ...loadedCase.config,
      expect: {
        completion: firstTurn.completion,
        review_conclusion: ["not_applicable"],
        questions: firstTurn.questions,
        routes: { contains: [], excludes: ["event-storming", "codify", "guard"] },
        verdicts: [],
        forbid_verdicts: ["violation", "evidence_gap"],
        git: firstTurn.git,
        files: firstTurn.files || [],
        checks: firstTurn.checks || [],
      },
    },
  };
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
  const isDialogue = Boolean(loadedCase.config.dialogue);
  const firstOutput = isDialogue ? path.join(modelOutput, "turn-1") : modelOutput;
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
    modelOutput: firstOutput,
    prompt: buildPrompt(loadedCase),
    promptFile: path.join(trialRoot, isDialogue ? "turn-1-prompt.txt" : "prompt.txt"),
    traceFile: path.join(trialRoot, isDialogue ? "turn-1-trace.jsonl" : "trace.jsonl"),
    stderrFile: path.join(trialRoot, isDialogue ? "turn-1-stderr.log" : "stderr.log"),
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
  const firstCase = isDialogue ? dialogueFirstTurnCase(loadedCase) : loadedCase;
  const firstGrade = gradeTurn(
    firstCase,
    firstTurn,
    firstState,
    workspace,
    baseline,
    context,
    trialPluginCache,
  );

  let finalTurn = firstTurn;
  let finalState = firstState;
  let grade = firstGrade;
  let dialogue = null;
  if (isDialogue) {
    dialogue = {
      continuationMode: "explicit-prompt-same-workspace",
      firstTurn: {
        result: firstTurn.parsed,
        grade: firstGrade,
        execution: {
          exit: firstTurn.execution.status,
          signal: firstTurn.execution.signal,
          error: firstTurn.execution.error,
          pluginReadObserved: firstState.pluginReadObserved,
          pluginUnchanged: firstState.pluginUnchanged,
          gitMetadataUnchanged: firstState.gitMetadataMutation.length === 0,
          containerCleanup: firstTurn.execution.containerCleanup,
        },
      },
      secondTurn: null,
    };
    if (!firstState.infrastructureFailure && firstGrade.passed) {
      const secondTurn = await executeTrialTurn({
        loadedCase,
        context,
        trialCodexHome,
        trialPluginCache,
        authFile: nextAuthFile(),
        workspace,
        modelOutput: path.join(modelOutput, "turn-2"),
        prompt: buildContinuationPrompt(loadedCase, firstTurn.parsed),
        promptFile: path.join(trialRoot, "turn-2-prompt.txt"),
        traceFile: path.join(trialRoot, "turn-2-trace.jsonl"),
        stderrFile: path.join(trialRoot, "turn-2-stderr.log"),
      });
      throwIfRunnerTerminating();
      const secondState = inspectTurnState(
        secondTurn,
        workspace,
        baseline,
        trialCodexHome,
        trialPluginCache,
        context.pluginHash,
      );
      const secondGrade = gradeTurn(
        loadedCase,
        secondTurn,
        secondState,
        workspace,
        baseline,
        context,
        trialPluginCache,
      );
      finalTurn = secondTurn;
      finalState = secondState;
      grade = secondGrade;
      dialogue.secondTurn = {
        result: secondTurn.parsed,
        grade: secondGrade,
        execution: {
          exit: secondTurn.execution.status,
          signal: secondTurn.execution.signal,
          error: secondTurn.execution.error,
          pluginReadObserved: secondState.pluginReadObserved,
          pluginUnchanged: secondState.pluginUnchanged,
          gitMetadataUnchanged: secondState.gitMetadataMutation.length === 0,
          containerCleanup: secondTurn.execution.containerCleanup,
        },
      };
    }
  }

  const infrastructureFailure = finalState.infrastructureFailure;
  const pluginReadObserved = firstState.pluginReadObserved ||
    Boolean(dialogue?.secondTurn?.execution.pluginReadObserved);

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
    dialogue,
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
  const phaseCounts = Object.fromEntries(["event-storming", "codify", "guard"].map((phase) => [phase, 0]));
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
          routes: { contains: ["codify"], excludes: ["event-storming"] },
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

    const dialogueCaseDir = path.join(tempRoot, "event-storming-dialogue-self-test");
    const dialogueWorkspace = path.join(dialogueCaseDir, "workspace");
    fs.mkdirSync(dialogueWorkspace, { recursive: true });
    fs.writeFileSync(path.join(dialogueCaseDir, "prompt.md"), "Complete the expiry scenario.\n");
    fs.writeFileSync(
      path.join(dialogueCaseDir, "answer.md"),
      "The clock triggers expiry at the deadline, establishing Reservation Expired and ending confirmation rights.\n",
    );
    const dialogueConfig = {
      id: "event-storming-dialogue-self-test",
      phase: "event-storming",
      suites: ["full"],
      sandbox: "workspace-write",
      prompt: "prompt.md",
      workspace: "workspace",
      dialogue: {
        answer: "answer.md",
        first_turn: {
          completion: ["needs_clarification"],
          questions: {
            min: 1,
            max: 1,
            contains_any: [
              ["who", "clock"],
              ["what fact", "outcome"],
              ["confirmation right", "right ends"],
            ],
            propositions: [{
              name: "question seeks the expiry effect",
              accepts: ["whose confirmation right ends", "what happens to the confirmation right"],
              rejects: ["the confirmation right remains unchanged"],
            }],
          },
          git: {
            changed: "some",
            required_paths: ["accepted-slice.md"],
            forbidden_paths: ["completed-model.md"],
            allowed_paths: ["accepted-slice.md"],
          },
          files: [{
            path: "accepted-slice.md",
            exists: true,
            contains: ["accepted Aggregate boundary"],
            excludes: [],
          }],
          checks: [{
            argv: ["node", "--version"],
            exit: 0,
            timeout_seconds: 30,
          }],
        },
      },
      expect: {
        completion: ["completed"],
        review_conclusion: ["not_applicable"],
        questions: { min: 0, max: 0 },
        routes: { contains: [], excludes: ["event-storming", "codify", "guard"] },
        verdicts: [],
        forbid_verdicts: ["violation", "evidence_gap"],
        git: {
          changed: "some",
          required_paths: ["accepted-slice.md", "completed-model.md"],
          forbidden_paths: [],
          allowed_paths: ["accepted-slice.md", "completed-model.md"],
        },
        files: [{
          path: "completed-model.md",
          exists: true,
          contains: ["Reservation Expired"],
          excludes: [],
        }],
        checks: [],
      },
    };
    fs.writeFileSync(path.join(dialogueWorkspace, "leaked-answer.md"), "must stay hidden\n");
    expectFailure(
      () => validateCase(dialogueCaseDir, {
        ...dialogueConfig,
        dialogue: { ...dialogueConfig.dialogue, answer: "workspace/leaked-answer.md" },
      }),
      /distinct real path and inode outside the turn-1 prompt and workspace/u,
      "dialogue answer isolation check",
    );
    fs.rmSync(path.join(dialogueWorkspace, "leaked-answer.md"));
    const symlinkedPrompt = path.join(dialogueCaseDir, "prompt-answer-alias.md");
    fs.symlinkSync("answer.md", symlinkedPrompt);
    expectFailure(
      () => validateCase(dialogueCaseDir, { ...dialogueConfig, prompt: "prompt-answer-alias.md" }),
      /must not traverse or name a symlink/u,
      "dialogue prompt symlink isolation check",
    );
    fs.rmSync(symlinkedPrompt);
    fs.writeFileSync(path.join(dialogueWorkspace, "ancestor-answer.md"), "must stay hidden\n");
    const workspaceAlias = path.join(dialogueCaseDir, "workspace-alias");
    fs.symlinkSync("workspace", workspaceAlias);
    expectFailure(
      () => validateCase(dialogueCaseDir, {
        ...dialogueConfig,
        dialogue: { ...dialogueConfig.dialogue, answer: "workspace-alias/ancestor-answer.md" },
      }),
      /must not traverse or name a symlink/u,
      "dialogue answer symlink-ancestor isolation check",
    );
    fs.unlinkSync(workspaceAlias);
    fs.rmSync(path.join(dialogueWorkspace, "ancestor-answer.md"));
    expectFailure(
      () => validateCase(dialogueCaseDir, {
        ...dialogueConfig,
        prompt: "./answer.md",
      }),
      /distinct real path and inode outside the turn-1 prompt and workspace/u,
      "dialogue answer inode isolation check",
    );
    expectFailure(
      () => validateCase(dialogueCaseDir, {
        ...dialogueConfig,
        dialogue: {
          ...dialogueConfig.dialogue,
          first_turn: {
            ...dialogueConfig.dialogue.first_turn,
            completion: ["needs_clarification", "completed"],
          },
        },
      }),
      /completion must be exactly needs_clarification/u,
      "dialogue first-turn completion check",
    );
    expectFailure(
      () => validateQuestionExpectation(
        { min: RESULT_QUESTION_MAX + 1, max: RESULT_QUESTION_MAX + 1 },
        "self-test.questions",
      ),
      /result-schema maxItems/u,
      "question expectation schema-bound check",
    );
    const dialogueLoaded = validateCase(dialogueCaseDir, dialogueConfig);
    const dialogueBaseline = initializeGit(dialogueWorkspace);
    fs.writeFileSync(path.join(dialogueWorkspace, "accepted-slice.md"), "accepted Aggregate boundary\n");
    const dialogueFirstResult = {
      scenario_id: dialogueConfig.id,
      phase: "event-storming",
      completion: "needs_clarification",
      review_conclusion: "not_applicable",
      questions: ["Who triggers expiry, what fact does it establish, and whose confirmation right ends"],
      routes: [],
      verdicts: [],
      changed_files: ["accepted-slice.md"],
      verification: [],
    };
    const dialogueFirstScoreOptions = {
      baseline: dialogueBaseline,
      executeCheck: () => ({ status: 0, stdout: "v1", stderr: "" }),
    };
    const dialogueFirstGrade = scoreResult(
      dialogueFirstTurnCase(dialogueLoaded),
      dialogueFirstResult,
      dialogueWorkspace,
      dialogueFirstScoreOptions,
    );
    if (!dialogueFirstGrade.passed || dialogueFirstGrade.checks.length !== 1) {
      fail(`scorer rejected a purpose-oriented first dialogue turn: ${JSON.stringify(dialogueFirstGrade.assertions)}`, 2);
    }
    const wrongHotSpotGrade = scoreResult(
      dialogueFirstTurnCase(dialogueLoaded),
      { ...dialogueFirstResult, questions: ["Which database should store Reservation"] },
      dialogueWorkspace,
      dialogueFirstScoreOptions,
    );
    if (wrongHotSpotGrade.passed) {
      fail("dialogue scorer accepted a first-turn question that missed the declared business HotSpot", 2);
    }
    fs.writeFileSync(path.join(dialogueWorkspace, "accepted-slice.md"), "placeholder only\n");
    const wrongFirstSliceGrade = scoreResult(
      dialogueFirstTurnCase(dialogueLoaded),
      dialogueFirstResult,
      dialogueWorkspace,
      dialogueFirstScoreOptions,
    );
    if (wrongFirstSliceGrade.passed || !wrongFirstSliceGrade.assertions.some((item) =>
      item.name.includes("accepted-slice.md contains accepted Aggregate boundary") && !item.passed)) {
      fail("dialogue scorer accepted a first-turn artifact without its declared accepted slice", 2);
    }
    fs.writeFileSync(path.join(dialogueWorkspace, "accepted-slice.md"), "accepted Aggregate boundary\n");
    const failedFirstCheckGrade = scoreResult(
      dialogueFirstTurnCase(dialogueLoaded),
      dialogueFirstResult,
      dialogueWorkspace,
      {
        baseline: dialogueBaseline,
        executeCheck: () => ({ status: 1, stdout: "", stderr: "failed" }),
      },
    );
    if (failedFirstCheckGrade.passed || !failedFirstCheckGrade.assertions.some((item) =>
      item.name === "check node --version" && !item.passed)) {
      fail("dialogue scorer accepted a failing first-turn check", 2);
    }
    const entrySafeQuestionCase = dialogueFirstTurnCase(dialogueLoaded);
    entrySafeQuestionCase.config = {
      ...entrySafeQuestionCase.config,
      expect: {
        ...entrySafeQuestionCase.config.expect,
        questions: { min: 2, max: 2, contains: ["Payment Captured"] },
      },
    };
    const splitQuestionResult = {
      ...dialogueFirstResult,
      questions: ["Which fact is Payment", "Captured by the provider"],
    };
    const splitQuestionGrade = scoreResult(
      entrySafeQuestionCase,
      splitQuestionResult,
      dialogueWorkspace,
      dialogueFirstScoreOptions,
    );
    const splitContainsAssertion = splitQuestionGrade.assertions.find((item) =>
      item.name === "question set contains Payment Captured");
    if (splitQuestionGrade.passed || !splitContainsAssertion || splitContainsAssertion.passed) {
      fail("dialogue scorer matched a semantic phrase across question entries", 2);
    }
    entrySafeQuestionCase.config.expect.questions = {
      min: 2,
      max: 2,
      excludes: ["Payment Captured"],
    };
    const splitExclusionGrade = scoreResult(
      entrySafeQuestionCase,
      splitQuestionResult,
      dialogueWorkspace,
      dialogueFirstScoreOptions,
    );
    if (!splitExclusionGrade.passed) {
      fail(`dialogue scorer falsely excluded a phrase split across question entries: ${JSON.stringify(splitExclusionGrade.assertions)}`, 2);
    }
    const firstPrompt = buildPrompt(dialogueLoaded);
    const continuationPrompt = buildContinuationPrompt(dialogueLoaded, dialogueFirstResult);
    if (firstPrompt.includes("The clock triggers expiry") ||
        !continuationPrompt.includes("The clock triggers expiry") ||
        !continuationPrompt.includes("same EventStorming conversation") ||
        !continuationPrompt.includes(JSON.stringify(dialogueFirstResult, null, 2))) {
      fail("dialogue prompt did not withhold the answer from turn 1 or preserve explicit continuation context", 2);
    }
    const resultlessHome = path.join(tempRoot, "resultless-home");
    const resultlessPluginCache = path.join(resultlessHome, "plugins", "cache", "ddd-expert");
    fs.mkdirSync(resultlessPluginCache, { recursive: true });
    fs.writeFileSync(path.join(resultlessPluginCache, "marker"), "unchanged\n");
    const resultlessTurn = {
      execution: { status: 0, signal: null, error: null, stdout: "" },
      parsed: null,
      parseError: "cannot parse model result JSON",
    };
    const resultlessState = inspectTurnState(
      resultlessTurn,
      dialogueWorkspace,
      dialogueBaseline,
      resultlessHome,
      resultlessPluginCache,
      hashTree(resultlessPluginCache),
    );
    if (resultlessState.infrastructureFailure) {
      fail("an exit-zero missing or malformed result was classified as an infrastructure failure", 2);
    }
    const resultlessGrade = gradeTurn(
      dialogueFirstTurnCase(dialogueLoaded),
      resultlessTurn,
      resultlessState,
      dialogueWorkspace,
      dialogueBaseline,
      {},
      resultlessPluginCache,
    );
    if (resultlessGrade.passed || !resultlessGrade.assertions.some((item) =>
      item.name === "result schema" && !item.passed)) {
      fail("an exit-zero missing or malformed result was not scored as a behavior failure", 2);
    }
    const failedExecutionState = inspectTurnState(
      {
        ...resultlessTurn,
        execution: { ...resultlessTurn.execution, status: 1 },
      },
      dialogueWorkspace,
      dialogueBaseline,
      resultlessHome,
      resultlessPluginCache,
      hashTree(resultlessPluginCache),
    );
    if (!failedExecutionState.infrastructureFailure) {
      fail("a nonzero Codex execution was not classified as an infrastructure failure", 2);
    }
    fs.writeFileSync(path.join(dialogueWorkspace, "completed-model.md"), "Reservation Expired is terminal.\n");
    const dialogueFinalResult = {
      ...dialogueFirstResult,
      completion: "completed",
      questions: [],
      changed_files: ["accepted-slice.md", "completed-model.md"],
    };
    const dialogueFinalGrade = scoreResult(
      dialogueLoaded,
      dialogueFinalResult,
      dialogueWorkspace,
      { baseline: dialogueBaseline },
    );
    if (!dialogueFinalGrade.passed) {
      fail(`scorer rejected the cumulative two-turn artifact delta: ${JSON.stringify(dialogueFinalGrade.assertions)}`, 2);
    }
    const secondTurnOnlyGrade = scoreResult(
      dialogueLoaded,
      { ...dialogueFinalResult, changed_files: ["completed-model.md"] },
      dialogueWorkspace,
      { baseline: dialogueBaseline },
    );
    if (secondTurnOnlyGrade.passed) {
      fail("dialogue scorer accepted changed_files that omitted the turn-1 artifact", 2);
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
        phase: "event-storming",
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
      phase: "event-storming",
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
    const eventStormingCase = {
      ...loadedCase,
      config: {
        ...loadedCase.config,
        phase: "event-storming",
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
          routes: { contains: [], excludes: ["event-storming"] },
          verdicts: [],
          forbid_verdicts: ["violation", "evidence_gap"],
        },
      },
    };
    const goodEventStorming = {
      ...good,
      phase: "event-storming",
      review_conclusion: "not_applicable",
      questions: ["Which Ｐａｙｍｅｎｔ\nauthority distinguishes CAPTURED from authorized or settled states?"],
      routes: [],
      verdicts: [],
    };
    const requireEventStormingGrade = (caseToScore, resultToScore, expected, message) => {
      const grade = scoreResult(caseToScore, resultToScore, workspace, scoreOptions);
      if (grade.passed !== expected) {
        fail(`${message}: ${JSON.stringify(grade.assertions)}`, 2);
      }
    };
    requireEventStormingGrade(eventStormingCase, goodEventStorming, true, "scorer rejected a normalized semantic question set");
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
      ["scorer accepted a question set from the wrong bounded context", "How should the Order react after payment succeeds?"],
      ["scorer accepted a downstream-question set with upstream terms", "After Payment authority reports Captured, what makes Order ready for fulfillment?"],
      ["scorer ignored a required semantic term", "Which Payment decision distinguishes captured from settled states?"],
      ["scorer ignored an alternative group", "Which Payment authority defines an authorized state?"],
      ["scorer ignored a forbidden semantic term", "Which Payment authority distinguishes captured states for Order?"],
    ]) {
      requireEventStormingGrade(eventStormingCase, { ...goodEventStorming, questions: [question] }, false, message);
    }
    const relationshipQuestionCase = {
      ...eventStormingCase,
      config: {
        ...eventStormingCase.config,
        expect: {
          ...eventStormingCase.config.expect,
          questions: {
            min: 1,
            max: 1,
            contains_any: [["registration"], ["delivery"], ["authorit*", "own*", "sufficient", "publish*", "translate*"]],
            excludes: ["accept* attendance"],
          },
        },
      },
    };
    requireEventStormingGrade(
      relationshipQuestionCase,
      { ...goodEventStorming, questions: ["When does Delivery record attendance after Registration evidence arrives?"] },
      false,
      "scorer accepted a local lifecycle question that skipped relationship authority",
    );
    requireEventStormingGrade(
      relationshipQuestionCase,
      { ...goodEventStorming, questions: ["Should Delivery accept attendance for a Registration seat?"] },
      false,
      "scorer accepted a local attendance question as relationship discovery",
    );
    const boundaryQuestionCase = {
      ...eventStormingCase,
      config: {
        ...eventStormingCase.config,
        expect: {
          ...eventStormingCase.config.expect,
          questions: {
            min: 1,
            max: 1,
            contains_any: [["confirm*"], ["authorit*", "own*", "decid*"], ["different", "separate", "each"], ["workshop", "program"], ["seat", "registration"]],
            excludes: [],
          },
        },
      },
    };
    requireEventStormingGrade(
      boundaryQuestionCase,
      { ...goodEventStorming, questions: ["Should each confirmed seat use a different allocation decision?"] },
      false,
      "scorer accepted one local responsibility as topology discovery",
    );
    const lateSemanticMatchCase = {
      ...eventStormingCase,
      config: {
        ...eventStormingCase.config,
        expect: {
          ...eventStormingCase.config.expect,
          questions: { ...eventStormingCase.config.expect.questions, max: 2 },
        },
      },
    };
    const lateSemanticMatch = {
      ...goodEventStorming,
      questions: [
        "Which business outcome is still unclear?",
        "Which Payment authority distinguishes captured from settled states?",
      ],
    };
    requireEventStormingGrade(lateSemanticMatchCase, lateSemanticMatch, true, "scorer rejected a semantic HotSpot expressed across the question set");
    const baselineLifecycleConfig = readJson(path.join(
      CASES_ROOT,
      "event-storming-baseline-with-open-lifecycle",
      "case.json",
    ));
    const baselineFirstTurnCase = dialogueFirstTurnCase({
      ...loadedCase,
      config: baselineLifecycleConfig,
    });
    const baselineLifecycleCase = {
      ...baselineFirstTurnCase,
      config: {
        ...baselineFirstTurnCase.config,
        expect: {
          ...baselineFirstTurnCase.config.expect,
          git: { changed: "none", required_paths: [], forbidden_paths: [] },
          files: [],
          checks: [],
        },
      },
    };
    const baselineLifecycleResult = {
      ...goodEventStorming,
      scenario_id: baselineLifecycleConfig.id,
      completion: "needs_clarification",
      questions: [
        "Who decides the Purchase outcome when stock or fraud checks fail, including either a stock check or fraud check failure; what fact is established and whether fulfillment preparation stops; and what outcome is recorded and whether retry requires new evidence?",
      ],
    };
    const baselineLifecycleGrade = scoreResult(
      baselineLifecycleCase,
      baselineLifecycleResult,
      workspace,
      scoreOptions,
    );
    if (!baselineLifecycleGrade.passed) {
      fail(`scorer rejected a purpose-oriented Purchase failure HotSpot question: ${JSON.stringify(baselineLifecycleGrade.assertions)}`, 2);
    }
    const fundsOnlyLifecycleResult = {
      ...baselineLifecycleResult,
      questions: ["When may treasury confirm, reverse, or expire Funds Settled?"],
    };
    if (scoreResult(baselineLifecycleCase, fundsOnlyLifecycleResult, workspace, scoreOptions).passed) {
      fail("scorer accepted an incomplete Funds-only lifecycle question", 2);
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
      "event-storming-existing-system-baseline",
      "case.json",
    ));
    const existingBaselineFirstCase = dialogueFirstTurnCase({
      ...loadedCase,
      config: existingBaselineConfig,
    });
    const existingBaselineResult = {
      ...goodEventStorming,
      scenario_id: existingBaselineConfig.id,
      completion: "needs_clarification",
      questions: [
        "Candidate current-state: Agent Execution is authoritative for the terminal Agent Run outcome and fans it out to both Work and Project Knowledge as two consumers. Is this current baseline correct?",
      ],
      changed_files: [],
    };
    if (!scoreResult(
      existingBaselineFirstCase,
      existingBaselineResult,
      workspace,
      scoreOptions,
    ).passed) {
      fail("scorer rejected a purpose-oriented existing-system candidate baseline", 2);
    }
    const projectedRecoveryChangeGrade = scoreResult(
      existingBaselineFirstCase,
      {
        ...existingBaselineResult,
        questions: [
          `${existingBaselineResult.questions[0]} Which recovery event should Agent Execution publish?`,
        ],
      },
      workspace,
      scoreOptions,
    );
    if (projectedRecoveryChangeGrade.passed || !projectedRecoveryChangeGrade.assertions.some((item) =>
      item.name.startsWith("question set excludes") && !item.passed)) {
      fail("scorer accepted an unconfirmed recovery projection inside baseline discovery", 2);
    }
    if (scoreResult(
      existingBaselineFirstCase,
      { ...existingBaselineResult, questions: ["Is the current Work boundary accepted?"] },
      workspace,
      scoreOptions,
    ).passed) {
      fail("scorer accepted a trivial existing-system boundary question", 2);
    }

    const restrainedEventStormingConfig = readJson(path.join(
      CASES_ROOT,
      "event-storming-document-confirmed-model",
      "case.json",
    ));
    const restrainedEventStormingCase = { ...loadedCase, config: restrainedEventStormingConfig };
    const restrainedEventStormingWorkspace = path.join(tempRoot, "restrained-event-storming-workspace");
    fs.cpSync(
      path.join(CASES_ROOT, "event-storming-document-confirmed-model", "workspace"),
      restrainedEventStormingWorkspace,
      { recursive: true },
    );
    const restrainedEventStormingBaseline = initializeGit(restrainedEventStormingWorkspace);
    const restrainedReadme = "docs/ddd-expert/README.md";
    const restrainedMap = "docs/ddd-expert/context-map.md";
    const restrainedModel = "docs/ddd-expert/context/inventory/model.md";
    fs.mkdirSync(path.dirname(path.join(restrainedEventStormingWorkspace, restrainedModel)), { recursive: true });
    fs.writeFileSync(path.join(restrainedEventStormingWorkspace, restrainedReadme), `# DDD Expert Artifacts

## Bounded Contexts

- [Inventory](context/inventory/model.md)

\`design.md\` lives beside each context's \`model.md\`. It may be absent before EventStorming applies the first accepted tactical slice, then remains \`evolving\` until its revision-matched Design becomes \`codify_ready\`. Context dependencies and named contracts are authoritative in [context-map.md](context-map.md).
`);
    fs.writeFileSync(path.join(restrainedEventStormingWorkspace, restrainedMap), `# Context Map

## Global View

Arrow direction: \`U -> D\` (Upstream model/published-contract influence -> Downstream model). It does not describe runtime call flow.

\`\`\`mermaid
graph LR
    inventory["Inventory"]
\`\`\`

## Bounded Contexts

### Inventory

- **Core responsibility:** Own sellable and reserved stock decisions.
- **Business authority:** Inventory is authoritative for quantities and reservation outcomes.

#### Local View

\`\`\`text
+-----------+
| Inventory |
+-----------+
\`\`\`
`);
    const acceptedRestrainedModel = `---
context: Inventory
model_revision: 2
model_status: shape_ready
---

# Inventory Domain Model

## Ubiquitous Language

An Inventory Reservation has identity across retry and release. A successful
reservation establishes Stock Reserved.

## Authority and Ownership

Inventory is the sole authority for sellable and reserved quantities.

## Scenarios and Lifecycle

An Inventory Reservation expires after 15 minutes unless the order confirms it.

## Invariants and Policies

Available quantity never becomes negative.

## Failure and Recovery Semantics

A duplicate command with the same reservation identity returns the original
result. Temporary caller inconsistency is repaired by retry.
`;
    fs.writeFileSync(
      path.join(restrainedEventStormingWorkspace, restrainedModel),
      acceptedRestrainedModel,
    );
    const restrainedChangedFiles = [restrainedReadme, restrainedMap, restrainedModel];
    const restrainedEventStormingResult = {
      ...goodEventStorming,
      scenario_id: restrainedEventStormingConfig.id,
      completion: "completed",
      questions: [],
      routes: [],
      changed_files: restrainedChangedFiles,
    };
    const executeRestrainedCheck = (check) => {
      const argv = [...check.argv];
      if (argv[0] === "node" && argv[1] === "/eval/validate-context-map.mjs") {
        argv[1] = path.join(PLUGIN_ROOT, "scripts", "validate-context-map.mjs");
      }
      return runCommand(argv, {
        cwd: restrainedEventStormingWorkspace,
        timeoutSeconds: check.timeout_seconds,
      });
    };
    const restrainedEventStormingOptions = {
      baseline: restrainedEventStormingBaseline,
      executeCheck: executeRestrainedCheck,
    };
    const restrainedEventStormingGrade = scoreResult(
      restrainedEventStormingCase,
      restrainedEventStormingResult,
      restrainedEventStormingWorkspace,
      restrainedEventStormingOptions,
    );
    if (!restrainedEventStormingGrade.passed) {
      fail(`scorer rejected a restrained Inventory Model: ${JSON.stringify(restrainedEventStormingGrade.assertions)}`, 2);
    }
    fs.writeFileSync(
      path.join(restrainedEventStormingWorkspace, restrainedModel),
      `${acceptedRestrainedModel}\n## Priority Badge\n\nPriority Badge is an independent Domain concept.\n`,
    );
    const promotedWeakNounGrade = scoreResult(
      restrainedEventStormingCase,
      restrainedEventStormingResult,
      restrainedEventStormingWorkspace,
      restrainedEventStormingOptions,
    );
    if (promotedWeakNounGrade.passed || !promotedWeakNounGrade.assertions.some((item) =>
      item.name === `file ${restrainedModel} semantically excludes Priority Badge` && !item.passed)) {
      fail("scorer accepted promotion of a semantically weak source noun", 2);
    }

    const evolvingCodifyConfig = readJson(path.join(
      CASES_ROOT,
      "codify-rejects-evolving-design",
      "case.json",
    ));
    const evolvingCodifyCase = { ...loadedCase, config: evolvingCodifyConfig };
    const evolvingCodifyWorkspace = path.join(tempRoot, "evolving-codify-workspace");
    fs.cpSync(
      path.join(CASES_ROOT, "codify-rejects-evolving-design", "workspace"),
      evolvingCodifyWorkspace,
      { recursive: true },
    );
    const evolvingCodifyBaseline = initializeGit(evolvingCodifyWorkspace);
    const evolvingCodifyResult = {
      ...goodEventStorming,
      scenario_id: evolvingCodifyConfig.id,
      phase: "codify",
      completion: "stopped",
      review_conclusion: "not_applicable",
      questions: [],
      routes: [{ target: "event-storming", reason: "the evolving Design is not ready implementation authority" }],
      verdicts: [],
      changed_files: [],
    };
    const evolvingCodifyOptions = { baseline: evolvingCodifyBaseline };
    const evolvingCodifyGrade = scoreResult(
      evolvingCodifyCase,
      evolvingCodifyResult,
      evolvingCodifyWorkspace,
      evolvingCodifyOptions,
    );
    if (!evolvingCodifyGrade.passed) {
      fail(`scorer rejected the Codify evolving-Design gate: ${JSON.stringify(evolvingCodifyGrade.assertions)}`, 2);
    }
    const skippedCodifyGateGrade = scoreResult(
      evolvingCodifyCase,
      { ...evolvingCodifyResult, completion: "completed", routes: [] },
      evolvingCodifyWorkspace,
      evolvingCodifyOptions,
    );
    if (skippedCodifyGateGrade.passed || !skippedCodifyGateGrade.assertions.some((item) =>
      item.name === "route contains event-storming" && !item.passed)) {
      fail("scorer accepted Codify completion without routing an evolving Design to EventStorming", 2);
    }

    const statuslessGuardConfig = readJson(path.join(
      CASES_ROOT,
      "guard-statusless-design-readiness",
      "case.json",
    ));
    const statuslessGuardCase = { ...loadedCase, config: statuslessGuardConfig };
    const statuslessGuardWorkspace = path.join(tempRoot, "statusless-guard-workspace");
    fs.cpSync(
      path.join(CASES_ROOT, "guard-statusless-design-readiness", "workspace"),
      statuslessGuardWorkspace,
      { recursive: true },
    );
    const statuslessGuardBaseline = initializeGit(statuslessGuardWorkspace);
    const statuslessDesign = "docs/ddd-expert/context/order/design.md";
    const statuslessGuardResult = {
      ...good,
      scenario_id: statuslessGuardConfig.id,
      completion: "completed",
      review_conclusion: "evidence_gaps",
      questions: [],
      routes: [{ target: "event-storming", reason: "replay and explicitly promote Design readiness" }],
      verdicts: [{
        kind: "evidence_gap",
        family: "model_evidence",
        summary: "The statusless legacy Design contains accepted content but has no codify-ready proof.",
        evidence: [{ path: statuslessDesign, line: 1, detail: "frontmatter has no design_status" }],
      }],
      changed_files: [],
    };
    const executeStatuslessGuardCheck = (check) => runCommand(check.argv, {
      cwd: statuslessGuardWorkspace,
      timeoutSeconds: check.timeout_seconds,
    });
    const statuslessGuardOptions = {
      baseline: statuslessGuardBaseline,
      executeCheck: executeStatuslessGuardCheck,
    };
    const statuslessGuardGrade = scoreResult(
      statuslessGuardCase,
      statuslessGuardResult,
      statuslessGuardWorkspace,
      statuslessGuardOptions,
    );
    if (!statuslessGuardGrade.passed) {
      fail(`scorer rejected the Guard statusless-readiness evidence gap: ${JSON.stringify(statuslessGuardGrade.assertions)}`, 2);
    }
    const falseReadyGuardGrade = scoreResult(
      statuslessGuardCase,
      {
        ...statuslessGuardResult,
        review_conclusion: "clear",
        routes: [],
        verdicts: [],
      },
      statuslessGuardWorkspace,
      statuslessGuardOptions,
    );
    if (falseReadyGuardGrade.passed || !falseReadyGuardGrade.assertions.some((item) =>
      item.name === "verdict evidence_gap/model_evidence" && !item.passed)) {
      fail("scorer accepted a statusless Design as ready Guard authority", 2);
    }
    const stoppedAtStatuslessGapGrade = scoreResult(
      statuslessGuardCase,
      { ...statuslessGuardResult, completion: "stopped" },
      statuslessGuardWorkspace,
      statuslessGuardOptions,
    );
    if (stoppedAtStatuslessGapGrade.passed || !stoppedAtStatuslessGapGrade.assertions.some((item) =>
      item.name === "completion" && !item.passed)) {
      fail("scorer accepted Guard stopping instead of completing independent conformance review", 2);
    }

    const bootstrapTacticalConfig = readJson(path.join(
      CASES_ROOT,
      "event-storming-bootstraps-accepted-story",
      "case.json",
    ));
    const bootstrapTacticalCase = { ...loadedCase, config: bootstrapTacticalConfig };
    const bootstrapTacticalWorkspace = path.join(tempRoot, "bootstrap-event-storming-workspace");
    fs.cpSync(
      path.join(CASES_ROOT, "event-storming-bootstraps-accepted-story", "workspace"),
      bootstrapTacticalWorkspace,
      { recursive: true },
    );
    const bootstrapTacticalBaseline = initializeGit(bootstrapTacticalWorkspace);
    const bootstrapReadme = "docs/ddd-expert/README.md";
    const bootstrapMap = "docs/ddd-expert/context-map.md";
    const bootstrapModel = "docs/ddd-expert/context/pass/model.md";
    const bootstrapDesign = "docs/ddd-expert/context/pass/design.md";
    fs.mkdirSync(path.dirname(path.join(bootstrapTacticalWorkspace, bootstrapModel)), { recursive: true });
    fs.writeFileSync(path.join(bootstrapTacticalWorkspace, bootstrapReadme), `# DDD Expert Artifacts

## Bounded Contexts

- [Pass](context/pass/model.md)

\`design.md\` lives beside each context's \`model.md\`. It may be absent before EventStorming applies the first accepted tactical slice, then remains \`evolving\` until its revision-matched Design becomes \`codify_ready\`. Context dependencies and named contracts are authoritative in [context-map.md](context-map.md).
`);
    fs.writeFileSync(path.join(bootstrapTacticalWorkspace, bootstrapMap), `# Context Map

## Global View

Arrow direction: \`U -> D\` (Upstream model/published-contract influence -> Downstream model). It does not describe runtime call flow.

\`\`\`mermaid
graph LR
    pass["Pass"]
\`\`\`

## Bounded Contexts

### Pass

- **Core responsibility:** Own activation, expiry, and remaining-use decisions.
- **Business authority:** Pass is authoritative for use acceptance and outcomes.

#### Local View

\`\`\`text
+------+
| Pass |
+------+
\`\`\`
`);
    const acceptedBootstrapModel = `---
context: "Pass"
model_revision: 1
model_status: shape_ready
---

# Pass Domain Model

## Ubiquitous Language

Record Pass Use is the command an Access Gate issues when a Pass Holder
presents a Pass for an access attempt. Use Recorded is the accepted outcome of
consuming one remaining use and grants the Pass Holder access. Pass Use
Rejected is the outcome when access is denied. A trusted Clock issues Expire
Pass at the expiry deadline, establishing Pass Expired.

## Authority and Ownership

Pass owns its activation, expiry, remaining uses, and use outcomes.

## Scenarios and Lifecycle

An Active Pass with at least one remaining use accepts a previously unseen Use
Key, reduces its remaining uses by exactly one, and establishes Use Recorded.
An Expired Pass or a Pass with no remaining uses establishes Pass Use Rejected
for a new Use Key without changing the count. The Access Gate grants the Pass
Holder access for Use Recorded and denies access for Pass Use Rejected. When
the trusted Clock reaches the expiry deadline, Expire Pass establishes Pass
Expired and prevents later new Use Keys.

## Invariants and Policies

Remaining uses never become negative.

## Failure and Recovery Semantics

When a Use Key is repeated, Pass returns the same original outcome and does not
consume another use.
`;
    fs.writeFileSync(
      path.join(bootstrapTacticalWorkspace, bootstrapModel),
      acceptedBootstrapModel,
    );
    const acceptedBootstrapDesign = `---
context: "Pass"
based_on_model_revision: 1
design_status: codify_ready
---

# Pass Tactical Design

## Model Realization

Pass is the Aggregate Root and sole authority for activation, expiry,
remaining uses, Use-Key admission, and established outcomes.

## Aggregate Designs

### Pass

#### Boundary Thesis

A single Pass Aggregate owns the decisions that must change together. The Pass
owns its remaining-use count and recorded Use Keys.

#### Invariants

An Active Pass accepts a new Use Key only when its remaining-use count is
positive. Remaining uses never become negative.

#### Behaviors and Lifecycle

The Access Gate issues Record Pass Use when a Pass Holder presents a Pass. For
a previously unseen Use Key, an Active Pass with at least one remaining use
decrements the remaining-use count by one and establishes Use Recorded, which
grants the Pass Holder access. A duplicate Use Key returns the same established
outcome without consuming another use, so the remaining-use count does not
change. An Expired Pass or a Pass with zero remaining uses establishes Pass Use
Rejected and access is denied. A trusted Clock issues Expire Pass at the expiry
deadline, establishing Pass Expired and preventing later new Use Keys.

#### Domain Events

Use Recorded, Pass Use Rejected, and Pass Expired are Domain Events established
by the Pass Aggregate.

#### Consistency, Concurrency, and Failure

The admission, decrement, and Use-Key record are one atomic Aggregate change.
The isolated context has no context dependencies, no Integration Message, no
cross-context contract, and no Process Manager.
`;
    fs.writeFileSync(
      path.join(bootstrapTacticalWorkspace, bootstrapDesign),
      acceptedBootstrapDesign,
    );
    const bootstrapChangedFiles = [bootstrapReadme, bootstrapMap, bootstrapModel, bootstrapDesign];
    const bootstrapTacticalResult = {
      ...goodEventStorming,
      scenario_id: bootstrapTacticalConfig.id,
      phase: "event-storming",
      completion: "completed",
      questions: [],
      routes: [],
      changed_files: bootstrapChangedFiles,
    };
    const executeBootstrapCheck = (check, workspacePath = bootstrapTacticalWorkspace) => {
      const argv = [...check.argv];
      if (argv[0] === "node" && argv[1] === "/eval/validate-context-map.mjs") {
        argv[1] = path.join(PLUGIN_ROOT, "scripts", "validate-context-map.mjs");
      }
      return runCommand(argv, {
        cwd: workspacePath,
        timeoutSeconds: check.timeout_seconds,
      });
    };
    const bootstrapTacticalOptions = {
      baseline: bootstrapTacticalBaseline,
      executeCheck: executeBootstrapCheck,
    };
    const bootstrapTacticalGrade = scoreResult(
      bootstrapTacticalCase,
      bootstrapTacticalResult,
      bootstrapTacticalWorkspace,
      bootstrapTacticalOptions,
    );
    if (!bootstrapTacticalGrade.passed) {
      fail(`scorer rejected same-run EventStorming bootstrap and Tactical continuation: ${JSON.stringify(bootstrapTacticalGrade.assertions)}`, 2);
    }
    fs.writeFileSync(
      path.join(bootstrapTacticalWorkspace, bootstrapModel),
      acceptedBootstrapModel.replace('context: "Pass"\n', ""),
    );
    const missingBootstrapContextGrade = scoreResult(
      bootstrapTacticalCase,
      bootstrapTacticalResult,
      bootstrapTacticalWorkspace,
      bootstrapTacticalOptions,
    );
    if (missingBootstrapContextGrade.passed || !missingBootstrapContextGrade.assertions.some((item) =>
      item.name.startsWith(`file ${bootstrapModel} contains any of context: Pass`) && !item.passed)) {
      fail("scorer accepted a bootstrapped Model without context frontmatter", 2);
    }
    fs.writeFileSync(
      path.join(bootstrapTacticalWorkspace, bootstrapModel),
      acceptedBootstrapModel.replace("Use Key is repeated", "Use Key is presented"),
    );
    const missingRepetitionSemanticsGrade = scoreResult(
      bootstrapTacticalCase,
      bootstrapTacticalResult,
      bootstrapTacticalWorkspace,
      bootstrapTacticalOptions,
    );
    if (missingRepetitionSemanticsGrade.passed || !missingRepetitionSemanticsGrade.assertions.some((item) =>
      item.name.startsWith(`file ${bootstrapModel} contains any of same Use Key`) && !item.passed)) {
      fail("scorer accepted a Pass Model without repeated-Use-Key semantics", 2);
    }
    fs.writeFileSync(
      path.join(bootstrapTacticalWorkspace, bootstrapModel),
      acceptedBootstrapModel,
    );
    const exposedBootstrapRouteGrade = scoreResult(
      bootstrapTacticalCase,
      {
        ...bootstrapTacticalResult,
        routes: [{ target: "event-storming", reason: "bootstrap the semantic artifacts" }],
      },
      bootstrapTacticalWorkspace,
      bootstrapTacticalOptions,
    );
    if (exposedBootstrapRouteGrade.passed || !exposedBootstrapRouteGrade.assertions.some((item) =>
      item.name === "route excludes event-storming" && !item.passed)) {
      fail("scorer accepted a user-visible EventStorming self-handoff during bootstrap", 2);
    }
    const semanticResetBootstrapGrade = scoreResult(
      bootstrapTacticalCase,
      {
        ...bootstrapTacticalResult,
        questions: [
          "Who owns remaining uses and what happens for a repeated Use Key?",
        ],
      },
      bootstrapTacticalWorkspace,
      bootstrapTacticalOptions,
    );
    if (semanticResetBootstrapGrade.passed || !semanticResetBootstrapGrade.assertions.some((item) =>
      item.name === "question count" && !item.passed)) {
      fail("scorer accepted reopening accepted story facts instead of continuing into Tactical Design", 2);
    }
    const unappliedBootstrapWorkspace = path.join(tempRoot, "unapplied-bootstrap-event-storming-workspace");
    fs.cpSync(
      path.join(CASES_ROOT, "event-storming-bootstraps-accepted-story", "workspace"),
      unappliedBootstrapWorkspace,
      { recursive: true },
    );
    const unappliedBootstrapBaseline = initializeGit(unappliedBootstrapWorkspace);
    const unappliedBootstrapGrade = scoreResult(
      bootstrapTacticalCase,
      { ...bootstrapTacticalResult, changed_files: [] },
      unappliedBootstrapWorkspace,
      {
        baseline: unappliedBootstrapBaseline,
        executeCheck: (check) => executeBootstrapCheck(check, unappliedBootstrapWorkspace),
      },
    );
    if (unappliedBootstrapGrade.passed || !unappliedBootstrapGrade.assertions.some((item) =>
      item.name === "git change expectation" && !item.passed)) {
      fail("scorer accepted Tactical continuation without applying the accepted semantic bootstrap", 2);
    }

    const integratedEventStormingConfig = readJson(path.join(
      CASES_ROOT,
      "event-storming-applies-coupled-model-closure",
      "case.json",
    ));
    const integratedEventStormingCase = { ...loadedCase, config: integratedEventStormingConfig };
    const integratedEventStormingWorkspace = path.join(tempRoot, "integrated-event-storming-workspace");
    fs.cpSync(
      path.join(CASES_ROOT, "event-storming-applies-coupled-model-closure", "workspace"),
      integratedEventStormingWorkspace,
      { recursive: true },
    );
    const integratedEventStormingBaseline = initializeGit(integratedEventStormingWorkspace);
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

\`\`\`text
+---------+   +-------+
| Payment |-->| Order |
+---------+   +-------+
\`\`\`

#### Downstream Contracts

##### Payment Captured

- **Downstream:** Order
- **Published meaning:** A Payment Capture reached its terminal Captured outcome.
- **Guarantee:** Payment is authoritative and gives Order no authority to redefine that outcome.

### Order

- **Core responsibility:** Own customer orders and fulfillment readiness.
- **Business authority:** Order owns its local reaction and readiness decision.

#### Local View

\`\`\`text
+---------+   +-------+
| Payment |-->| Order |
+---------+   +-------+
\`\`\`

#### Upstream Dependencies

##### Payment Captured

- **Upstream:** Payment
- **Accepted meaning:** Payment authoritatively established its terminal Captured outcome.
- **Local translation:** Order records Captured Payment Evidence; it does not itself mean fulfillment readiness.
`;
const acceptedPaymentModel = `---
context: Payment
model_revision: 2
model_status: shape_ready
---

# Payment Domain Model

Payment is the sole authority for the Payment Capture lifecycle and its terminal Captured outcome. Payment establishes and publishes Payment Captured, while publication gives Order no authority to redefine its meaning.
`;
const acceptedOrderModel = `---
context: Order
model_revision: 2
model_status: shape_ready
---

# Order Domain Model

Order owns fulfillment readiness and translates Payment Captured into Captured Payment Evidence. That evidence does not by itself mean readiness: only an active Order may become Ready for Fulfillment. Duplicate delivery is idempotent, and a cancelled Order remains cancelled and cannot become Ready for Fulfillment.
`;
    fs.writeFileSync(path.join(integratedEventStormingWorkspace, integratedMapRelative), acceptedIntegratedMap);
    fs.writeFileSync(path.join(integratedEventStormingWorkspace, integratedPaymentRelative), acceptedPaymentModel);
    fs.writeFileSync(path.join(integratedEventStormingWorkspace, integratedOrderRelative), acceptedOrderModel);
    const integratedChangedFiles = [
      integratedMapRelative,
      integratedOrderRelative,
      integratedPaymentRelative,
    ];
    const integratedEventStormingResult = {
      ...goodEventStorming,
      scenario_id: integratedEventStormingConfig.id,
      completion: "completed",
      questions: [],
      routes: [],
      changed_files: integratedChangedFiles,
    };
    const executeIntegratedCheck = (check) => {
      const argv = [...check.argv];
      if (argv[0] === "node" && argv[1] === "/eval/validate-context-map.mjs") {
        argv[1] = path.join(PLUGIN_ROOT, "scripts", "validate-context-map.mjs");
      }
      return runCommand(argv, {
        cwd: integratedEventStormingWorkspace,
        timeoutSeconds: check.timeout_seconds,
      });
    };
    const integratedEventStormingOptions = {
      baseline: integratedEventStormingBaseline,
      executeCheck: executeIntegratedCheck,
    };
    const acceptedIntegratedGrade = scoreResult(
      integratedEventStormingCase,
      integratedEventStormingResult,
      integratedEventStormingWorkspace,
      integratedEventStormingOptions,
    );
    if (!acceptedIntegratedGrade.passed) {
      fail(`scorer rejected accepted integrated Model facts: ${JSON.stringify(acceptedIntegratedGrade.assertions)}`, 2);
    }
    fs.appendFileSync(
      path.join(integratedEventStormingWorkspace, integratedPaymentRelative),
      "\npayment has no\nauthority over captured outcomes.\n",
    );
    const lowercaseContradictionGrade = scoreResult(
      integratedEventStormingCase,
      integratedEventStormingResult,
      integratedEventStormingWorkspace,
      integratedEventStormingOptions,
    );
    const lowercaseContradictionAssertion = lowercaseContradictionGrade.assertions.find((item) =>
      item.name === `file ${integratedPaymentRelative} semantically excludes Payment has no authority`);
    if (lowercaseContradictionGrade.passed ||
        !lowercaseContradictionAssertion || lowercaseContradictionAssertion.passed) {
      fail("scorer accepted a lowercase line-wrapped contradiction", 2);
    }
    fs.writeFileSync(
      path.join(integratedEventStormingWorkspace, integratedPaymentRelative),
      acceptedPaymentModel,
    );
    const sourceCoverageRelative = "docs/ddd-expert/source-coverage.md";
    fs.writeFileSync(
      path.join(integratedEventStormingWorkspace, sourceCoverageRelative),
      "temporary source coverage must not be persisted\n",
    );
    const extraTraceGrade = scoreResult(
      integratedEventStormingCase,
      {
        ...integratedEventStormingResult,
        changed_files: [...integratedChangedFiles, sourceCoverageRelative].sort(),
      },
      integratedEventStormingWorkspace,
      integratedEventStormingOptions,
    );
    const exactSetAssertion = extraTraceGrade.assertions.find((item) =>
      item.name === "git changed only allowed paths");
    if (extraTraceGrade.passed || !exactSetAssertion || exactSetAssertion.passed) {
      fail("integrated EventStorming scorer accepted a persisted source-coverage trace", 2);
    }
    fs.rmSync(path.join(integratedEventStormingWorkspace, sourceCoverageRelative));
    fs.appendFileSync(
      path.join(integratedEventStormingWorkspace, integratedPaymentRelative),
      "\n## Source Coverage\n\n- Story S-1 covered.\n",
    );
    const embeddedTraceGrade = scoreResult(
      integratedEventStormingCase,
      integratedEventStormingResult,
      integratedEventStormingWorkspace,
      integratedEventStormingOptions,
    );
    const embeddedTraceAssertion = embeddedTraceGrade.assertions.find((item) =>
      item.name === `file ${integratedPaymentRelative} excludes ## Source Coverage`);
    if (embeddedTraceGrade.passed || !embeddedTraceAssertion || embeddedTraceAssertion.passed) {
      fail("integrated EventStorming scorer accepted source coverage embedded in an allowed Model", 2);
    }
    fs.writeFileSync(
      path.join(integratedEventStormingWorkspace, integratedPaymentRelative),
      acceptedPaymentModel,
    );
    fs.appendFileSync(
      path.join(integratedEventStormingWorkspace, integratedMapRelative),
      "\n## Story Coverage\n\n- Story S-1 covered.\n",
    );
    const embeddedMapTraceGrade = scoreResult(
      integratedEventStormingCase,
      integratedEventStormingResult,
      integratedEventStormingWorkspace,
      integratedEventStormingOptions,
    );
    const embeddedMapTraceAssertion = embeddedMapTraceGrade.assertions.find((item) =>
      item.name === `file ${integratedMapRelative} excludes ## Story Coverage`);
    if (embeddedMapTraceGrade.passed || !embeddedMapTraceAssertion || embeddedMapTraceAssertion.passed) {
      fail("integrated EventStorming scorer accepted story coverage embedded in the Context Map", 2);
    }
    fs.writeFileSync(
      path.join(integratedEventStormingWorkspace, integratedMapRelative),
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
      fs.writeFileSync(path.join(integratedEventStormingWorkspace, relative), `${accepted}${trace}`);
      const alternateTraceGrade = scoreResult(
        integratedEventStormingCase,
        integratedEventStormingResult,
        integratedEventStormingWorkspace,
        integratedEventStormingOptions,
      );
      const temporaryTraceAssertion = alternateTraceGrade.assertions.find((item) =>
        item.name === `file ${relative} persists no temporary discovery trace`);
      if (alternateTraceGrade.passed || !temporaryTraceAssertion || temporaryTraceAssertion.passed) {
        fail(`integrated EventStorming scorer accepted an alternate temporary trace in ${relative}: ${trace.trim()}`, 2);
      }
      fs.writeFileSync(path.join(integratedEventStormingWorkspace, relative), accepted);
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
    fs.writeFileSync(path.join(integratedEventStormingWorkspace, integratedMapRelative), contradictoryIntegratedMap);
    fs.writeFileSync(
      path.join(integratedEventStormingWorkspace, integratedPaymentRelative),
      `---
context: Payment
model_revision: 2
---
# Payment Domain Model
Order, not Payment, owns every Captured payment fact. Payment has no authority, and Order may redefine Payment Captured.
`,
    );
    fs.writeFileSync(
      path.join(integratedEventStormingWorkspace, integratedOrderRelative),
      `---
context: Order
model_revision: 2
---
# Order Domain Model
Payment Captured Evidence always makes a cancelled Order ready. Payment decides fulfillment readiness.
`,
    );
    const contradictoryIntegratedGrade = scoreResult(
      integratedEventStormingCase,
      integratedEventStormingResult,
      integratedEventStormingWorkspace,
      integratedEventStormingOptions,
    );
    if (contradictoryIntegratedGrade.passed ||
        contradictoryIntegratedGrade.checks.some((check) => check.status !== 0) ||
        !contradictoryIntegratedGrade.assertions.some((item) =>
          !item.passed && item.name.startsWith("file docs/ddd-expert/"))) {
      fail("scorer did not reject contradictory integrated Model facts at the file-assertion seam", 2);
    }
    const acceptedSliceConfig = readJson(path.join(
      CASES_ROOT,
      "event-storming-applies-accepted-model-slice",
      "case.json",
    ));
    const acceptedSliceCase = { ...loadedCase, config: acceptedSliceConfig };
    const acceptedSliceWorkspace = path.join(tempRoot, "accepted-model-slice-workspace");
    fs.cpSync(
      path.join(CASES_ROOT, "event-storming-applies-accepted-model-slice", "workspace"),
      acceptedSliceWorkspace,
      { recursive: true },
    );
    const acceptedSliceBaseline = initializeGit(acceptedSliceWorkspace);
    const acceptedSlicePayment = "docs/ddd-expert/context/payment/model.md";
    const acceptedSliceOrder = "docs/ddd-expert/context/order/model.md";
    const acceptedPaymentSliceModel = `---
context: Payment
model_revision: 2
model_status: shape_ready
---

# Payment Domain Model

## Authority and Ownership

Payment is the sole authority for the Payment Capture lifecycle and outcomes.

## Scenarios and Lifecycle

A valid authorization lets one Payment Capture identity establish exactly one
terminal outcome: Payment Captured, Payment Capture Rejected, or Payment Capture Expired.
Repeating a request for the same capture identity returns its
established terminal outcome. A later refund, chargeback, or reversal belongs
to a separate lifecycle and does not revise the recorded capture outcome.
`;
    fs.writeFileSync(
      path.join(acceptedSliceWorkspace, acceptedSlicePayment),
      acceptedPaymentSliceModel,
    );
    const acceptedOrderStatusOnly = fs.readFileSync(
      path.join(acceptedSliceWorkspace, acceptedSliceOrder),
      "utf8",
    ).replace("model_status: shape_ready", "model_status: evolving");
    fs.writeFileSync(
      path.join(acceptedSliceWorkspace, acceptedSliceOrder),
      acceptedOrderStatusOnly,
    );
    const acceptedSliceResult = {
      ...goodEventStorming,
      scenario_id: acceptedSliceConfig.id,
      completion: "needs_clarification",
      questions: [
        "Is Payment Captured sufficient for Order fulfillment readiness, what additional local facts must Order require before fulfillment, and what happens to readiness if Payment is later reversed by refund or chargeback?",
      ],
      routes: [],
      changed_files: [acceptedSliceOrder, acceptedSlicePayment].sort(),
    };
    const acceptedSliceOptions = { baseline: acceptedSliceBaseline };
    const acceptedSliceGrade = scoreResult(
      dialogueFirstTurnCase(acceptedSliceCase),
      acceptedSliceResult,
      acceptedSliceWorkspace,
      acceptedSliceOptions,
    );
    if (!acceptedSliceGrade.passed) {
      fail(`scorer rejected an accepted context-local Model slice: ${JSON.stringify(acceptedSliceGrade.assertions)}`, 2);
    }
    const unappliedSliceWorkspace = path.join(tempRoot, "unapplied-model-slice-workspace");
    fs.cpSync(
      path.join(CASES_ROOT, "event-storming-applies-accepted-model-slice", "workspace"),
      unappliedSliceWorkspace,
      { recursive: true },
    );
    const unappliedSliceBaseline = initializeGit(unappliedSliceWorkspace);
    const unappliedSliceGrade = scoreResult(
      dialogueFirstTurnCase(acceptedSliceCase),
      { ...acceptedSliceResult, changed_files: [] },
      unappliedSliceWorkspace,
      { baseline: unappliedSliceBaseline },
    );
    if (unappliedSliceGrade.passed || !unappliedSliceGrade.assertions.some((item) =>
      !item.passed && item.name === "git change expectation")) {
      fail("scorer accepted EventStorming continuation without applying the accepted Model slice", 2);
    }
    const migrationEventStormingConfig = readJson(path.join(
      CASES_ROOT,
      "event-storming-migrates-legacy-context-map",
      "case.json",
    ));
    const migrationEventStormingCase = { ...loadedCase, config: migrationEventStormingConfig };
    const migrationEventStormingWorkspace = path.join(tempRoot, "migration-event-storming-workspace");
    fs.cpSync(
      path.join(CASES_ROOT, "event-storming-migrates-legacy-context-map", "workspace"),
      migrationEventStormingWorkspace,
      { recursive: true },
    );
    const migrationEventStormingBaseline = initializeGit(migrationEventStormingWorkspace);
    const migrationReadmeRelative = "docs/ddd-expert/README.md";
    const migrationMapRelative = "docs/ddd-expert/context-map.md";
    const migrationAgentRelative = "docs/ddd-expert/context/agent-execution/model.md";
    const migrationWorkRelative = "docs/ddd-expert/context/work/model.md";
    const migrationKnowledgeRelative = "docs/ddd-expert/context/project-knowledge/model.md";
    const acceptedMigrationReadme = fs.readFileSync(
      path.join(migrationEventStormingWorkspace, migrationReadmeRelative),
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

\`\`\`text
+-----------------+         +------+
| Agent Execution |--+----->| Work |
+-----------------+  |      +------+
                     |
                     |      +-------------------+
                     +----->| Project Knowledge |
                            +-------------------+
\`\`\`

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

\`\`\`text
+-----------------+   +------+
| Agent Execution |-->| Work |
+-----------------+   +------+
\`\`\`

#### Upstream Dependencies

##### Work Agent Run Outcome

- **Upstream:** Agent Execution
- **Accepted meaning:** Work accepts an authoritative Agent Run outcome only as execution evidence.
- **Local translation:** Work translates the evidence into its own language; it does not by itself complete Work.

### Project Knowledge

- **Core responsibility:** Govern canonical project knowledge and Candidate evaluation.
- **Business authority:** Project Knowledge owns Knowledge Candidate evaluation and acceptance.

#### Local View

\`\`\`text
+-----------------+   +-------------------+
| Agent Execution |-->| Project Knowledge |
+-----------------+   +-------------------+
\`\`\`

#### Upstream Dependencies

##### Knowledge Agent Run Outcome

- **Upstream:** Agent Execution
- **Accepted meaning:** Project Knowledge accepts an authoritative Agent Run outcome only as execution evidence.
- **Local translation:** Project Knowledge translates the evidence into Candidate evaluation language; it does not by itself accept a Candidate.
`;
const acceptedMigrationAgentModel = `---
context: Agent Execution
model_revision: 2
model_status: shape_ready
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
model_status: shape_ready
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
model_status: shape_ready
---

# Project Knowledge Domain Model

## Authority and Ownership

Project Knowledge owns Knowledge Candidate evaluation and acceptance.

## Context Dependencies

Project Knowledge accepts Agent Execution's authoritative Agent Run outcome only as execution evidence. It does not by itself accept a Candidate.
`;
    fs.writeFileSync(path.join(migrationEventStormingWorkspace, migrationReadmeRelative), acceptedMigrationReadme);
    fs.writeFileSync(path.join(migrationEventStormingWorkspace, migrationMapRelative), acceptedMigrationMap);
    fs.writeFileSync(path.join(migrationEventStormingWorkspace, migrationAgentRelative), acceptedMigrationAgentModel);
    fs.writeFileSync(path.join(migrationEventStormingWorkspace, migrationWorkRelative), acceptedMigrationWorkModel);
    fs.writeFileSync(path.join(migrationEventStormingWorkspace, migrationKnowledgeRelative), acceptedMigrationKnowledgeModel);
    const migrationChangedFiles = [
      migrationReadmeRelative,
      migrationMapRelative,
      migrationAgentRelative,
      migrationWorkRelative,
      migrationKnowledgeRelative,
    ];
    const migrationEventStormingResult = {
      ...goodEventStorming,
      scenario_id: migrationEventStormingConfig.id,
      completion: "completed",
      questions: [],
      routes: [],
      changed_files: migrationChangedFiles,
    };
    const executeMigrationCheck = (check) => {
      const argv = [...check.argv];
      if (argv[0] === "node" && argv[1] === "/eval/validate-context-map.mjs") {
        argv[1] = path.join(PLUGIN_ROOT, "scripts", "validate-context-map.mjs");
      }
      return runCommand(argv, {
        cwd: migrationEventStormingWorkspace,
        timeoutSeconds: check.timeout_seconds,
      });
    };
    const migrationEventStormingOptions = {
      baseline: migrationEventStormingBaseline,
      executeCheck: executeMigrationCheck,
    };
    const acceptedMigrationGrade = scoreResult(
      migrationEventStormingCase,
      migrationEventStormingResult,
      migrationEventStormingWorkspace,
      migrationEventStormingOptions,
    );
    if (!acceptedMigrationGrade.passed) {
      fail(`scorer rejected accepted legacy migration semantics: ${JSON.stringify(acceptedMigrationGrade.assertions)}`, 2);
    }
    fs.writeFileSync(
      path.join(migrationEventStormingWorkspace, migrationReadmeRelative),
      `${acceptedMigrationReadme}\ncontext\nrelationships are authoritative\n`,
    );
    const lowercaseLegacyReadmeGrade = scoreResult(
      migrationEventStormingCase,
      migrationEventStormingResult,
      migrationEventStormingWorkspace,
      migrationEventStormingOptions,
    );
    const lowercaseLegacyReadmeAssertion = lowercaseLegacyReadmeGrade.assertions.find((item) =>
      item.name === `file ${migrationReadmeRelative} semantically excludes Context relationships are authoritative`);
    if (lowercaseLegacyReadmeGrade.passed || !lowercaseLegacyReadmeAssertion || lowercaseLegacyReadmeAssertion.passed) {
      fail("scorer accepted a lowercase line-wrapped legacy README authority claim", 2);
    }
    fs.writeFileSync(path.join(migrationEventStormingWorkspace, migrationReadmeRelative), acceptedMigrationReadme);
    fs.writeFileSync(
      path.join(migrationEventStormingWorkspace, migrationAgentRelative),
      `${acceptedMigrationAgentModel}\nlowercase partnership remains the collaboration pattern.\n`,
    );
    const lowercaseLegacyPatternGrade = scoreResult(
      migrationEventStormingCase,
      migrationEventStormingResult,
      migrationEventStormingWorkspace,
      migrationEventStormingOptions,
    );
    const lowercaseLegacyPatternAssertion = lowercaseLegacyPatternGrade.assertions.find((item) =>
      item.name === `file ${migrationAgentRelative} semantically excludes Partnership`);
    if (lowercaseLegacyPatternGrade.passed || !lowercaseLegacyPatternAssertion || lowercaseLegacyPatternAssertion.passed) {
      fail("scorer accepted a lowercase retired collaboration pattern", 2);
    }
    fs.writeFileSync(path.join(migrationEventStormingWorkspace, migrationAgentRelative), acceptedMigrationAgentModel);
    fs.writeFileSync(
      path.join(migrationEventStormingWorkspace, migrationMapRelative),
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
      path.join(migrationEventStormingWorkspace, migrationAgentRelative),
      acceptedMigrationAgentModel.replace(
        "Agent Execution owns Agent Run admission, identity, lifecycle, and terminal outcomes.",
        "Work owns Agent Run, Project Knowledge owns Agent Run, Agent Execution completes Work, and Agent Execution accepts a Knowledge Candidate.",
      ),
    );
    fs.writeFileSync(
      path.join(migrationEventStormingWorkspace, migrationWorkRelative),
      acceptedMigrationWorkModel
        .replace("Work owns Work lifecycle and completion.", "Agent Execution owns Work completion.")
        .replace("It does not by itself complete Work.", "Agent Run outcome completes a Work."),
    );
    fs.writeFileSync(
      path.join(migrationEventStormingWorkspace, migrationKnowledgeRelative),
      acceptedMigrationKnowledgeModel
        .replace(
          "Project Knowledge owns Knowledge Candidate evaluation and acceptance.",
          "Agent Execution owns Candidate acceptance.",
        )
        .replace("It does not by itself accept a Candidate.", "Agent Run outcome accepts a Knowledge Candidate."),
    );
    const contradictoryMigrationGrade = scoreResult(
      migrationEventStormingCase,
      migrationEventStormingResult,
      migrationEventStormingWorkspace,
      migrationEventStormingOptions,
    );
    if (contradictoryMigrationGrade.passed ||
        contradictoryMigrationGrade.checks.some((check) => check.status !== 0) ||
        !contradictoryMigrationGrade.assertions.some((item) =>
          !item.passed && item.name.startsWith("file docs/ddd-expert/"))) {
      fail("scorer did not reject authority and lifecycle reversals in a structurally valid migration", 2);
    }
    const partialMigrationConfig = readJson(path.join(
      CASES_ROOT,
      "event-storming-blocks-partial-legacy-migration",
      "case.json",
    ));
    const partialMigrationCase = { ...loadedCase, config: partialMigrationConfig };
    const partialMigrationWorkspace = path.join(tempRoot, "partial-migration-workspace");
    fs.cpSync(
      path.join(CASES_ROOT, "event-storming-blocks-partial-legacy-migration", "workspace"),
      partialMigrationWorkspace,
      { recursive: true },
    );
    const partialMigrationBaseline = initializeGit(partialMigrationWorkspace);
    const partialMigrationResult = {
      ...goodEventStorming,
      scenario_id: partialMigrationConfig.id,
      completion: "needs_clarification",
      questions: [
        "Audit/model.md is a legacy Model with the retired Context Relationships heading, but Audit is omitted from the accepted target and has no terminal content. Which facts does Audit continue to observe from Work or Project Knowledge, which context is authoritative for those facts, or is that observation retired?",
      ],
      routes: [],
      changed_files: [],
    };
    const partialMigrationOptions = { baseline: partialMigrationBaseline };
    const partialMigrationGrade = scoreResult(
      partialMigrationCase,
      partialMigrationResult,
      partialMigrationWorkspace,
      partialMigrationOptions,
    );
    if (!partialMigrationGrade.passed) {
      fail(`scorer rejected an evidence-bearing omitted-legacy-Model question: ${JSON.stringify(partialMigrationGrade.assertions)}`, 2);
    }
    const paraphrasedPartialMigrationResult = {
      ...partialMigrationResult,
      questions: [
        "Audit still has the retired Context Relationships marker, while the accepted target supplies terminal content only for Agent Execution, Work, and Project Knowledge. What evidence must Audit still observe from Work or Project Knowledge, who is authoritative for it, or is that observation retired?",
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


    const tacticalWriteConfig = readJson(path.join(
      CASES_ROOT,
      "event-storming-mysql-default-handoff",
      "case.json",
    ));
    const tacticalWriteWorkspace = path.join(tempRoot, "event-storming-write-workspace");
    fs.mkdirSync(tacticalWriteWorkspace, { recursive: true });
    const tacticalWriteBaseline = initializeGit(tacticalWriteWorkspace);
    const tacticalWriteRelative = "docs/ddd-expert/context/inventory/design.md";
    const tacticalWritePath = path.join(tacticalWriteWorkspace, tacticalWriteRelative);
    fs.mkdirSync(path.dirname(tacticalWritePath), { recursive: true });
const minimalTacticalDesign = `---
context: Inventory
based_on_model_revision: 1
design_status: codify_ready
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
    fs.writeFileSync(tacticalWritePath, minimalTacticalDesign);
    const tacticalWriteCase = { ...loadedCase, config: tacticalWriteConfig };
    const tacticalWriteResult = {
      ...goodEventStorming,
      scenario_id: tacticalWriteConfig.id,
      phase: "event-storming",
      completion: "completed",
      questions: [],
      changed_files: [tacticalWriteRelative],
    };
    if (scoreResult(
      tacticalWriteCase,
      tacticalWriteResult,
      tacticalWriteWorkspace,
      { baseline: tacticalWriteBaseline },
    ).passed) {
      fail("scorer accepted an EventStorming write that had headings but omitted accepted tactical decisions", 2);
    }
const completeTacticalDesign = `---
context: Inventory
based_on_model_revision: 1
design_status: codify_ready
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
    fs.writeFileSync(tacticalWritePath, completeTacticalDesign);
    const completeTacticalGrade = scoreResult(
      tacticalWriteCase,
      tacticalWriteResult,
      tacticalWriteWorkspace,
      { baseline: tacticalWriteBaseline },
    );
    if (!completeTacticalGrade.passed) {
      fail(`scorer rejected an EventStorming write containing the accepted tactical decisions: ${JSON.stringify(completeTacticalGrade.assertions)}`, 2);
    }
    const paraphrasedValueObjectsDesign = completeTacticalDesign.replace(
      "ReservationId is the immutable identity of one reservation. It is constructed only from an identity admitted by Inventory. The Model defines no format, normalization, or additional validity rule. ReservationId values are equal when they denote the same reservation identity.\n\nQuantity is the immutable amount of stock accepted for the reservation. Quantity construction requires a positive amount, and Quantity equality is by that amount.",
      "ReservationId is the Domain identity value that denotes the same reservation throughout its lifecycle. Construction accepts an identity admitted by Inventory. The Model defines no format, normalization, or additional validity rule. Two values are equal when they denote the same reservation identity.\n\nQuantity is the accepted quantity owned by one reservation. Construction succeeds only for a positive quantity. Two values are equal when their represented quantities are equal.",
    );
    fs.writeFileSync(tacticalWritePath, paraphrasedValueObjectsDesign);
    if (!scoreResult(
      tacticalWriteCase,
      tacticalWriteResult,
      tacticalWriteWorkspace,
      { baseline: tacticalWriteBaseline },
    ).passed) {
      fail("scorer rejected equivalent Value Object construction and equality semantics", 2);
    }
    const reverseNegatedIdentifierFormat = completeTacticalDesign.replace(
      "ReservationId is the immutable identity of one reservation. It is constructed only from an identity admitted by Inventory. The Model defines no format, normalization, or additional validity rule. ReservationId values are equal when they denote the same reservation identity.",
      "ReservationId is the immutable identity of one reservation. ReservationId is constructed from an identity admitted by Inventory. No UUID format is required for ReservationId. The Model defines no additional business validity rule. ReservationId values are equal when they denote the same reservation identity.",
    );
    fs.writeFileSync(tacticalWritePath, reverseNegatedIdentifierFormat);
    const reverseNegatedIdentifierGrade = scoreResult(
      tacticalWriteCase,
      tacticalWriteResult,
      tacticalWriteWorkspace,
      { baseline: tacticalWriteBaseline },
    );
    if (!reverseNegatedIdentifierGrade.passed) {
      fail(`scorer rejected a reverse-order statement that explicitly denies an identifier format: ${JSON.stringify(reverseNegatedIdentifierGrade.assertions.filter((item) => !item.passed))}`, 2);
    }
    fs.writeFileSync(tacticalWritePath, completeTacticalDesign);
    fs.writeFileSync(
      tacticalWritePath,
      completeTacticalDesign.replace(
        "It is constructed only from an identity admitted by Inventory. The Model defines no format, normalization, or additional validity rule. ReservationId values are equal when they denote the same reservation identity.",
        "Construction requires a canonical UUIDv7. ReservationId values are equal by that UUID.",
      ),
    );
    const inventedIdentifierGrade = scoreResult(
      tacticalWriteCase,
      tacticalWriteResult,
      tacticalWriteWorkspace,
      { baseline: tacticalWriteBaseline },
    );
    const inventoryIdentifierFormatAssertionName =
      "file docs/ddd-expert/context/inventory/design.md invents no identifier format";
    const inventedIdentifierAssertion = inventedIdentifierGrade.assertions.find((item) =>
      item.name === inventoryIdentifierFormatAssertionName);
    if (inventedIdentifierGrade.passed || !inventedIdentifierAssertion || inventedIdentifierAssertion.passed) {
      fail("scorer accepted a House Style invented as a Domain identifier rule", 2);
    }
    fs.writeFileSync(tacticalWritePath, completeTacticalDesign);
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
      fs.writeFileSync(tacticalWritePath, `${completeTacticalDesign}\n${inventedRule}\n`);
      const inventedRuleGrade = scoreResult(
        tacticalWriteCase,
        tacticalWriteResult,
        tacticalWriteWorkspace,
        { baseline: tacticalWriteBaseline },
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
      fs.writeFileSync(tacticalWritePath, `${completeTacticalDesign}\n${deniedRule}\n`);
      const deniedFormatGrade = scoreResult(
        tacticalWriteCase,
        tacticalWriteResult,
        tacticalWriteWorkspace,
        { baseline: tacticalWriteBaseline },
      );
      if (!deniedFormatGrade.passed) {
        fail(`scorer rejected an explicit denial of a ReservationId format: ${deniedRule}`, 2);
      }
    }
    fs.writeFileSync(tacticalWritePath, completeTacticalDesign);
    const undefinedValueObjectsDesign = completeTacticalDesign.replace(
      "ReservationId is the immutable identity of one reservation. It is constructed only from an identity admitted by Inventory. The Model defines no format, normalization, or additional validity rule. ReservationId values are equal when they denote the same reservation identity.\n\nQuantity is the immutable amount of stock accepted for the reservation. Quantity construction requires a positive amount, and Quantity equality is by that amount.",
      "ReservationId. Quantity is positive.",
    );
    fs.writeFileSync(tacticalWritePath, undefinedValueObjectsDesign);
    const undefinedValueObjectsGrade = scoreResult(
      tacticalWriteCase,
      tacticalWriteResult,
      tacticalWriteWorkspace,
      { baseline: tacticalWriteBaseline },
    );
    if (undefinedValueObjectsGrade.passed || !undefinedValueObjectsGrade.assertions.some((item) =>
      !item.passed && item.name.includes("design.md contains any of"))) {
      fail("scorer accepted Value Object names without Domain definitions", 2);
    }
    const inventoryValueObjects = "ReservationId is the immutable identity of one reservation. It is constructed only from an identity admitted by Inventory. The Model defines no format, normalization, or additional validity rule. ReservationId values are equal when they denote the same reservation identity.\n\nQuantity is the immutable amount of stock accepted for the reservation. Quantity construction requires a positive amount, and Quantity equality is by that amount.";
    for (const [label, replacement, assertionFragment] of [
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
      fs.writeFileSync(tacticalWritePath, completeTacticalDesign.replace(inventoryValueObjects, replacement));
      const omissionGrade = scoreResult(
        tacticalWriteCase,
        tacticalWriteResult,
        tacticalWriteWorkspace,
        { baseline: tacticalWriteBaseline },
      );
      if (omissionGrade.passed || !omissionGrade.assertions.some((item) =>
        item.name.includes(assertionFragment) && !item.passed)) {
        fail(`scorer accepted Inventory Value Objects without ${label}`, 2);
      }
    }
    fs.writeFileSync(
      tacticalWritePath,
      `${completeTacticalDesign}\nReservationId construction is unspecified. ReservationId equality is undefined. Quantity meaning is unspecified. Quantity equality is undefined.\n`,
    );
    const unspecifiedInventoryValueObjectsGrade = scoreResult(
      tacticalWriteCase,
      tacticalWriteResult,
      tacticalWriteWorkspace,
      { baseline: tacticalWriteBaseline },
    );
    if (unspecifiedInventoryValueObjectsGrade.passed || !unspecifiedInventoryValueObjectsGrade.assertions.some((item) =>
      item.name.includes("semantically excludes") && !item.passed)) {
      fail("scorer accepted unspecified Inventory Value Object semantics as definitions", 2);
    }
    fs.writeFileSync(tacticalWritePath, completeTacticalDesign);
    const negatedTacticalDesign = completeTacticalDesign
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
    fs.writeFileSync(tacticalWritePath, negatedTacticalDesign);
    const negatedTacticalGrade = scoreResult(
      tacticalWriteCase,
      tacticalWriteResult,
      tacticalWriteWorkspace,
      { baseline: tacticalWriteBaseline },
    );
    if (negatedTacticalGrade.passed || !negatedTacticalGrade.assertions.some((item) =>
      !item.passed && item.name.includes("design.md semantically excludes"))) {
      fail("scorer accepted an EventStorming design that negated accepted tactical decisions", 2);
    }
    fs.writeFileSync(
      tacticalWritePath,
      `${completeTacticalDesign}\n#### Entities\n\nReservation Item is a child Entity.\n`,
    );
    const headingBypassTacticalGrade = scoreResult(
      tacticalWriteCase,
      tacticalWriteResult,
      tacticalWriteWorkspace,
      { baseline: tacticalWriteBaseline },
    );
    const headingBypassAssertion = headingBypassTacticalGrade.assertions.find((item) =>
      item.name === "file docs/ddd-expert/context/inventory/design.md semantically excludes Reservation Item is a child Entity");
    if (headingBypassTacticalGrade.passed || !headingBypassAssertion || headingBypassAssertion.passed) {
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
