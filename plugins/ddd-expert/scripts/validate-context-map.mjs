#!/usr/bin/env node

import fs from "node:fs";

const path = process.argv[2];

if (!path || process.argv.length !== 3) {
  console.error("usage: validate-context-map.mjs <context-map.md>");
  process.exit(2);
}

let source;
try {
  source = fs.readFileSync(path, "utf8");
} catch (error) {
  console.error(`unable to read Context Map: ${error.message}`);
  process.exit(2);
}

function invalid(message) {
  console.error(`invalid Context Map: ${message}`);
  process.exit(1);
}

function sameSet(left, right) {
  return left.size === right.size && [...left].every((item) => right.has(item));
}

function sectionLines(lines, heading, stopLevel) {
  const start = lines.findIndex((line) => line === heading);
  if (start < 0) return null;
  const prefix = "#".repeat(stopLevel);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith(`${prefix} `)) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end);
}

if (/<-+>/.test(source)) {
  invalid("bidirectional arrows such as <-> or <--> are forbidden");
}
if (/\bPartnership\b/i.test(source)) {
  invalid("Partnership is unsupported by the ddd-expert DAG House Rule");
}
if (/\bShared[ -]+Kernel\b/i.test(source)) {
  invalid("Shared Kernel is unsupported by the ddd-expert DAG House Rule");
}
if (/^## Relationships\s*$/m.test(source)) {
  invalid("legacy ## Relationships is unsupported; project contracts into each context");
}

const allLines = source.split(/\r?\n/);
const globalStart = allLines.findIndex((line) => line === "## Global View");
const boundedStart = allLines.findIndex((line) => line === "## Bounded Contexts");
if (globalStart < 0 || boundedStart < 0 || boundedStart <= globalStart) {
  invalid("expected one ## Global View followed by one ## Bounded Contexts");
}
if (allLines.filter((line) => line === "## Global View").length !== 1 ||
    allLines.filter((line) => line === "## Bounded Contexts").length !== 1) {
  invalid("Global View and Bounded Contexts headings must be unique");
}

const globalLines = allLines.slice(globalStart + 1, boundedStart);
const graphStart = globalLines.findIndex((line) => /^\s*graph LR\s*$/.test(line));
if (graphStart < 0) invalid("Global View must contain a Mermaid graph LR");

const nodes = new Map();
const labelToId = new Map();
const edges = [];
let inGraph = false;
for (const line of globalLines) {
  if (/^```mermaid\s*$/.test(line)) {
    inGraph = true;
    continue;
  }
  if (inGraph && /^```\s*$/.test(line)) {
    inGraph = false;
    continue;
  }
  if (!inGraph || /^\s*(?:graph LR)?\s*$/.test(line)) continue;

  const node = line.match(/^\s*([a-z][a-z0-9_]*)\["([^"]+)"\]\s*$/);
  if (node) {
    const [, id, label] = node;
    if (nodes.has(id) || labelToId.has(label)) {
      invalid(`Global View contains duplicate node ${label}`);
    }
    nodes.set(id, label);
    labelToId.set(label, id);
    continue;
  }

  const edge = line.match(/^\s*([a-z][a-z0-9_]*)\s*-->\s*([a-z][a-z0-9_]*)\s*$/);
  if (edge) {
    edges.push([edge[1], edge[2]]);
    continue;
  }

  invalid(`unsupported Global View graph line: ${line.trim()}`);
}

if (nodes.size === 0) invalid("Global View must declare at least one Bounded Context");

const edgeKeys = new Set();
for (const [upstreamId, downstreamId] of edges) {
  if (!nodes.has(upstreamId) || !nodes.has(downstreamId)) {
    invalid(`Global View edge ${upstreamId} -> ${downstreamId} has an unknown endpoint`);
  }
  const key = `${upstreamId}->${downstreamId}`;
  if (edgeKeys.has(key)) invalid(`Global View contains duplicate edge ${key}`);
  edgeKeys.add(key);
  if (upstreamId === downstreamId) invalid(`self-loop ${key} is forbidden`);
}

for (const [upstreamId, downstreamId] of edges) {
  if (edgeKeys.has(`${downstreamId}->${upstreamId}`)) {
    invalid(`reciprocal dependency ${nodes.get(upstreamId)} <-> ${nodes.get(downstreamId)} is forbidden`);
  }
}

const outgoing = new Map([...nodes.keys()].map((id) => [id, []]));
for (const [upstreamId, downstreamId] of edges) {
  outgoing.get(upstreamId).push(downstreamId);
}
const visiting = new Set();
const visited = new Set();
function visit(id) {
  if (visiting.has(id)) return false;
  if (visited.has(id)) return true;
  visiting.add(id);
  for (const next of outgoing.get(id)) {
    if (!visit(next)) return false;
  }
  visiting.delete(id);
  visited.add(id);
  return true;
}
for (const id of nodes.keys()) {
  if (!visit(id)) invalid("cycle detected; the Context Map must remain a DAG");
}

