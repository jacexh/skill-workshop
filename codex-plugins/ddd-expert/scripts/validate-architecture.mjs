#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const arguments_ = process.argv.slice(2);
if (arguments_.length !== 1 || arguments_[0].startsWith("--")) {
  console.error("usage: validate-architecture.mjs <architecture.html>");
  process.exit(2);
}

const file = arguments_[0];
let source;
try {
  source = fs.readFileSync(file, "utf8");
} catch (error) {
  console.error(`unable to read Architecture: ${error.message}`);
  process.exit(2);
}

function invalid(message) {
  console.error(`invalid Architecture: ${message}`);
  process.exit(1);
}

const LAYER_OF_KIND = {
  application: "application",
  "event-handler": "application",
  "integration-message": "application",
  "query-repository": "application",
  "application-port": "application",
  "aggregate-root": "domain",
  "domain-service": "domain",
  "domain-port": "domain",
  "domain-event": "domain",
  repository: "domain",
  adapter: "infrastructure",
};

// Allowed dependency directions: source layer -> target layers.
const ALLOWED = {
  application: ["application", "domain"],
  domain: ["domain"],
  infrastructure: ["application", "domain"],
};

const CONTRACT_KINDS = ["repository", "query-repository", "domain-port", "application-port"];
// The application entry carries entry-point mechanisms such as Transport middleware.
const SEAM_KINDS = ["application", "adapter"];
const CHECKED_DOMAIN_KINDS = ["aggregate-root", "domain-service", "domain-port", "domain-event"];

const blocks = [...source.matchAll(
  /<script\s+type="application\/json"\s+id="architecture-data"\s*>([\s\S]*?)<\/script>/g,
)];
if (blocks.length !== 1) invalid('expected exactly one <script type="application/json" id="architecture-data"> block');

let data;
try {
  data = JSON.parse(blocks[0][1]);
} catch (error) {
  invalid(`data block is not valid JSON: ${error.message}`);
}

function text(value, label) {
  if (typeof value !== "string" || value.trim() === "") invalid(`${label} must be a non-empty string`);
  return value.trim();
}

function only(object, keys, label) {
  if (object === null || typeof object !== "object" || Array.isArray(object)) invalid(`${label} must be an object`);
  for (const key of Object.keys(object)) {
    if (!keys.includes(key)) invalid(`${label} has unknown field "${key}"`);
  }
}

only(data, ["context", "components", "dependencies", "mechanisms"], "data");
text(data.context, "context");
for (const key of ["components", "dependencies", "mechanisms"]) {
  if (!Array.isArray(data[key])) invalid(`${key} must be an array`);
}

const components = new Map();
data.components.forEach((component, index) => {
  const label = `component ${index + 1}`;
  only(component, ["id", "kind", "name", "note"], label);
  const id = text(component.id, `${label} id`);
  const kind = text(component.kind, `${label} kind`);
  text(component.name, `${label} name`);
  if (component.note !== undefined) text(component.note, `${label} note`);
  if (!LAYER_OF_KIND[kind]) invalid(`${label} has unknown kind "${kind}"`);
  if (components.has(id)) invalid(`duplicate component id "${id}"`);
  components.set(id, { ...component, layer: LAYER_OF_KIND[kind] });
});
if (components.size === 0) invalid("components must not be empty");

const edges = new Set();
data.dependencies.forEach((dependency, index) => {
  const label = `dependency ${index + 1}`;
  only(dependency, ["from", "to"], label);
  const from = components.get(text(dependency.from, `${label} from`));
  const to = components.get(text(dependency.to, `${label} to`));
  if (!from) invalid(`${label} references unknown component "${dependency.from}"`);
  if (!to) invalid(`${label} references unknown component "${dependency.to}"`);
  if (from.id === to.id) invalid(`${label} points to itself`);
  if (!ALLOWED[from.layer].includes(to.layer)) {
    invalid(`${label} ${from.id} -> ${to.id} points from ${from.layer} to ${to.layer}`);
  }
  const key = `${from.id}\u0000${to.id}`;
  if (edges.has(key)) invalid(`duplicate dependency ${from.id} -> ${to.id}`);
  edges.add(key);
});

