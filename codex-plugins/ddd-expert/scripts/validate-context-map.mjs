#!/usr/bin/env node

import fs from "node:fs";

const arguments_ = process.argv.slice(2);
const positional = arguments_.filter((argument) => argument !== "--allow-legacy");
const unknownOptions = arguments_.filter(
  (argument) => argument.startsWith("--") && argument !== "--allow-legacy",
);

if (positional.length !== 1 || unknownOptions.length > 0) {
  console.error("usage: validate-context-map.mjs [--allow-legacy] <context-map.md>");
  process.exit(2);
}

let source;
try {
  source = fs.readFileSync(positional[0], "utf8");
} catch (error) {
  console.error(`unable to read Context Map: ${error.message}`);
  process.exit(2);
}

function invalid(message) {
  console.error(`invalid Context Map: ${message}`);
  process.exit(1);
}

function plain(value) {
  return value
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function section(lines, heading) {
  const indexes = lines
    .map((line, index) => line.trim() === heading ? index : -1)
    .filter((index) => index >= 0);
  if (indexes.length !== 1) invalid(`expected exactly one ${heading} section`);

  const start = indexes[0] + 1;
  let end = lines.length;
  for (let index = start; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end);
}

function splitRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  return trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
}

function parseTable(lines, expectedHeaders, label) {
  const meaningful = lines.filter((line) => line.trim() !== "");
  if (meaningful.length < 2) invalid(`${label} must contain a Markdown table`);

  const headers = splitRow(meaningful[0]);
  const delimiter = splitRow(meaningful[1]);
  if (!headers || headers.join("\u0000") !== expectedHeaders.join("\u0000")) {
    invalid(`${label} headers must be: ${expectedHeaders.join(" | ")}`);
  }
  if (!delimiter || delimiter.length !== headers.length ||
      delimiter.some((cell) => !/^:?-{3,}:?$/.test(cell))) {
    invalid(`${label} must contain a valid Markdown table delimiter`);
  }

  return meaningful.slice(2).map((line, rowIndex) => {
    const cells = splitRow(line);
    if (!cells || cells.length !== headers.length) {
      invalid(`${label} row ${rowIndex + 1} must contain exactly ${headers.length} cells`);
    }
    if (cells.some((cell) => plain(cell) === "")) {
      invalid(`${label} row ${rowIndex + 1} contains an empty cell`);
    }
    return cells;
  });
}

const lines = source.replace(/\r\n/g, "\n").split("\n");
const levelOneHeadings = lines
  .filter((line) => /^#\s+/.test(line))
  .map((line) => line.trim());
const firstContent = lines.find((line) => line.trim() !== "")?.trim();
if (levelOneHeadings.length !== 1 || levelOneHeadings[0] !== "# Context Map" ||
    firstContent !== "# Context Map") {
  invalid("expected exactly one # Context Map heading and no preamble");
}
const levelTwoHeadings = lines
  .filter((line) => /^##\s+/.test(line))
  .map((line) => line.trim());
const expectedHeadings = ["## Bounded Contexts", "## Semantic Dependencies"];
if (levelTwoHeadings.join("\u0000") !== expectedHeadings.join("\u0000")) {
  invalid("expected exactly ## Bounded Contexts then ## Semantic Dependencies");
}
const titleIndex = lines.findIndex((line) => line.trim() === "# Context Map");
const contextsIndex = lines.findIndex((line) => line.trim() === "## Bounded Contexts");
if (lines.slice(titleIndex + 1, contextsIndex).some((line) => line.trim() !== "")) {
  invalid("Context Map may contain only its heading and two tables");
}

if (/\b(?:Partnership|Shared Kernel)\b|<->|↔/iu.test(source)) {
  invalid("only one-way semantic dependencies are supported");
}
if (/^```(?:mermaid|text)?\s*$/mu.test(source)) {
  invalid("Context Map must not contain diagrams");
}

const contextRows = parseTable(
  section(lines, "## Bounded Contexts"),
  ["Bounded Context", "Purpose", "Model"],
  "Bounded Contexts",
);
if (contextRows.length === 0) invalid("at least one Bounded Context is required");

const contexts = new Set();
for (const [rawName, rawPurpose, rawModel] of contextRows) {
  const name = plain(rawName);
  if (contexts.has(name)) invalid(`duplicate Bounded Context ${name}`);
  contexts.add(name);

  if (plain(rawPurpose).length < 3) invalid(`Bounded Context ${name} needs a purpose`);
  const model = rawModel.match(/^\[([^\]]+)\]\((context\/([a-z0-9]+(?:-[a-z0-9]+)*)\/model\.md)\)$/);
  if (!model) invalid(`Bounded Context ${name} needs one context/<slug>/model.md link`);
  if (plain(model[1]) === "") invalid(`Bounded Context ${name} has an empty Model link label`);
}

const dependencyRows = parseTable(
  section(lines, "## Semantic Dependencies"),
  ["Upstream", "Downstream", "Published contract", "Downstream use"],
  "Semantic Dependencies",
);

const dependencies = [];
const dependencyKeys = new Set();
for (const [rawUpstream, rawDownstream, rawContract] of dependencyRows) {
  const upstream = plain(rawUpstream);
  const downstream = plain(rawDownstream);
  const contract = plain(rawContract);

  if (!contexts.has(upstream) || !contexts.has(downstream)) {
    invalid(`dependency ${upstream} -> ${downstream} names an unknown Bounded Context`);
  }
  if (upstream === downstream) invalid(`self dependency ${upstream} -> ${downstream} is unsupported`);

  const key = `${upstream}\u0000${downstream}\u0000${contract}`;
  if (dependencyKeys.has(key)) {
    invalid(`duplicate dependency ${upstream} -> ${downstream} for ${contract}`);
  }
  dependencyKeys.add(key);
  dependencies.push([upstream, downstream]);
}

const adjacency = new Map([...contexts].map((context) => [context, []]));
for (const [upstream, downstream] of dependencies) adjacency.get(upstream).push(downstream);

const visiting = new Set();
const visited = new Set();
function visit(context) {
  if (visiting.has(context)) invalid("semantic dependencies must be acyclic");
  if (visited.has(context)) return;
  visiting.add(context);
  for (const downstream of adjacency.get(context)) visit(downstream);
  visiting.delete(context);
  visited.add(context);
}
for (const context of contexts) visit(context);

console.log(`valid Context Map: ${contexts.size} contexts, ${dependencies.length} dependencies`);
