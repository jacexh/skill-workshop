---
name: rebuild
description: Use when initializing project knowledge for the first time or when knowledge has drifted too far from reality — full codebase scan and knowledge regeneration
---

# Rebuild Project Knowledge

Scan the entire codebase and generate a complete project knowledge base from scratch.

**Announce at start:** "I'm rebuilding the project knowledge base from the codebase."

## When to Use

- First time setting up the knowledge base for a project
- Knowledge base has drifted significantly from reality
- User explicitly requests a full rebuild

## Process

1. **Scan the codebase:**
   - Read project structure: `ls`, key directories, entry points
   - Read configuration files: `package.json`, `Cargo.toml`, `pyproject.toml`, `Makefile`, `docker-compose.yml`, etc.
   - Read existing documentation: `README.md`, `CLAUDE.md`, `docs/` directory
   - Read existing specs and plans: `docs/superpowers/specs/`, `docs/superpowers/plans/`
   - Check git log for recent development history: `git log --oneline -20`
   - Sample key source files to understand architecture patterns

2. **Generate knowledge files:**

   Create `docs/project-knowledge/` directory if it doesn't exist.

   For each of the 5 knowledge files, use the plugin template as the structural basis and fill in concrete content from the codebase analysis:

   - **architecture.md** — System overview, module structure (from directory layout and imports), data flow (from entry points and key modules)
   - **tech-stack.md** — Languages and frameworks (from config files), key dependencies (from package manifests), build tools (from scripts/Makefile)
   - **features.md** — Implemented features (from specs, README, and code), in-progress features (from plans with unchecked items)
   - **conventions.md** — Coding standards (from linter configs, existing patterns), architecture rules (from CLAUDE.md or observed patterns), testing conventions (from test directory structure and existing tests)
   - **decisions.md** — Extract significant decisions from git history, specs, and code comments. Create ADR entries for non-obvious architectural choices.

3. **Set frontmatter:**
   For every generated file:
   - `last_updated`: today's date (YYYY-MM-DD)
   - `updated_by`: `superpowers-memory:rebuild`
   - `triggered_by_plan`: `"none"` (literal string — not YAML null)

4. **Generate MEMORY.md index:**

   After writing the 5 knowledge files, generate `docs/project-knowledge/MEMORY.md`:

   - For each of the 5 files, extract 2-3 concrete key points from the content you just wrote (e.g., specific pattern names, version numbers, rule names — not generic descriptions)
   - Write the file following the format in `templates/MEMORY.md`, setting `updated_by: superpowers-memory:rebuild` and `triggered_by_plan: "none"`

   **Size constraint:** Keep MEMORY.md under 30 lines total.

5. **Commit:**

```bash
git add docs/project-knowledge/
git commit -m "docs: rebuild project knowledge base from codebase"
```

6. **Report:**
   - Summarize what was generated
   - Note any areas where information was sparse or uncertain
   - Suggest running `superpowers-memory:update` after the next iteration to keep knowledge fresh

## Quality Guidelines

- Be factual: only include what you can verify from the codebase. Do not speculate.
- Be concise: each file should be scannable in under 2 minutes
- Be structured: follow the template format strictly so incremental updates work cleanly
- Link to sources: reference file paths, spec files, and plan files where relevant
