#!/usr/bin/env node

import fs from "node:fs";

const arguments_ = process.argv.slice(2);
const allowLegacy = arguments_.includes("--allow-legacy");
const positionalArguments = arguments_.filter((argument) => argument !== "--allow-legacy");

if (positionalArguments.length !== 1 ||
    arguments_.some((argument) => argument.startsWith("--") && argument !== "--allow-legacy")) {
  console.error("usage: validate-context-map.mjs [--allow-legacy] <context-map.md>");
  process.exit(2);
}
const [path] = positionalArguments;

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

function parseLocalWireframe(context, localLines, expected, contextNames) {
  let first = 0;
  while (first < localLines.length && localLines[first].trim() === "") first += 1;
  let last = localLines.length - 1;
  while (last >= first && localLines[last].trim() === "") last -= 1;
  if (first > last || localLines[first] !== "```text" || localLines[last] !== "```") {
    invalid(`Local View for ${context} must contain exactly one canonical \`\`\`text wireframe`);
  }
  if (localLines.slice(0, first).some((line) => line.trim() !== "") ||
      localLines.slice(last + 1).some((line) => line.trim() !== "") ||
      localLines.slice(first + 1, last).some((line) => /^\s*(?:`{3,}|~{3,})/.test(line))) {
    invalid(`Local View for ${context} must contain exactly one canonical \`\`\`text wireframe`);
  }

  const diagram = localLines.slice(first + 1, last);
  if (diagram.length === 0 || diagram.some((line) => line.trim() === "" || /\t|\s$/.test(line))) {
    invalid(`Local View wireframe for ${context} cannot contain blank lines, tabs, or trailing whitespace`);
  }

  const width = Math.max(...diagram.map((line) => line.length));
  const grid = diagram.map((line) => [...line.padEnd(width, " ")]);
  const boxCells = new Map();
  const boxes = [];

  for (let row = 0; row + 2 < diagram.length; row += 1) {
    const topPattern = /\+(-{3,})\+/g;
    let match;
    while ((match = topPattern.exec(diagram[row])) !== null) {
      const start = match.index;
      const end = start + match[0].length - 1;
      const middle = diagram[row + 1].padEnd(width, " ");
      const bottom = diagram[row + 2].padEnd(width, " ");
      if (middle[start] !== "|" || middle[end] !== "|" ||
          bottom.slice(start, end + 1) !== match[0]) {
        continue;
      }
      const interior = middle.slice(start + 1, end);
      const name = interior.trim();
      if (!name || !interior.startsWith(" ") || !interior.endsWith(" ") || name.includes("|")) {
        invalid(`Local View for ${context} contains a malformed context box`);
      }
      const box = { name, top: row, middle: row + 1, bottom: row + 2, start, end };
      for (let boxRow = row; boxRow <= row + 2; boxRow += 1) {
        for (let column = start; column <= end; column += 1) {
          const key = `${boxRow},${column}`;
          if (boxCells.has(key)) invalid(`Local View for ${context} contains overlapping context boxes`);
          boxCells.set(key, box);
        }
      }
      boxes.push(box);
    }
  }

  if (boxes.length === 0) invalid(`Local View for ${context} must contain its current context box`);
  const boxNames = new Set();
  for (const box of boxes) {
    if (boxNames.has(box.name)) invalid(`duplicate Local View context box ${box.name} for ${context}`);
    if (!contextNames.has(box.name)) {
      invalid(`Local View for ${context} contains non-Global-View context box ${box.name}`);
    }
    boxNames.add(box.name);
  }
  if (!boxNames.has(context)) invalid(`Local View for ${context} must center the current context box ${context}`);
  const expectedNeighborNames = new Set([...expected].map((relationship) => {
    const [edge] = relationship.split(":");
    const [source, target] = edge.split("->");
    return source === context ? target : source;
  }));
  for (const box of boxes) {
    if (box.name !== context && !expectedNeighborNames.has(box.name)) {
      invalid(`Local View for ${context} contains non-neighbor context box ${box.name}`);
    }
  }

  const connectorDirections = new Map([
    ["-", [[0, -1], [0, 1]]],
    ["|", [[-1, 0], [1, 0]]],
    ["+", [[-1, 0], [1, 0], [0, -1], [0, 1]]],
    [">", [[0, -1], [0, 1]]],
  ]);
  const oppositeDirection = new Map([
    ["-1,0", "1,0"],
    ["1,0", "-1,0"],
    ["0,-1", "0,1"],
    ["0,1", "0,-1"],
  ]);
  const connectorCells = new Map();
  for (let row = 0; row < grid.length; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const key = `${row},${column}`;
      if (boxCells.has(key) || grid[row][column] === " ") continue;
      if (!connectorDirections.has(grid[row][column])) {
        invalid(`Local View wireframe for ${context} contains unsupported character ${grid[row][column]}`);
      }
      connectorCells.set(key, { row, column, character: grid[row][column] });
    }
  }

  const attachments = new Map();
  for (const cell of connectorCells.values()) {
    for (const [rowDelta, columnDelta] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const neighborBox = boxCells.get(`${cell.row + rowDelta},${cell.column + columnDelta}`);
      if (!neighborBox) continue;
      let side = null;
      if (cell.row === neighborBox.middle && cell.column === neighborBox.start - 1 &&
          rowDelta === 0 && columnDelta === 1) {
        side = "target";
        if (cell.character !== ">") {
          invalid(`Local View arrow into ${neighborBox.name} must end with canonical --> syntax`);
        }
      } else if (cell.row === neighborBox.middle && cell.column === neighborBox.end + 1 &&
          rowDelta === 0 && columnDelta === -1) {
        side = "source";
        if (cell.character !== "-") {
          invalid(`Local View arrow out of ${neighborBox.name} must start with canonical --> syntax`);
        }
      } else {
        invalid(`Local View connector touches ${neighborBox.name} outside the box centerline`);
      }
      const key = `${cell.row},${cell.column}`;
      if (attachments.has(key)) invalid(`Local View connector ambiguously touches multiple context boxes`);
      attachments.set(key, { box: neighborBox, side });
    }
  }

  function connectorNeighbors(cell) {
    const neighbors = [];
    for (const [rowDelta, columnDelta] of connectorDirections.get(cell.character)) {
      const neighbor = connectorCells.get(`${cell.row + rowDelta},${cell.column + columnDelta}`);
      if (!neighbor) continue;
      const reverse = oppositeDirection.get(`${rowDelta},${columnDelta}`);
      if (connectorDirections.get(neighbor.character).some(
        ([candidateRow, candidateColumn]) => `${candidateRow},${candidateColumn}` === reverse,
      )) {
        neighbors.push(neighbor);
      }
    }
    return neighbors;
  }

  const actual = new Set();
  const attachmentCounts = new Map(boxes.map((box) => [box.name, 0]));
  const remaining = new Set(connectorCells.keys());
  while (remaining.size > 0) {
    const startKey = remaining.values().next().value;
    const stack = [connectorCells.get(startKey)];
    const component = [];
    remaining.delete(startKey);
    while (stack.length > 0) {
      const cell = stack.pop();
      component.push(cell);
      for (const neighbor of connectorNeighbors(cell)) {
        const key = `${neighbor.row},${neighbor.column}`;
        if (!remaining.delete(key)) continue;
        stack.push(neighbor);
      }
    }

    const componentAttachments = [];
    const seenAttachments = new Set();
    const arrowKeys = new Set();
    for (const cell of component) {
      const key = `${cell.row},${cell.column}`;
      if (cell.character === ">") arrowKeys.add(key);
      const attachment = attachments.get(key);
      if (!attachment) continue;
      const attachmentKey = `${attachment.box.name}:${attachment.side}`;
      if (seenAttachments.has(attachmentKey)) continue;
      seenAttachments.add(attachmentKey);
      componentAttachments.push(attachment);
      attachmentCounts.set(attachment.box.name, attachmentCounts.get(attachment.box.name) + 1);
    }
    if (componentAttachments.length === 0) {
      invalid(`Local View for ${context} contains a dangling connector`);
    }
    const sources = componentAttachments.filter(({ side }) => side === "source").map(({ box }) => box.name);
    const targets = componentAttachments.filter(({ side }) => side === "target").map(({ box }) => box.name);
    const targetArrowKeys = new Set(componentAttachments
      .filter(({ side }) => side === "target")
      .map(({ box }) => `${box.middle},${box.start - 1}`));
    if (sources.length === 0 || targets.length === 0 || !sameSet(arrowKeys, targetArrowKeys)) {
      invalid(`Local View for ${context} contains a malformed directed connector component`);
    }
    if (targets.length === 1 && targets[0] === context && !sources.includes(context)) {
      for (const source of sources) actual.add(`${source}->${context}:U`);
    } else if (sources.length === 1 && sources[0] === context && !targets.includes(context)) {
      for (const target of targets) actual.add(`${context}->${target}:D`);
    } else {
      invalid(`Local View for ${context} must use the current context as the merge or fork center`);
    }
  }

  for (const box of boxes) {
    const count = attachmentCounts.get(box.name);
    if (box.name !== context && count !== 1) {
      invalid(`Local View neighbor ${box.name} must connect directly to ${context} exactly once`);
    }
    if (box.name === context && expected.size > 0 && count === 0) {
      invalid(`Local View for ${context} must connect its current context box`);
    }
  }
  if (expected.size === 0 && (boxes.length !== 1 || connectorCells.size !== 0)) {
    invalid(`isolated Local View for ${context} must contain only its current context box`);
  }
  if (!sameSet(actual, expected)) {
    invalid(`Local View for ${context} must contain exactly its direct Global View neighbors`);
  }
}

