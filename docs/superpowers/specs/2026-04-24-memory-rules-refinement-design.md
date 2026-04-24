# superpowers-memory Rules Refinement — Design Spec

**Date:** 2026-04-24
**Status:** Ready for implementation
**Triggering case study:** `/home/xuhao/talgent/docs/project-knowledge/` after 22+ iterations

---

## Context

User's real talgent KB, iterated via `superpowers-memory:update` for months, drifted significantly from what the plugin templates prescribe:

- **3/7 files exceed size caps by 2.2×–3.2×**: `decisions.md` (472 / 150), `features.md` (319 / 100), `glossary.md` (178 / 80). Size Guard fires soft warnings; user repeatedly chose to ignore them.
- **SSOT broken**: the Dispatcher-split narrative is duplicated (with slight phrasing variance) across 7/7 KB files. `content-rules.md` claims "ownership matrix in templates" but that matrix is never written out; it lives implicitly in per-template `<!-- OWNER: -->` comments the update skill never cross-references.
- **Exclusion List violated**: struct field lists (AssistantBlock), enum catalogs (17 SystemContent subtypes), method signatures (`messagestream.Stream`), and commit SHA sequences (features.md) all slipped in. The rules exist in `content-rules.md` but the update skill's steps never checkpoint "does this new entry pass the Exclusion List?"
- **CRITICAL ADR format became default**: 36/36 ADRs use full CRITICAL format despite template specifying 3-line NORMAL as default.

Use case constraint: **mixed human + AI vibe coding**, with explicit concern about token cost on every `load`.

## Root-cause analysis (per category)

### Cat 1 — Size overflow
Size caps treated 7 files as flat equivalents. But `decisions.md`, `features.md`, `glossary.md` have different natural-growth curves than steady-state files. The real first-order problem isn't the cap — it's **granularity / content-composition**:

- Too many things counted as ADRs. ~10/36 ADRs in talgent are implementation details or naming decisions that shouldn't have been ADR'd.
- `features.md` became a changelog (history + commit SHAs + test counts) instead of a state description.
- `glossary.md` entries became mini-wikis (5–10 lines each) instead of one-line definitions.

Fixing granularity makes the existing caps sufficient. **Hot/cold archive split was considered and rejected** — it's a workaround that adds operational complexity (cross-file supersede navigation, "when to migrate") to solve a problem that granularity tightening eliminates at the source.

### Cat 2 — SSOT broken
Ownership is only implied by `<!-- OWNER: -->` comments in individual templates. The update skill processes files one at a time without a cross-file ownership view, so the same new fact (e.g., "Dispatcher cmd/dispatcher port 8083 with Kafka eventbus") ends up expanded in every touched file.

### Cat 3 — Exclusion List violations
Exclusion List is stated in `content-rules.md` but never invoked as a step in the update skill's flow. The skill asks "what changed?" and "which file does this belong in?" — it never asks "does this new content *shape* comply with the exclusion rules?"

---

## Design decisions

### D1 — SSOT ownership matrix (explicit table)

Add a concrete ownership matrix to `content-rules.md`, not just implied in templates:

| Info type | Owner | Others reference by |
|-----------|-------|--------------------|
| Structure (components, boundaries, data flows, wiring) | architecture.md | "see architecture.md §Components" |
| **Current capability (what the system can DO)** | **features.md (capability view)** | "see features.md §<capability>" |
| WHY a design choice was made | decisions.md (ADR-NNN) | "see ADR-NNN" |
| Dep version + selection rationale | tech-stack.md | "see tech-stack.md" |
| Coding/workflow rules | conventions.md | "see conventions.md §X" |
| Term definitions | glossary.md | "see glossary" |
| Delivery timeline (when shipped) | `docs/superpowers/plans/<date>-*.md` | plan filename only |

Rule: any claim > 3 lines appearing in 2+ KB files must move to its owner; others reference by pointer.

### D2 — `features.md` as **capability view**, not changelog

Path B of the brainstormed alternatives (rejected path A "delete features.md for infra projects" as too aggressive).

