# Template Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize all 5 knowledge base templates in `plugins/superpowers-memory/templates/` based on the design spec, improving agent-usability by adding missing sections derived from GSD template analysis.

**Architecture:** Each task rewrites one template file in full. The frontmatter block is preserved exactly; only the body sections change. No new files are created.

**Tech Stack:** Markdown only. Verification via `grep` to confirm section presence.

**Spec:** `docs/superpowers/specs/2026-04-01-template-optimization-design.md`

---

### Task 1: Update architecture.md

**Files:**
- Modify: `plugins/superpowers-memory/templates/architecture.md`

- [ ] **Step 1: Overwrite the file with new content**

Write `plugins/superpowers-memory/templates/architecture.md`:

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

# Architecture

## Pattern Overview

**Overall:** [Pattern name: e.g., "Monolithic CLI", "Layered API", "Full-stack MVC", "Plugin Marketplace"]

**Key Characteristics:**
- [e.g., "Single executable with subcommands"]
- [e.g., "Stateless request handling"]
- [e.g., "File-based state, no database"]

## System Overview

<!-- One paragraph describing what this system does and its high-level architecture -->

## Layers

<!-- One entry per conceptual layer. Location is critical — it makes this actionable for planning. -->

**[Layer Name]:**
- Purpose: [What this layer does]
- Contains: [Types of code: e.g., "route handlers", "business logic"]
- Location: [`src/xxx/`]
- Depends on: [What it uses: e.g., "service layer only"]
- Used by: [What uses it: e.g., "CLI entry point"]

## Data Flow

<!-- Describe the primary data flows through the system. Use numbered steps. -->

**[Flow Name] (e.g., "HTTP Request", "CLI Command"):**

1. [Entry point]
2. [Processing step]
3. [Processing step]
4. [Output]

**State Management:**
- [How state is handled: e.g., "Stateless — no persistent state", "File-based in .planning/", "Database per request"]

## Entry Points

**[Entry Point Name]:**
- Location: [`path/to/file`]
- Triggers: [What invokes it: e.g., "CLI invocation", "HTTP request"]
- Responsibilities: [What it sets up or routes]

## Error Handling

<!-- System-level strategy: where errors are caught, what happens at boundaries.
     Code-level patterns (naming, async style) go in conventions.md. -->

**Strategy:** [e.g., "Throw exceptions, catch at command boundary", "Return Result<T,E>"]

**Patterns:**
- [e.g., "Services throw, command handlers catch and log, then exit(1)"]
- [e.g., "Validation errors surfaced before execution (fail fast)"]

## Cross-Cutting Concerns

**Logging:** [Approach: e.g., "console.log, no framework" or "pino, structured JSON"]
**Validation:** [Approach: e.g., "Zod schemas at API boundary" or "Manual in command handlers"]
**Authentication:** [Approach: e.g., "JWT middleware on protected routes" or "N/A"]

## Key Design Decisions

<!-- Brief notes on architectural choices that affect the whole system.
     Detailed rationale goes in decisions.md -->
