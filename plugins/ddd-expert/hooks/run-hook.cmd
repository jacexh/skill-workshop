#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
plugin_root="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

case "$mode" in
  pre-tool-use)
    exec "$plugin_root/hooks/pre-tool-use"
    ;;
  *)
    printf '{}\n'
    ;;
esac