- Each entry describes the system's **current** ability in 3–6 lines + ADR reference. Past versions are not documented (evolution lives in ADR supersede chains).
- **Explicit exclusions**: commit SHAs, test counts, scope-boundary blocks, per-iteration changelog narrative.
- **Boundary from architecture.md**: architecture.md describes structure (modules, how wired), features.md describes capability (what the system can do from outside).

### D3 — ADR single-question granularity gate

Replace the 3-criteria OR gate with a single question:

> **If a future reader (human or AI) did NOT see this record, would they plausibly re-propose the opposite choice?**

- YES → record ADR. Default format is **NORMAL 3-line** (Decision / Why / Trade-off).
- NO → not an ADR. If the fact is still useful, capture in `conventions.md`; otherwise skip.

**CRITICAL tier**, tightened AND-condition:

- ≥2 rejected alternatives AND
- each rejected alternative has substantive analysis (not a one-line "we didn't use X").

Without both, use NORMAL format even if the decision feels important.

**Supersede entries use 2-line short format**:

```
## ADR-NNN: Original Title (Superseded by ADR-MMM on YYYY-MM-DD)
**Original:** [one-line summary of what was originally decided]
```

**`decisions.md` warning cap raised 150 → 300** per user decision 2026-04-24. Even with the granularity gate enforced, mature projects accumulate real architectural decisions; 300 lines accommodates ~50 ADRs at NORMAL 3-line default + a reasonable share of CRITICAL-tier + supersede entries without archival. Other 6 files' warning caps unchanged (no observed drift there).

### D4 — `glossary.md` per-entry format

Hard rule, machine-checkable:

- **≤ 2 lines per term.** Longer context belongs in architecture.md / decisions.md — glossary links to them.
- Format: `**Term** — one-line business definition. → \`path\` (ADR-NNN if applicable)`
- **Deleted terms**: tombstone format `**Term** — DELETED (ADR-NNN). Replaced by [NewTerm].`

### D5 — Total KB token budget

Per-file caps don't compose. Add aggregate check in `verify`:

- Compute total byte size of all KB files.
- Rough token estimate: `bytes / 4`.
- Default budget: **20,000 tokens** (full `load` cost; ~2% of 1M context). Set per user decision 2026-04-24 after measuring current KB sizes (talgent ~43K, skill-workshop ~5.8K) and targeting the "common execution" compression range (~20–25K) as the sweet spot between forcing compression and being achievable.
- Exceed → warning in `verify` output with per-file breakdown. Warn-only; does not block commits.

### D6 — Hard committable gate [REJECTED 2026-04-24]

**Rejected** per user decision 2026-04-24: keep soft warnings only; do not block commits on size/shape/token violations. Rationale: user prefers not to alter the current commit flow; enriched `verify` warnings (ssotCheck / contentShapeLint / totalTokenBudget / existing sizeWarnings) are expected to surface drift early enough without coercive enforcement. `committable` logic stays git-state-only (no rebase/merge/detached-HEAD).

### D7 — Exclusion Gate step in skills

Add explicit step to both `update` and `rebuild` skill flows, BEFORE writing any new content:

For each new entry being written, check against the Exclusion List + per-file format rules:

- **glossary entry** → is it ≤2 lines of business meaning + 1 path? If not, either compress or put the content elsewhere.
- **features entry** → is it a capability description (current state, ≤6 lines, ADR-referenced)? If it's a changelog block or contains commit SHAs/test counts, stop and reconsider.
- **ADR** → does it pass the single-question gate? Use NORMAL unless BOTH CRITICAL conditions are met.
- **any file** → does the content contain struct fields / enum value catalogs / method signatures / git-log-derivable info? If yes, strip or move.

### D8 — Single-Owner step in update skill

Before writing any update, pick ONE owner file based on the ownership matrix (D1). All other files that reference the fact get a 1-line pointer (≤1 line per file), never a duplicate expansion.

### D9 — verify automated checks (new)

Three new checks in `hook-runtime.js verify`:

1. **`ssotCheck`**: find runs of ≥3 consecutive non-trivial lines (≥40 chars each) appearing in 2+ KB files with ≥80% similarity. Report file pairs + sample.
2. **`contentShapeLint`**: pattern-match violations per file type:
   - `glossary.md`: any term entry spanning >2 lines
   - `features.md`: commit SHA pattern `\b[0-9a-f]{7,40}\b` (short SHAs like `6b5e869` match), or "test" counts like `\b\d+\s+(?:unit|integration|E2E|tests)\b`
   - `any file`: method signatures `\b\w+\([^)]*\)\s+\w+` heuristic, or Go `func Name(` patterns
