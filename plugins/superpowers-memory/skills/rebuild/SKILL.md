---
name: rebuild
description: Use when initializing project knowledge, when knowledge has drifted too far from reality, or when a specific KB file needs to be rebuilt against current content rules — reads codebase and regenerates
---

# Rebuild Project Knowledge

Scan the codebase and regenerate the project knowledge base. Two modes:

- **Full mode** (no argument): rebuild the entire KB from scratch.
- **Scoped mode** (target file as argument, e.g., `architecture.md`): rebuild only that file against current `content-rules.md` by reading the code relevant to it; leave other KB files untouched (except for content that gets routed to them and for `index.md`, which is always regenerated).

**Announce at start:**
- Full mode: `I'm rebuilding the project knowledge base from the codebase.`
- Scoped mode: `I'm rebuilding <filename> against current content rules.`

## When to Use

**Full mode:**
- First time setting up the knowledge base for a project
- Knowledge base has drifted significantly from reality
- User explicitly requests a full rebuild

**Scoped mode:**
- `content-rules.md` has changed and an existing KB file needs reshaping to comply
- One specific KB file looks drifted from reality but the rest of the KB is trusted
- User wants to apply the current template structure to an existing file without redoing the whole KB

Scoped mode deliberately re-reads the code relevant to the target file (not just reformat existing prose) — reformatting without re-verification risks dressing up stale content in a compliant shape.

## Scope Routing (scoped mode only)

When a target file is provided, validate it against the abstract-category table below and locate the concrete sources using the project's actual conventions. If the argument is not a valid target, stop and list the valid options.

**Detect first, then read.** Before applying the table, run `ls` at the repo root and inspect the root manifests to identify the language(s) and layout convention. Common patterns — not exhaustive:

- **Go**: `go.mod` + `cmd/` + `internal/` + `pkg/`; lint `.golangci*`; DI via `fx.Provide` / `wire.Build`
- **Java**: `pom.xml` or `build.gradle[.kts]` + `src/main/java/<pkg>/`; lint `checkstyle.xml` / Spotless; entry via `@SpringBootApplication`
- **Python**: `pyproject.toml` / `setup.py` / `requirements*.txt` + `src/<pkg>/` or flat `<pkg>/`; lint `ruff.toml` / `.flake8` / `[tool.*]`; entry via `manage.py` (Django) or `app.py` (FastAPI/Flask)
- **JS/TS**: `package.json` (+ `pnpm-workspace.yaml` / `yarn.lock` if monorepo) + `apps/` / `packages/` / `src/`; lint `.eslintrc*` / `biome.json`
- **Rust**: `Cargo.toml` (+ workspace) + `src/` / `crates/`; lint `rustfmt.toml` / `clippy.toml`
- **Other** (Ruby, .NET, PHP, Elixir, …): infer from the manifest + top-level directory listing; apply the same abstract categories

Multi-language monorepos (e.g., Go backend + TS frontend) are common — detect all stacks present and apply the table to each relevant slice.

Then map abstract source categories to concrete paths:

