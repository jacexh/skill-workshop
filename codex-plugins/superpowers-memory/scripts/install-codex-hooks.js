#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const MANAGED_PLUGINS = [
  "designing-tests",
  "superpowers-architect",
  "superpowers-memory",
];

const pluginRoot = path.resolve(__dirname, "..");
const pluginName = inferPluginName(pluginRoot);
const codexHome = process.env.CODEX_HOME
  ? path.resolve(process.env.CODEX_HOME)
  : path.join(os.homedir(), ".codex");
const hooksPath = path.join(codexHome, "hooks.json");
const snippetPath = path.join(pluginRoot, "codex-hooks-snippet.json");

function inferPluginName(root) {
  const basename = path.basename(root);
  const parentName = path.basename(path.dirname(root));
  if (/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(basename) && MANAGED_PLUGINS.includes(parentName)) {
    return parentName;
  }
  return basename;
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse ${label} ${filePath}: ${error.message}`);
  }
}

function stripManagedLegacyMarkers(raw) {
  const marker = MANAGED_PLUGINS.map((name) =>
    name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  ).join("|");
  const pattern = new RegExp(
    `^\\s*//\\s*(?:BEGIN\\s+(?:${marker}):hooks-v[0-9A-Za-z._-]+|END\\s+(?:${marker}):hooks)\\s*$`,
    "gm"
  );
  return raw.replace(pattern, "");
}

function readCurrentConfig() {
  if (!fs.existsSync(hooksPath)) {
    return { config: {}, raw: null, cleanedLegacyMarkers: false };
  }

  const raw = fs.readFileSync(hooksPath, "utf8");
  try {
    return { config: JSON.parse(raw), raw, cleanedLegacyMarkers: false };
  } catch (strictError) {
    const cleaned = stripManagedLegacyMarkers(raw);
    if (cleaned !== raw) {
      try {
        return { config: JSON.parse(cleaned), raw, cleanedLegacyMarkers: true };
      } catch (_cleanedError) {
        // Fall through to the original strict parse error; it points at the
        // file Codex failed to read.
      }
    }
    throw new Error(`Failed to parse ${hooksPath}: ${strictError.message}`);
  }
}

function cloneWithPluginRoot(value) {
  if (Array.isArray(value)) {
    return value.map(cloneWithPluginRoot);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneWithPluginRoot(child)])
    );
  }
  if (typeof value === "string") {
    return value.replace(/\$\{PLUGIN_ROOT\}/g, pluginRoot);
  }
  return value;
}

function commandTargetsPlugin(command) {
  if (typeof command !== "string") {
    return false;
  }
  const normalized = command.replace(/\\/g, "/");
  return (
    normalized.includes(`/${pluginName}/`) &&
    normalized.includes("/hooks/codex-runtime.js")
  );
}

function entryTargetsPlugin(entry) {
  return Array.isArray(entry && entry.hooks)
    ? entry.hooks.some((hook) => commandTargetsPlugin(hook.command))
    : false;
}

function countEntries(hooksByEvent) {
  return Object.values(hooksByEvent).reduce(
    (total, entries) => total + (Array.isArray(entries) ? entries.length : 0),
    0
  );
}

function pluginEntriesByEvent(hooksByEvent) {
  const found = {};
  for (const [eventName, entries] of Object.entries(hooksByEvent || {})) {
    if (!Array.isArray(entries)) {
      continue;
    }
    const matches = entries.filter(entryTargetsPlugin);
    if (matches.length > 0) {
      found[eventName] = matches;
    }
  }
  return found;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildNextConfig(config, desiredHooks) {
  const next = {
    ...config,
    hooks: config.hooks && typeof config.hooks === "object" ? { ...config.hooks } : {},
  };

  const currentPluginEntries = pluginEntriesByEvent(next.hooks);
  const alreadyInstalled = sameJson(currentPluginEntries, desiredHooks);
  const removed = countEntries(currentPluginEntries);
  const added = alreadyInstalled ? 0 : countEntries(desiredHooks);

  if (alreadyInstalled) {
    return { config: next, removed: 0, added: 0 };
  }

  for (const [eventName, entries] of Object.entries(next.hooks)) {
    if (Array.isArray(entries)) {
      next.hooks[eventName] = entries.filter((entry) => !entryTargetsPlugin(entry));
    }
  }

  for (const [eventName, entries] of Object.entries(desiredHooks)) {
    if (!Array.isArray(next.hooks[eventName])) {
      next.hooks[eventName] = [];
    }
    next.hooks[eventName].push(...entries);
  }

  return { config: next, removed, added };
}

function backupCurrentFile(raw) {
  if (raw === null) {
    return null;
  }

  const stamp = new Date().toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "-");
  let backupPath = `${hooksPath}.bak.${stamp}`;
  let suffix = 1;
  while (fs.existsSync(backupPath)) {
    backupPath = `${hooksPath}.bak.${stamp}.${suffix}`;
    suffix += 1;
  }
  fs.writeFileSync(backupPath, raw);
  return backupPath;
}

function main() {
  const snippet = readJson(snippetPath, "hook snippet");
  if (!snippet.version || !snippet.hooks || typeof snippet.hooks !== "object") {
    throw new Error(`${snippetPath} must contain version and hooks fields`);
  }

  const desiredHooks = cloneWithPluginRoot(snippet.hooks);
  const current = readCurrentConfig();
  const next = buildNextConfig(current.config, desiredHooks);
  const nextRaw = `${JSON.stringify(next.config, null, 2)}\n`;
  const currentComparableRaw = current.raw === null
    ? null
    : `${JSON.stringify(current.config, null, 2)}\n`;

  if (current.raw !== null && nextRaw === currentComparableRaw && !current.cleanedLegacyMarkers) {
    console.log(`${pluginName} hooks already up to date (${snippet.version})`);
    return;
  }

  fs.mkdirSync(codexHome, { recursive: true });
  const backupPath = backupCurrentFile(current.raw);
  fs.writeFileSync(hooksPath, nextRaw);

  console.log(`${pluginName} hooks installed (${snippet.version})`);
  console.log(`hooks file: ${hooksPath}`);
  console.log(`backup: ${backupPath || "not created (new hooks file)"}`);
  console.log(`entries removed: ${next.removed}`);
  console.log(`entries added: ${next.added}`);
  if (current.cleanedLegacyMarkers) {
    console.log("legacy JSON comment markers removed");
  }
  console.log("Restart Codex for hook changes to take effect.");
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
