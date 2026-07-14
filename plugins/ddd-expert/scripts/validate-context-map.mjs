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

const namedCharacterReferences = new Map([
  ["amp", "&"],
  ["gt", ">"],
  ["lt", "<"],
  ["nbsp", " "],
  ["hyphen", "-"],
  ["minus", "-"],
]);

function isBidirectionalNamedArrowReference(name) {
  const normalized = name.toLowerCase();
  return normalized.includes("leftright") ||
    normalized.includes("rightleft") ||
    normalized === "leftarrowrightarrow" ||
    normalized === "rightarrowleftarrow" ||
    /^(?:x?harr|iff|(?:lr|rl)(?:arr|har)|(?:reverse)?equilibrium)$/.test(normalized);
}

function decodeOneWayNamedArrowReference(name) {
  const normalized = name.toLowerCase();
  if (/^(?:x?larr|(?:long|short)?leftarrow)$/.test(normalized)) return "←";
  if (/^(?:x?rarr|(?:long|short)?rightarrow)$/.test(normalized)) return "→";
  return null;
}

function decodeCharacterReferences(value) {
  return value.replace(
    /&(#(?:[xX][0-9A-Fa-f]+|[0-9]+)|[A-Za-z][A-Za-z0-9]+);/g,
    (reference, name) => {
      if (!name.startsWith("#")) {
        if (isBidirectionalNamedArrowReference(name)) return "↔";
        const oneWayArrow = decodeOneWayNamedArrowReference(name);
        if (oneWayArrow !== null) return oneWayArrow;
        return namedCharacterReferences.get(name.toLowerCase()) ?? reference;
      }
      const hexadecimal = name[1] === "x" || name[1] === "X";
      const codePoint = Number.parseInt(name.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      if (!Number.isSafeInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff ||
          (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        return reference;
      }
      return String.fromCodePoint(codePoint);
    },
  );
}

function canonicalInlineMarkdown(value) {
  let canonical = decodeCharacterReferences(value)
    .normalize("NFKC")
    .replace(/\p{Default_Ignorable_Code_Point}/gu, "")
    .replace(/[\u2010-\u2015\u2212]/gu, "-")
    .replace(/!?\[([^\]\r\n]*)\]\((?:\\.|[^)\r\n])*\)/g, "$1")
    .replace(/!?\[([^\]\r\n]*)\]\[[^\]\r\n]*\]/g, "$1")
    .replace(/<\/?[A-Za-z][^>\r\n]*>/g, "");
  for (let depth = 0; depth < 8; depth += 1) {
    const stripped = canonical.replace(
      /(?<!\\)(\*{1,3}|_{1,3}|~{2}|`+)([^\r\n]*?)(?<!\\)\1/g,
      "$2",
    );
    if (stripped === canonical) break;
    canonical = stripped;
  }
  return canonical;
}

function renderedPlainText(value) {
  return canonicalInlineMarkdown(value)
    .replace(/&(?:#[0-9]+|#[xX][0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]+);/g, " ")
    .replace(/[*_`~[\](){}<>\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasRenderedText(value) {
  return /[\p{L}\p{N}]/u.test(renderedPlainText(value));
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

const canonicalSource = canonicalInlineMarkdown(source);
if (/[\u2190-\u21ff\u2794-\u27bf\u27f0-\u27ff\u2900-\u297f\u2b00-\u2b11\u2b30-\u2b4c\u2b60-\u2b73\u2b76-\u2b95\u2ba0-\u2bb8\u{1f800}-\u{1f8ff}]/u.test(canonicalSource)) {
  invalid("bidirectional or non-canonical Unicode arrows are forbidden; use canonical ASCII -> syntax");
}
if (/<(?:-+|=+)>|[↔↭↮↹⇄⇆⇋⇌⇎⇔⇿⟷⟺⤄⥂⥄⥊⥋⥎⥐⥦⬄⬌]|(?:[←⇐⟵⟸]\s*[→⇒⟶⟹]|[→⇒⟶⟹]\s*[←⇐⟵⟸])/u.test(canonicalSource)) {
  invalid("bidirectional arrows such as <->, <-->, or ↔ are forbidden");
}
if (/^## Relationships\s*$/m.test(source)) {
  invalid("legacy ## Relationships is unsupported; project contracts into each context");
}

const allLines = source.split(/\r?\n/);
if (allLines[0] !== "# Context Map" || allLines.filter((line) => line === "# Context Map").length !== 1) {
  invalid("expected exactly one # Context Map title as the first line");
}
if (source.includes("<!--")) {
  invalid("HTML comments are unsupported in a materialized Context Map");
}
if (allLines.some((line) => /^\s{0,3}<[/?A-Za-z!]/.test(line))) {
  invalid("raw HTML blocks are unsupported in a materialized Context Map");
}

const semanticFieldLabels = new Set([
  "Core responsibility",
  "Business authority",
  "Accepted meaning",
  "Local translation",
  "Published meaning",
  "Guarantee",
  "Collaboration pattern",
]);

function collaborationSemanticMode(label) {
  if (/\b(?:relationship|collaboration|context map|pattern)\b/i.test(label)) return "strict";
  return semanticFieldLabels.has(label) ? "business-prose" : null;
}

function assertSupportedCollaborationSemantics(value, mode = "strict") {
  const plain = renderedPlainText(value);
  const unsupported = plain.match(/\b(?:Partnerships?|Shared(?:[\s/_.-]*)Kernels?)\b/i);
  const explicitPattern = /\b(?:form(?:s|ed|ing)?|collaborat(?:e|es|ed|ing)\s+as|operat(?:e|es|ed|ing)\s+as|work(?:s|ed|ing)?\s+as|share(?:s|d|ing)?|jointly\s+own(?:s|ed|ing)?)\s+(?:an?\s+)?(?:Partnerships?|Shared(?:[\s/_.-]*)Kernels?)\b/i.test(plain) ||
    /\b(?:is|are|was|were)\s+(?:in\s+)?an?\s+Partnership\b/i.test(plain) ||
    /(?:构成|形成|结成|属于|是)(?:一个|一种)?\s*Partnerships?/iu.test(plain) ||
    /(?:共同拥有|共享|共用)\s*Shared(?:[\s/_.-]*)Kernels?/iu.test(plain);
  if (unsupported && (mode === "strict" || explicitPattern)) {
    invalid(`${unsupported[0]} is unsupported by the ddd-expert DAG House Rule`);
  }
}

function canonicalAtxHeading(line) {
  const match = line.match(/^[ \t]{0,3}(#{1,6})[ \t]+(.*)$/);
  if (!match) return null;
  let text = match[2].replace(/[ \t]+$/, "");
  text = text.replace(/[ \t]+#+[ \t]*$/, "");
  return `${match[1]} ${text}`;
}

let continuedSemanticValue = null;
let continuedSemanticMode = null;
for (const line of allLines) {
  if (/^ {1,5}(?:(?:[-+*]|[0-9]{1,9}[.)])[ \t]+)?\*\*[^*]+:\*\*(?:[ \t]|$)/.test(line)) {
    invalid("indented structured fields are unsupported; use canonical top-level fields");
  }
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

  const structuredField = line.match(/^- \*\*([^*]+):\*\* (.*)$/);
  if (structuredField) {
    continuedSemanticMode = collaborationSemanticMode(structuredField[1]);
    continuedSemanticValue = continuedSemanticMode !== null
      ? structuredField[2]
      : null;
    if (continuedSemanticValue !== null) {
      assertSupportedCollaborationSemantics(continuedSemanticValue, continuedSemanticMode);
    }
    continue;
  }
  if (line.trim() === "") continue;
  if (continuedSemanticValue !== null && /^ {1,5}[^ \t]/.test(line)) {
    continuedSemanticValue += ` ${line.trim()}`;
    assertSupportedCollaborationSemantics(continuedSemanticValue, continuedSemanticMode);
    continue;
  }
  continuedSemanticValue = null;
  continuedSemanticMode = null;
}

const globalStart = allLines.findIndex((line) => line === "## Global View");
const boundedStart = allLines.findIndex((line) => line === "## Bounded Contexts");
const h2Headings = allLines.filter((line) => /^## /.test(line));
if (h2Headings.length !== 2 ||
    h2Headings[0] !== "## Global View" ||
    h2Headings[1] !== "## Bounded Contexts") {
  invalid("expected exactly ## Global View followed by ## Bounded Contexts");
}
if (allLines.slice(1, globalStart).some((line) => line.trim() !== "")) {
  invalid("only blank lines may appear between # Context Map and ## Global View");
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
let continuationOpen = false;
for (let index = 0; index < allLines.length; index += 1) {
  const line = allLines[index];
  const outsideMermaid = index < absoluteMermaidStart || index > absoluteMermaidEnd;
  if (outsideMermaid && /^[ \t]+\S/.test(line)) {
    const trimmed = line.trimStart();
    const hidesStructure = /^(?:#{1,6}(?:[ \t]|$)|>|(?:[-+*]|[0-9]{1,9}[.)])[ \t]+|`{3,}|~{3,}|<)/.test(trimmed);
    const ordinaryContinuation = /^ {1,5}[^ \t]/.test(line) && continuationOpen && !hidesStructure;
    if (!ordinaryContinuation) {
      invalid(`indentation outside the Mermaid graph is unsupported: ${line.trim()}`);
    }
    continuationOpen = true;
  } else if (outsideMermaid) {
    continuationOpen = /^- \*\*[^*]+:\*\* \S/.test(line);
  }
  if (!/^\s*(?:`{3,}|~{3,})/.test(line)) continue;
  if (index === absoluteMermaidStart && line === "```mermaid") continue;
  if (index === absoluteMermaidEnd && line === "```") continue;
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

  const node = line.match(/^\s*([a-z][a-z0-9]*(?:_[a-z0-9]+)*)\["([^"]+)"\]\s*$/);
  if (node) {
    const [, id, label] = node;
    if (nodes.has(id) || labelToId.has(label)) {
      invalid(`Global View contains duplicate node ${label}`);
    }
    nodes.set(id, label);
    labelToId.set(label, id);
    continue;
  }

  const edge = line.match(/^\s*([a-z][a-z0-9]*(?:_[a-z0-9]+)*)\s*-->\s*([a-z][a-z0-9]*(?:_[a-z0-9]+)*)\s*$/);
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
const firstContextHeading = contextLines.findIndex((line) => /^### /.test(line));
if (firstContextHeading < 0 || contextLines.slice(0, firstContextHeading).some((line) => line.trim() !== "")) {
  invalid("Bounded Contexts must begin with a canonical ### context section");
}
const contexts = new Map();
for (let index = 0; index < contextLines.length; index += 1) {
  const match = contextLines[index].match(/^### ([^#].*)$/);
  if (!match) continue;
  const name = match[1].trim();
  let end = contextLines.length;
  for (let cursor = index + 1; cursor < contextLines.length; cursor += 1) {
    if (/^### [^#]/.test(contextLines[cursor])) {
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
if (contextLines.filter((line) => /^### /.test(line)).length !== contexts.size) {
  invalid("Bounded Contexts contains an unsupported or malformed ### section");
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
    assertSupportedCollaborationSemantics(name);
    let end = body.length;
    for (let cursor = index + 1; cursor < body.length; cursor += 1) {
      if (/^##### [^#]/.test(body[cursor])) {
        end = cursor;
        break;
      }
    }
    const contractLines = body.slice(index + 1, end);
    const allowedFields = new Set([endpointLabel, ...semanticLabels, "Collaboration pattern"]);
    for (const line of contractLines) {
      if (line.trim() === "" || /^ {1,5}[^ \t]/.test(line)) continue;
      const field = line.match(/^- \*\*([^*]+):\*\* (.*)$/);
      if (!field || !allowedFields.has(field[1])) {
        invalid(`contract projection ${context}/${name} contains unsupported contract field: ${line.trim()}`);
      }
    }
    const endpointLines = contractLines.filter((line) => /^- \*\*(?:Upstream|Downstream):\*\*/.test(line));
    const endpointPattern = new RegExp(`^- \\*\\*${endpointLabel}:\\*\\* (\\S.*)$`);
    if (endpointLines.length !== 1 || !endpointPattern.test(endpointLines[0]) ||
        !hasRenderedText(endpointLines[0].match(endpointPattern)?.[1] || "")) {
      invalid(`contract projection ${context}/${name} must declare exactly one non-empty ${endpointLabel}`);
    }
    const endpoint = endpointLines[0].match(endpointPattern)[1].trim();
    for (const label of semanticLabels) {
      const prefix = `- **${label}:**`;
      const semanticLines = contractLines.filter((line) => line.startsWith(prefix));
      if (semanticLines.length !== 1 || !hasRenderedText(semanticLines[0].slice(prefix.length))) {
        invalid(`contract semantics ${context}/${name} must declare exactly one non-empty ${label}`);
      }
    }
    const collaborationPrefix = "- **Collaboration pattern:**";
    const collaborationLines = contractLines.filter((line) => line.startsWith(collaborationPrefix));
    if (collaborationLines.length > 1 ||
        (collaborationLines.length === 1 && !hasRenderedText(collaborationLines[0].slice(collaborationPrefix.length)))) {
      invalid(`contract projection ${context}/${name} must declare at most one non-empty Collaboration pattern`);
    }
    target.push({ context, endpoint, name });
    index = end - 1;
  }
}

for (const [context, lines] of contexts) {
  const allowedSections = new Set([
    "#### Local View",
    "#### Upstream Dependencies",
    "#### Downstream Contracts",
  ]);
  const sectionHeadings = lines.filter((line) => /^#### /.test(line));
  for (const heading of sectionHeadings) {
    if (!allowedSections.has(heading)) {
      invalid(`${context} contains unsupported context section ${heading}`);
    }
  }
  const sectionRank = new Map([
    ["#### Local View", 0],
    ["#### Upstream Dependencies", 1],
    ["#### Downstream Contracts", 2],
  ]);
  for (let index = 1; index < sectionHeadings.length; index += 1) {
    if (sectionRank.get(sectionHeadings[index]) < sectionRank.get(sectionHeadings[index - 1])) {
      invalid(`${context} context sections must follow Local View, Upstream Dependencies, Downstream Contracts order`);
    }
  }
  const firstSection = lines.findIndex((line) => /^#### /.test(line));
  const preamble = lines.slice(0, firstSection < 0 ? lines.length : firstSection);
  for (const line of preamble) {
    if (line.trim() === "" || /^ {1,5}[^ \t]/.test(line) ||
        /^- \*\*(?:Core responsibility|Business authority):\*\* \S/.test(line)) {
      continue;
    }
    invalid(`${context} contains unsupported context content: ${line.trim()}`);
  }
  for (const label of ["Core responsibility", "Business authority"]) {
    const prefix = `- **${label}:**`;
    const fields = lines.filter((line) => line.startsWith(prefix));
    if (fields.length !== 1 || !hasRenderedText(fields[0].slice(prefix.length))) {
      invalid(`${context} must declare exactly one non-empty ${label}`);
    }
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
