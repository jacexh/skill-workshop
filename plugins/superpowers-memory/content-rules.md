# Content Rules

Shared rules for `rebuild` and `update` skills. Both skills reference this file as the single source of truth for content generation guidelines.

## Language

Generate content in the same language as the project's existing documentation (README, specs, plans, code comments). Section headings remain in English for skill parsing compatibility.

## Inclusion Principle

Only include information that requires crossing module/package boundaries to understand, changes only with architectural decisions, and affects understanding of multiple modules.

## Exclusion List — Do NOT Include

- Struct/class field lists — AI should read source code directly
- Enum/constant value mappings — these change with code and go stale
- Method signatures (unless enforcing non-obvious invariants)
- Single-module implementation details
- Information derivable from `git log` or `git blame`

## SSOT

Each piece of information has one owner file per the ownership matrix in templates. Full content only in the owner; other files reference by pointer ("see ADR-011").

## Quality

Be factual (verify from codebase, do not speculate), be concise (scannable in under 2 minutes per file), be structured (follow template format), link to sources (file paths, spec files, plan files).

## Size Guard

After generating or updating files, check line counts. If any file exceeds its threshold, warn the user and suggest specific compression actions. Do NOT auto-compress.

| File | Warning threshold |
|------|------------------|
| architecture.md | 200 |
| conventions.md | 150 |
| decisions.md | 150 |
| tech-stack.md | 120 |
| features.md | 100 |
| glossary.md | 80 |
| index.md | 50 |

Compression suggestions by file type:
- features.md: collapse old completed iterations into one-line summaries
- decisions.md: non-CRITICAL ADRs beyond 10 entries → merge into Historical section
- architecture.md: remove implementation details, keep module-level only
- conventions.md: remove rules already enforced by formatter/linter config
- tech-stack.md: remove deprecated or no-longer-used dependencies
- glossary.md: merge synonymous entries, remove terms only referenced in one file