```

- [ ] **Step 2: Verify required sections are present**

Run:
```bash
grep -n "^## " plugins/superpowers-memory/templates/architecture.md
```

Expected output (8 sections in this order):
```
## Pattern Overview
## System Overview
## Layers
## Data Flow
## Entry Points
## Error Handling
## Cross-Cutting Concerns
## Key Design Decisions
```

- [ ] **Step 3: Verify frontmatter is intact**

Run:
```bash
head -5 plugins/superpowers-memory/templates/architecture.md
```

Expected:
```
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---
```

- [ ] **Step 4: Commit**

```bash
git add plugins/superpowers-memory/templates/architecture.md
git commit -m "feat: update architecture.md template — add Pattern Overview, Layers, Entry Points, Error Handling, Cross-Cutting Concerns"
```

---

### Task 2: Update tech-stack.md

**Files:**
- Modify: `plugins/superpowers-memory/templates/tech-stack.md`

- [ ] **Step 1: Overwrite the file with new content**

Write `plugins/superpowers-memory/templates/tech-stack.md`:

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

# Tech Stack

## Languages & Frameworks

| Technology | Role | Version | Notes |
|-----------|------|---------|-------|
| | | | |

## Runtime

**Environment:** [e.g., "Node.js 20.x", "Python 3.12", "Bun 1.x"]
**Package Manager:** [e.g., "npm 10.x", "uv 0.4", "pnpm 9.x"]
**Lockfile:** [e.g., "package-lock.json", "uv.lock", "pnpm-lock.yaml"]

## Key Dependencies

<!-- List only 5-10 most critical dependencies — those essential to understanding the stack -->

| Package | Purpose | Why Chosen |
|---------|---------|------------|
| | | |

## Build & Dev Tools

| Tool | Purpose |
|------|---------|
| | |

## Configuration

**Environment:** [e.g., ".env files required", "KEY1, KEY2 must be set — see .env.example"]
**Build:** [e.g., "vite.config.ts, tsconfig.json" or "N/A — no build step"]

## Platform Requirements

**Development:** [e.g., "any platform" or "macOS/Linux; Docker required for local DB"]
**Production:** [e.g., "Vercel", "Docker container on Linux x86_64"]

## Infrastructure

<!-- Hosting, CI/CD, databases, external services, etc. -->
```

- [ ] **Step 2: Verify required sections are present**

Run:
```bash
grep -n "^## " plugins/superpowers-memory/templates/tech-stack.md
```

Expected output (7 sections in this order):
```
## Languages & Frameworks
## Runtime
## Key Dependencies
## Build & Dev Tools
## Configuration
## Platform Requirements
## Infrastructure
```

- [ ] **Step 3: Verify deps limit comment is present**

Run:
```bash
grep "5-10" plugins/superpowers-memory/templates/tech-stack.md
```

Expected: line containing `<!-- List only 5-10 most critical dependencies`

- [ ] **Step 4: Commit**

```bash
git add plugins/superpowers-memory/templates/tech-stack.md
git commit -m "feat: update tech-stack.md template — add Runtime, Configuration, Platform Requirements sections"
```

---

### Task 3: Update features.md

**Files:**
- Modify: `plugins/superpowers-memory/templates/features.md`

- [ ] **Step 1: Overwrite the file with new content**

Write `plugins/superpowers-memory/templates/features.md`:

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

# Features

## Implemented

<!-- List completed features with links to their spec/plan files -->

| Feature | Description | Added | Spec | Plan |
|---------|------------|-------|------|------|
| | | | | |

## In Progress

<!-- List features currently being implemented -->

| Feature | Description | Plan | Status |
|---------|------------|------|--------|
| | | | |

## Backlog

<!-- Features planned but not yet started. Source: specs without a corresponding plan. -->

