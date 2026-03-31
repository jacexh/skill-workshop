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
