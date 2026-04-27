---
name: standards
description: Use before designing, implementing, refactoring, or reviewing architecture, REST APIs, database schemas, backend services, DDD/Clean Architecture code, frontend React/Next.js code, or browser QA flows. Loads applicable design pattern standards and requires stating applicable, non-applicable, and conflicting patterns.
---

# Apply Project Architecture Standards

Use this skill whenever the task may touch architecture, APIs, databases, backend boundaries, DDD/Clean Architecture, frontend structure, UI implementation patterns, browser QA, refactoring, implementation planning, execution, or code review.

## Workflow

1. Identify the task area: API, database, backend domain model, language-specific DDD, frontend, browser QA, or code review.
2. Use the injected Project Architecture Standards index if it is present. If it is not present, inspect these directories from highest to lowest priority:
   - `<repo>/docs/design-patterns/`
   - `<repo>/design-patterns/`
   - `$SPA_GLOBAL`
   - `$SP_ARCHITECT_DIR`
   - `~/.claude/superpowers-architect/design-patterns/`
   - `<plugin-root>/design-patterns/`
3. Read the full content of every relevant pattern before planning, editing, or reviewing.
4. State which patterns apply and the constraints that affect the work.
5. State which listed patterns do not apply when that helps avoid ambiguity.
6. If the user request conflicts with a pattern, call out the conflict explicitly and choose the smallest compliant approach unless the user overrides it.

## Expected Output Discipline

For implementation or planning work, include a short architecture-standards note before the plan or code changes:

```text
Architecture standards:
- Applies: <patterns>
- Constraints: <key constraints>
- Not relevant: <patterns, if useful>
- Conflicts: <none or explicit conflict>
```

For code review work, findings related to standards must cite the relevant pattern and explain the violation or compliance risk.
