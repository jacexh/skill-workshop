#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const arguments_ = process.argv.slice(2);
if (arguments_.length !== 1 || arguments_[0].startsWith("--")) {
  console.error("usage: validate-model.mjs <model.md>");
  process.exit(2);
}

const file = arguments_[0];
let source;
try {
  source = fs.readFileSync(file, "utf8");
} catch (error) {
  console.error(`unable to read Model: ${error.message}`);
  process.exit(2);
}

// An error is a name that resolves nowhere: the artifacts contradict each other.
// A note is a gap that review must judge: the artifacts may still be correct.
const errors = [];
const notes = [];

function plain(value) {
  return value
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function linesOf(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "").split(/\r?\n/);
}

function quoted(text) {
  return [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim());
}

// A clause or an Invariant follows the artifact writing contract: one sentence of at most
// 25 words.
const MAX_WORDS = 25;
function checkSentence(text, label) {
  const words = plain(text).split(/\s+/).filter(Boolean).length;
  const sentences = plain(text).split(/[.!?](?:\s+|$)/).filter((part) => part.trim() !== "").length;
  if (words === 0 || words > MAX_WORDS || sentences > 1) {
    errors.push(`${label} must be one sentence of at most ${MAX_WORDS} words`);
  }
}

// Model: the `- **Name:** ...` entries under one `## ` section, each with its `### ` group
// and the clauses under it.
function entries(lines, heading, label) {
  const found = new Map();
  let inside = false;
  let group = "";
  let name = null;
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      inside = line.trim() === heading;
      group = "";
      name = null;
      continue;
    }
    if (!inside) continue;
    const groupMatch = line.match(/^###\s+(.+)$/);
    if (groupMatch) {
      group = plain(groupMatch[1]);
      name = null;
      continue;
    }
    const entry = line.match(/^-\s+\*\*(.+?)\*\*/);
    if (entry) {
      name = plain(entry[1]).replace(/:$/, "").trim();
      if (found.has(name)) errors.push(`duplicate ${label} "${name}"`);
      found.set(name, { group, clauses: 0 });
      continue;
    }
    const clause = name && line.match(/^ {2,}-\s+(.*)$/);
    if (clause) {
      found.get(name).clauses += 1;
      checkSentence(clause[1], `${label} "${name}" clause ${found.get(name).clauses}`);
    }
  }
  return found;
}

const modelLines = linesOf(source);
const rules = entries(modelLines, "## Business Rules", "Business Rule");
const policies = entries(modelLines, "## Policies", "Policy");

