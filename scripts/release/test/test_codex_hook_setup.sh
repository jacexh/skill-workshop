#!/usr/bin/env bash
# Validate Codex setup installers migrate legacy hook blocks into strict JSON.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

export CODEX_HOME="$TMP/codex"
INSTALL_ROOT="$TMP/cache/skill-workshop-codex"
mkdir -p "$CODEX_HOME"
for plugin in superpowers-architect superpowers-memory; do
  mkdir -p "$INSTALL_ROOT/$plugin"
  cp -R "$ROOT/codex-plugins/$plugin" "$INSTALL_ROOT/$plugin/1.12.4"
done

cat > "$CODEX_HOME/hooks.json" <<'JSON'
{
  "hooks": {
    "SessionStart": [
      // BEGIN superpowers-architect:hooks-v1.6.2
      {
        "matcher": "startup|resume|clear",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.codex/plugins/cache/skill-workshop-codex/superpowers-architect/1.12.3/hooks/codex-runtime.js\" session-start"
          }
        ]
      }
      // END superpowers-architect:hooks
      ,
      // BEGIN superpowers-memory:hooks-v1.11.0
      {
        "matcher": "startup|resume|clear",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.codex/plugins/cache/skill-workshop-codex/superpowers-memory/1.12.3/hooks/codex-runtime.js\" session-start"
          }
        ]
      }
      // END superpowers-memory:hooks
    ],
    "UserPromptSubmit": [
      // BEGIN superpowers-memory:hooks-v1.11.0
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.codex/plugins/cache/skill-workshop-codex/superpowers-memory/1.12.3/hooks/codex-runtime.js\" user-prompt-submit"
          }
        ]
      }
      // END superpowers-memory:hooks
    ],
    "PreToolUse": [
      // BEGIN superpowers-memory:hooks-v1.11.0
      {
        "matcher": "apply_patch|mcp__filesystem__.*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.codex/plugins/cache/skill-workshop-codex/superpowers-memory/1.12.3/hooks/codex-runtime.js\" pre-tool-use"
          }
        ]
      }
      // END superpowers-memory:hooks
    ],
    "OtherEvent": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo keep-user-hook"
          }
        ]
      }
    ]
  }
}
JSON

node "$INSTALL_ROOT/superpowers-architect/1.12.4/scripts/install-codex-hooks.js" >/dev/null
node "$INSTALL_ROOT/superpowers-memory/1.12.4/scripts/install-codex-hooks.js" >/dev/null

before="$(cat "$CODEX_HOME/hooks.json")"
node "$INSTALL_ROOT/superpowers-architect/1.12.4/scripts/install-codex-hooks.js" >/dev/null
node "$INSTALL_ROOT/superpowers-memory/1.12.4/scripts/install-codex-hooks.js" >/dev/null
after="$(cat "$CODEX_HOME/hooks.json")"
[ "$before" = "$after" ] || { echo "FAIL setup installers are not idempotent"; exit 1; }

INSTALL_ROOT="$INSTALL_ROOT" node <<'NODE'
const fs = require("fs");
const path = require("path");

const installRoot = process.env.INSTALL_ROOT;
const hooksPath = path.join(process.env.CODEX_HOME, "hooks.json");
const raw = fs.readFileSync(hooksPath, "utf8");
const cfg = JSON.parse(raw);

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

if (raw.includes("// BEGIN") || raw.includes("// END")) {
  fail("legacy JSON comments were not removed");
}
if (raw.includes(".codex/plugins/skill-workshop-codex/codex-plugins")) {
  fail("legacy runtime path remained in hooks.json");
}
if (raw.includes("/1.12.3/")) {
  fail("stale cache runtime path remained in hooks.json");
}

const commands = [];
for (const entries of Object.values(cfg.hooks)) {
  for (const entry of entries) {
    for (const hook of entry.hooks || []) {
      commands.push(hook.command);
    }
  }
}

const expected = [
  `node "${installRoot}/superpowers-architect/1.12.4/hooks/codex-runtime.js" session-start`,
  `node "${installRoot}/superpowers-architect/1.12.4/hooks/codex-runtime.js" user-prompt-submit`,
  `node "${installRoot}/superpowers-memory/1.12.4/hooks/codex-runtime.js" session-start`,
  `node "${installRoot}/superpowers-memory/1.12.4/hooks/codex-runtime.js" user-prompt-submit`,
  `node "${installRoot}/superpowers-memory/1.12.4/hooks/codex-runtime.js" pre-tool-use`,
  "echo keep-user-hook",
];

for (const command of expected) {
  if (!commands.includes(command)) {
    fail(`missing command: ${command}`);
  }
}
if (commands.some((command) => command.includes("/superpowers-ddd-architect/"))) {
  fail("retired superpowers-ddd-architect command should not be installed");
}

for (const plugin of ["superpowers-architect", "superpowers-memory"]) {
  const matches = commands.filter((command) => command.includes(`/${plugin}/1.12.4/hooks/codex-runtime.js`));
  const want =
    plugin === "superpowers-memory" ? 3 : 2;
  if (matches.length !== want) {
    fail(`${plugin} command count ${matches.length}, want ${want}`);
  }
}

console.log("  codex hook setup: strict JSON migration correct");
NODE

for plugin in superpowers-architect superpowers-memory; do
  printf '{broken native hook source\n' > "$INSTALL_ROOT/$plugin/1.12.4/hooks/hooks.json"
done

node "$INSTALL_ROOT/superpowers-architect/1.12.4/scripts/install-codex-hooks.js" remove >/dev/null
node "$INSTALL_ROOT/superpowers-memory/1.12.4/scripts/install-codex-hooks.js" remove >/dev/null

INSTALL_ROOT="$INSTALL_ROOT" node <<'NODE'
const fs = require("fs");
const path = require("path");

const hooksPath = path.join(process.env.CODEX_HOME, "hooks.json");
const cfg = JSON.parse(fs.readFileSync(hooksPath, "utf8"));

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

const commands = [];
for (const entries of Object.values(cfg.hooks || {})) {
  for (const entry of entries) {
    for (const hook of entry.hooks || []) {
      commands.push(hook.command);
    }
  }
}

if (commands.some((command) => command.includes("/skill-workshop-codex/"))) {
  fail("skill-workshop fallback hooks remained after remove");
}
if (!commands.includes("echo keep-user-hook")) {
  fail("user hook was removed by fallback cleanup");
}
for (const [eventName, entries] of Object.entries(cfg.hooks || {})) {
  if (Array.isArray(entries) && entries.length === 0) {
    fail(`empty hook event remained after cleanup: ${eventName}`);
  }
}

console.log("  codex hook setup: fallback cleanup correct");
NODE
