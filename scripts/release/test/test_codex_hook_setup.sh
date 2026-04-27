#!/usr/bin/env bash
# Validate Codex setup installers migrate legacy hook blocks into strict JSON.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

export CODEX_HOME="$TMP/codex"
mkdir -p "$CODEX_HOME"

cat > "$CODEX_HOME/hooks.json" <<'JSON'
{
  "hooks": {
    "SessionStart": [
      // BEGIN designing-tests:hooks-v1.6.0
      {
        "matcher": "startup|resume|clear",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.codex/plugins/skill-workshop-codex/codex-plugins/designing-tests/hooks/codex-runtime.js\" session-start"
          }
        ]
      }
      // END designing-tests:hooks
      ,
      // BEGIN superpowers-architect:hooks-v1.6.2
      {
        "matcher": "startup|resume|clear",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.codex/plugins/skill-workshop-codex/codex-plugins/superpowers-architect/hooks/codex-runtime.js\" session-start"
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
            "command": "node \"$HOME/.codex/plugins/skill-workshop-codex/codex-plugins/superpowers-memory/hooks/codex-runtime.js\" session-start"
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
            "command": "node \"$HOME/.codex/plugins/skill-workshop-codex/codex-plugins/superpowers-memory/hooks/codex-runtime.js\" user-prompt-submit"
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
            "command": "node \"$HOME/.codex/plugins/skill-workshop-codex/codex-plugins/superpowers-memory/hooks/codex-runtime.js\" pre-tool-use"
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

node "$ROOT/codex-plugins/designing-tests/scripts/install-codex-hooks.js" >/dev/null
node "$ROOT/codex-plugins/superpowers-architect/scripts/install-codex-hooks.js" >/dev/null
node "$ROOT/codex-plugins/superpowers-memory/scripts/install-codex-hooks.js" >/dev/null

before="$(cat "$CODEX_HOME/hooks.json")"
node "$ROOT/codex-plugins/designing-tests/scripts/install-codex-hooks.js" >/dev/null
node "$ROOT/codex-plugins/superpowers-architect/scripts/install-codex-hooks.js" >/dev/null
node "$ROOT/codex-plugins/superpowers-memory/scripts/install-codex-hooks.js" >/dev/null
after="$(cat "$CODEX_HOME/hooks.json")"
[ "$before" = "$after" ] || { echo "FAIL setup installers are not idempotent"; exit 1; }

ROOT="$ROOT" node <<'NODE'
const fs = require("fs");
const path = require("path");

const root = process.env.ROOT;
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

const commands = [];
for (const entries of Object.values(cfg.hooks)) {
  for (const entry of entries) {
    for (const hook of entry.hooks || []) {
      commands.push(hook.command);
    }
  }
}

const expected = [
  `node "${root}/codex-plugins/designing-tests/hooks/codex-runtime.js" session-start`,
  `node "${root}/codex-plugins/superpowers-architect/hooks/codex-runtime.js" session-start`,
  `node "${root}/codex-plugins/superpowers-memory/hooks/codex-runtime.js" session-start`,
  `node "${root}/codex-plugins/superpowers-memory/hooks/codex-runtime.js" user-prompt-submit`,
  `node "${root}/codex-plugins/superpowers-memory/hooks/codex-runtime.js" pre-tool-use`,
  "echo keep-user-hook",
];

for (const command of expected) {
  if (!commands.includes(command)) {
    fail(`missing command: ${command}`);
  }
}

for (const plugin of ["designing-tests", "superpowers-architect", "superpowers-memory"]) {
  const matches = commands.filter((command) => command.includes(`/${plugin}/hooks/codex-runtime.js`));
  const want = plugin === "superpowers-memory" ? 3 : 1;
  if (matches.length !== want) {
    fail(`${plugin} command count ${matches.length}, want ${want}`);
  }
}

console.log("  codex hook setup: strict JSON migration correct");
NODE
