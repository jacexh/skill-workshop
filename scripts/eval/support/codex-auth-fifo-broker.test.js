#!/usr/bin/env node

"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const BROKER = path.join(__dirname, "codex-auth-fifo-broker.js");
const READY_LINE = "codex-auth-fifo-ready\n";

function waitForExit(child, timeoutMs = 2_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`child did not exit within ${timeoutMs}ms: ${child.spawnargs.join(" ")}`));
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

function collect(stream) {
  let content = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    content += chunk;
  });
  return () => content;
}

async function waitForReady(child, stdout, stderr, timeoutMs = 2_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (stdout() === READY_LINE) return;
    if (child.exitCode !== null) {
      throw new Error(`broker exited before ready: ${stderr().trim()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`broker did not become ready: ${stderr().trim()}`);
}

function startBroker(source, fifo) {
  const child = spawn(process.execPath, [BROKER, "--source", source, "--fifo", fifo], {
    // Keeping this pipe open is the broker's parent-liveness lease.
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stdout = collect(child.stdout);
  const stderr = collect(child.stderr);
  return { child, stdout, stderr };
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    if (process.platform === "linux") {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
      const state = stat.slice(stat.lastIndexOf(")") + 2).split(" ", 1)[0];
      if (state === "Z") return false;
    }
    return true;
  } catch (error) {
    if (["ESRCH", "ENOENT"].includes(error.code)) return false;
    throw error;
  }
}

async function waitUntil(predicate, timeoutMs = 2_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`condition did not become true within ${timeoutMs}ms`);
}

async function readFramedPayload(fifo, expectedBytes) {
  const reader = await fs.promises.open(fifo, fs.constants.O_RDONLY);
  try {
    const payload = Buffer.alloc(expectedBytes);
    let offset = 0;
    while (offset < payload.length) {
      const result = await reader.read(payload, offset, payload.length - offset);
      assert.notEqual(result.bytesRead, 0, "the broker closed before serving a complete payload");
      offset += result.bytesRead;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    const extra = await reader.read(Buffer.alloc(1), 0, 1);
    assert.equal(extra.bytesRead, 0, "one FIFO reader must receive exactly one auth JSON document");
    return payload;
  } finally {
    await reader.close();
    // Let the broker observe ENXIO before this test opens the next reader.
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

async function assertLaterBlockingReaderGetsNoBytes(fifo) {
  const reader = spawn("sh", ["-c", 'cat < "$1"', "sh", fifo], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = collect(reader.stdout);
  const stderr = collect(reader.stderr);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(reader.exitCode, null, "a blocking FIFO reader must still be waiting without a writer");
  assert.equal(stdout(), "", "a later reader must not recover previously served auth bytes");
  assert.equal(stderr(), "");
  reader.kill("SIGKILL");
  await waitForExit(reader);
}

async function testRepeatedServingAndCleanShutdown() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-auth-fifo-broker-"));
  try {
    const source = path.join(temp, "source-auth.json");
    const fifo = path.join(temp, "auth.json");
    const expected = Buffer.from(JSON.stringify({
      auth_mode: "test",
      token: "test-only-secret-that-must-not-be-logged",
    }));
    fs.writeFileSync(source, expected, { mode: 0o600 });

    const broker = startBroker(source, fifo);
    await waitForReady(broker.child, broker.stdout, broker.stderr);

    for (let delivery = 0; delivery < 3; delivery += 1) {
      assert.deepEqual(await readFramedPayload(fifo, expected.length), expected);
    }

    broker.child.kill("SIGTERM");
    assert.deepEqual(await waitForExit(broker.child), { code: 0, signal: null });
    assert.equal(broker.stdout(), READY_LINE, "the broker must not log delivery metadata or auth bytes");
    assert.equal(broker.stderr(), "");
    await assertLaterBlockingReaderGetsNoBytes(fifo);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

async function testParentDeathRevokesCredentialChannel() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-auth-fifo-broker-parent-death-"));
  let brokerPid = null;
  let wrapper = null;
  try {
    const source = path.join(temp, "source-auth.json");
    const fifo = path.join(temp, "auth.json");
    const pidFile = path.join(temp, "broker.pid");
    fs.writeFileSync(source, JSON.stringify({
      auth_mode: "test",
      token: "parent-death-test-secret",
    }), { mode: 0o600 });

    const wrapperSource = [
      'const fs = require("fs");',
      'const { spawn } = require("child_process");',
      'const child = spawn(process.execPath, process.argv.slice(1),',
      '  { stdio: ["pipe", "ignore", "ignore"] });',
      'fs.writeFileSync(process.env.BROKER_PID_FILE, String(child.pid));',
      'setInterval(() => {}, 1000);',
    ].join("\n");
    wrapper = spawn(process.execPath, [
      "-e", wrapperSource, BROKER, "--source", source, "--fifo", fifo,
    ], {
      env: { ...process.env, BROKER_PID_FILE: pidFile },
      stdio: ["ignore", "ignore", "ignore"],
    });

    await waitUntil(() => fs.existsSync(pidFile) && fs.existsSync(fifo));
    brokerPid = Number.parseInt(fs.readFileSync(pidFile, "utf8"), 10);
    assert.equal(Number.isInteger(brokerPid) && brokerPid > 0, true);
    assert.equal(processIsAlive(brokerPid), true, "broker must be alive before its parent dies");

    wrapper.kill("SIGKILL");
    assert.deepEqual(await waitForExit(wrapper), { code: null, signal: "SIGKILL" });
    wrapper = null;

    await waitUntil(() => !processIsAlive(brokerPid));
    await assertLaterBlockingReaderGetsNoBytes(fifo);
  } finally {
    if (wrapper && wrapper.exitCode === null && wrapper.signalCode === null) {
      wrapper.kill("SIGKILL");
      await waitForExit(wrapper).catch(() => {});
    }
    if (brokerPid && processIsAlive(brokerPid)) {
      try {
        process.kill(brokerPid, "SIGKILL");
      } catch {
        // The broker may have exited between the liveness check and cleanup.
      }
    }
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

async function testHardLinkedSourceIsRejected() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-auth-fifo-broker-link-"));
  try {
    const source = path.join(temp, "source-auth.json");
    const linked = path.join(temp, "linked-auth.json");
    const fifo = path.join(temp, "auth.json");
    fs.writeFileSync(source, "{}", { mode: 0o600 });
    fs.linkSync(source, linked);
    const broker = startBroker(source, fifo);
    const result = await waitForExit(broker.child);

    assert.equal(result.code, 2);
    assert.equal(broker.stdout(), "");
    assert.match(broker.stderr(), /exactly one hard link/);
    assert.equal(fs.existsSync(fifo), false, "unsafe source metadata must fail before creating a FIFO");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

async function testMalformedJsonDoesNotLeakSource() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-auth-fifo-broker-bad-"));
  try {
    const source = path.join(temp, "source-auth.json");
    const fifo = path.join(temp, "auth.json");
    const secret = "DO_NOT_LOG_THIS_TEST_SECRET";
    fs.writeFileSync(source, `{\"token\":\"${secret}\"`, { mode: 0o600 });
    const broker = startBroker(source, fifo);
    const result = await waitForExit(broker.child);

    assert.equal(result.code, 2);
    assert.equal(broker.stdout(), "");
    assert.match(broker.stderr(), /auth source is not valid JSON/);
    assert.doesNotMatch(broker.stderr(), new RegExp(secret));
    assert.equal(fs.existsSync(fifo), false, "invalid input must fail before creating a FIFO");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

async function main() {
  await testRepeatedServingAndCleanShutdown();
  await testParentDeathRevokesCredentialChannel();
  await testMalformedJsonDoesNotLeakSource();
  await testHardLinkedSourceIsRejected();
  console.log("codex auth FIFO broker self-test passed");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
