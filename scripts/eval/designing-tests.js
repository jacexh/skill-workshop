#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const EVAL_ROOT = path.join(ROOT, "evals", "designing-tests");
const CASES_ROOT = path.join(EVAL_ROOT, "cases");
const RESULT_SCHEMA = path.join(EVAL_ROOT, "result.schema.json");

function fail(message, exitCode = 1) {
  const error = new Error(message);
  error.exitCode = exitCode;
  throw error;
}

function readJson(file, label = file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`cannot read ${label}: ${error.message}`, 2);
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return isObject(value) &&
    Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function safeChild(parent, relative, label) {
  if (!nonEmptyString(relative) || path.isAbsolute(relative)) {
    fail(`${label} must be a non-empty relative path`, 2);
  }
  const resolved = path.resolve(parent, relative);
  if (!resolved.startsWith(`${path.resolve(parent)}${path.sep}`)) {
    fail(`${label} escapes its case directory`, 2);
  }
  return resolved;
}

function validateRuleList(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`, 2);
  const ids = new Set();
  for (const rule of value) {
    if (!exactKeys(rule, ["id", "description"]) ||
        !/^[a-z][a-z0-9-]*$/.test(rule.id || "") ||
        !nonEmptyString(rule.description)) {
      fail(`${label} entries require id and description`, 2);
    }
    if (ids.has(rule.id)) fail(`${label} repeats ${rule.id}`, 2);
    ids.add(rule.id);
  }
  return ids;
}

function countFiles(directory) {
  let count = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    count += entry.isDirectory() ? countFiles(child) : 1;
  }
  return count;
}

function validateCase(caseDir, config) {
  const required = ["id", "suites", "prompt", "workspace", "criteria", "forbidden"];
  if (!exactKeys(config, required)) fail(`${caseDir}/case.json has invalid keys`, 2);
  const name = path.basename(caseDir);
  if (config.id !== name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.id)) {
    fail(`${caseDir}/case.json id must match its kebab-case directory`, 2);
  }
  if (!Array.isArray(config.suites) || config.suites.length === 0 ||
      config.suites.some((suite) => !["smoke", "full"].includes(suite))) {
    fail(`${config.id}.suites must contain smoke or full`, 2);
  }
  const prompt = safeChild(caseDir, config.prompt, `${config.id}.prompt`);
  const workspace = safeChild(caseDir, config.workspace, `${config.id}.workspace`);
  if (!fs.statSync(prompt, { throwIfNoEntry: false })?.isFile() ||
      !nonEmptyString(fs.readFileSync(prompt, "utf8"))) {
    fail(`${config.id} prompt is missing or empty`, 2);
  }
  if (!fs.statSync(workspace, { throwIfNoEntry: false })?.isDirectory() || countFiles(workspace) === 0) {
    fail(`${config.id} workspace is missing or empty`, 2);
  }
  const criteria = validateRuleList(config.criteria, `${config.id}.criteria`);
  if (criteria.size < 3) fail(`${config.id} needs at least three semantic criteria`, 2);
  const forbidden = validateRuleList(config.forbidden, `${config.id}.forbidden`);
  for (const id of forbidden) {
    if (criteria.has(id)) fail(`${config.id} reuses rule id ${id}`, 2);
  }
  return { config, caseDir, prompt, workspace, criteria, forbidden };
}

function loadCases() {
  if (!fs.statSync(CASES_ROOT, { throwIfNoEntry: false })?.isDirectory()) {
    fail(`missing cases directory ${CASES_ROOT}`, 2);
  }
  const cases = fs.readdirSync(CASES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const caseDir = path.join(CASES_ROOT, entry.name);
      return validateCase(caseDir, readJson(path.join(caseDir, "case.json"), `${entry.name}/case.json`));
    });
  if (cases.length < 5) fail("designing-tests needs at least five behavior cases", 2);
  if (cases.filter((item) => item.config.suites.includes("smoke")).length < 2) {
    fail("designing-tests needs at least two smoke cases", 2);
  }
  return cases;
}

function validateResultSchema() {
  const schema = readJson(RESULT_SCHEMA, "result schema");
  if (!Array.isArray(schema.required) ||
      schema.required.sort().join(",") !== ["case_id", "criteria", "forbidden", "verdict"].sort().join(",") ||
      schema.properties?.verdict?.enum?.join(",") !== "pass,fail") {
    fail("result schema does not define the assessment contract", 2);
  }
}

function assessmentRows(value, keys, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`, 2);
  const rows = new Map();
  for (const row of value) {
    if (!exactKeys(row, keys) || !nonEmptyString(row.id) || !nonEmptyString(row.evidence)) {
      fail(`${label} contains an invalid assessment row`, 2);
    }
    if (rows.has(row.id)) fail(`${label} repeats ${row.id}`, 2);
    rows.set(row.id, row);
  }
  return rows;
}

