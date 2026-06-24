---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

<!-- OWNER: Naming conventions, code style, architecture rules, testing conventions, git workflow.
     Architecture Rules here are PROJECT-SPECIFIC constraints only.
     For general DDD/Clean Architecture rules, reference design-pattern documents — do not duplicate.
     System-level error strategy belongs in architecture.md.
     This file is current guardrails, not dependency inventory, decision history,
     or feature description.

     CONTENT EXCLUSION: Do not repeat rules already enforced by formatter/linter.
     Principle: if the formatter handles it, don't repeat it here.

     Reference Query Coverage:
     - Can query move from each cross-cutting rule to the canonical source,
       config, CI check, design pattern, or ADR?
     - Does each non-obvious convention explain the boundary it protects without
       duplicating architecture, feature, tech-stack, ADR rationale, or generic
       design-pattern content?
     - If `conventions-<domain>.md` shards exist, are they linked from this file
       or index.md and scoped to stable practice areas? -->

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

## Cross-cutting concerns

<!-- REQUIRED section, may be N/A.
     Index rules that apply across most code paths in the project.
     Topics are DISCOVERED per project — not a fixed list.

     Discovery cues:
     - middlewares/decorators imported across many files
     - utility modules with broad fan-in
     - CI-enforced cross-file checks
     - framework hooks wired globally

     Format per concern (one line each):
     **<topic>:** <one-line rule> → `<canonical impl path>`

     Common topic names when present: auth, logging, tracing, error handling, config,
     observability, persistence, caching, rate limiting, i18n. List only what the
     project actually has.

     If the project has no cross-cutting concerns (pure library, plugin/skill repo,
     docs site), write the single line below and nothing else:
     N/A: <reason> -->

**<topic>:** <one-line rule> → `<canonical impl path>`

## Convention Shards [OPTIONAL]

<!-- Link `conventions-<domain>.md` shards only when a stable practice area has
     multiple reusable current guardrails and canonical source refs.
     Good domains: backend, frontend, operations, testing, security, data.
     Small projects should keep conventions in this file. -->

## Domain-Specific Conventions [OPTIONAL]

<!-- Add sections based on project needs. Common examples:
     - Database Standards (table naming, migrations, indexing strategy)
     - API Standards (routing conventions, versioning, response format)
     - Frontend Standards (component patterns, state management)
     - Security Standards (input validation, auth patterns)
     Only add sections with non-obvious, project-specific rules. -->
