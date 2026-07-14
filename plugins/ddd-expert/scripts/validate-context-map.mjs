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
if (source.includes("<!--")) {
  invalid("HTML comments are unsupported in a materialized Context Map");
}
if (source.split(/\r?\n/).some((line) => /^\s{0,3}<[/?A-Za-z!]/.test(line))) {
  invalid("raw HTML blocks are unsupported in a materialized Context Map");
}

function canonicalAtxHeading(line) {
  const match = line.match(/^[ \t]{0,3}(#{1,6})[ \t]+(.*)$/);
  if (!match) return null;
  let text = match[2].replace(/[ \t]+$/, "");
  text = text.replace(/[ \t]+#+[ \t]*$/, "");
  return `${match[1]} ${text}`;
}

for (const line of allLines) {
  if (/^[ \t]{0,3}>/.test(line)) {
    invalid("blockquotes are unsupported in a materialized Context Map");
  }
  if (/^[ \t]{0,3}(?:[-+*]|[0-9]{1,9}[.)])[ \t]+#{1,6}(?:[ \t]|$)/.test(line)) {
    invalid("list-nested headings are unsupported; use canonical top-level ATX headings");
  }
  if (/^[ \t]{0,3}(?:[-+*]|[0-9]{1,9}[.)])[ \t]+(?:>|[-+*][ \t]|[0-9]{1,9}[.)][ \t]|`{3,}|~{3,}|<)/.test(line)) {
    invalid("nested Markdown containers are unsupported in a materialized Context Map");
  }
  if (/^[ \t]{0,3}(?:=+|-+)[ \t]*$/.test(line)) {
    invalid("Setext headings and thematic breaks are unsupported; use canonical ATX headings");
  }
  const canonical = canonicalAtxHeading(line);
  if (canonical !== null && line !== canonical) {
    invalid(`use canonical ATX heading syntax without extra spacing or closing hashes: ${line}`);
  }
  if (canonical !== null) {
    const headingText = canonical.replace(/^#{1,6} /, "");
    const entity = /&(?:#[0-9]+|#[xX][0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]+);/;
    if (/\t| {2,}/.test(headingText)) {
      invalid(`use single-space ATX heading text without tabs: ${line}`);
    }
    if (/[*_`[\]<>\\~]/.test(headingText) || entity.test(headingText)) {
      invalid(`plain-text ATX headings cannot contain inline Markdown, HTML, or entities: ${line}`);
    }
  }
}

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
const directionStatement = "Arrow direction: `U -> D` (Upstream model/published-contract influence -> Downstream model). It does not describe runtime call flow.";
const directionLines = globalLines.filter((line) => line.startsWith("Arrow direction:"));
if (directionLines.length !== 1 || directionLines[0] !== directionStatement) {
  invalid("Global View must contain exactly one canonical Arrow direction statement");
}

