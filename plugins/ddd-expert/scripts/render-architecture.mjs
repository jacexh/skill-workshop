#!/usr/bin/env node
// Generate the architecture view of one Bounded Context from its architecture.md catalog and
// its other DDD artifacts. The view is for people; architecture.md stays the constraint.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SECTIONS = [
  { title: "Query Repositories", headers: ["Query Repository", "Reads", "Read needs", "Store", "Reason"], required: true },
  { title: "Application Ports", headers: ["Application Port", "Authority", "Covers", "Adapter", "Reason"], required: true },
  { title: "Inbound Sources", headers: ["Inbound Source", "Authority", "Receives", "Reason"], required: false },
  { title: "Tasks", headers: ["Task", "Advances", "Key", "Enqueued by", "Reason"], required: false },
  { title: "Mechanisms", headers: ["Mechanism", "Seam", "Serves"], required: false },
];

export function plain(value) {
  return value
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  return trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
}

function lines(source) {
  return source.replace(/\r\n/g, "\n").replace(/<!--[\s\S]*?-->/g, "").split("\n");
}

// Parse architecture.md into its context name and section rows. Throws on a shape error.
export function parseCatalog(source) {
  const all = lines(source);
  const content = all.filter((line) => line.trim() !== "");
  const title = (content[0] || "").trim().match(/^#\s+(.+?)\s+Architecture$/);
  if (!title || all.filter((line) => /^#\s/.test(line)).length !== 1) {
    throw new Error('expected exactly one "# <Bounded Context> Architecture" heading, first');
  }
  const headings = all.map((line, index) => [line.trim(), index]).filter(([line]) => /^##\s/.test(line));
  const order = SECTIONS.map((section) => section.title);
  let last = -1;
  for (const [heading] of headings) {
    const index = order.indexOf(heading.replace(/^##\s+/, ""));
    if (index < 0) throw new Error(`unknown section "${heading}"`);
    if (index <= last) throw new Error(`section "${heading}" is out of order or repeated`);
    last = index;
  }
  const titleIndex = all.findIndex((line) => /^#\s/.test(line));
  const preamble = all.slice(titleIndex + 1, headings.length ? headings[0][1] : all.length);
  if (preamble.some((line) => line.trim() !== "")) throw new Error("only sections may follow the heading");

  const catalog = { context: plain(title[1]) };
  for (const section of SECTIONS) {
    const found = headings.find(([heading]) => heading === `## ${section.title}`);
    catalog[section.title] = [];
    if (!found) {
      if (section.required) throw new Error(`missing section "## ${section.title}"`);
      continue;
    }
    const next = headings.find(([, index]) => index > found[1]);
    const body = all.slice(found[1] + 1, next ? next[1] : all.length).filter((line) => line.trim() !== "");
    if (body.length === 1 && body[0].trim() === "None.") continue;
    if (body.length < 3) throw new Error(`section "${section.title}" needs a table with at least one row, or "None."`);
    const headers = splitRow(body[0]);
    if (!headers || headers.join("\u0000") !== section.headers.join("\u0000")) {
      throw new Error(`section "${section.title}" headers must be: ${section.headers.join(" | ")}`);
    }
    const delimiter = splitRow(body[1]);
    if (!delimiter || delimiter.length !== headers.length || delimiter.some((cell) => !/^:?-{3,}:?$/.test(cell))) {
      throw new Error(`section "${section.title}" needs a valid table delimiter`);
    }
    body.slice(2).forEach((line, rowIndex) => {
      const cells = splitRow(line);
      const label = `${section.title} row ${rowIndex + 1}`;
      if (!cells || cells.length !== headers.length) throw new Error(`${label} must contain exactly ${headers.length} cells`);
      if (cells.some((cell) => plain(cell) === "")) throw new Error(`${label} contains an empty cell`);
      catalog[section.title].push(Object.fromEntries(section.headers.map((header, index) => [header, cells[index]])));
    });
  }
  return catalog;
}

function readIfPresent(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

// domain-objects.md: Roots and Domain Services with their Domain-owned Ports and Domain Events.
export function parseDomainObjects(source) {
  const owners = [];
  let owner = null;
  let field = null;
  let event = null;
  for (const line of lines(source)) {
    const heading = line.match(/^###\s+(.+?)\s+—\s+(Aggregate Root|Entity|Domain Service)\b/);
    if (heading) {
      if (heading[2] !== "Entity") {
        owner = { name: heading[1].trim(), kind: heading[2], ports: [], events: [] };
        owners.push(owner);
      }
      field = null;
      continue;
    }
    if (/^##\s/.test(line)) { owner = null; field = null; continue; }
    if (!owner) continue;
    const fieldMatch = line.match(/^-\s+\*\*(.+?):\*\*/);
    if (fieldMatch) { field = fieldMatch[1]; continue; }
    const item = line.match(/^ {2}-\s+`([^`]+)`/);
    if (item && field === "Domain-owned Ports") owner.ports.push(item[1].trim());
    if (item && field === "Domain Events") {
      event = { name: item[1].trim(), consumedBy: [] };
      owner.events.push(event);
      continue;
    }
    if (field === "Domain Events" && event && /^ {4}-\s+\*\*Consumed by:\*\*/.test(line)) {
      for (const match of line.matchAll(/Policy `([^`]+)`/g)) event.consumedBy.push(match[1].trim());
    }
  }
  return owners;
}

// model.md: the context name, its Aggregate Roots, and its Policies.
export function parseModel(source) {
  const all = lines(source);
  const title = all.find((line) => /^#\s/.test(line));
  const name = title ? plain(title.replace(/^#\s+/, "").replace(/\s+Model$/, "")) : null;
  const roots = [];
  const policies = [];
  let section = null;
  for (const line of all) {
    if (/^##\s/.test(line)) { section = line.replace(/^##\s+/, "").trim(); continue; }
    if (section === "Aggregate Roots") {
      const cells = splitRow(line);
      if (cells && !/^:?-{3,}/.test(cells[0]) && plain(cells[0]) !== "Aggregate Root") roots.push(plain(cells[0]));
    }
    if (section === "Policies") {
      const policy = line.match(/^-\s+\*\*(.+?):\*\*/);
      if (policy) policies.push(policy[1].trim());
    }
  }
  return { name, roots, policies };
}

// context-map.md: the contexts whose messages this context subscribes to, the asynchronous
// contracts it sends, and the synchronous contracts it supplies. A row whose Downstream use
// cites a Policy is a subscription. A contract is asynchronous when its name ends in
// "Published Fact Contract" or "Intent Contract", or its parenthetical says so.
export function parseContextMap(source, context) {
  const result = { consumed: [], sent: [], supplied: [] };
  let inDependencies = false;
  for (const line of lines(source)) {
    if (/^##\s/.test(line)) { inDependencies = line.trim() === "## Semantic Dependencies"; continue; }
    const cells = inDependencies ? splitRow(line) : null;
    if (!cells || cells.length !== 4 || /^:?-{3,}/.test(cells[0]) || plain(cells[0]) === "Upstream") continue;
    const upstream = plain(cells[0]);
    const downstream = plain(cells[1]);
    if (upstream !== context && downstream !== context) continue;
    const policies = [...cells[3].matchAll(/Policy `([^`]+)`/g)].map((match) => match[1].trim());
    const contracts = [...cells[2].matchAll(/\*\*([^*]+?)\*\*/g)].map((match) => {
      const full = plain(match[1]).replace(/:$/, "").trim();
      const note = (full.match(/\(([^)]*)\)$/) || [, ""])[1].toLowerCase();
      const name = full.replace(/\s*\([^)]*\)$/, "").trim();
      const fact = /Published Fact Contract$/.test(name) || /published fact/.test(note);
      const intent = !fact && (/Intent Contract$/.test(name) || /\bintent\b/.test(note));
      return { name, fact, intent };
    });
    if (downstream === context && policies.length) {
      const facts = contracts.filter((contract) => contract.fact);
      result.consumed.push({ name: `${upstream} subscriber`, counterpart: upstream, kind: "fact", policies,
        messages: (facts.length ? facts : contracts.slice(0, 1)).map((contract) => contract.name) });
    }
    for (const contract of contracts) {
      if (upstream === context && contract.intent) {
        result.consumed.push({ name: `${downstream} subscriber`, counterpart: downstream, kind: "intent", policies: [], messages: [contract.name] });
      } else if (upstream === context && contract.fact) {
        result.sent.push({ name: contract.name, counterpart: downstream, kind: "fact" });
      } else if (downstream === context && contract.intent) {
        result.sent.push({ name: contract.name, counterpart: upstream, kind: "intent" });
      } else if (upstream === context && !contract.fact) {
        result.supplied.push({ name: contract.name, counterpart: downstream });
      }
    }
  }
  return result;
}

// Read the catalog and the sibling artifacts. The context map sits two levels up.
export function loadArtifacts(catalogPath, artifactsDir) {
  const catalog = parseCatalog(fs.readFileSync(catalogPath, "utf8"));
  const dir = artifactsDir || path.dirname(catalogPath);
  const modelSource = readIfPresent(path.join(dir, "model.md"));
  const objectsSource = readIfPresent(path.join(dir, "domain-objects.md"));
  const mapSource = readIfPresent(path.join(dir, "..", "..", "context-map.md"));
  return {
    catalog,
    model: modelSource ? parseModel(modelSource) : null,
    owners: objectsSource ? parseDomainObjects(objectsSource) : null,
    map: mapSource ? parseContextMap(mapSource, catalog.context) : null,
  };
}

function names(cell) {
  return plain(cell).split(/\s*(?:,|;|\band\b)\s*/).map((name) => name.trim()).filter(Boolean);
}

function merge(list) {
  const byName = new Map();
  for (const item of list) {
    const known = byName.get(item.name);
    if (known) {
      if (!known.counterparts.includes(item.counterpart)) known.counterparts.push(item.counterpart);
      for (const policy of item.policies || []) if (!known.policies.includes(policy)) known.policies.push(policy);
    } else {
      byName.set(item.name, { ...item, counterparts: [item.counterpart], policies: [...(item.policies || [])] });
    }
  }
  return [...byName.values()];
}

// Build the view model: cards in bands, and only the relations the artifacts state.
export function buildView({ catalog, model, owners, map }) {
  const cards = [];
  const edges = [];
  const add = (card) => { cards.push({ mechanisms: [], ...card }); return card.id; };
  const slug = (prefix, name) => `${prefix}:${name}`;

  const consumed = map ? map.consumed : [];
  const sent = merge(map ? map.sent : []);
  for (const subscriber of consumed) {
    if (cards.some((card) => card.name === subscriber.name)) {
      cards.find((card) => card.name === subscriber.name).chips.push(...subscriber.messages.map((message) =>
        ({ id: slug("msg", message), name: message, note: subscriber.kind === "intent" ? "Intent" : "from " + subscriber.counterpart })));
      continue;
    }
    add({
      id: slug("sub", subscriber.name), band: "transport", kind: "subscriber", name: subscriber.name,
      chips: subscriber.messages.map((message) => ({ id: slug("msg", message), name: message,
        note: subscriber.kind === "intent" ? "Intent" : "from " + subscriber.counterpart })),
    });
  }
  for (const source of catalog["Inbound Sources"]) {
    add({ id: slug("src", plain(source["Inbound Source"])), band: "transport", kind: "inbound-source",
      name: plain(source["Inbound Source"]), lines: [plain(source.Authority)], detail: plain(source.Receives) });
  }
  for (const task of catalog.Tasks) {
    const name = plain(task.Task);
    const enqueued = plain(task["Enqueued by"]);
    add({ id: slug("task", name), band: "transport", kind: "task", name,
      lines: [`${plain(task.Advances)} · key ${plain(task.Key)}`], detail: /^Every\b/i.test(enqueued) ? enqueued : "" });
  }

  // The Application entry lists the synchronous contracts it supplies, once per contract.
  add({ id: "app", band: "application", kind: "application", name: `${catalog.context} Application`,
    lines: merge(map ? map.supplied : []).map((contract) => `${contract.name} → ${contract.counterparts.join(", ")}`) });
  for (const policy of model ? model.policies : []) {
    add({ id: slug("policy", policy), band: "application", kind: "policy", name: policy });
  }
  for (const repository of catalog["Query Repositories"]) {
    add({ id: slug("qr", plain(repository["Query Repository"])), band: "contracts", kind: "query-repository",
      name: plain(repository["Query Repository"]), lines: [plain(repository.Store)], detail: plain(repository.Reads) });
  }
  for (const port of catalog["Application Ports"]) {
    add({ id: slug("port", plain(port["Application Port"])), band: "contracts", kind: "application-port",
      name: plain(port["Application Port"]), lines: [`${plain(port.Authority)} · ${plain(port.Adapter)}`], detail: plain(port.Covers) });
  }

  const rootNames = owners ? owners.filter((owner) => owner.kind === "Aggregate Root").map((owner) => owner.name)
    : (model ? model.roots : []);
  for (const owner of owners || rootNames.map((name) => ({ name, kind: "Aggregate Root", ports: [], events: [] }))) {
    const root = owner.kind === "Aggregate Root";
    add({
      id: slug("domain", owner.name), band: "domain", kind: root ? "aggregate-root" : "domain-service", name: owner.name,
      lines: root ? [`${owner.name}Repository`] : [],
      chips: [
        ...owner.ports.map((port) => ({ id: slug("dport", port), name: port, note: "Domain-owned Port" })),
        ...owner.events.map((event) => ({ id: slug("event", event.name), name: event.name, note: "" })),
      ],
    });
    for (const event of owner.events) {
      for (const policy of event.consumedBy) edges.push({ from: slug("event", event.name), to: slug("policy", policy), kind: "reacts" });
    }
  }

  for (const message of sent) {
    add({ id: slug("out", message.name), band: "outbound", kind: "message", name: message.name,
      lines: [`${message.kind === "intent" ? "Intent" : "Published Fact"} to ${message.counterparts.join(", ")}`] });
  }

  // Subscribers deliver to the Policies the Context Map names for their messages.
  for (const subscriber of consumed) {
    for (const policy of subscriber.policies) edges.push({ from: slug("sub", subscriber.name), to: slug("policy", policy), kind: "delivers" });
  }
  // A task is enqueued by the Policies, Inbound Sources, tasks, or Application its row names.
  const ids = new Map(cards.map((card) => [card.name, card.id]));
  ids.set("Application", "app");
  for (const task of catalog.Tasks) {
    for (const name of names(task["Enqueued by"])) {
      const from = ids.get(name);
      if (from && from !== slug("task", plain(task.Task))) edges.push({ from, to: slug("task", plain(task.Task)), kind: "enqueues" });
    }
  }

  // Mechanisms sit on their seam card, or on the chip line that names the seam.
  const seamCard = new Map(cards.map((card) => [card.name, card.id]));
  seamCard.set("Application", "app");
  for (const card of cards) {
    for (const line of card.lines || []) if (line.endsWith("Repository") && card.band === "domain") seamCard.set(line, card.id);
    for (const chip of card.chips || []) seamCard.set(chip.name, card.id);
  }
  for (const mechanism of catalog.Mechanisms) {
    const target = seamCard.get(plain(mechanism.Seam));
    const card = cards.find((candidate) => candidate.id === target);
    if (card) card.mechanisms.push({ name: plain(mechanism.Mechanism), seam: plain(mechanism.Seam), serves: plain(mechanism.Serves) });
  }

  const known = new Set(cards.flatMap((card) => [card.id, ...(card.chips || []).map((chip) => chip.id)]));
  return { context: catalog.context, cards, edges: edges.filter((edge) => known.has(edge.from) && known.has(edge.to)) };
}

const STYLE = `
:root{--bg:#f6f6f2;--fg:#1d2127;--muted:#5f6670;--card:#fff;--line:#dcdcd4;--edge:#8a919a;
--transport:#3a6ea8;--transport-bg:#eaf1f9;--application:#0d8478;--application-bg:#e7f4f1;
--domain:#7440dd;--domain-bg:#f1eafd;--outbound:#c0386b;--outbound-bg:#fcedf3;--mech:#c2570c;--mech-bg:#fff3e8;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#131518;--fg:#e7e9ec;--muted:#9aa1aa;--card:#1c1f23;--line:#2c3036;--edge:#7f868f;
--transport:#7fb0ec;--transport-bg:#16212e;--application:#4fc7b9;--application-bg:#13282a;--domain:#b48cff;--domain-bg:#221b33;
--outbound:#f27aa4;--outbound-bg:#341a27;--mech:#f59e5b;--mech-bg:#33241a;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;padding:28px 16px 48px;background:var(--bg);color:var(--fg);font:14px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
h1{font-size:24px;margin:0 0 4px}
.sub{color:var(--muted);margin:0 0 18px;max-width:80ch}
.board{position:relative;display:flex;flex-direction:column;gap:22px;max-width:1440px}
.band{border-radius:14px;padding:14px 14px 16px;background:var(--layer-bg);border:1px solid color-mix(in srgb,var(--layer) 25%,transparent)}
.band h2{margin:0 0 10px;font-size:12.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--layer)}
.cards{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}
.card{position:relative;z-index:2;width:236px;background:var(--card);border:1.5px solid color-mix(in srgb,var(--layer) 65%,transparent);border-radius:8px;padding:8px 10px;transition:opacity .15s,box-shadow .15s}
.card.contract{border-style:dashed}
.kind{font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--layer);font-weight:650}
.name{font-weight:650;line-height:1.3;overflow-wrap:anywhere}
.line{font-size:12px;color:var(--muted);overflow-wrap:anywhere}
.detail{font-size:12px;color:var(--muted);margin-top:4px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.card:hover .detail{-webkit-line-clamp:unset}
.chips{display:flex;flex-direction:column;gap:3px;margin-top:6px}
.chip{font-size:12px;padding:1px 8px;border-radius:999px;border:1px dotted var(--layer);color:var(--layer);overflow-wrap:anywhere;transition:box-shadow .15s}
.chip small{color:var(--muted)}
.mech{margin-top:6px;padding:4px 7px;border-left:3px solid var(--mech);border-radius:5px;background:var(--mech-bg);font-size:12px}
.mech b{color:var(--mech);font-weight:650}
.mech span{display:block;color:var(--muted)}
svg.edges{position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:1}
path.edge{fill:none;stroke-width:1.5;opacity:.6;transition:opacity .15s}
path.reacts{stroke:var(--application);stroke-dasharray:7 3 1.5 3}
path.delivers{stroke:var(--transport)}
path.enqueues{stroke:var(--outbound);stroke-dasharray:2 4}
.board.focus .card:not(.hot){opacity:.35}
.board.focus path.edge{opacity:.07}
.board.focus path.edge.hot{opacity:1;stroke-width:2.2}
.hot{box-shadow:0 0 0 3px color-mix(in srgb,var(--layer) 30%,transparent)}
.legend{margin-top:20px;display:flex;flex-wrap:wrap;gap:8px 28px;font-size:12.5px;color:var(--muted)}
.legend svg{vertical-align:middle;margin-right:6px}
@media (max-width:540px){.card{width:100%}}
`;

const SCRIPT = `
(function(){"use strict";
var view=JSON.parse(document.getElementById("architecture-view").textContent);
var BANDS=[["transport","Transport","transport"],["application","Application","application"],["domain","Domain","domain"],
["contracts","Application contracts, implemented by adapters","application"],["outbound","Outbound","outbound"]];
var KIND={subscriber:"Subscriber","inbound-source":"Inbound Source",task:"Task",application:"Application entry",policy:"Policy",
"query-repository":"Query Repository","application-port":"Application Port","aggregate-root":"Aggregate Root","domain-service":"Domain Service",message:"Integration Message"};
var CONTRACT={"query-repository":1,"application-port":1};
function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
document.getElementById("title").textContent=view.context+" Architecture";
document.title=view.context+" Architecture";
var board=document.getElementById("board"),nodes={},owner={};
BANDS.forEach(function(b){
var members=view.cards.filter(function(c){return c.band===b[0];});if(!members.length)return;
var band=el("section","band");band.style.setProperty("--layer","var(--"+b[2]+")");band.style.setProperty("--layer-bg","var(--"+b[2]+"-bg)");
band.appendChild(el("h2",null,b[1]));var list=el("div","cards");
members.forEach(function(c){
var card=el("div","card"+(CONTRACT[c.kind]?" contract":""));
card.appendChild(el("div","kind",KIND[c.kind]));card.appendChild(el("div","name",c.name));
(c.lines||[]).forEach(function(l){card.appendChild(el("div","line",l));});
if(c.detail){var d=el("div","detail",c.detail);d.title=c.detail;card.appendChild(d);}
if(c.chips&&c.chips.length){var chips=el("div","chips");c.chips.forEach(function(ch){
var chip=el("div","chip",ch.name+" ");if(ch.note)chip.appendChild(el("small",null,ch.note));chips.appendChild(chip);
nodes[ch.id]=chip;owner[ch.id]=c.id;hover(chip,ch.id);});card.appendChild(chips);}
c.mechanisms.forEach(function(m){var box=el("div","mech");box.appendChild(el("b",null,m.name));
box.appendChild(el("span",null,(m.seam!==c.name?m.seam+": ":"")+m.serves));card.appendChild(box);});
nodes[c.id]=card;hover(card,c.id);list.appendChild(card);});
band.appendChild(list);board.appendChild(band);});
var NS="http://www.w3.org/2000/svg",svg=document.createElementNS(NS,"svg");svg.setAttribute("class","edges");board.appendChild(svg);
var defs=document.createElementNS(NS,"defs");
["reacts","delivers","enqueues"].forEach(function(k){var m=document.createElementNS(NS,"marker");
m.setAttribute("id","arrow-"+k);m.setAttribute("viewBox","0 0 10 10");m.setAttribute("refX","9");m.setAttribute("refY","5");
m.setAttribute("markerWidth","7");m.setAttribute("markerHeight","7");m.setAttribute("orient","auto-start-reverse");
var p=document.createElementNS(NS,"path");p.setAttribute("d","M0,0 L10,5 L0,10 z");
p.setAttribute("style","fill:var(--"+(k==="reacts"?"application":k==="delivers"?"transport":"outbound")+")");m.appendChild(p);defs.appendChild(m);});
var paths=[],focused=null;
function draw(){while(svg.lastChild)svg.removeChild(svg.lastChild);svg.appendChild(defs);paths=[];
svg.setAttribute("width",board.scrollWidth);svg.setAttribute("height",board.scrollHeight);
var o=board.getBoundingClientRect();
view.edges.forEach(function(e){var a=nodes[e.from],b=nodes[e.to];if(!a||!b)return;
var ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();
var ax=ra.left+ra.width/2-o.left,bx=rb.left+rb.width/2-o.left,down=rb.top>ra.bottom,up=rb.bottom<ra.top,d;
if(down||up){var ay=(down?ra.bottom:ra.top)-o.top,by=(down?rb.top:rb.bottom)-o.top,bend=Math.max(30,Math.abs(by-ay)/2);
d="M"+ax+","+ay+" C"+ax+","+(ay+(down?bend:-bend))+" "+bx+","+(by+(down?-bend:bend))+" "+bx+","+by;}
else{var y1=ra.top-o.top,y2=rb.top-o.top,lift=Math.min(y1,y2)-28;d="M"+ax+","+y1+" C"+ax+","+lift+" "+bx+","+lift+" "+bx+","+y2;}
var p=document.createElementNS(NS,"path");p.setAttribute("d",d);p.setAttribute("class","edge "+e.kind);
p.setAttribute("marker-end","url(#arrow-"+e.kind+")");svg.appendChild(p);paths.push({e:e,p:p});});
if(focused!==null)focus(focused);}
function light(id){nodes[id].classList.add("hot");if(owner[id])nodes[owner[id]].classList.add("hot");}
function touches(end,id){return end===id||owner[end]===id;}
function focus(id){focused=id;board.classList.toggle("focus",id!==null);
Object.keys(nodes).forEach(function(k){nodes[k].classList.remove("hot");});
if(id===null)return;light(id);
paths.forEach(function(x){var hot=touches(x.e.from,id)||touches(x.e.to,id);
x.p.classList.toggle("hot",hot);if(hot){light(x.e.from);light(x.e.to);}});}
function hover(n,id){n.addEventListener("mouseenter",function(){focus(id);});
n.addEventListener("mouseleave",function(){focus(owner[id]||null);});}
draw();window.addEventListener("resize",draw);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(draw);
})();
`;

function escapeJson(json) {
  return json.replace(/</g, "\\u003c");
}

export function renderHtml(view) {
  const legend = [
    ["reacts", "var(--application)", "7 3 1.5 3", "Domain Event to the Policy that reacts"],
    ["delivers", "var(--transport)", "", "subscriber to the Policy it triggers"],
    ["enqueues", "var(--outbound)", "2 4", "enqueues a task"],
  ].map(([, color, dash, text]) =>
    `<span><svg width="34" height="10"><path d="M2,5 H30" stroke="${color}" stroke-width="1.6"${dash ? ` stroke-dasharray="${dash}"` : ""}/></svg>${text}</span>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Architecture</title>
<!-- Generated by ddd-expert render-architecture.mjs from architecture.md and the context's DDD artifacts. Do not edit. -->
<style>${STYLE}</style>
</head>
<body>
<h1 id="title"></h1>
<p class="sub">Generated view of the Bounded Context. The contract catalog in architecture.md is the constraint; dashed cards are its contracts. Hover a card or chip to trace its relations.</p>
<div class="board" id="board"></div>
<div class="legend">${legend}<span>dashed card: cataloged contract</span><span>orange note: technical mechanism on its seam</span></div>
<script type="application/json" id="architecture-view">
${escapeJson(JSON.stringify(view, null, 1))}
</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

export function renderCatalog(catalogPath, artifactsDir) {
  return renderHtml(buildView(loadArtifacts(catalogPath, artifactsDir)));
}

function main(argv) {
  const usage = "usage: render-architecture.mjs <context-dir | architecture.md> [--artifacts <context-dir>] [--out <file>]";
  const options = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--artifacts" || argv[index] === "--out") options[argv[index].slice(2)] = argv[++index];
    else if (argv[index].startsWith("--")) { console.error(usage); process.exit(2); }
    else positional.push(argv[index]);
  }
  if (positional.length !== 1 || Object.values(options).some((value) => !value)) { console.error(usage); process.exit(2); }
  let catalogPath = positional[0];
  if (fs.existsSync(catalogPath) && fs.statSync(catalogPath).isDirectory()) catalogPath = path.join(catalogPath, "architecture.md");
  const out = options.out || path.join(path.dirname(catalogPath), "architecture.html");
  let html;
  try {
    html = renderCatalog(catalogPath, options.artifacts);
  } catch (error) {
    console.error(`unable to render Architecture: ${error.message}`);
    process.exit(1);
  }
  fs.writeFileSync(out, html);
  console.log(`rendered ${out}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main(process.argv.slice(2));