3. **`totalTokenBudget`**: sum bytes, estimate tokens, compare against 20K default (warn-only, per-file breakdown in output).

Each returns a list of findings. Aggregated into `verify`'s output alongside existing `sizeWarnings` + `staleRefs`.

---

## Non-goals (explicit rejections)

- **Hot/cold ADR archive split**: rejected in favor of granularity tightening (see Cat 1 RCA).
- **Hard committable gate on size/shape/token violations** (D6): rejected per user decision 2026-04-24. Soft warnings remain the sole forcing function.
- **New automated test framework**: verify-by-fixture retains the existing "no test framework" convention (ADR-003-adjacent). Each new check ships with fixture KB dirs exercising the check's success + failure paths.
- **Modifying which files are in the KB set**: all 7 files (`index/architecture/tech-stack/features/conventions/decisions/glossary`) remain. No deletions.
- **Retroactively fixing talgent's KB**: out of scope for this plugin change. After plugin lands, user can re-run `update`/`rebuild` against talgent and the new gates will start reshaping it progressively.

---

## Scope

Only `plugins/superpowers-memory/`:

- `content-rules.md` — add D1, D3, D4, D5; refine D7 Exclusion List.
- `templates/decisions.md` — reflect D3 (gate + NORMAL default + CRITICAL tightening + 2-line supersede).
- `templates/features.md` — rewrite per D2 (capability view).
- `templates/glossary.md` — reflect D4 (≤2-line rule + tombstone example).
- `templates/architecture.md` — add a one-paragraph boundary note with features.md per D2.
- `skills/update/SKILL.md` — add D7 Exclusion Gate + D8 Single-Owner steps.
- `skills/rebuild/SKILL.md` — mirror same additions.
- `hooks/hook-runtime.js` — add D9 three checks (warn-only; no hard committable gate — D6 rejected).

Plus:

- skill-workshop's own KB (`docs/project-knowledge/conventions.md` + `decisions.md`) — record the new rules as conventions (new section) + add ADR-009 capturing this refinement.

## Verification strategy

1. **Fixture-based integration** for hook-runtime.js changes. Create `plugins/superpowers-memory/hooks/fixtures/` with per-check scenarios (success KB + failing KB).
2. **Manual inspection** for Markdown/template changes.
3. **Dry-run against talgent's real KB**: after plugin changes land, run `verify` against `~/talgent/docs/project-knowledge/` and document exactly which violations surface — that's the evidence this design would have prevented the observed drift.

---

## Evidence: verify run against talgent's real KB (post-plugin-changes)

Running `verify` on `/home/xuhao/talgent/docs/project-knowledge/` after the plugin changes (commit `8c8a863`) surfaces the following drift categories — proving the new checks reproduce the problem this refactor was designed to prevent.

**Date of run:** 2026-04-24

**Findings:**

- **sizeWarnings**: 4 findings — `conventions.md (151/150)`, `decisions.md (473/300)`, `features.md (319/100)`, `glossary.md (178/80)`
- **shapeViolations**: 21 findings total — by kind: `{"method_signature":10,"commit_sha":8,"test_count":2,"glossary_entry_too_long":1}`; by file: `{"architecture.md":1,"conventions.md":2,"decisions.md":1,"features.md":10,"glossary.md":7}`
- **ssotViolations**: 0 findings — no cross-file narrative duplication detected in this run
- **tokenBudgetViolation**: `estimatedTokens=42797, budget=20000`
- **committable**: `true` (warn-only; does not block commits per D6-REJECTED)
- **ok**: `false`

**Conclusion:** the enriched warning set surfaces exactly the drift categories observed in the design case study. User has a concrete, evidence-backed task list to compress talgent's KB progressively via subsequent `superpowers-memory:update` runs — but retains the choice whether to compress or accept the warnings.

**Note:** this is one-off evidence, not a regression test — the talgent KB is not part of this repository.
