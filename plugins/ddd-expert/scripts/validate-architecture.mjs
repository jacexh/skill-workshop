#!/usr/bin/env node
// Validate one context's architecture.md contract catalog and, unless a draft is checked
// against --artifacts, that its committed architecture.html equals a fresh render.

import fs from "node:fs";
import path from "node:path";
import { SECTIONS, loadArtifacts, plain, renderCatalog } from "./render-architecture.mjs";

const usage = "usage: validate-architecture.mjs <architecture.md> [--artifacts <context-dir>]";
const argv = process.argv.slice(2);
let artifactsDir = null;
const positional = [];
for (let index = 0; index < argv.length; index += 1) {
  if (argv[index] === "--artifacts" && argv[index + 1]) artifactsDir = argv[++index];
  else if (argv[index].startsWith("--")) { console.error(usage); process.exit(2); }
  else positional.push(argv[index]);
}
if (positional.length !== 1) { console.error(usage); process.exit(2); }

const file = positional[0];
if (!fs.existsSync(file)) {
  console.error(`unable to read Architecture: ${file} does not exist`);
  process.exit(2);
}

function invalid(message) {
  console.error(`invalid Architecture: ${message}`);
  process.exit(1);
}

let artifacts;
try {
  artifacts = loadArtifacts(file, artifactsDir);
} catch (error) {
  invalid(error.message);
}
const { catalog, model, owners, map } = artifacts;

if (model && model.name && model.name !== catalog.context) {
  invalid(`heading names "${catalog.context}" but model.md names "${model.name}"`);
}

// History stays out of the artifact, and existing code is never a reason.
const source = fs.readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "");
const issue = source.match(/(?:^|[\s(])#\d+\b|github\.com\/[^\s)]+\/(?:issues|pull)\/\d+/m);
if (issue) invalid(`cites issue or pull request "${issue[0].trim()}"; state the delivery constraint or project decision instead`);

const NAME_COLUMN = Object.fromEntries(SECTIONS.map((section) => [section.title, section.headers[0]]));
const catalogNames = new Map();
for (const section of SECTIONS) {
  catalog[section.title].forEach((row, index) => {
    const name = plain(row[NAME_COLUMN[section.title]]);
    const label = `${section.title} row ${index + 1}`;
    if (section.title !== "Mechanisms") {
      if (catalogNames.has(name)) invalid(`${label} repeats the name "${name}"`);
      catalogNames.set(name, section.title);
    }
    if (row.Reason !== undefined && /\b(?:existing|current|legacy)\s+(?:code|implementation)\b/i.test(plain(row.Reason))) {
      invalid(`${label} "${name}" takes its Reason from existing code; name an accepted source`);
    }
  });
}

// Each mechanism seam resolves to the Application entry, a cataloged row, a Root's Repository,
// a Domain-owned Port, or the subscriber of a context in the Context Map.
const seams = new Set(["Application", ...catalogNames.keys()]);
const roots = owners ? owners.filter((owner) => owner.kind === "Aggregate Root").map((owner) => owner.name)
  : (model ? model.roots : []);
for (const root of roots) seams.add(`${root}Repository`);
for (const owner of owners || []) for (const port of owner.ports) seams.add(port);
for (const subscriber of map ? map.consumed : []) seams.add(subscriber.name);
catalog.Mechanisms.forEach((mechanism, index) => {
  const seam = plain(mechanism.Seam);
  if (!seams.has(seam)) {
    invalid(`Mechanisms row ${index + 1} sits on unknown seam "${seam}"; use Application, a cataloged row, a Root's Repository, a Domain-owned Port, or a Context Map subscriber`);
  }
});

let view = "draft checked against " + (artifactsDir || "its directory") + "; view not compared";
if (!artifactsDir) {
  const viewPath = path.join(path.dirname(file), "architecture.html");
  if (!fs.existsSync(viewPath)) invalid("architecture.html is missing; run render-architecture.mjs");
  if (fs.readFileSync(viewPath, "utf8") !== renderCatalog(file)) {
    invalid("architecture.html differs from a fresh render; run render-architecture.mjs");
  }
  view = "architecture.html is current";
}

const counts = SECTIONS.map((section) => `${section.title} ${catalog[section.title].length}`).join(", ");
const sources = [model ? "model.md" : null, owners ? "domain-objects.md" : null, map ? "context-map.md" : null].filter(Boolean);
console.log(`valid Architecture: ${counts}; seams resolved against ${sources.length ? sources.join(", ") : "the catalog only"}; ${view}`);