| Target file | Abstract source categories to read |
|-------------|---------------------|
| `architecture.md` | (1) Top-level module/service directories per the detected layout; (2) service entry points (main/application classes, WSGI/ASGI entry, etc.); (3) aggregate root / domain-model files, however the project organizes them; (4) FSM construction code where applicable; (5) API / contract definitions (proto, OpenAPI, GraphQL SDL, REST controllers); (6) deployment manifests (`docker-compose*.yml`, `deploy/`, `k8s/`, `helm/`, `terraform/`); (7) `README.md` + `CLAUDE.md` + `AGENTS.md` |
| `features.md` | `README.md`; `docs/design/`; `docs/superpowers/plans/` (in-progress + planned); module/service entry points for implemented capabilities |
| `tech-stack.md` | Root language manifests (per detection above); containerization (`Dockerfile`, `docker-compose*.yml`); build orchestration (`Makefile`, `Taskfile.yml`, `justfile`, or equivalent); toolchain installers (`scripts/setup-*.sh` or equivalent) |
| `conventions.md` | Lint/format configs (per the languages present); build orchestration; CI configs (`.github/workflows/`, `.gitlab-ci.yml`, `.circleci/`); `CLAUDE.md`; `docs/design/` (stable cross-cutting rules) |
| `decisions.md` + `adr/` | Existing `decisions.md` + `adr/*.md` (format-compliance pass); `git log --oneline` for significant recent changes (granularity gate); `docs/design/` + `docs/superpowers/specs/` for decision sources |
| `glossary.md` | Aggregate and domain-object names (per the project's domain-code organization — packages, model classes, ORM entities, proto `message` definitions); API contract type names (proto `service`, OpenAPI schema names, GraphQL types); `README.md` + `CLAUDE.md` for project-specific vocabulary |

Files outside the mapping are out of scope — for example, `adr/ADR-NNN-<slug>.md` detail files are not scoped targets (they're rebuilt as part of `decisions.md` rebuild, or authored directly during `update`).

## Pre-check

**Scoped mode: skip this step entirely.** Scoped rebuilds are cheap and user-intent-driven; the commit-count gate only applies to full rebuilds.

**Full mode:** if `docs/project-knowledge/` already exists:
- Read `last_updated` from any knowledge file
- Count commits since last update using two-tier detection (excluding the KB directory itself):
  - Tier 1: `git log --oneline --since="<last_updated>" -E -i --grep="^(feat|refactor)" --no-merges -- . ':!docs/project-knowledge' | wc -l`
  - Tier 2 (if tier 1 = 0): `git log --oneline --since="<last_updated>" --no-merges -- . ':!docs/project-knowledge' | wc -l`
- If tier 1 ≥ 5: proceed without warning (significant changes justify rebuild)
- If tier 1 = 0 AND tier 2 ≥ 20: proceed without warning (many commits justify rebuild)
- Otherwise: warn user
  "Knowledge base was recently updated on [date] with only N commits
  since. Full rebuild will overwrite incremental changes. Continue?"
- Wait for confirmation before proceeding.

## Process

### 1. Phase 1 — General scan

**Scoped mode: skip.** Go directly to Phase 2 and read only the sources listed in the Scope Routing table for the target file.

**Full mode:**
- Read project structure: `ls`, key directories
- Read configuration files: `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `Makefile`, `docker-compose.yml`, etc.
- Read existing documentation: `README.md`, `CLAUDE.md`, `docs/` directory
- Read existing specs and plans: `docs/superpowers/specs/`, `docs/superpowers/plans/`
- Check git log for recent development history: `git log --oneline -20`

### 2. Phase 2 — Deep scan

**Scoped mode:** read only the sources in the Scope Routing table for the target file. Also read the current content of the target KB file itself — it is the prior belief, to be reconciled with the code you're reading. When the code and the prior belief agree, keep the existing entry (just reformat if it violates current rules). When they disagree, prefer the code; note the divergence in the post-rebuild report (Step 7).

**Full mode:** based on Phase 1 findings, identify the project's top-level modules (directories representing independent functional units). For each module:
- Read the core abstraction file (primary types, interfaces, or entry point)
- Read 2-3 cross-module integration points, prioritizing flows that span 3+ components

Prioritize reading:
1. Files referenced in README.md or CLAUDE.md
2. Module entry points / registration files
3. Interface or contract definitions (APIs, events, repository interfaces)

Do NOT read: test files, generated code, vendor/node_modules, migration files, or single-module implementation details.

### 2a. Exclusion Gate + Single-Owner (before generating files)

Before writing any file:

1. **Exclusion Gate** — for each fact harvested in Phase 2, check against the Exclusion List in `content-rules.md`:
   - No struct / class field lists
   - No enum / constant value catalogs
   - No method signatures (unless the signature IS the cross-cutting invariant)
   - No single-module implementation details
   - No information derivable from git log / git blame (commit SHAs, timestamps, author names)
   - No test counts or test paths in features.md

2. **Single-Owner Principle** — for each fact, pick ONE owner file per the Ownership Matrix:

   | Info type | Owner |
   |-----------|-------|
   | Structure / wiring / data flow | architecture.md |
   | Capability / current behavior | features.md |
   | Decision rationale (WHY) | decisions.md |
   | Dep version + pick rationale | tech-stack.md |
   | Coding / workflow rules | conventions.md |
   | Term definition | glossary.md |
   | Delivery timeline | plan files (NOT KB) |

   Other files get ≤1-line pointers only.

3. **Per-file format rules** (from `content-rules.md`):
   - `decisions.md`: **summary only** — 4 lines per ADR (heading + Decision + Trade-off + pointer to detail). Max 6 non-blank lines per entry. Apply the 3-criteria granularity gate before writing any ADR — cross-module scope, ≥2 substantive rejected alternatives, not trivially reversible. If any fails → route to tech-stack.md / conventions.md / design docs / plan files instead. Superseded ADRs collapse to the 1-line heading.
   - `adr/ADR-NNN-<slug>.md`: **full rationale** — one file per ADR with Context / Decision / Alternatives Rejected (paragraph per rejected alt) / Consequences. Target ~100 lines. Loaded on demand via `Read`, not injected at session start.
   - `glossary.md`: ≤2 lines per term, one-line definition, 1 path.
   - `features.md`: capability view — current state in 3–6 lines + ADR ref. No SHAs, no test counts, no changelog narrative.
   - `architecture.md`: structure view — Pattern Overview, System Context, Layering, Scenario Sequences (Mermaid `sequenceDiagram`), Key Object FSMs (Mermaid `stateDiagram-v2` with trigger + emitted-event labels), Key Design Decisions (pointer list). No implementation constants (ports, timeouts, TTLs), no env var names, no HTTP header names, no prose FSM state lists, no capability descriptions (those belong in `features.md`).

### 3. Generate knowledge files

**Scoped mode:** generate ONLY the target file per its per-file format rule below. Do NOT rewrite other KB files. If Step 2a's Single-Owner check routes content out of the target (e.g., impl constants from `architecture.md` that belong in `tech-stack.md`), **append** the displaced entry to the correct destination file — do not overwrite the destination. In the target file, leave a ≤1-line pointer per the Ownership Matrix. Record both the target rewrite and every destination append in Step 7's diff summary.

**Full mode:** create `docs/project-knowledge/` directory if it doesn't exist.

For each of the 6 knowledge files (full mode) or the single target file (scoped mode), use the plugin template as the structural basis and fill in concrete content from the codebase analysis:

- **architecture.md** — Pattern Overview (paradigm + 2–3 key characteristics, 1 paragraph); System Context (external actors + external systems, list form, ≤10 lines); Layering (bounded contexts or layers; each entry is name + one-sentence responsibility + path + key abstraction names; declare call-direction rules at the end); Scenario Sequences (2–3 Mermaid `sequenceDiagram` for cross-module flows of 3+ components; single-module internal flows do NOT belong here); Key Object FSMs (Mermaid `stateDiagram-v2` for aggregates whose transitions cross module boundaries, with trigger + emitted-event labels — bullet-list state enumerations are Exclusion List violations); Key Design Decisions (pointer list, 3–5 entries as `**[title]** — see ADR-NNN`). Skip §Key Object FSMs only if the project genuinely has no aggregates with cross-BC state transitions — and declare this explicitly rather than silently omitting the section.
- **tech-stack.md** — Languages and frameworks (from config files), key dependencies (from package manifests), build tools (from scripts/Makefile). Organize by technology category or system boundary — whichever fits better.
- **features.md** — Implemented features grouped by plan/iteration (from specs, README, and code), in-progress features (from plans with unchecked items), planned features (from specs without plans).
- **conventions.md** — Coding standards (from linter configs, existing patterns), architecture rules (project-specific only — do not duplicate general DDD/Clean Architecture rules from design-pattern docs), testing conventions (framework, mock principle, coverage target), git workflow. Add Domain-Specific Conventions (DB, API, frontend standards) only if non-obvious project-specific rules exist.
- **decisions.md + adr/** — Extract significant decisions from git history, specs, and code comments. Apply the 3-criteria granularity gate first — most "decisions" fail one criterion and should go elsewhere (tech-stack.md, conventions.md, design docs). For each surviving ADR, write TWO artifacts: (1) a 4-line summary in `decisions.md` (heading + Decision + Trade-off + pointer); (2) a full detail file at `docs/project-knowledge/adr/ADR-NNN-<slug>.md` with Context / Decision / Alternatives Rejected / Consequences. Create the `adr/` directory if missing.
- **glossary.md** — Domain terms from Ubiquitous Language: terms where the business meaning is not obvious from the code name, or the same word means different things in different contexts. Use definition list format: `**Term** — Definition. → \`path\``

### 4. Set frontmatter

**Full mode** — for every generated file:
- `last_updated`: today's date (YYYY-MM-DD)
- `updated_by`: `superpowers-memory:rebuild`
- `triggered_by_plan`: `null`

**Scoped mode** — for the target file and any destination files that received routed content:
- `last_updated`: today's date (YYYY-MM-DD)
- `updated_by`: `superpowers-memory:rebuild`
- `triggered_by_plan`: **preserve the existing value** — do not overwrite with `null` or `"none"`. Scoped rebuild is not plan-triggered, but the previous plan attribution remains valid for content that was not changed by this rebuild.

### 5. Generate index.md

Always regenerate `docs/project-knowledge/index.md` — in both modes — since key points for any touched file may have changed.

- Re-read all existing knowledge files (including the one(s) just rewritten)
- For each file, extract 1-2 key points that help AI decide whether to load the file in full (e.g., specific pattern names, version numbers, counts — not generic descriptions)
- Write the file following the format in `templates/index.md`, setting `updated_by: superpowers-memory:rebuild` and `covers_branch: <branch>@<short-sha>` where `<branch>` is the output of `git branch --show-current` and `<short-sha>` is the output of `git rev-parse --short HEAD` (e.g., `covers_branch: main@a1b2c3d`). The SHA anchor ensures staleness detection works at commit granularity, not just branch-name granularity.
- `triggered_by_plan`:
  - **Full mode**: `null` (fresh KB, no plan attribution)
  - **Scoped mode**: preserve the existing value from the prior `index.md` — scoped rebuild is not plan-triggered and should not overwrite the attribution with `null`

**Size constraint:** Keep index.md under 50 lines total.

**Legacy cleanup:** If `docs/project-knowledge/MEMORY.md` exists (from an older version), delete it after creating `index.md`.

### 6. Verify (before commit)

Run the automated verification script first, then do manual spot-checks:

```bash
node "${CLAUDE_PLUGIN_ROOT:-plugins/superpowers-memory}/hooks/hook-runtime.js" verify
```

The script checks: file size thresholds, stale path references, content-shape violations, and git commit readiness. Fix any `staleRefs`, `sizeWarnings`, or `shapeViolations` it reports before proceeding.

**Manual checks (on top of automated):**

**6a. Version consistency:**
Compare version numbers in tech-stack.md against actual manifests:
- Go: `grep '^go ' go.mod`
- Node: `node -v` or `cat .node-version`
- Key deps: spot-check 2-3 against go.mod / package.json

**6b. Module coverage:**
List actual top-level source directories. Confirm each appears in `architecture.md` §Layering. Flag modules in code but missing from knowledge, or vice versa. (Scoped mode: only run this check if the target file is `architecture.md`.)

**6c. SSOT spot-check:**
Pick 2-3 concepts appearing in multiple files. Confirm full description only in designated owner file; other files use references only.

### 7. Post-rebuild diff summary

If previous knowledge files existed:
- Output a brief diff summary: which files changed, what was added/removed/modified
- This helps the user verify the rebuild didn't lose important information.

### 8. Commit

Check the `committable` field from the step 6 verify output. If `false`, skip the commit — leave files uncommitted and tell the user why (mid-rebase, mid-merge, or detached HEAD).

**Full mode:**
```bash
git add docs/project-knowledge/ docs/project-knowledge/adr/
git commit -m "docs: rebuild project knowledge base from codebase"
```

**Scoped mode:** add only the files that were touched (target file + any destinations that received routed content + `index.md`), and use a scope-specific message:
```bash
git add docs/project-knowledge/<target-file> [docs/project-knowledge/<other-destinations>...] docs/project-knowledge/index.md
git commit -m "docs: rebuild <target-file> against current content rules"
```

If the commit fails (e.g., pre-commit hook), report the error to the user. Do not retry with `--no-verify`.

**Recovery:** If the rebuild is interrupted before this step, the previous KB can be restored with `git checkout HEAD -- docs/project-knowledge/` (assuming it was committed).

### 9. Report

- Summarize what was generated
- Note any areas where information was sparse or uncertain
- Suggest running `superpowers-memory:update` after the next iteration to keep knowledge fresh

## Content Rules

Follow all rules defined in [`content-rules.md`](../../content-rules.md) — language, inclusion/exclusion, SSOT, quality, and **size guard** (check line counts after generating, warn if exceeded).
