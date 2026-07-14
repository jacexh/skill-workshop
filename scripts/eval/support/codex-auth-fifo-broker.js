#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const MAX_AUTH_BYTES = 64 * 1024;
const RETRY_DELAY_MS = 10;
const READY_LINE = "codex-auth-fifo-ready\n";

let stopping = false;
let activePayload = null;

function stop() {
  stopping = true;
  if (activePayload) activePayload.fill(0);
  if (!process.stdin.destroyed) process.stdin.destroy();
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("SIGPIPE", () => {});
process.stdin.on("end", stop);
process.stdin.on("close", stop);
process.stdin.on("error", stop);
process.stdin.resume();

function fail(message) {
  const error = new Error(message);
  error.safe = true;
  throw error;
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (!["--source", "--fifo"].includes(option) || values.has(option)) {
      fail("usage: codex-auth-fifo-broker.js --source <auth.json> --fifo <path>");
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      fail(`${option} requires a path`);
    }
    values.set(option, value);
    index += 1;
  }
  if (values.size !== 2) {
    fail("usage: codex-auth-fifo-broker.js --source <auth.json> --fifo <path>");
  }
  return {
    source: path.resolve(values.get("--source")),
    fifo: path.resolve(values.get("--fifo")),
  };
}

function sameFile(before, after) {
  return before.dev === after.dev &&
    before.ino === after.ino &&
    before.size === after.size &&
    before.mtimeMs === after.mtimeMs &&
    before.ctimeMs === after.ctimeMs;
}

function readBoundedAuth(source) {
  const flags = fs.constants.O_RDONLY |
    (fs.constants.O_CLOEXEC || 0) |
    (fs.constants.O_NOFOLLOW || 0);
  let descriptor;
  try {
    descriptor = fs.openSync(source, flags);
    const before = fs.fstatSync(descriptor);
    if (!before.isFile()) fail("auth source must be a regular file");
    if (before.nlink !== 1) fail("auth source must have exactly one hard link");
    if (before.size <= 0 || before.size > MAX_AUTH_BYTES) {
      fail(`auth source must contain 1-${MAX_AUTH_BYTES} bytes`);
    }
    if ((before.mode & 0o077) !== 0) {
      fail("auth source must not be accessible by group or other users");
    }

    const payload = Buffer.allocUnsafe(before.size);
    let offset = 0;
    while (offset < payload.length) {
      const bytesRead = fs.readSync(descriptor, payload, offset, payload.length - offset, offset);
      if (bytesRead === 0) fail("auth source changed while being read");
      offset += bytesRead;
    }
    const after = fs.fstatSync(descriptor);
    if (!sameFile(before, after)) fail("auth source changed while being read");

    let parsed;
    try {
      parsed = JSON.parse(payload.toString("utf8"));
    } catch {
      payload.fill(0);
      fail("auth source is not valid JSON");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      payload.fill(0);
      fail("auth source must contain a JSON object");
    }
    return payload;
  } catch (error) {
    if (error.safe) throw error;
    fail(`cannot read auth source (${error.code || "unknown error"})`);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function createPrivateFifo(fifo) {
  const parent = path.dirname(fifo);
  let parentStat;
  try {
    parentStat = fs.lstatSync(parent);
  } catch (error) {
    fail(`cannot inspect FIFO parent (${error.code || "unknown error"})`);
  }
  if (!parentStat.isDirectory() || fs.realpathSync(parent) !== parent) {
    fail("FIFO parent must be a real directory, not a symbolic link");
  }
  if ((parentStat.mode & 0o022) !== 0) {
    fail("FIFO parent must not be writable by group or other users");
  }
  if (fs.lstatSync(fifo, { throwIfNoEntry: false })) {
    fail("FIFO path already exists");
  }

  const created = spawnSync("mkfifo", ["-m", "600", "--", fifo], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (created.error || created.status !== 0) fail("cannot create FIFO");

  const fifoStat = fs.lstatSync(fifo);
  if (!fifoStat.isFIFO()) fail("created auth path is not a FIFO");
  fs.chmodSync(fifo, 0o600);
  return { dev: fifoStat.dev, ino: fifoStat.ino };
}

function delay() {
  return new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
}

function retryable(error) {
  return ["EAGAIN", "EINTR", "ENXIO", "EWOULDBLOCK"].includes(error.code);
}

function isExpectedFifo(stat, expected) {
  return stat.isFIFO() && stat.dev === expected.dev && stat.ino === expected.ino;
}

async function tryOpenWriter(fifo, expected) {
  let pathStat;
  try {
    pathStat = await fs.promises.lstat(fifo);
  } catch (error) {
    fail(`cannot inspect FIFO (${error.code || "unknown error"})`);
  }
  if (!isExpectedFifo(pathStat, expected)) fail("FIFO path changed after creation");

  const flags = fs.constants.O_WRONLY |
    fs.constants.O_NONBLOCK |
    (fs.constants.O_CLOEXEC || 0) |
    (fs.constants.O_NOFOLLOW || 0);
  let writer;
  try {
    writer = await fs.promises.open(fifo, flags);
  } catch (error) {
    if (error.code === "ENXIO") return { kind: "no-reader" };
    if (retryable(error)) return { kind: "retry" };
    fail(`cannot open FIFO (${error.code || "unknown error"})`);
  }
  const openedStat = await writer.stat();
  if (!isExpectedFifo(openedStat, expected)) {
    await writer.close().catch(() => {});
    fail("FIFO changed while being opened");
  }
  return { kind: "writer", writer };
}

async function openWaitingWriter(fifo, expected) {
  while (!stopping) {
    const result = await tryOpenWriter(fifo, expected);
    if (result.kind === "writer") return result.writer;
    await delay();
  }
  return null;
}

async function waitForReaderGap(fifo, expected) {
  while (!stopping) {
    const result = await tryOpenWriter(fifo, expected);
    if (result.kind === "no-reader") return;
    if (result.kind === "writer") await result.writer.close().catch(() => {});
    await delay();
  }
}

async function serve(fifo, expected, payload) {
  while (!stopping) {
    const writer = await openWaitingWriter(fifo, expected);
    if (!writer) return;
    try {
      let offset = 0;
      while (!stopping && offset < payload.length) {
        try {
          const result = await writer.write(payload, offset, payload.length - offset);
          if (result.bytesWritten === 0) fail("FIFO write made no progress");
          offset += result.bytesWritten;
        } catch (error) {
          if (error.code === "EPIPE") break;
          if (!retryable(error)) fail(`cannot write FIFO (${error.code || "unknown error"})`);
          await delay();
        }
      }
    } finally {
      await writer.close().catch(() => {});
    }
    await waitForReaderGap(fifo, expected);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const payload = readBoundedAuth(options.source);
  activePayload = payload;
  try {
    const fifoIdentity = createPrivateFifo(options.fifo);
    process.stdout.write(READY_LINE);
    await serve(options.fifo, fifoIdentity, payload);
  } finally {
    payload.fill(0);
    if (activePayload === payload) activePayload = null;
  }
}

main().catch((error) => {
  stop();
  const message = error.safe ? error.message : "unexpected broker failure";
  process.stderr.write(`codex auth FIFO broker: ${message}\n`);
  process.exitCode = 2;
});