function gradeAssessment(evalCase, assessment) {
  if (!exactKeys(assessment, ["case_id", "criteria", "forbidden", "verdict"]) ||
      assessment.case_id !== evalCase.config.id ||
      !["pass", "fail"].includes(assessment.verdict)) {
    fail(`${evalCase.config.id} assessment has invalid top-level fields`, 2);
  }
  const criteria = assessmentRows(assessment.criteria, ["id", "met", "evidence"], `${evalCase.config.id}.criteria`);
  const forbidden = assessmentRows(assessment.forbidden, ["id", "observed", "evidence"], `${evalCase.config.id}.forbidden`);
  for (const [id, row] of criteria) {
    if (!evalCase.criteria.has(id) || typeof row.met !== "boolean") fail(`${evalCase.config.id} has unknown criterion ${id}`, 2);
  }
  for (const [id, row] of forbidden) {
    if (!evalCase.forbidden.has(id) || typeof row.observed !== "boolean") fail(`${evalCase.config.id} has unknown forbidden rule ${id}`, 2);
  }
  for (const id of evalCase.criteria) if (!criteria.has(id)) fail(`${evalCase.config.id} assessment misses criterion ${id}`, 2);
  for (const id of evalCase.forbidden) if (!forbidden.has(id)) fail(`${evalCase.config.id} assessment misses forbidden rule ${id}`, 2);

  const passed = [...criteria.values()].every((row) => row.met) &&
    [...forbidden.values()].every((row) => !row.observed);
  const verdict = passed ? "pass" : "fail";
  if (assessment.verdict !== verdict) fail(`${evalCase.config.id} verdict ${assessment.verdict} contradicts ${verdict}`, 2);
  return { passed, verdict };
}

function syntheticAssessment(evalCase) {
  return {
    case_id: evalCase.config.id,
    criteria: [...evalCase.criteria].map((id) => ({ id, met: true, evidence: `observed ${id}` })),
    forbidden: [...evalCase.forbidden].map((id) => ({ id, observed: false, evidence: `not observed ${id}` })),
    verdict: "pass",
  };
}

function expectFailure(fn, message) {
  try {
    fn();
  } catch {
    return;
  }
  fail(`self-test did not reject ${message}`, 2);
}

function selfTest(cases) {
  const evalCase = cases[0];
  const good = syntheticAssessment(evalCase);
  if (!gradeAssessment(evalCase, good).passed) fail("self-test rejected a complete assessment", 2);

  const missing = structuredClone(good);
  missing.criteria.pop();
  expectFailure(() => gradeAssessment(evalCase, missing), "missing criterion");

  const lying = structuredClone(good);
  lying.criteria[0].met = false;
  expectFailure(() => gradeAssessment(evalCase, lying), "contradictory pass verdict");

  if (good.forbidden.length > 0) {
    const prohibited = structuredClone(good);
    prohibited.forbidden[0].observed = true;
    prohibited.verdict = "fail";
    if (gradeAssessment(evalCase, prohibited).passed) fail("self-test accepted prohibited behavior", 2);
  }

  if (cases.filter((candidate) => candidate.config.suites.includes("smoke")).length < 2) {
    fail("self-test could not select the smoke suite", 2);
  }
}

function usage() {
  console.log("Usage: designing-tests.js validate | self-test | list <smoke|full> | prompt <case-id> | grade <case-id> <assessment.json> | suite <smoke|full> <assessment-dir>");
}

function main() {
  validateResultSchema();
  const cases = loadCases();
  const command = process.argv[2];
  if (command === "validate") {
    console.log(`designing-tests evals valid: ${cases.length} cases`);
    return;
  }
  if (command === "self-test") {
    selfTest(cases);
    console.log("designing-tests eval scorer self-test passed");
    return;
  }
  const id = process.argv[3];
  const evalCase = cases.find((candidate) => candidate.config.id === id);
  if (command === "list") {
    if (!["smoke", "full"].includes(id)) fail("list requires smoke or full", 2);
    for (const candidate of cases.filter((item) => item.config.suites.includes(id))) {
      console.log(candidate.config.id);
    }
    return;
  }
  if ((command === "grade" || command === "prompt") && !evalCase) fail(`unknown case ${id}`, 2);
  if (command === "prompt") {
    process.stdout.write(fs.readFileSync(evalCase.prompt, "utf8"));
    return;
  }
  if (command === "grade") {
    const assessmentFile = process.argv[4];
    if (!assessmentFile) fail("grade requires an assessment JSON path", 2);
    const result = gradeAssessment(evalCase, readJson(path.resolve(assessmentFile), "assessment"));
    console.log(JSON.stringify(result));
    process.exitCode = result.passed ? 0 : 1;
    return;
  }
  if (command === "suite") {
    const suite = id;
    const assessmentDir = process.argv[4];
    if (!["smoke", "full"].includes(suite) || !assessmentDir) {
      fail("suite requires smoke|full and an assessment directory", 2);
    }
    const selected = cases.filter((candidate) => candidate.config.suites.includes(suite));
    let passed = true;
    for (const candidate of selected) {
      const assessmentFile = path.resolve(assessmentDir, `${candidate.config.id}.json`);
      const result = gradeAssessment(candidate, readJson(assessmentFile, `${candidate.config.id} assessment`));
      console.log(`${candidate.config.id}: ${result.verdict}`);
      passed &&= result.passed;
    }
    process.exitCode = passed ? 0 : 1;
    return;
  }
  usage();
  fail("unknown command", 2);
}

try {
  main();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exit(error.exitCode || 1);
}