const canonicalSource = canonicalInlineMarkdown(source);
if (/[\u2190-\u21ff\u2794-\u27bf\u27f0-\u27ff\u2900-\u297f\u2b00-\u2b11\u2b30-\u2b4c\u2b60-\u2b73\u2b76-\u2b95\u2ba0-\u2bb8\u{1f800}-\u{1f8ff}]/u.test(canonicalSource)) {
  invalid("bidirectional or non-canonical Unicode arrows are forbidden; use canonical ASCII -> syntax");
}
if (/<(?:-+|=+)>|[↔↭↮↹⇄⇆⇋⇌⇎⇔⇿⟷⟺⤄⥂⥄⥊⥋⥎⥐⥦⬄⬌]|(?:[←⇐⟵⟸]\s*[→⇒⟶⟹]|[→⇒⟶⟹]\s*[←⇐⟵⟸])/u.test(canonicalSource)) {
  invalid("bidirectional arrows such as <->, <-->, or ↔ are forbidden");
}
if (/^## Relationships\s*$/m.test(source)) {
  invalid("legacy ## Relationships is unsupported; use ## Model Dependency Contracts");
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
  "Downstream reliance",
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
const dependencyContractsStart = allLines.findIndex(
  (line) => line === "## Model Dependency Contracts",
);
const h2Headings = allLines.filter((line) => /^## /.test(line));
const expectedH2Headings = [
  "## Global View",
  "## Bounded Contexts",
  "## Model Dependency Contracts",
];
if (h2Headings.length !== expectedH2Headings.length ||
    h2Headings.some((heading, index) => heading !== expectedH2Headings[index])) {
  invalid(
    "expected exactly ## Global View, ## Bounded Contexts, and " +
    "## Model Dependency Contracts in that order",
  );
}
if (allLines.slice(1, globalStart).some((line) => line.trim() !== "")) {
  invalid("only blank lines may appear between # Context Map and ## Global View");
}

const globalEnd = boundedStart;
const globalLines = allLines.slice(globalStart + 1, globalEnd);
const directionStatement = "Arrow direction: `U -> D` (Upstream model/published-contract influence -> Downstream model). It does not describe runtime call flow.";

function parseViewEnvelope(viewName, lines, statement, absoluteSectionStart) {
  const directionLines = lines.filter((line) => line.startsWith("Arrow direction:"));
  if (directionLines.length !== 1 || directionLines[0] !== statement) {
    invalid(`${viewName} must contain exactly one canonical Arrow direction statement`);
  }

  const mermaidStarts = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (/^```mermaid\s*$/.test(lines[index])) mermaidStarts.push(index);
  }
  if (mermaidStarts.length !== 1) {
    invalid(`${viewName} must contain exactly one Mermaid graph LR block`);
  }
  const start = mermaidStarts[0];
  const end = lines.findIndex(
    (line, index) => index > start && /^```\s*$/.test(line),
  );
  if (end < 0) invalid(`${viewName} Mermaid graph LR block is not closed`);

  for (let index = 0; index < lines.length; index += 1) {
    if (index >= start && index <= end) continue;
    const line = lines[index];
    if (line.trim() === "" || line === statement) continue;
    invalid(`unsupported ${viewName} content outside Mermaid graph: ${line.trim()}`);
  }

  return {
    start,
    end,
    graphLines: lines.slice(start + 1, end),
    absoluteStart: absoluteSectionStart + 1 + start,
    absoluteEnd: absoluteSectionStart + 1 + end,
  };
}

const globalEnvelope = parseViewEnvelope("Global View", globalLines, directionStatement, globalStart);
const mermaidRanges = [globalEnvelope];
let continuationOpen = false;
let localTextFenceOpen = false;
for (let index = 0; index < allLines.length; index += 1) {
  const line = allLines[index];
  const outsideMermaid = !mermaidRanges.some(
    ({ absoluteStart, absoluteEnd }) => index >= absoluteStart && index <= absoluteEnd,
  );
  if (outsideMermaid && line === "```text") {
    if (localTextFenceOpen) invalid("nested Local View text code fences are unsupported");
    localTextFenceOpen = true;
    continuationOpen = false;
    continue;
  }
  if (outsideMermaid && line === "```" && localTextFenceOpen) {
    localTextFenceOpen = false;
    continue;
  }
  if (localTextFenceOpen) {
    if (/^\s*(?:`{3,}|~{3,})/.test(line)) {
      invalid("only one canonical text fence is supported in each Local View");
    }
    continue;
  }
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
  if (mermaidRanges.some(({ absoluteStart }) => index === absoluteStart) && line === "```mermaid") continue;
  if (mermaidRanges.some(({ absoluteEnd }) => index === absoluteEnd) && line === "```") continue;
  invalid("only the canonical Global View Mermaid and optional Local View text code fences are supported");
}
if (localTextFenceOpen) invalid("Local View text code fence is not closed");

const graphLines = globalEnvelope.graphLines;
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

const contextLines = allLines.slice(boundedStart + 1, dependencyContractsStart);
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

for (const [context, lines] of contexts) {
  const allowedSections = new Set(["#### Local View"]);
  const sectionHeadings = lines.filter((line) => /^#### /.test(line));
  for (const heading of sectionHeadings) {
    if (!allowedSections.has(heading)) {
      invalid(`${context} contains unsupported context section ${heading}`);
    }
  }
  const firstSection = lines.findIndex((line) => /^#### /.test(line));
  const preamble = lines.slice(0, firstSection < 0 ? lines.length : firstSection);
  for (const line of preamble) {
    if (line.trim() === "" || /^ {1,5}[^ \t]/.test(line) ||
        /^- \*\*(?:Core responsibility|Business authority|Model):\*\* \S/.test(line)) {
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
  const modelPrefix = "- **Model:**";
  const modelFields = lines.filter((line) => line.startsWith(modelPrefix));
  const model = modelFields.length === 1
    ? modelFields[0].match(
      /^- \*\*Model:\*\* \[([^\]\r\n]+)\]\(context\/[a-z0-9]+(?:[-_][a-z0-9]+)*\/model\.md\)$/,
    )
    : null;
  if (model === null || model[1] !== context) {
    invalid(
      `${context} must declare exactly one matching Model link at context/<context-slug>/model.md`,
    );
  }

  const localHeadingCount = lines.filter((line) => line === "#### Local View").length;
  if (localHeadingCount > 1) invalid(`Local View may appear at most once for ${context}`);
  if (localHeadingCount === 1) {
    const expected = expectedLocal.get(context);
    parseLocalWireframe(
      context,
      sectionLines(lines, "#### Local View", 4),
      expected,
      new Set(contexts.keys()),
    );
  }
}

function parseGlobalDetails(start, end, sectionName, requiredLabels, optionalLabels = []) {
  const lines = allLines.slice(start + 1, end);
  const entries = [];
  const names = new Set();
  let index = 0;
  while (index < lines.length && lines[index].trim() === "") index += 1;

  while (index < lines.length) {
    const heading = lines[index].match(/^### ([^#].*)$/);
    if (!heading) {
      invalid(`${sectionName} must contain only canonical ### detail sections`);
    }
    const name = heading[1].trim();
    if (!hasRenderedText(name)) invalid(`${sectionName} contains an empty detail name`);
    assertSupportedCollaborationSemantics(name);
    if (names.has(name)) invalid(`${sectionName} contains duplicate detail name ${name}`);
    names.add(name);

    let next = index + 1;
    while (next < lines.length && !/^### [^#]/.test(lines[next])) next += 1;
    const detailLines = lines.slice(index + 1, next);
    const allowedLabels = new Set([...requiredLabels, ...optionalLabels]);
    const values = new Map();
    for (const line of detailLines) {
      if (line.trim() === "" || /^ {1,5}[^ \t]/.test(line)) continue;
      const field = line.match(/^- \*\*([^*]+):\*\* (.*)$/);
      if (!field || !allowedLabels.has(field[1])) {
        invalid(`${sectionName} detail ${name} contains unsupported field: ${line.trim()}`);
      }
      if (values.has(field[1])) {
        invalid(`${sectionName} detail ${name} must declare ${field[1]} exactly once`);
      }
      if (!hasRenderedText(field[2])) {
        invalid(`${sectionName} detail ${name} must declare non-empty ${field[1]}`);
      }
      values.set(field[1], field[2].trim());
    }
    for (const label of requiredLabels) {
      if (!values.has(label)) {
        invalid(`${sectionName} detail ${name} must declare ${label} exactly once`);
      }
    }
    for (const label of optionalLabels) {
      if (values.has(label)) assertSupportedCollaborationSemantics(values.get(label));
    }
    entries.push({ name, values });
    index = next;
    while (index < lines.length && lines[index].trim() === "") index += 1;
  }
  return entries;
}

const dependencyDetails = parseGlobalDetails(
  dependencyContractsStart,
  allLines.length,
  "Model Dependency Contracts",
  [
    "Upstream",
    "Downstream",
    "Published meaning",
    "Downstream reliance",
    "Local translation",
    "Guarantee",
  ],
  ["Collaboration pattern"],
);

const coveredDependencyEdges = new Set();
for (const detail of dependencyDetails) {
  const upstream = detail.values.get("Upstream");
  const downstream = detail.values.get("Downstream");
  const upstreamId = labelToId.get(upstream);
  const downstreamId = labelToId.get(downstream);
  const graphEdge = upstreamId && downstreamId ? `${upstreamId}->${downstreamId}` : null;
  if (graphEdge === null || !edgeKeys.has(graphEdge)) {
    invalid(
      `Model Dependency Contracts detail ${detail.name} endpoints ` +
      `${upstream} -> ${downstream} are absent from Global View`,
    );
  }
  coveredDependencyEdges.add(graphEdge);
}
for (const [upstreamId, downstreamId] of edges) {
  if (!coveredDependencyEdges.has(`${upstreamId}->${downstreamId}`)) {
    invalid(
      `Model Dependency Contracts detail is missing for ` +
      `${nodes.get(upstreamId)} -> ${nodes.get(downstreamId)}`,
    );
  }
}

console.log(`valid Context Map: ${nodes.size} contexts, ${edges.length} dependencies`);