| Feature | Description | Spec |
|---------|------------|------|
| | | |
```

- [ ] **Step 2: Verify sections and Implemented table columns**

Run:
```bash
grep -n "^## \|^| Feature" plugins/superpowers-memory/templates/features.md
```

Expected output includes:
```
## Implemented
| Feature | Description | Added | Spec | Plan |
## In Progress
| Feature | Description | Plan | Status |
## Backlog
| Feature | Description | Spec |
```

- [ ] **Step 3: Commit**

```bash
git add plugins/superpowers-memory/templates/features.md
git commit -m "feat: update features.md template — add Added column and Backlog section"
```

---

### Task 4: Update conventions.md

**Files:**
- Modify: `plugins/superpowers-memory/templates/conventions.md`

- [ ] **Step 1: Overwrite the file with new content**

Write `plugins/superpowers-memory/templates/conventions.md`:

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

# Conventions

## Naming Patterns

**Files:** [e.g., "kebab-case for all files", "PascalCase.tsx for React components"]
**Functions:** [e.g., "camelCase; handleX for event handlers; async functions no special prefix"]
**Variables:** [e.g., "camelCase; UPPER_SNAKE_CASE for module-level constants"]
**Types:** [e.g., "PascalCase interfaces and type aliases; no I-prefix"]

## Code Style

**Formatter:** [Tool + config file: e.g., "Prettier, .prettierrc" or "ruff format, pyproject.toml"]
**Linter:** [Tool + config file: e.g., "ESLint, eslint.config.js" or "ruff check, pyproject.toml"]
**Line length:** [e.g., "100 characters"]
**Quotes:** [e.g., "single quotes for strings"]
**Semicolons:** [e.g., "required" or "omitted" — N/A for Python]

## Import Organization

**Order:**
1. [e.g., "External packages (react, express, etc.)"]
2. [e.g., "Internal modules (@/lib, @/components)"]
3. [e.g., "Relative imports (., ..)"]
4. [e.g., "Type imports (import type {})"]

**Path Aliases:** [e.g., "@/ maps to src/" or "N/A"]

## Error Handling

<!-- Code-level patterns: how to write error handling code.
     System-level strategy (which layer catches what) goes in architecture.md. -->

**Strategy:** [e.g., "Throw errors, catch at boundaries" or "Return Result<T,E>"]
**Custom errors:** [e.g., "Extend Error class, named *Error (e.g., ValidationError)"]
**Async:** [e.g., "try/catch everywhere, no .catch() chains"]

## Logging

**Framework:** [e.g., "console.log (no framework)", "pino", "winston", "structlog"]
**Patterns:** [e.g., "Structured logging with context object", "Log at service boundaries only"]
**When:** [e.g., "Log state transitions and external calls; not inside utility functions"]

## Comments

**When:** [e.g., "Explain why, not what — business logic, algorithms, edge cases only"]
**JSDoc/TSDoc:** [e.g., "Required for public APIs; optional for internals" or "N/A"]
**TODO format:** [e.g., "// TODO(username): description #issue-number"]

## Function & Module Design

**Max function length:** [e.g., "50 lines; extract helpers beyond that"]
**Max parameters:** [e.g., "3; use options object beyond that"]
**Exports:** [e.g., "Named exports preferred; default export only for React components"]
**Barrel files:** [e.g., "index.ts re-exports public API; avoid circular deps" or "N/A"]

## Architecture Rules

<!-- Hard constraints: what is NOT allowed, boundaries that must not be crossed -->

## Testing Conventions

**Framework:** [e.g., "Vitest", "Jest", "pytest"] — run with: [command, e.g., "npm test", "pytest"]
**File location:** [e.g., "*.test.ts alongside source files", "tests/ directory mirroring src/"]
**Naming:** [e.g., "describe('ComponentName') > it('does X when Y')"]

**Mocking strategy:**
- Mock: [e.g., "External HTTP calls, file system, time"]
- Do NOT mock: [e.g., "Internal business logic, pure functions"]
- Framework: [e.g., "vi.mock() for modules, MSW for HTTP" or "unittest.mock.patch"]

**Fixtures / Factories:**
- Location: [e.g., "tests/fixtures/" or "conftest.py"]
- Pattern: [e.g., "Factory functions returning fresh objects, not static JSON"]

**Coverage:**
- Requirement: [e.g., "80% line coverage enforced in CI" or "no formal requirement"]
- Run: [e.g., "npm run test:coverage" or "pytest --cov"]

## Git & Workflow

<!-- Branch naming, commit message format, PR process -->
```

- [ ] **Step 2: Verify all 11 sections are present**

Run:
```bash
grep -n "^## " plugins/superpowers-memory/templates/conventions.md
```

Expected output (11 sections in this order):
```
## Naming Patterns
## Code Style
## Import Organization
## Error Handling
## Logging
## Comments
## Function & Module Design
## Architecture Rules
## Testing Conventions
## Git & Workflow
```

- [ ] **Step 3: Verify Error Handling scope comment is present**

Run:
```bash
grep "architecture.md" plugins/superpowers-memory/templates/conventions.md
```

Expected: line containing `<!-- Code-level patterns: how to write error handling code.`

- [ ] **Step 4: Commit**

```bash
git add plugins/superpowers-memory/templates/conventions.md
git commit -m "feat: update conventions.md template — add Naming Patterns, Code Style, Import Organization, Error Handling, Logging, Comments, Function & Module Design; expand Testing Conventions"
```

