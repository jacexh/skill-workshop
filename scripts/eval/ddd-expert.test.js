#!/usr/bin/env node

"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const CASE_ROOT = path.join(ROOT, "evals", "ddd-expert", "cases", "guard-outbound-port-structure");
const CROSS_ROOT_CASE_ROOT = path.join(ROOT, "evals", "ddd-expert", "cases", "guard-cross-root-repository");
const RECIPROCAL_CASE_ROOT = path.join(ROOT, "evals", "ddd-expert", "cases", "guard-reciprocal-context-imports");
const MIGRATION_CASE_ROOT = path.join(ROOT, "evals", "ddd-expert", "cases", "guard-mysql-migration");
const RESULT_SCHEMA = path.join(ROOT, "evals", "ddd-expert", "result.schema.json");
const { initializeGit, resolveCodexRuntime, scoreResult, validateResultShape } = require("./ddd-expert.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validResult() {
  return {
    scenario_id: "guard-outbound-port-structure",
    phase: "guard",
    completion: "completed",
    review_conclusion: "violations",
    architecture_ledger: [
      {
        source_id: "recipient-notification",
        source_assertion: "Application depends on a business-language recipient notification capability and exposes no HTTP or provider mechanics.",
        frozen_id: "AU-application-contract",
        responsibility: "application",
        state: "violation",
      },
      {
        source_id: "recipient-notification",
        source_assertion: "Infrastructure adapter faithfully implements the supplied inner contract without adding business decisions.",
        frozen_id: "AU-infrastructure-adapter",
        responsibility: "infrastructure",
        state: "clear",
      },
    ],
    questions: [],
    routes: [{ target: "codify", reason: "Repair the mechanism-shaped Application port." }],
    verdicts: [
      {
        kind: "violation",
        family: "layer_boundary",
        summary: "Application exposes HTTP mechanics instead of a Shipping capability.",
        unit_ids: ["AU-application-contract"],
        correction: "Own a recipient-notification capability in Application and keep HTTP details in Infrastructure.",
        evidence: [
          {
            path: "internal/shipping/application/announce_dispatch.go",
            line: 8,
            detail: "The port exposes endpoint, headers, and encoded payload.",
          },
        ],
      },
    ],
    changed_files: [],
    verification: [],
  };
}

function assertInvalid(result, message) {
  const errors = validateResultShape(result);
  assert.equal(errors.some((error) => error.includes(message)), true, `expected ${message}; got ${errors.join("; ")}`);
}

function initializeWorkspace(caseRoot = CASE_ROOT) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ddd-expert-ledger-test-"));
  const workspace = path.join(temp, "workspace");
  fs.cpSync(path.join(caseRoot, "workspace"), workspace, { recursive: true });
  return { temp, workspace, baseline: initializeGit(workspace) };
}