const mermaidStarts = [];
for (let index = 0; index < globalLines.length; index += 1) {
  if (/^```mermaid\s*$/.test(globalLines[index])) mermaidStarts.push(index);
}
if (mermaidStarts.length !== 1) {
  invalid("Global View must contain exactly one Mermaid graph LR block");
}
const mermaidStart = mermaidStarts[0];
const mermaidEnd = globalLines.findIndex(
  (line, index) => index > mermaidStart && /^```\s*$/.test(line),
);
if (mermaidEnd < 0) invalid("Global View Mermaid graph LR block is not closed");

const absoluteMermaidStart = globalStart + 1 + mermaidStart;
const absoluteMermaidEnd = globalStart + 1 + mermaidEnd;
for (let index = 0; index < allLines.length; index += 1) {
  if ((index < absoluteMermaidStart || index > absoluteMermaidEnd) &&
      /^[ \t]+\S/.test(allLines[index])) {
    invalid(`indentation outside the Mermaid graph is unsupported: ${allLines[index].trim()}`);
  }
  if (!/^\s*(?:`{3,}|~{3,})/.test(allLines[index])) continue;
  if (index === absoluteMermaidStart && allLines[index] === "```mermaid") continue;
  if (index === absoluteMermaidEnd && allLines[index] === "```") continue;
  invalid("only the canonical Global View Mermaid code fence is supported");
}

for (let index = 0; index < globalLines.length; index += 1) {
  if (index >= mermaidStart && index <= mermaidEnd) continue;
  const line = globalLines[index];
  if (line.trim() === "" || line === directionStatement) continue;
  invalid(`unsupported Global View content outside Mermaid graph: ${line.trim()}`);
}

const graphLines = globalLines.slice(mermaidStart + 1, mermaidEnd);
const graphDeclarations = graphLines
  .map((line, index) => (/^\s*graph LR\s*$/.test(line) ? index : -1))
  .filter((index) => index >= 0);
const firstGraphLine = graphLines.findIndex((line) => line.trim() !== "");
if (graphDeclarations.length !== 1 || graphDeclarations[0] !== firstGraphLine) {
  invalid("Global View must contain exactly one Mermaid graph LR as the first nonblank block line");
}

const nodes = new Map();
const labelToId = new Map();
const edges = [];
for (let index = graphDeclarations[0] + 1; index < graphLines.length; index += 1) {
  const line = graphLines[index];
  if (line.trim() === "") continue;

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

function parseContracts(context, lines, heading, endpointLabel, semanticLabels, target) {
  const headingCount = lines.filter((line) => line === heading).length;
  if (headingCount > 1) invalid(`duplicate ${heading} section for ${context}`);
  const body = sectionLines(lines, heading, 4);
  if (body === null) return;
  for (let index = 0; index < body.length; index += 1) {
    const contract = body[index].match(/^##### ([^#].*)$/);
    if (!contract) {
      if (body[index].trim() !== "") {
        invalid(`contract projection section ${context}/${heading} contains unsupported content: ${body[index].trim()}`);
      }
      continue;
    }
    const name = contract[1].trim();
    let end = body.length;
    for (let cursor = index + 1; cursor < body.length; cursor += 1) {
      if (/^##### [^#]/.test(body[cursor])) {
        end = cursor;
        break;
      }
    }
    const contractLines = body.slice(index + 1, end);
    const endpointLines = contractLines.filter((line) => /^- \*\*(?:Upstream|Downstream):\*\*/.test(line));
    const endpointPattern = new RegExp(`^- \\*\\*${endpointLabel}:\\*\\* (\\S.*)$`);
    if (endpointLines.length !== 1 || !endpointPattern.test(endpointLines[0])) {
      invalid(`contract projection ${context}/${name} must declare exactly one non-empty ${endpointLabel}`);
    }
    const endpoint = endpointLines[0].match(endpointPattern)[1].trim();
    for (const label of semanticLabels) {
      const prefix = `- **${label}:**`;
      const semanticLines = contractLines.filter((line) => line.startsWith(prefix));
      if (semanticLines.length !== 1 || semanticLines[0].slice(prefix.length).trim() === "") {
        invalid(`contract semantics ${context}/${name} must declare exactly one non-empty ${label}`);
      }
    }
    target.push({ context, endpoint, name });
    index = end - 1;
  }
}

for (const [context, lines] of contexts) {
  if (!lines.some((line) => /^- \*\*Core responsibility:\*\* \S/.test(line)) ||
      !lines.some((line) => /^- \*\*Business authority:\*\* \S/.test(line))) {
    invalid(`${context} must declare Core responsibility and Business authority`);
  }

  const localHeadingCount = lines.filter((line) => line === "#### Local View").length;
  if (localHeadingCount !== 1) invalid(`Local View must appear exactly once for ${context}`);
  const localLines = sectionLines(lines, "#### Local View", 4);
  const actualLocal = new Set();
  let noDependencies = false;
  for (const line of localLines) {
    if (line.trim() === "") continue;
    if (line === "- No context dependencies.") {
      if (noDependencies) invalid(`duplicate Local View no-dependencies marker for ${context}`);
      noDependencies = true;
      continue;
    }
    const item = line.match(/^- `(.+)`$/);
    if (!item) invalid(`Local View for ${context} contains unsupported content: ${line.trim()}`);
    const upstream = item[1].match(/^(.+) \[U\] -> (.+)$/);
    const downstream = item[1].match(/^(.+) -> (.+) \[D\]$/);
    let key;
    if (upstream && upstream[2] === context) {
      key = `${upstream[1]}->${context}:U`;
    } else if (downstream && downstream[1] === context) {
      key = `${context}->${downstream[2]}:D`;
    } else {
      invalid(`Local View for ${context} contains a malformed or non-local edge ${item[1]}`);
    }
    if (actualLocal.has(key)) invalid(`duplicate Local View edge ${item[1]} for ${context}`);
    actualLocal.add(key);
  }
  const expected = expectedLocal.get(context);
  if ((noDependencies && actualLocal.size > 0) ||
      (noDependencies && expected.size > 0) || (!noDependencies && expected.size === 0) ||
      !sameSet(actualLocal, expected)) {
    invalid(`Local View for ${context} must contain exactly its direct Global View neighbors`);
  }

  parseContracts(
    context,
    lines,
    "#### Upstream Dependencies",
    "Upstream",
    ["Accepted meaning", "Local translation"],
    upstreamContracts,
  );
  parseContracts(
    context,
    lines,
    "#### Downstream Contracts",
    "Downstream",
    ["Published meaning", "Guarantee"],
    downstreamContracts,
  );
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
  const projectionKey = contractKey(entry.endpoint, entry.context, entry.name);
  if (upstreamKeys.has(projectionKey)) invalid(`duplicate contract projection ${projectionKey}`);
  upstreamKeys.add(projectionKey);
}

const downstreamKeys = new Set();
for (const entry of downstreamContracts) {
  const key = `${entry.context}->${entry.endpoint}`;
  const upstreamId = labelToId.get(entry.context);
  const downstreamId = labelToId.get(entry.endpoint);
  if (!upstreamId || !downstreamId || !edgeKeys.has(`${upstreamId}->${downstreamId}`)) {
    invalid(`contract projection ${key}/${entry.name} is absent from Global View`);
  }
  const projectionKey = contractKey(entry.context, entry.endpoint, entry.name);
  if (downstreamKeys.has(projectionKey)) invalid(`duplicate contract projection ${projectionKey}`);
  downstreamKeys.add(projectionKey);
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
