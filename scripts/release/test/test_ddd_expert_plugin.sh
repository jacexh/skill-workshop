#!/usr/bin/env bash
# Static packaging and resource-discovery checks, not model-behavior evidence.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
node - "$ROOT" <<'NODE'
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = process.argv[2];
const read = p => fs.readFileSync(p, "utf8");
const json = p => JSON.parse(read(p));
const skills = ["codify", "event-storming", "guard", "tactical-design"];
const templates = ["artifact-layout.md", "context-map.md", "domain-objects.md", "model.md"];
const tracks = ["plugins/ddd-expert", "codex-plugins/ddd-expert"];

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const p = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(p) : [p];
  });
}

for (const [index, track] of tracks.entries()) {
  const plugin = path.join(root, track);
  const marketplace = json(path.join(root, index ? ".agents/plugins/marketplace.json" : ".claude-plugin/marketplace.json"));
  const entry = marketplace.plugins.find(p => p.name === "ddd-expert");
  assert.ok(entry, track + ": marketplace entry");
  assert.equal(index ? entry.source.path : entry.source, "./" + track);
  const manifest = json(path.join(plugin, index ? ".codex-plugin/plugin.json" : ".claude-plugin/plugin.json"));
  assert.equal(manifest.name, "ddd-expert");
  assert.ok(manifest.description.length);
  assert.equal(manifest.hooks, undefined, "DDD Expert remains hookless");
  assert.equal(fs.existsSync(path.join(plugin, "hooks")), false);
  assert.deepEqual(fs.readdirSync(path.join(plugin, "skills")).sort(), skills);
  assert.deepEqual(fs.readdirSync(path.join(plugin, "templates")).sort(), templates);

  for (const skill of skills) {
    const text = read(path.join(plugin, "skills", skill, "SKILL.md"));
    assert.ok(text.startsWith("---\n"), skill + ": frontmatter");
    assert.match(text, new RegExp("^name: " + skill + "$", "m"));
    assert.match(text, /^description: .+$/m);
  }

  if (index) {
    assert.equal(manifest.skills, "./skills/");
    assert.ok(manifest.interface.capabilities.includes("Read"));
    assert.ok(manifest.interface.capabilities.includes("Write"));
    const prompts = manifest.interface.defaultPrompt;
    assert.ok(Array.isArray(prompts) && prompts.length > 0);
    for (const prompt of prompts) {
      const invoked = [...prompt.matchAll(/\$ddd-expert:([a-z-]+)/g)].map(m => m[1]);
      assert.ok(invoked.length > 0, "default prompt reaches a public skill");
      for (const name of invoked) assert.ok(skills.includes(name), "unknown default-prompt skill: " + name);
    }
  }

  // Check every local Markdown/script link, then walk from actual skill entries.
  // README-only resources are not discoverable from a skill execution.
  const graph = new Map();
  for (const file of filesUnder(plugin).filter(p => p.endsWith(".md"))) {
    const targets = [];
    for (const match of read(file).matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1].split("#")[0];
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      if (file.includes("/templates/") && /<[^>]+>/.test(target)) continue;
      const resolved = path.resolve(path.dirname(file), target);
      assert.ok(resolved.startsWith(plugin + path.sep), "resource escapes plugin: " + file + " -> " + target);
      assert.ok(fs.statSync(resolved).isFile(), "missing linked resource: " + resolved);
      targets.push(resolved);
    }
    graph.set(file, targets);
  }

  function reachable(entries) {
    const visited = new Set();
    const pending = [...entries];
    while (pending.length) {
      const file = pending.pop();
      if (visited.has(file)) continue;
      visited.add(file);
      pending.push(...(graph.get(file) || []));
    }
    return visited;
  }
  const entries = skills.map(s => path.join(plugin, "skills", s, "SKILL.md"));
  const reached = reachable(entries);
  for (const dir of ["references", "templates", "scripts"]) {
    for (const file of filesUnder(path.join(plugin, dir))) {
      assert.ok(reached.has(file), "resource unreachable from skills: " + file);
    }
  }
  for (const skill of ["event-storming", "tactical-design"]) {
    const reachedFromDesign = reachable([path.join(plugin, "skills", skill, "SKILL.md")]);
    for (const resource of ["templates/artifact-layout.md", "templates/domain-objects.md",
      "templates/context-map.md", "templates/model.md", "scripts/validate-context-map.mjs"]) {
      assert.ok(reachedFromDesign.has(path.join(plugin, resource)), skill + " cannot reach " + resource);
    }
  }
}

// The two packages share semantic instructions and executable resources.
for (const dir of ["skills", "references", "templates", "scripts"]) {
  const left = path.join(root, tracks[0], dir);
  const right = path.join(root, tracks[1], dir);
  const inventory = base => filesUnder(base).map(p => path.relative(base, p)).sort();
  assert.deepEqual(inventory(left), inventory(right), dir + ": mirror inventory");
  for (const relative of inventory(left)) {
    assert.equal(read(path.join(left, relative)), read(path.join(right, relative)), dir + "/" + relative + ": mirror content");
  }
}
const claude = json(path.join(root, tracks[0], ".claude-plugin/plugin.json"));
const codex = json(path.join(root, tracks[1], ".codex-plugin/plugin.json"));
assert.equal(claude.description, codex.description);
assert.equal(claude.version, codex.version);
console.log("PASS ddd-expert packaging, mirrors, and reachable resources (static checks)");
NODE
