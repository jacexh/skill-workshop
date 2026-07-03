---
name: rebuild
description: Compatibility alias for superpowers-memory:ingest bootstrap or full-refresh mode
---

# Rebuild Project Knowledge

`rebuild` is a compatibility alias for `superpowers-memory:ingest`.

- If `docs/superpowers/memory/` does not exist, use ingest bootstrap mode.
- If the knowledge base exists, use ingest full-refresh mode for the requested owner file or whole KB.

Use the `ingest` process from `plugins/superpowers-memory/skills/ingest/SKILL.md`.