---

### Task 5: Update decisions.md

**Files:**
- Modify: `plugins/superpowers-memory/templates/decisions.md`

- [ ] **Step 1: Overwrite the file with new content**

Write `plugins/superpowers-memory/templates/decisions.md`:

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

# Decisions

## Known Issues

<!-- Living record of known problems. Each entry needs: description, file path(s), and fix direction.
     Remove entries when resolved. -->

### Tech Debt

<!-- Shortcuts or workarounds that will need revisiting -->
<!-- Format: **[Area]** (`path/to/file`) — description. Fix: approach. -->

### Known Bugs

<!-- Documented defects not yet fixed -->
<!-- Format: **[Bug]** — symptom. Reproduces when: condition. Location: `path/to/file`. -->

### Security Considerations

<!-- Known risks and current mitigations -->
<!-- Format: **[Risk]** — description. Mitigation: current approach. -->

---

<!-- ADR list below — add new decisions at the top of this section.
     Do not remove old decisions — mark superseded ones instead. -->

## ADR-NNN: [Decision Title]

**Date:** YYYY-MM-DD

**Status:** Proposed | Accepted | Superseded by ADR-NNN

**Context:** <!-- What is the issue that is motivating this decision? -->

**Decision:** <!-- What is the change that we're proposing/doing? -->

**Alternatives Considered:**
- Alternative A: ...
- Alternative B: ...

**Reason:** <!-- Why was this decision made over the alternatives? -->
```

- [ ] **Step 2: Verify Known Issues section and subsections are present**

Run:
```bash
grep -n "^## \|^### " plugins/superpowers-memory/templates/decisions.md
```

Expected output:
```
## Known Issues
### Tech Debt
### Known Bugs
### Security Considerations
## ADR-NNN: [Decision Title]
```

- [ ] **Step 3: Verify the horizontal rule separator is present**

Run:
```bash
grep -n "^---$" plugins/superpowers-memory/templates/decisions.md
```

Expected: 2 matches (frontmatter close + section separator)

- [ ] **Step 4: Commit**

```bash
git add plugins/superpowers-memory/templates/decisions.md
git commit -m "feat: update decisions.md template — add Known Issues section (Tech Debt, Known Bugs, Security)"
```

---

### Task 6: End-to-End Verification

- [ ] **Step 1: Confirm all 5 templates have correct frontmatter**

Run:
```bash
for f in plugins/superpowers-memory/templates/*.md; do
  echo "=== $f ==="
  head -5 "$f"
  echo
done
```

Expected: each file starts with `---`, `last_updated: YYYY-MM-DD`, `updated_by: superpowers-memory:<skill-name>`, `triggered_by_plan: null`, `---`

- [ ] **Step 2: Confirm section counts match spec**

Run:
```bash
echo "architecture:"; grep -c "^## " plugins/superpowers-memory/templates/architecture.md
echo "tech-stack:";   grep -c "^## " plugins/superpowers-memory/templates/tech-stack.md
echo "features:";     grep -c "^## " plugins/superpowers-memory/templates/features.md
echo "conventions:";  grep -c "^## " plugins/superpowers-memory/templates/conventions.md
echo "decisions:";    grep -c "^## " plugins/superpowers-memory/templates/decisions.md
```

Expected counts:
```
architecture: 8
tech-stack: 7
features: 3
conventions: 10
decisions: 2
```

- [ ] **Step 3: Bump plugin version to 1.0.8**

Edit `plugins/superpowers-memory/.claude-plugin/plugin.json` — change `"version": "1.0.7"` to `"version": "1.0.8"`.

- [ ] **Step 4: Also update the installed copy**

Edit `/home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory/.claude-plugin/plugin.json` — change `"version"` to `"1.0.8"`.

Also copy updated templates to installed location:
```bash
cp plugins/superpowers-memory/templates/*.md \
   /home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory/templates/
```

- [ ] **Step 5: Commit version bump**

```bash
git add plugins/superpowers-memory/.claude-plugin/plugin.json
git commit -m "chore: bump superpowers-memory to v1.0.8"
```
