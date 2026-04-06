---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

<!-- OWNER: Naming conventions, code style, architecture rules, testing conventions, git workflow.
     Architecture Rules here are PROJECT-SPECIFIC constraints only.
     For general DDD/Clean Architecture rules, reference design-pattern documents — do not duplicate.
     System-level error strategy belongs in architecture.md.

     CONTENT EXCLUSION: Do not repeat rules already enforced by formatter/linter.
     Principle: if the formatter handles it, don't repeat it here. -->

# Conventions

## Naming Patterns

**Files:** [e.g., "kebab-case for all files", "PascalCase.tsx for React components"]
**Functions/Methods:** [e.g., "camelCase", "snake_case"]
**Variables/Constants:** [e.g., "camelCase; UPPER_SNAKE_CASE for module-level constants"]
**Types:** [e.g., "PascalCase interfaces and type aliases"]

## Code Style

**Formatter:** [Tool + config file: e.g., "gofmt" or "Prettier, .prettierrc"]
**Linter:** [Tool + config file: e.g., "golangci-lint, .golangci.yml" or "ESLint, eslint.config.js"]
<!-- Only include style rules that DEVIATE from formatter/linter defaults.
     If the formatter handles it, don't repeat it here. -->

## Error Handling

<!-- Code-level patterns: how to write error handling code.
     System-level strategy (which layer catches what) goes in architecture.md. -->

**Strategy:** [e.g., "Throw errors, catch at boundaries" or "Return Result<T,E>"]
**Custom errors:** [e.g., "Extend Error class, named *Error" or "Wrap with fmt.Errorf"]

## Architecture Rules

<!-- Project-specific hard constraints: what is NOT allowed, boundaries that must not be crossed.
     For general DDD/Clean Architecture rules, reference design-pattern docs — do not duplicate here. -->

## Testing Conventions

**Framework & command:** [e.g., "go test ./...", "pytest", "vitest — npm test"]
**Mock principle:**
- Mock: [e.g., "External HTTP calls, databases, time"]
- Do NOT mock: [e.g., "Internal business logic, pure functions"]
**Coverage target:** [e.g., "80% line coverage" or "no formal requirement"]
<!-- Optional: Fixtures location, E2E strategy, performance benchmarks -->

## Git & Workflow

<!-- Branch naming, commit message format, PR process -->

## Domain-Specific Conventions [OPTIONAL]

<!-- Add sections based on project needs. Common examples:
     - Database Standards (table naming, migrations, indexing strategy)
     - API Standards (routing conventions, versioning, response format)
     - Frontend Standards (component patterns, state management)
     - Security Standards (input validation, auth patterns)
     Only add sections with non-obvious, project-specific rules. -->
