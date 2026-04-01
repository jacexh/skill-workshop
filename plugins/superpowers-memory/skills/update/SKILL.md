---
name: update
description: Use after completing a development branch or when prompted by Stop hook — incrementally updates project knowledge base from recent changes
---

# Update Project Knowledge

Incrementally update the project knowledge base based on changes from the current iteration.

**Announce at start:** "I'm updating the project knowledge base."

## Prerequisites

- `docs/project-knowledge/` must exist. If not, tell the user to run `superpowers-memory:rebuild` first.

## Process

1. **Gather context:**
   - Read all 5 current knowledge files from `docs/project-knowledge/`
   - Identify the most recent plan file: check `docs/superpowers/plans/` for recently modified plans, or ask the user which plan triggered this update
   - Read the triggering plan file and its associated spec (from `docs/superpowers/specs/`)
   - Run `git diff main...HEAD --stat` (or appropriate base branch) to see what files changed

2. **Analyze what changed:**
   - New features implemented? → update `features.md`
   - Architecture changed (new modules, changed data flow)? → update `architecture.md`
   - New dependencies added? → update `tech-stack.md`
   - New conventions established? → update `conventions.md`
   - Significant design decisions made? → add ADR to `decisions.md`

3. **Apply updates:**
   - Only modify files that need changes — do not rewrite unchanged files
   - Preserve existing content; append or modify specific sections
   - Update frontmatter in every modified file:
     - `last_updated`: today's date (YYYY-MM-DD)
     - `updated_by`: `superpowers-memory:update`
     - `triggered_by_plan`: the plan filename that triggered this update (e.g., `2026-03-31-superpowers-memory.md`)

4. **Regenerate MEMORY.md index:**

   Always regenerate `docs/project-knowledge/MEMORY.md` in full (full overwrite — any file's key points may have changed):

   - Re-read all 5 knowledge files (including any you just updated)
   - Extract 2-3 concrete key points per file
   - Write `docs/project-knowledge/MEMORY.md` using this exact format:

   ```markdown
   ---
   last_updated: YYYY-MM-DD
   updated_by: superpowers-memory:update
   triggered_by_plan: <plan-filename>
   ---

   # Project Knowledge Index

   - [architecture.md](architecture.md) — System overview, module structure, data flow
     Key points: [2-3 specific facts from architecture.md]

   - [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
     Key points: [2-3 specific facts from tech-stack.md]

   - [features.md](features.md) — Implemented features, in-progress work
     Key points: [2-3 specific facts from features.md]

   - [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
     Key points: [2-3 specific facts from conventions.md]

   - [decisions.md](decisions.md) — ADR log, known issues
     Key points: [2-3 specific facts from decisions.md]
   ```

   **Size constraint:** Keep MEMORY.md under 30 lines total.

5. **Report changes:**
   - List which knowledge files were updated and what changed
   - Confirm MEMORY.md was regenerated
   - If no knowledge file updates were needed, still regenerate MEMORY.md

## Templates

Knowledge files follow the structure defined in the plugin templates. If you need to add a new section that doesn't exist in the current file, refer to the template for the expected format:

- `architecture.md` → System Overview, Module Structure, Data Flow, Key Design Decisions
- `tech-stack.md` → Languages & Frameworks, Key Dependencies, Build & Dev Tools, Infrastructure
- `features.md` → Implemented (with spec/plan links), In Progress
- `conventions.md` → Coding Standards, Architecture Rules, Testing Conventions, Git & Workflow
- `decisions.md` → ADR format (Context, Decision, Alternatives, Reason)

## Commit

After updating, commit the changes:

```bash
git add docs/project-knowledge/
git commit -m "docs: update project knowledge base from [plan-name]"
```
