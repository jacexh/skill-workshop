# Template Optimization Design

**Date:** 2026-04-01

**Scope:** Optimize the 5 existing knowledge base templates in `plugins/superpowers-memory/templates/` based on a comparative analysis with the GSD (get-shit-done) codebase template set. No new template files will be added.

**Reference:** [GSD codebase templates](https://github.com/gsd-build/get-shit-done/tree/main/get-shit-done/templates/codebase)

---

## Motivation

The current templates were designed from first principles. GSD's templates have been refined through practical agent usage and cover several gaps:

- **architecture.md** lacks pattern naming, layer definitions with file paths, entry points, error handling, and cross-cutting concerns — all critical for agent planning
- **tech-stack.md** lacks runtime details, configuration file references, and platform requirements
- **features.md** lacks a date column and backlog section
- **conventions.md** is too coarse — missing import ordering, error handling patterns, logging, comments policy, function/module design, and testing detail
- **decisions.md** has no place for known issues (tech debt, bugs, security concerns)

GSD also has `concerns.md` and `testing.md` which have no direct counterparts. Their content will be absorbed into `decisions.md` and `conventions.md` respectively.

---

## File 1: architecture.md

**Change magnitude: Major**

### Remove
- `Module Structure` table (replaced by `Layers` section — same information but with `Location` field, making it actionable for agent planning)

### Add

**`## Pattern Overview`** (before System Overview)
```markdown
## Pattern Overview

**Overall:** [Pattern name: e.g., "Monolithic CLI", "Layered API", "Full-stack MVC"]

**Key Characteristics:**
- [e.g., "Single executable"]
- [e.g., "Stateless request handling"]
- [e.g., "File-based state, no database"]
```

**`## Layers`** (replaces Module Structure table)
```markdown
## Layers

**[Layer Name]:**
- Purpose: [What this layer does]
- Contains: [Types of code: e.g., "route handlers", "business logic"]
- Location: [`src/xxx/`]
- Depends on: [What it uses]
- Used by: [What uses it]
```

**`State Management` subsection** inside Data Flow
```markdown
**State Management:**
- [How state is handled: e.g., "Stateless", "File-based in .planning/", "Database per request"]
```

**`## Entry Points`** (after Data Flow)
```markdown
## Entry Points

**[Entry Point Name]:**
- Location: [`path/to/file`]
- Triggers: [What invokes it: e.g., "CLI invocation", "HTTP request"]
- Responsibilities: [What it sets up or routes]
```

**`## Error Handling`** (after Entry Points)

> Scope: system-level strategy — where errors are caught, what happens at boundaries. Code-level patterns (naming, async style) go in `conventions.md`.

```markdown
## Error Handling

**Strategy:** [e.g., "Throw exceptions, catch at command boundary", "Return Result<T,E>"]

**Patterns:**
- [e.g., "Services throw, command handlers catch and exit(1)"]
- [e.g., "Validation errors shown before execution (fail fast)"]
```

**`## Cross-Cutting Concerns`** (after Error Handling)
```markdown
## Cross-Cutting Concerns

**Logging:** [Approach: e.g., "console.log, no framework"]
**Validation:** [Approach: e.g., "Zod schemas at API boundary"]
**Authentication:** [Approach: e.g., "JWT middleware on protected routes" or "N/A"]
```

### Keep unchanged
- Frontmatter (`last_updated`, `updated_by`, `triggered_by_plan`)
- `## System Overview` (paragraph)
- `## Data Flow` (numbered steps)
- `## Key Design Decisions` (brief notes, detailed rationale in decisions.md)

---

## File 2: tech-stack.md

**Change magnitude: Medium**

### Add

**`## Runtime`** (after Languages & Frameworks)
```markdown
## Runtime

**Environment:** [e.g., "Node.js 20.x", "Python 3.12"]
**Package Manager:** [e.g., "npm 10.x", "uv 0.4"]
**Lockfile:** [e.g., "package-lock.json", "uv.lock"]
```

**`## Configuration`** (after Build & Dev Tools)
```markdown
## Configuration

**Environment:** [e.g., ".env files required", "DATABASE_URL, API_KEY must be set"]
**Build:** [e.g., "vite.config.ts, tsconfig.json"]
```

**`## Platform Requirements`** (after Configuration)
```markdown
## Platform Requirements

**Development:** [e.g., "any platform", "Docker required for local DB"]
**Production:** [e.g., "Vercel", "Docker container on Linux"]
```

### Modify
- `## Key Dependencies` table: add HTML comment `<!-- List only 5-10 most critical dependencies -->`

### Keep unchanged
- Frontmatter
- `## Languages & Frameworks` table
- `## Key Dependencies` table structure
- `## Build & Dev Tools` table
- `## Infrastructure`

---

## File 3: features.md

**Change magnitude: Small**

### Modify
- `## Implemented` table: add `Added` column (date feature was introduced)

  ```markdown
  | Feature | Description | Added | Spec | Plan |
  |---------|------------|-------|------|------|
  ```

### Add

**`## Backlog`** (after In Progress)
```markdown
## Backlog

<!-- Features planned but not yet started. Source: specs without a corresponding plan. -->

| Feature | Description | Spec |
|---------|------------|------|
```

### Keep unchanged
- Frontmatter
- `## In Progress` table

---

## File 4: conventions.md

**Change magnitude: Major**

The existing four sections are kept but `Coding Standards` is split into fine-grained sections, `Testing Conventions` is expanded into a full sub-structure, and several new coding sections are added.

### Replace
- `## Coding Standards` (generic) → split into `## Naming Patterns` + `## Code Style`

### Add (coding sections)

**`## Naming Patterns`**
```markdown
## Naming Patterns

**Files:** [e.g., "kebab-case for all files"]
**Functions:** [e.g., "camelCase, handleX for event handlers"]
**Variables:** [e.g., "camelCase, UPPER_SNAKE_CASE for constants"]
**Types:** [e.g., "PascalCase interfaces, no I-prefix"]
```

**`## Code Style`**
```markdown
## Code Style

**Formatter:** [Tool + config file: e.g., "Prettier, .prettierrc"]
**Linter:** [Tool + config file: e.g., "ESLint, eslint.config.js"]
**Line length:** [e.g., "100 characters"]
**Quotes:** [e.g., "single quotes"]
**Semicolons:** [e.g., "required" or "omitted"]
```

**`## Import Organization`**
```markdown
## Import Organization

**Order:**
1. [e.g., "External packages"]
2. [e.g., "Internal modules (@/lib, @/components)"]
3. [e.g., "Relative imports"]
4. [e.g., "Type imports"]

**Path Aliases:** [e.g., "@/ maps to src/"]
```

**`## Error Handling`**

> Scope: code-level patterns — how to write error handling code. System-level strategy (which layer catches what) goes in `architecture.md`.

```markdown
## Error Handling

**Strategy:** [e.g., "Throw errors, catch at boundaries"]
**Custom errors:** [e.g., "Extend Error, named *Error"]
**Async:** [e.g., "try/catch, no .catch() chains"]
```

**`## Logging`**
```markdown
## Logging

**Framework:** [e.g., "console.log", "pino", "winston"]
**Patterns:** [e.g., "Structured logging with context object"]
**When:** [e.g., "Log at service boundaries, not in utils"]
```

**`## Comments`**
```markdown
## Comments

**When:** [e.g., "Explain why, not what. Business logic and edge cases only."]
**JSDoc:** [e.g., "Required for public APIs, optional for internals"]
**TODO format:** [e.g., "// TODO(username): description #issue"]
```

**`## Function & Module Design`**
```markdown
## Function & Module Design

**Max function length:** [e.g., "50 lines, extract helpers beyond that"]
**Max parameters:** [e.g., "3; use options object beyond that"]
**Exports:** [e.g., "Named exports preferred; default for React components"]
**Barrel files:** [e.g., "index.ts re-exports public API; avoid circular deps"]
```

### Expand

**`## Testing Conventions`** — replace the current one-liner section with:
```markdown
## Testing Conventions

**Framework:** [e.g., "Vitest", "Jest", "pytest"] — run with: [command]
**File location:** [e.g., "*.test.ts alongside source", "tests/ directory"]
**Naming:** [e.g., "describe('ComponentName') > it('does X when Y')"]

**Mocking strategy:**
- [What to mock: e.g., "External HTTP calls, file system"]
- [What NOT to mock: e.g., "Internal business logic"]
- [Framework: e.g., "vi.mock(), MSW for HTTP"]

**Fixtures / Factories:**
- [Location: e.g., "tests/fixtures/"]
- [Pattern: e.g., "Factory functions, not static JSON"]

**Coverage:**
- [Requirement: e.g., "80% line coverage enforced in CI"]
- [Run: e.g., "npm run test:coverage"]
```

### Keep unchanged
- Frontmatter
- `## Architecture Rules`
- `## Git & Workflow`

---

## File 5: decisions.md

**Change magnitude: Medium**

### Add

**`## Known Issues`** section at the top (before ADR list), with a horizontal rule separating the two concerns:

```markdown
## Known Issues

<!-- Living record of known problems. Each entry needs: description, file path(s), and fix direction.
     Remove entries when resolved. -->

### Tech Debt

<!-- Shortcuts or workarounds that will need revisiting -->
<!-- Format: **[Area]** (`path/to/file`) — description. Fix: approach. -->

### Known Bugs

<!-- Documented defects not yet fixed -->
<!-- Format: **[Bug]** — symptom. Reproduces when: condition. Location: `path`. -->

### Security Considerations

<!-- Known risks and current mitigations -->
<!-- Format: **[Risk]** — description. Mitigation: current approach. -->

---
<!-- ADR list below — add new decisions at the top of this section -->
```

### Keep unchanged
- Frontmatter
- ADR entry format (Date, Status, Context, Decision, Alternatives Considered, Reason)
- Instruction to not remove old ADRs, only mark superseded

---

## Summary of Changes

| Template | Magnitude | Key Additions |
|----------|-----------|---------------|
| architecture.md | Major | Pattern Overview, Layers (replaces table), Entry Points, Error Handling, Cross-Cutting Concerns, State Management |
| tech-stack.md | Medium | Runtime, Configuration, Platform Requirements, deps limit note |
| features.md | Small | Added date column, Backlog section |
| conventions.md | Major | Naming Patterns, Code Style, Import Organization, Error Handling, Logging, Comments, Function & Module Design, expanded Testing |
| decisions.md | Medium | Known Issues section (Tech Debt, Known Bugs, Security) |
