#!/usr/bin/env bash
# Validate the hookless designing-tests plugin contract and cross-track parity.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLAUDE_ROOT="$ROOT/plugins/designing-tests"
CODEX_ROOT="$ROOT/codex-plugins/designing-tests"
CLAUDE_SKILL="$CLAUDE_ROOT/skills/designing-tests"
CODEX_SKILL="$CODEX_ROOT/skills/designing-tests"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

for removed in \
  "$CLAUDE_ROOT/hooks" \
  "$CODEX_ROOT/hooks" \
  "$CODEX_ROOT/codex-hooks-snippet.json" \
  "$CODEX_ROOT/scripts/install-codex-hooks.js"; do
  [ ! -e "$removed" ] || fail "designing-tests must be hookless: ${removed#"$ROOT/"}"
done

jq -e 'has("hooks") | not' "$CODEX_ROOT/.codex-plugin/plugin.json" >/dev/null ||
  fail "Codex designing-tests manifest must not declare hooks"

if rg -n 'PreToolUse|UserPromptSubmit|\$superpowers:' "$CLAUDE_ROOT" "$CODEX_ROOT" >/dev/null; then
  fail "designing-tests must not contain cross-workflow hook routing"
fi

CLAUDE_ROOT="$CLAUDE_ROOT" CODEX_ROOT="$CODEX_ROOT" node <<'NODE'
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.env.CLAUDE_ROOT, "../..");
const claudeRoot = process.env.CLAUDE_ROOT;
const codexRoot = process.env.CODEX_ROOT;
const claudeSkill = path.join(claudeRoot, "skills", "designing-tests");
const codexSkill = path.join(codexRoot, "skills", "designing-tests");

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function frontmatter(file) {
  const raw = read(file);
  const match = raw.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) fail(`${file} has no YAML frontmatter`);
  const fields = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return { fields, body: raw.slice(match[0].length) };
}

const claudeFile = path.join(claudeSkill, "SKILL.md");
const codexFile = path.join(codexSkill, "SKILL.md");
const claude = frontmatter(claudeFile);
const codex = frontmatter(codexFile);

for (const parsed of [claude, codex]) {
  if (parsed.fields.name !== "designing-tests") fail("unexpected skill name");
  if (!parsed.fields.description) fail("skill must have a discovery description");
  if (!parsed.body.trim()) fail("skill instructions are empty");
}

if (claude.fields.description !== codex.fields.description) {
  fail("Claude and Codex skill descriptions differ");
}
if (read(claudeFile) !== read(codexFile)) {
  fail("Claude and Codex SKILL.md files differ");
}

function markdownFiles(directory) {
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...markdownFiles(file));
    else if (entry.name.endsWith(".md")) found.push(file);
  }
  return found;
}

function relativeFiles(directory, current = directory) {
  const found = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const file = path.join(current, entry.name);
    if (entry.isDirectory()) found.push(...relativeFiles(directory, file));
    else found.push(path.relative(directory, file));
  }
  return found.sort();
}

const claudeInventory = relativeFiles(claudeSkill);
const codexInventory = relativeFiles(codexSkill);
if (claudeInventory.join("\0") !== codexInventory.join("\0")) {
  fail("Claude and Codex skill file inventories differ");
}
for (const relative of claudeInventory) {
  if (read(path.join(claudeSkill, relative)) !== read(path.join(codexSkill, relative))) {
    fail(`Claude and Codex skill file differs: ${relative}`);
  }
}

for (const skillRoot of [claudeSkill, codexSkill]) {
  const reachable = new Set();
  function visit(file) {
    if (reachable.has(file)) return;
    reachable.add(file);
    const raw = read(file);
    for (const match of raw.matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1].split("#", 1)[0];
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      const resolved = path.resolve(path.dirname(file), target);
      if (!fs.existsSync(resolved)) fail(`${file} has broken link ${target}`);
      if (resolved.endsWith(".md")) visit(resolved);
    }
  }
  visit(path.join(skillRoot, "SKILL.md"));
  for (const file of markdownFiles(skillRoot)) {
    if (!reachable.has(file)) fail(`skill reference is unreachable: ${file}`);
  }
}

const claudeManifest = JSON.parse(read(path.join(claudeRoot, ".claude-plugin", "plugin.json")));
const codexManifest = JSON.parse(read(path.join(codexRoot, ".codex-plugin", "plugin.json")));
const marketplace = JSON.parse(read(path.join(root, ".claude-plugin", "marketplace.json")));
const marketplaceEntry = marketplace.plugins.find((plugin) => plugin.name === "designing-tests");
if (!marketplaceEntry) fail("Claude marketplace lacks designing-tests");
if (new Set([claudeManifest.description, codexManifest.description, marketplaceEntry.description]).size !== 1) {
  fail("designing-tests manifest descriptions drifted");
}
NODE

echo "  designing-tests plugin: hookless workflow and cross-track parity correct"