const contextLines = allLines.slice(boundedStart + 1);
const contexts = new Map();
for (let index = 0; index < contextLines.length; index += 1) {
  const match = contextLines[index].match(/^### ([^#].*)$/);
  if (!match) continue;
  const name = match[1].trim();
  let end = contextLines.length;
  for (let cursor = index + 1; cursor < contextLines.length; cursor += 1) {
    if (/^### [^#]/.test(contextLines[cursor]) || /^## [^#]/.test(contextLines[cursor])) {
      end = cursor;
      break;
    }
  }
  if (contexts.has(name)) invalid(`duplicate Bounded Context section ${name}`);
  contexts.set(name, contextLines.slice(index + 1, end));
  index = end - 1;
}

if (!sameSet(new Set(nodes.values()), new Set(contexts.keys()))) {
  invalid("Global View nodes and Bounded Context sections must match exactly");
}

const expectedLocal = new Map([...contexts.keys()].map((name) => [name, new Set()]));
for (const [upstreamId, downstreamId] of edges) {
  const upstream = nodes.get(upstreamId);
  const downstream = nodes.get(downstreamId);
  expectedLocal.get(upstream).add(`${upstream}->${downstream}:D`);
  expectedLocal.get(downstream).add(`${upstream}->${downstream}:U`);
}

const upstreamContracts = [];
const downstreamContracts = [];

function parseContracts(context, lines, heading, endpointLabel, target) {
  const body = sectionLines(lines, heading, 4);
  if (body === null) return;
  for (let index = 0; index < body.length; index += 1) {
    const contract = body[index].match(/^##### ([^#].*)$/);
    if (!contract) continue;
    const name = contract[1].trim();
    let end = body.length;
    for (let cursor = index + 1; cursor < body.length; cursor += 1) {
      if (/^##### [^#]/.test(body[cursor])) {
        end = cursor;
        break;
      }
    }
    const endpointPattern = new RegExp(`^- \\*\\*${endpointLabel}:\\*\\* (.+)$`);
    const endpointLine = body.slice(index + 1, end).find((line) => endpointPattern.test(line));
    if (!endpointLine) invalid(`contract projection ${context}/${name} is missing ${endpointLabel}`);
    const endpoint = endpointLine.match(endpointPattern)[1].trim();
    target.push({ context, endpoint, name });
    index = end - 1;
  }
}

for (const [context, lines] of contexts) {
  if (!lines.some((line) => /^- \*\*Core responsibility:\*\* \S/.test(line)) ||
      !lines.some((line) => /^- \*\*Business authority:\*\* \S/.test(line))) {
    invalid(`${context} must declare Core responsibility and Business authority`);
  }

  const localLines = sectionLines(lines, "#### Local View", 4);
  if (localLines === null) invalid(`Local View is missing for ${context}`);
  const actualLocal = new Set();
  let noDependencies = false;
  for (const line of localLines) {
    if (line === "- No context dependencies.") {
      noDependencies = true;
      continue;
    }
    const item = line.match(/^- `(.+)`$/);
    if (!item) continue;
    const upstream = item[1].match(/^(.+) \[U\] -> (.+)$/);
    const downstream = item[1].match(/^(.+) -> (.+) \[D\]$/);
    if (upstream && upstream[2] === context) {
      actualLocal.add(`${upstream[1]}->${context}:U`);
    } else if (downstream && downstream[1] === context) {
      actualLocal.add(`${context}->${downstream[2]}:D`);
    } else {
      invalid(`Local View for ${context} contains a malformed or non-local edge ${item[1]}`);
    }
  }
  const expected = expectedLocal.get(context);
  if ((noDependencies && expected.size > 0) || (!noDependencies && expected.size === 0) ||
      !sameSet(actualLocal, expected)) {
    invalid(`Local View for ${context} must contain exactly its direct Global View neighbors`);
  }

  parseContracts(context, lines, "#### Upstream Dependencies", "Upstream", upstreamContracts);
  parseContracts(context, lines, "#### Downstream Contracts", "Downstream", downstreamContracts);
}

const contractKey = (upstream, downstream, name) => `${upstream}->${downstream}::${name}`;
const upstreamKeys = new Set();
for (const entry of upstreamContracts) {
  const key = `${entry.endpoint}->${entry.context}`;
  const upstreamId = labelToId.get(entry.endpoint);
  const downstreamId = labelToId.get(entry.context);
  if (!upstreamId || !downstreamId || !edgeKeys.has(`${upstreamId}->${downstreamId}`)) {
    invalid(`contract projection ${key}/${entry.name} is absent from Global View`);
  }
  upstreamKeys.add(contractKey(entry.endpoint, entry.context, entry.name));
}

const downstreamKeys = new Set();
for (const entry of downstreamContracts) {
  const key = `${entry.context}->${entry.endpoint}`;
  const upstreamId = labelToId.get(entry.context);
  const downstreamId = labelToId.get(entry.endpoint);
  if (!upstreamId || !downstreamId || !edgeKeys.has(`${upstreamId}->${downstreamId}`)) {
    invalid(`contract projection ${key}/${entry.name} is absent from Global View`);
  }
  downstreamKeys.add(contractKey(entry.context, entry.endpoint, entry.name));
}

if (!sameSet(upstreamKeys, downstreamKeys)) {
  invalid("contract projection names and endpoints must match on upstream and downstream sides");
}

for (const [upstreamId, downstreamId] of edges) {
  const prefix = `${nodes.get(upstreamId)}->${nodes.get(downstreamId)}::`;
  if (![...upstreamKeys].some((key) => key.startsWith(prefix))) {
    invalid(`contract projection is missing for ${nodes.get(upstreamId)} -> ${nodes.get(downstreamId)}`);
  }
}

console.log(`valid Context Map: ${nodes.size} contexts, ${edges.length} dependencies`);
