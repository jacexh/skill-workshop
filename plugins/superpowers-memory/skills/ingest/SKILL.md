---
name: ingest
description: Use to create, incrementally update, or full-refresh Project Knowledge Base from specs, plans, ADRs, docs, memory candidates, and validated code facts
---

# Ingest Project Knowledge

Write durable project facts into `docs/project-knowledge/`. This is the only normal knowledge-writing path.

**Announce at start:** "I'm ingesting project knowledge."

## Modes

- **Incremental ingest:** default after a spec, plan, PR, or implementation branch. Read source documents first and update only affected owner files.
- **Bootstrap ingest:** use when `docs/project-knowledge/` does not exist. Read the project and create the initial owner files plus compact `index.md`.
- **Full-refresh ingest:** use when `superpowers-memory:lint` reports high drift, owner-file structure is obsolete, or the user explicitly asks to regenerate target files.

## Source Authority

Read sources in this order:

1. `docs/superpowers/specs/*.md`
2. `docs/superpowers/plans/*.md`
3. ADRs and project decision documents
4. README and user-facing documentation
5. Explicit Memory candidates from `query`
6. Code/diff inspection for validation, paths, names, and implementation status
7. Commit messages as weak hints only

## Process

1. Acquire the write lock:

```bash
node "${CLAUDE_PLUGIN_ROOT:-plugins/superpowers-memory}/hooks/hook-runtime.js" lock superpowers-memory:ingest
```

2. Identify changed or requested source documents.
3. Extract durable capabilities, boundaries, decisions, terms, conventions, dependencies, and lifecycle facts.
4. Route each fact to exactly one owner file per `content-rules.md`.
5. Validate anchors against code or docs when the fact names files, commands, dependencies, or implemented behavior.
6. Update only affected owner files.
7. Regenerate `docs/project-knowledge/index.md` when routing or key points changed.
8. Run verification:

```bash
node "${CLAUDE_PLUGIN_ROOT:-plugins/superpowers-memory}/hooks/hook-runtime.js" verify
```

9. Fix `staleRefs`, `shapeViolations`, `readinessWarnings`, or `ssotViolations` before committing.
10. Release the write lock:

```bash
node "${CLAUDE_PLUGIN_ROOT:-plugins/superpowers-memory}/hooks/hook-runtime.js" unlock
```

## Compatibility

- `superpowers-memory:update` is a thin alias for incremental ingest.
- `superpowers-memory:rebuild` is a thin alias for bootstrap ingest when no KB exists, or full-refresh ingest when one exists.