// Domain objects: each object's Lifecycle States, Invariants, Behaviors with their clauses,
// and Domain Events.
const objects = [];
const domainObjectsPath = path.join(path.dirname(file), "domain-objects.md");
const hasDomainObjects = fs.existsSync(domainObjectsPath);
if (hasDomainObjects) {
  let section = "";
  let object = null;
  let field = null;
  let item = null;
  for (const line of linesOf(fs.readFileSync(domainObjectsPath, "utf8"))) {
    const heading = line.match(/^###\s+(.+?)\s+—\s/);
    if (heading) {
      object = { name: plain(heading[1]), section, states: [], invariants: [], behaviors: [], events: [] };
      objects.push(object);
      field = null;
      item = null;
      continue;
    }
    if (/^#{1,2}\s/.test(line)) {
      section = plain(line.replace(/^#+\s+/, ""));
      object = null;
      continue;
    }
    if (!object) continue;
    const fieldMatch = line.match(/^-\s+\*\*(.+?):\*\*/);
    if (fieldMatch) {
      field = fieldMatch[1];
      item = null;
      continue;
    }
    const itemMatch = line.match(/^ {2}-\s+`([^`]+)`(.*)$/);
    if (itemMatch) {
      item = { name: itemMatch[1].trim(), text: itemMatch[2], clauses: [] };
      // A state may carry its lifecycle name: `Slot.State = Free`.
      if (field === "Lifecycle State" && item.name !== "No explicit Lifecycle State") {
        object.states.push(item.name.split(/\s+(?:=|—)\s+/).pop());
      }
      if (field === "Invariants") object.invariants.push(item);
      if (field === "Behavior") object.behaviors.push(item);
      if (field === "Domain Events") object.events.push(item);
      continue;
    }
    // A nested entry under a Behavior is a clause. Other nested entries and wrapped lines
    // belong to the current item.
    const clause = item && field === "Behavior" && line.match(/^ {4}-\s+(.*)$/);
    if (clause) item.clauses.push(clause[1]);
    else if (item && item.clauses.length > 0 && /^ {5,}\S/.test(line)) item.clauses[item.clauses.length - 1] += ` ${line.trim()}`;
    else if (item && /^ {3,}\S/.test(line)) item.text += ` ${line.trim()}`;
    else if (line.trim() !== "") item = null;
  }
}

// A lifecycle name may join the words of its object: Client Secret owns ClientSecret.State.
const objectByName = new Map(objects.map((object) => [object.name.replace(/\s+/g, ""), object]));

// Each Invariant has one name in its Aggregate. Each Invariant and each clause is one sentence.
let clauseCount = 0;
const invariantsOf = new Map();
for (const object of objects) {
  if (!invariantsOf.has(object.section)) invariantsOf.set(object.section, new Set());
  for (const invariant of object.invariants) {
    if (invariantsOf.get(object.section).has(invariant.name)) {
      errors.push(`duplicate Invariant "${invariant.name}" under ${object.section}`);
    }
    invariantsOf.get(object.section).add(invariant.name);
    checkSentence(invariant.text.replace(/^\s*—\s*/, ""), `${object.name} Invariant "${invariant.name}"`);
  }
  for (const behavior of object.behaviors) {
    behavior.clauses.forEach((clause, index) => {
      clauseCount += 1;
      checkSentence(clause, `${object.name} Behavior "${behavior.name}" clause ${index + 1}`);
    });
  }
}
const invariantCount = objects.reduce((count, object) => count + object.invariants.length, 0);

// Each `Rules:` citation names an Invariant of its Aggregate, or a Business Rule or the
// Policy a reaction realizes in this Model.
const citedRules = new Set();
for (const object of objects) {
  for (const behavior of object.behaviors) {
    const citation = behavior.text.match(/\bRules?:\s*(.*)$/);
    if (!citation) continue;
    for (const name of quoted(citation[1])) {
      citedRules.add(name);
      if (!invariantsOf.get(object.section).has(name) && !rules.has(name) && !policies.has(name)) {
        errors.push(`${object.name} Behavior "${behavior.name}" cites "${name}", which is not an Invariant of its Aggregate or a Business Rule or Policy in the Model`);
      }
    }
  }
}
// A Business Rule outside `### Context` that no Behavior cites has no owner yet: it waits
// for Tactical Design, or it is a rule that no Behavior owns.
if (hasDomainObjects) {
  const waiting = [...rules].filter(([name, rule]) => rule.group !== "Context" && !citedRules.has(name)).map(([name]) => name);
  if (waiting.length > 0) {
    const shown = waiting.slice(0, 20).map((name) => `"${name}"`).join(", ");
    const more = waiting.length > 20 ? `, and ${waiting.length - 20} more` : "";
    notes.push(`${waiting.length} of ${rules.size} Business Rules are outside \`### Context\` and have no owning Behavior: ${shown}${more}`);
  }
}

// Each Domain Event names its recording Behaviors in its own Aggregate, the Policies that
// consume it, and the contract that publishes it.
const publishedContracts = [];
for (const object of objects) {
  const behaviorNames = new Set(objects
    .filter((other) => other.section === object.section)
    .flatMap((other) => other.behaviors.map((behavior) => behavior.name)));
  for (const event of object.events) {
    // "recorded by `A`, `B` and `C`" names its Behaviors exactly. Looser wording, such as
    // "recorded by each accepted `A`", must still name one Behavior before its ";".
    const listed = event.text.match(/recorded by\s+((?:`[^`]+`(?:\s*,\s*|\s+and\s+|\s+or\s+)?)+)/);
    const loose = quoted((event.text.match(/\brecorded\b([^;]*)/) ?? ["", ""])[1]);
    for (const name of listed ? quoted(listed[1]) : []) {
      if (!behaviorNames.has(name)) {
        errors.push(`Domain Event "${event.name}" is recorded by "${name}", which is not a Behavior under ${object.section}`);
      }
    }
    if (!listed && !loose.some((name) => behaviorNames.has(name))) {
      errors.push(`Domain Event "${event.name}" names no recording Behavior under ${object.section}`);
    }
    for (const consumer of event.text.matchAll(/Consumed by:\*\*\s+Policy\s+`([^`]+)`/g)) {
      if (!policies.has(consumer[1].trim())) {
        errors.push(`Domain Event "${event.name}" is consumed by Policy "${consumer[1].trim()}", which is not in the Model`);
      }
    }
    const published = event.text.match(/published as\s+`([^`]+)`/);
    if (published) publishedContracts.push({ event: event.name, contract: published[1].trim() });
  }
}

// Lifecycle: every transition a Behavior states moves between declared Lifecycle States.
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The declared state a piece of text starts with, or null.
function leadingState(piece, states) {
  const text = piece.trim();
  const tick = text.match(/^`([^`]+)`/);
  if (tick) return states.includes(tick[1].trim()) ? tick[1].trim() : null;
  return [...states]
    .sort((a, b) => b.length - a.length)
    .find((state) => new RegExp(`^${escapeRegExp(state)}(?![\\w-])`).test(text)) ?? null;
}

function pieces(text) {
  return text.split(/\s*,\s*|\s+or\s+/).filter((piece) => piece.trim() !== "");
}

// Read "<lifecycle> [from <states>] to <states>" against one object's declared states.
// Text may follow the target states, so only the first target must be a declared state.
function readTransition(lifecycle, fromText, toText, states) {
  const unknown = [];
  const from = [];
  for (const piece of fromText === null ? [] : pieces(fromText)) {
    if (/^(any|every)\b/i.test(piece.trim())) from.push(...states);
    else if (leadingState(piece, states)) from.push(leadingState(piece, states));
    else unknown.push(plain(piece));
  }
  const to = [];
  for (const [index, piece] of pieces(toText).entries()) {
    const state = leadingState(piece, states);
    if (state) to.push(state);
    else {
      if (index === 0) unknown.push(plain(piece));
      break;
    }
  }
  return { lifecycle, from, to, unknown };
}

let transitionCount = 0;
for (const object of objects) object.touched = new Set();
for (const object of objects) {
  for (const behavior of object.behaviors) {
    const body = behavior.text.split(/\bRules?:/)[0];
    for (const match of body.matchAll(/\btransition(?:ing|s)\s+/g)) {
      const where = `${object.name} Behavior "${behavior.name}"`;
      const clause = body.slice(match.index + match[0].length).split(/\.\s|;|\.$/)[0];
      const toAt = clause.indexOf(" to ");
      if (toAt < 0) {
        notes.push(`${where} states a transition that has no "to <state>"; it was not checked`);
        continue;
      }
      const fromAt = clause.indexOf(" from ");
      const hasFrom = fromAt >= 0 && fromAt < toAt;
      const lifecycle = plain(clause.slice(0, hasFrom ? fromAt : toAt));
      const fromText = hasFrom ? clause.slice(fromAt + 6, toAt) : null;
      const toText = clause.slice(toAt + 4);

      // `<Object>.State` names that object's lifecycle; a bare `State` names the owner's.
      const qualified = lifecycle.match(/^(.+?)[. ](?:Lifecycle State|State|Status)$/);
      const named = qualified ? objectByName.get(qualified[1].replace(/\s+/g, "")) : null;
      const bare = /^(?:Lifecycle State|State|Status)$/.test(lifecycle);
      const target = named ?? object;
      const transition = readTransition(lifecycle, fromText, toText, target.states);

      if (!named && !bare && transition.unknown.length > 0) {
        notes.push(`${where} transitions "${lifecycle}", which names no object's Lifecycle State; it was not checked`);
        continue;
      }
      transitionCount += 1;
      for (const state of transition.unknown) {
        errors.push(`${where} transitions ${lifecycle} through "${state}", which is not a Lifecycle State of ${target.name}`);
      }
      for (const state of [...transition.from, ...transition.to]) target.touched.add(state);
    }
  }
}
// A state that no transition reaches or leaves, and no Behavior of its object names, is dead.
for (const object of objects) {
  if (object.touched.size === 0) continue;
  const bodies = object.behaviors
    .map((behavior) => `${behavior.text.split(/\bRules?:/)[0]} ${behavior.clauses.join(" ")}`)
    .join(" ");
  for (const state of object.states) {
    if (object.touched.has(state)) continue;
    if (new RegExp(`(?<![\\w-])${escapeRegExp(state)}(?![\\w-])`).test(bodies)) continue;
    notes.push(`${object.name} Lifecycle State "${state}" takes part in no transition and no Behavior names it`);
  }
}

// Context Map: the Policies it cites for this context exist, and it carries each contract
// that a Domain Event of this context is published as.
function tableRows(lines, heading) {
  const rows = [];
  let inside = false;
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      inside = line.trim() === heading;
      continue;
    }
    const trimmed = line.trim();
    if (!inside || !trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;
    rows.push(trimmed.slice(1, -1).split("|").map((cell) => cell.trim()));
  }
  return rows.slice(2);
}

let contextMapCheck = "no Context Map entry to cross-check";
const contextDirectory = path.dirname(path.resolve(file));
const contextMapPath = path.join(contextDirectory, "..", "..", "context-map.md");
if (fs.existsSync(contextMapPath)) {
  const mapLines = linesOf(fs.readFileSync(contextMapPath, "utf8"));
  const link = `(context/${path.basename(contextDirectory)}/model.md)`;
  const row = tableRows(mapLines, "## Bounded Contexts").find((cells) => (cells[2] ?? "").includes(link));
  if (row) {
    const context = plain(row[0]);
    const dependencies = tableRows(mapLines, "## Semantic Dependencies").filter((cells) => cells.length === 4);
    for (const [, downstream, , use] of dependencies) {
      if (plain(downstream) !== context) continue;
      for (const policy of use.matchAll(/Policy\s+`([^`]+)`/g)) {
        if (!policies.has(policy[1].trim())) {
          errors.push(`Context Map cites Policy "${policy[1].trim()}" for ${context}, which is not in the Model`);
        }
      }
    }
    const published = dependencies
      .filter(([upstream]) => plain(upstream) === context)
      .map(([, , contract]) => plain(contract));
    for (const { event, contract } of publishedContracts) {
      if (!published.some((cell) => cell.includes(contract))) {
        errors.push(`Domain Event "${event}" is published as "${contract}", which the Context Map does not list as a contract ${context} publishes`);
      }
    }
    contextMapCheck = "Context Map names match";
  }
}

for (const note of notes) console.log(`note: ${note}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`invalid Model: ${error}`);
  process.exit(1);
}
console.log(
  `valid Model: ${rules.size} Business Rules, ${policies.size} Policies, ` +
  `${hasDomainObjects ? `${objects.length} domain objects, ${invariantCount} Invariants, ${clauseCount} clauses, ${transitionCount} transitions` : "no domain-objects.md to cross-check"}; ` +
  contextMapCheck,
);