// Every contract has an implementing adapter, and every adapter implements a contract.
const implemented = new Set();
const implementing = new Set();
for (const key of edges) {
  const [fromId, toId] = key.split("\u0000");
  if (components.get(fromId).kind === "adapter" && CONTRACT_KINDS.includes(components.get(toId).kind)) {
    implementing.add(fromId);
    implemented.add(toId);
  }
}
for (const component of components.values()) {
  if (CONTRACT_KINDS.includes(component.kind) && !implemented.has(component.id)) {
    invalid(`${component.kind} "${component.id}" has no implementing adapter`);
  }
  if (component.kind === "adapter" && !implementing.has(component.id)) {
    invalid(`adapter "${component.id}" implements no contract`);
  }
}

// An Integration Message is carried by exactly one owner, the component that translates it:
// the application entry that consumes it, the application-port that sends this context's
// Published Fact Contract, or an application-port adapter that maps intent to another
// context's Asynchronous Intent Contract.
const applicationPortAdapters = new Set([...edges].map((key) => key.split("\u0000"))
  .filter(([from, to]) => components.get(from).kind === "adapter" && components.get(to).kind === "application-port")
  .map(([from]) => from));
function carriesMessages(component) {
  return ["application", "application-port"].includes(component.kind) || applicationPortAdapters.has(component.id);
}
for (const component of components.values()) {
  if (component.kind !== "integration-message") continue;
  const touching = [...edges].map((key) => key.split("\u0000")).filter(([from, to]) => from === component.id || to === component.id);
  const owners = touching.filter(([from, to]) => to === component.id && carriesMessages(components.get(from)));
  if (owners.length !== 1 || touching.length !== 1) {
    invalid(`integration-message "${component.id}" needs exactly one dependency, from the application entry, an application-port, or an application-port adapter`);
  }
}

data.mechanisms.forEach((mechanism, index) => {
  const label = `mechanism ${index + 1}`;
  only(mechanism, ["name", "seam", "serves"], label);
  text(mechanism.name, `${label} name`);
  text(mechanism.serves, `${label} serves`);
  const seam = components.get(text(mechanism.seam, `${label} seam`));
  if (!seam) invalid(`${label} references unknown seam "${mechanism.seam}"`);
  if (!SEAM_KINDS.includes(seam.kind)) {
    invalid(`${label} sits on ${seam.kind} "${seam.id}"; a mechanism sits on the application entry or an adapter`);
  }
});

// Cross-check Domain names with the sibling domain-objects.md when it exists.
let domainCheck = "no domain-objects.md to cross-check";
const domainObjectsPath = path.join(path.dirname(file), "domain-objects.md");
if (fs.existsSync(domainObjectsPath)) {
  const accepted = new Map(CHECKED_DOMAIN_KINDS.map((kind) => [kind, new Set()]));
  const lines = fs.readFileSync(domainObjectsPath, "utf8").split(/\r?\n/);
  let field = null;
  for (const line of lines) {
    const heading = line.match(/^###\s+(.+?)\s+—\s+(Aggregate Root|Entity|Domain Service)\b/);
    if (heading) {
      if (heading[2] === "Aggregate Root") accepted.get("aggregate-root").add(heading[1].trim());
      if (heading[2] === "Domain Service") accepted.get("domain-service").add(heading[1].trim());
      field = null;
      continue;
    }
    const fieldMatch = line.match(/^-\s+\*\*(.+?):\*\*/);
    if (fieldMatch) {
      field = fieldMatch[1];
      continue;
    }
    const item = line.match(/^ {2}-\s+`([^`]+)`/);
    if (!item) continue;
    if (field === "Domain-owned Ports") accepted.get("domain-port").add(item[1].trim());
    if (field === "Domain Events") accepted.get("domain-event").add(item[1].trim());
  }

  for (const kind of CHECKED_DOMAIN_KINDS) {
    const drawn = new Set([...components.values()].filter((c) => c.kind === kind).map((c) => c.name.trim()));
    for (const name of drawn) {
      if (!accepted.get(kind).has(name)) invalid(`${kind} "${name}" is not in domain-objects.md`);
    }
    for (const name of accepted.get(kind)) {
      if (!drawn.has(name)) invalid(`${kind} "${name}" from domain-objects.md is not drawn`);
    }
  }
  domainCheck = "Domain names match domain-objects.md";
}

console.log(
  `valid Architecture: ${components.size} components, ${data.dependencies.length} dependencies, ` +
  `${data.mechanisms.length} mechanisms; ${domainCheck}`,
);