function testLegacyCaseRejectsInventedLedger() {
  const fixture = initializeWorkspace(CROSS_ROOT_CASE_ROOT);
  try {
    const config = JSON.parse(fs.readFileSync(path.join(CROSS_ROOT_CASE_ROOT, "case.json"), "utf8"));
    config.expect.checks = [];
    const invented = {
      scenario_id: "guard-cross-root-repository",
      phase: "guard",
      completion: "completed",
      review_conclusion: "violations",
      architecture_ledger: [{
        source_id: "invented-source",
        source_assertion: "An unrelated repository boundary is invalid.",
        frozen_id: "AU-invented",
        responsibility: "domain",
        state: "violation",
      }],
      questions: [],
      routes: [{ target: "codify", reason: "Repair the repository boundary." }],
      verdicts: [{
        kind: "violation",
        family: "aggregate_boundary",
        summary: "A plausible family and evidence path are not sufficient without the real authority clauses.",
        unit_ids: ["AU-invented"],
        correction: "Separate the repositories.",
        evidence: [{
          path: "internal/checkout/domain/repository.go",
          line: 8,
          detail: "The path exists, but the ledger source is fabricated.",
        }],
      }],
      changed_files: [],
      verification: [],
    };
    assert.deepEqual(validateResultShape(invented), []);
    const grade = scoreResult({ config }, invented, fixture.workspace, { baseline: fixture.baseline });
    assert.equal(grade.passed, false, "source-backed Guard cases must reject invented ledger rows");
    assert.equal(grade.assertions.some((item) =>
      !item.passed && item.name.startsWith("architecture ledger row docs/ddd-expert/context/")), true);
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
}

function testDistinctUnitAndEmptyLedgerExpectations() {
  const reciprocalFixture = initializeWorkspace(RECIPROCAL_CASE_ROOT);
  try {
    const config = JSON.parse(fs.readFileSync(path.join(RECIPROCAL_CASE_ROOT, "case.json"), "utf8"));
    config.expect.checks = [];
    const collapsed = {
      scenario_id: "guard-reciprocal-context-imports",
      phase: "guard",
      completion: "completed",
      review_conclusion: "violations",
      architecture_ledger: [
        {
          source_id: "docs/ddd-expert/context-map.md#Semantic Dependencies",
          source_assertion: "Payment owns Payment Captured for Order and publishes the meaning downstream.",
          frozen_id: "AU-collapsed-cycle",
          responsibility: "collaboration",
          state: "violation",
        },
        {
          source_id: "docs/ddd-expert/context-map.md#Semantic Dependencies",
          source_assertion: "Order consumes Payment Captured and creates no reverse semantic dependency on Payment.",
          frozen_id: "AU-collapsed-cycle",
          responsibility: "collaboration",
          state: "violation",
        },
      ],
      questions: [],
      routes: [{ target: "codify", reason: "Remove reciprocal implementation dependencies." }],
      verdicts: [{
        kind: "violation",
        family: "collaboration",
        summary: "Both dependency directions were incorrectly collapsed into one review unit.",
        unit_ids: ["AU-collapsed-cycle"],
        correction: "Restore one-way published-contract collaboration.",
        evidence: [
          { path: "internal/payment/application/notify_order.go", line: 3, detail: "Payment imports Order Application." },
          { path: "internal/order/application/confirm_payment.go", line: 3, detail: "Order imports Payment Domain." },
        ],
      }],
      changed_files: [],
      verification: [],
    };
    assert.deepEqual(validateResultShape(collapsed), []);
    const grade = scoreResult({ config }, collapsed, reciprocalFixture.workspace, { baseline: reciprocalFixture.baseline });
    assert.equal(grade.passed, false, "independently falsifiable dependency edges must use distinct frozen units");
    assert.equal(grade.assertions.some((item) =>
      !item.passed && item.name === "architecture ledger distinct frozen units reciprocal-context-edges"), true);
  } finally {
    fs.rmSync(reciprocalFixture.temp, { recursive: true, force: true });
  }

  const migrationFixture = initializeWorkspace(MIGRATION_CASE_ROOT);
  try {
    const config = JSON.parse(fs.readFileSync(path.join(MIGRATION_CASE_ROOT, "case.json"), "utf8"));
    config.expect.checks = [];
    const extraClear = {
      scenario_id: "guard-mysql-migration",
      phase: "guard",
      completion: "completed",
      review_conclusion: "clear",
      architecture_ledger: [{
        source_id: "invented-migration-seam",
        source_assertion: "The migration creates an architecture responsibility.",
        frozen_id: "AU-invented-migration",
        responsibility: "infrastructure",
        state: "clear",
      }],
      questions: [],
      routes: [],
      verdicts: [],
      changed_files: [],
      verification: [],
    };
    assert.deepEqual(validateResultShape(extraClear), []);
    const grade = scoreResult({ config }, extraClear, migrationFixture.workspace, { baseline: migrationFixture.baseline });
    assert.equal(grade.passed, false, "a migration-only change must not invent an architecture unit");
    assert.equal(grade.assertions.some((item) =>
      !item.passed && item.name === "architecture ledger maximum frozen units"), true);
  } finally {
    fs.rmSync(migrationFixture.temp, { recursive: true, force: true });
  }
}

function testShapeContract() {
  const base = validResult();
  assert.deepEqual(validateResultShape(base), []);

  const merged = clone(base);
  merged.architecture_ledger.push({
    source_id: "dispatch-owner",
    source_assertion: "Shipment owns dispatch completion.",
    frozen_id: "AU-domain-owner",
    responsibility: "domain",
    state: "violation",
  });
  merged.verdicts[0].unit_ids.push("AU-domain-owner");
  assert.deepEqual(validateResultShape(merged), [], "one root verdict may merge multiple violated units");

  const duplicateSource = clone(base);
  duplicateSource.architecture_ledger.push(clone(duplicateSource.architecture_ledger[0]));
  assertInvalid(duplicateSource, "source assertion must appear exactly once");

  const conflictingUnit = clone(base);
  conflictingUnit.architecture_ledger.push({
    source_id: "another-source",
    source_assertion: "The same unit is clear.",
    frozen_id: "AU-application-contract",
    responsibility: "application",
    state: "clear",
  });
  assertInvalid(conflictingUnit, "one responsibility and terminal state");

  const unknownUnit = clone(base);
  unknownUnit.verdicts[0].unit_ids = ["AU-unknown"];
  assertInvalid(unknownUnit, "unit_ids must name frozen architecture units");

  const duplicateUnitLink = clone(base);
  duplicateUnitLink.verdicts[0].unit_ids.push("AU-application-contract");
  assertInvalid(duplicateUnitLink, "verdict is invalid");

  const wrongKind = clone(base);
  wrongKind.architecture_ledger[0].state = "evidence_gap";
  assertInvalid(wrongKind, "verdict kind must match");

  const orphan = clone(base);
  orphan.verdicts = [];
  assertInvalid(orphan, "non-clear architecture unit must link to exactly one verdict");

  const incompleteLedger = clone(base);
  incompleteLedger.completion = "stopped";
  incompleteLedger.review_conclusion = "incomplete";
  incompleteLedger.routes = [];
  incompleteLedger.verdicts = [];
  assertInvalid(incompleteLedger, "must not claim a terminal architecture ledger");

  const malformedLedger = clone(incompleteLedger);
  malformedLedger.architecture_ledger = null;
  assert.doesNotThrow(() => validateResultShape(malformedLedger));
  assertInvalid(malformedLedger, "architecture_ledger must be an array");

  const stoppedTerminal = clone(base);
  stoppedTerminal.completion = "stopped";
  assertInvalid(stoppedTerminal, "terminal Guard conclusion requires completed execution");

  const nonGuardLedger = clone(base);
  nonGuardLedger.phase = "codify";
  nonGuardLedger.review_conclusion = "not_applicable";
  nonGuardLedger.routes = [];
  nonGuardLedger.verdicts = [];
  assertInvalid(nonGuardLedger, "non-guard results must use not_applicable with no architecture ledger or verdicts");

  const schema = JSON.parse(fs.readFileSync(RESULT_SCHEMA, "utf8"));
  assert.equal(schema.properties.verdicts.items.properties.unit_ids.uniqueItems, true);
}

function testScorerContract() {
  const fixture = initializeWorkspace();
  try {
    const config = JSON.parse(fs.readFileSync(path.join(CASE_ROOT, "case.json"), "utf8"));
    config.expect.checks = [];
    const loadedCase = { config };
    const valid = scoreResult(loadedCase, validResult(), fixture.workspace, { baseline: fixture.baseline });
    assert.equal(valid.passed, true, valid.assertions.filter((item) => !item.passed).map((item) => `${item.name}: ${item.detail}`).join("\n"));

    const wrongAssertion = validResult();
    wrongAssertion.architecture_ledger[0].source_assertion = "Application has some outbound dependency.";
    const wrongAssertionGrade = scoreResult(loadedCase, wrongAssertion, fixture.workspace, { baseline: fixture.baseline });
    assert.equal(wrongAssertionGrade.passed, false);
    assert.equal(wrongAssertionGrade.assertions.some((item) =>
      !item.passed && item.name.includes("architecture ledger row recipient-notification/application/violation")), true);

    const extraFinding = validResult();
    extraFinding.architecture_ledger.push({
      source_id: "invented-risk",
      source_assertion: "The provider may have another structural problem.",
      frozen_id: "AU-invented-risk",
      responsibility: "infrastructure",
      state: "violation",
    });
    extraFinding.verdicts.push({
      kind: "violation",
      family: "layer_boundary",
      summary: "An extra unsupported finding.",
      unit_ids: ["AU-invented-risk"],
      correction: "Change the provider boundary.",
      evidence: [{
        path: "internal/shipping/infrastructure/http_poster.go",
        line: 1,
        detail: "The file exists but does not support this additional root.",
      }],
    });
    assert.deepEqual(validateResultShape(extraFinding), []);
    const extraFindingGrade = scoreResult(loadedCase, extraFinding, fixture.workspace, { baseline: fixture.baseline });
    assert.equal(extraFindingGrade.passed, false);
    assert.equal(extraFindingGrade.assertions.some((item) => !item.passed && item.name === "exact verdict count"), true);

    const emptyClear = validResult();
    emptyClear.review_conclusion = "clear";
    emptyClear.architecture_ledger = [];
    emptyClear.routes = [];
    emptyClear.verdicts = [];
    assert.deepEqual(validateResultShape(emptyClear), [], "a no-seam Guard review may be structurally clear");
    const emptyClearGrade = scoreResult(loadedCase, emptyClear, fixture.workspace, { baseline: fixture.baseline });
    assert.equal(emptyClearGrade.passed, false, "a case with claimed seams must reject a vacuous ledger");
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
}

function testNpmCodexRuntimeResolution() {
  const asset = {
    "linux/x64": { packageName: "codex-linux-x64", target: "x86_64-unknown-linux-musl" },
    "linux/arm64": { packageName: "codex-linux-arm64", target: "aarch64-unknown-linux-musl" },
  }[`${process.platform}/${process.arch}`];
  if (!asset) return;

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ddd-expert-npm-codex-"));
  const previousNative = process.env.CODEX_NATIVE_BIN;
  const previousHost = process.env.CODEX_CODE_MODE_HOST;
  try {
    delete process.env.CODEX_NATIVE_BIN;
    delete process.env.CODEX_CODE_MODE_HOST;
    const packageRoot = path.join(temp, "node_modules", "@openai", "codex");
    const entry = path.join(packageRoot, "bin", "codex.js");
    const platformRoot = path.join(packageRoot, "node_modules", "@openai", asset.packageName);
    const nativeBin = path.join(platformRoot, "vendor", asset.target, "bin", "codex");
    const codeModeHost = path.join(platformRoot, "vendor", asset.target, "bin", "codex-code-mode-host");
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    fs.mkdirSync(path.dirname(nativeBin), { recursive: true });
    fs.writeFileSync(entry, "#!/usr/bin/env node\n", { mode: 0o755 });
    fs.writeFileSync(path.join(platformRoot, "package.json"), "{}\n");
    fs.writeFileSync(nativeBin, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    fs.writeFileSync(codeModeHost, "#!/bin/sh\nexit 0\n", { mode: 0o755 });

    const resolved = resolveCodexRuntime(entry);
    assert.equal(resolved.entry, fs.realpathSync(entry));
    assert.equal(resolved.nativeBinary, fs.realpathSync(nativeBin));
    assert.equal(resolved.codeModeHost, fs.realpathSync(codeModeHost));
  } finally {
    if (previousNative === undefined) delete process.env.CODEX_NATIVE_BIN;
    else process.env.CODEX_NATIVE_BIN = previousNative;
    if (previousHost === undefined) delete process.env.CODEX_CODE_MODE_HOST;
    else process.env.CODEX_CODE_MODE_HOST = previousHost;
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

testShapeContract();
testScorerContract();
testLegacyCaseRejectsInventedLedger();
testDistinctUnitAndEmptyLedgerExpectations();
testNpmCodexRuntimeResolution();
console.log("ddd-expert architecture ledger scorer tests passed");
