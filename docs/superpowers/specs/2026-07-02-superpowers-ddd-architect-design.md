# Superpowers DDD Architect Plugin Design

- **Status**: Draft
- **Date**: 2026-07-02
- **Author**: xuhao + Codex

## Context

The talgent audit showed that the current `superpowers-architect` plugin already contains many useful DDD rules, but its product identity is too broad. It acts as a dynamic standards loader for architecture, REST, database, backend, frontend, browser QA, runtime, and DDD. That broad role encourages the plugin to grow into a large pattern catalog. The agent then has to route through a document system before it can behave like an architect.

The better split is to make DDD architecture a dedicated plugin.

`superpowers-ddd-architect` becomes the active backend architecture guardrail. It owns DDD boundary protection, Go/Python/TypeScript backend DDD guidance, event/message boundaries, taskqueue/runtime DDD-adjacent guidance, and database standards that matter to backend design.

`superpowers-architect` stops being the automatic dynamic injector. It moves directly to the medium-term target: explicit-only standards loading.

## Architecture Standards

- **Applies**: dual Claude/Codex plugin tracks, DDD pattern parity, Codex lightweight SessionStart policy, explicit skill invocation, progressive loading.
- **Key constraints**:
  - Keep Claude and Codex plugin trees semantically aligned.
  - Do not add Stop hooks for Codex.
  - Do not inject full pattern indexes at Codex SessionStart.
  - Preserve natural-language prompt quietness unless a spec explicitly changes it.
  - Avoid duplicate hook injections from old and new plugins.
- **Not relevant**: frontend design implementation, browser QA, product UI standards.
- **Conflict resolved by this design**: `superpowers-architect` currently has broad dynamic injection; the new design removes that automatic role instead of trying to make it DDD-first.

## Decision

Create a new plugin named **`superpowers-ddd-architect`**.

Its positioning:

> DDD-first backend architecture guardrails for code agents.

Old plugin positioning after this change:

> `superpowers-architect` is an explicit-only general standards loader. It no longer injects dynamic architecture standards into workflow skills by default.

This is not a soft migration. The old plugin skips the short-term "keep automatic injection for now" phase and moves directly to the medium-term target.

## Goals

1. Make DDD/backend architecture a focused plugin identity rather than one mode inside a general standards loader.
2. Reduce default loaded context by replacing broad pattern discovery with a DDD Risk Router.
3. Prevent old and new plugins from both injecting architecture guidance into the same workflow.
4. Keep database guidance as backend support, not as a separate top-level product identity.
5. Preserve explicit access to general standards through `superpowers-architect`.
6. Make the design phase start from product semantics intake and spec-to-model traceability rather than from a passive list of references to read.
7. Give each phase a compact thinking framework: `design` turns product semantics into a model, `implement` maps the accepted model into code placement, and `review` turns concrete evidence into boundary judgments.

## Non-Goals

- Do not delete `superpowers-architect`.
- Do not remove non-DDD general pattern files in this phase.
- Do not add frontend or REST capabilities to the new DDD plugin.
- Do not change talgent.
- Do not implement CI linting or project-specific architecture tests in this spec.

## Plugin Responsibilities

### `superpowers-ddd-architect`

Default active responsibilities:

- DDD Risk Router.
- Bounded context and context-map boundaries.
- Product-semantics-to-model design.
- Model-to-code implementation placement.
- Evidence-to-judgment boundary review.
- Domain/Application/Infrastructure ownership.
- Domain and Application port eligibility.
- Generated protocol DTO boundaries.
- ConnectRPC/gRPC shortcut pressure.
- Python and TypeScript backend DDD module/layer placement.
- Domain Event, Boundary Publisher, Integration Message, taskqueue, and async handler roles.
- Go DDD runtime/module assembly when it affects DDD service boundaries.
- Database standards relevant to backend persistence design.

Explicit non-responsibilities:

- Frontend architecture and browser QA.
- General REST style review unless a DDD/backend boundary requires it.
- Product design or UI pattern guidance.
- Universal dynamic pattern marketplace behavior.

### `superpowers-architect`

After this migration:

- Exposes `$superpowers-architect:standards` for explicit general standards loading.
- Does not automatically inject dynamic pattern indexes for upstream workflow skills.
- Does not own DDD as the primary path.
- May retain generic pattern discovery for explicit use.
- README and marketplace copy should point DDD/backend users to `superpowers-ddd-architect`.

## Loading Model

### DDD Plugin Hot Path

The new plugin does not ask "which architecture standard might apply?" first. Each phase starts from its own thinking framework, and DDD risk remains the compact routing surface for deeper references.

1. For design work, complete Product semantics intake: actors/users, business capability, user actions/system triggers, product-visible outcomes, business rules/invariants, data authority, state lifecycle, external collaborators, and read/query needs.
2. Keep a Spec trace from product requirement statements to bounded context, invariant, command, query, event/message, and stop-question decisions.
3. For implementation work, run a Design input check, build a Model-to-code placement plan, and keep an Implementation trace from model decisions to touched files and tests.
4. For review work, build an Evidence map, compare Expected model vs observed code, and run Finding triage before reporting issues.
5. Load the DDD Risk Router.
6. Match the task or review against compact cards.
7. Load detailed references only when a card, task, or gate requires them.
8. Emit a short phase-specific note with applicable DDD/backend constraints.

Risk cards use this shape:

```text
Risk: <high-risk failure mode>
Smell: <code shape or task phrase that should trigger review>
Probe examples: <repo-shape-dependent search examples, when useful>
Decision: <default DDD placement or boundary rule>
Allowed exception: <written evidence required>
Reference: <deep pattern section>
```

Probe examples are calibration aids, not fixed audit commands. Agents must first identify the repository's bounded-context roots, layer names, generated-code locations, RPC/runtime wiring, and local architecture docs/tests, then adapt the examples before treating any hit as evidence.

Initial cards:

1. Cross-context direct imports.
2. Generated protocol types leaking into semantic ports.
3. Fat Go RPC shortcut in `application.go`.
4. Shared umbrella processor behind thin message handlers.
5. Business state classification outside Domain.
6. Command-side Application port by dependency-inversion reflex.
7. Runtime/cmd provider pollution.
8. Technical bounded-context exception.

### General Architect Loading

`superpowers-architect` no longer participates in automatic workflow injection. It only runs when the user explicitly invokes its standards skill. This prevents duplicated context and makes its remaining purpose clear: general standards lookup on demand.

## Reference Ownership

Move or copy these references into the new plugin as a shared reference set:

```text
skills/
  design/SKILL.md
  implement/SKILL.md
  review/SKILL.md
references/
  ddd-risk-router.md
  ddd-agent-contract.md
  ddd-modeling.md
  ddd-core.md
  ddd-golang.md
  ddd-python.md
  ddd-typescript.md
  ddd-golang-events-messages.md
  ddd-golang-runtime.md
  ddd-golang-taskqueue.md
  database.md
```

The new plugin should not use a root `design-patterns/` directory. That directory belongs to the old generic standards-loader model. The DDD plugin is skill-native: `design`, `implement`, and `review` skills all point to shared explicit references, with `ddd-risk-router.md` as the first read.

The new plugin may keep database as a support reference, but the DDD Risk Router stays first. Database standards should load only for schema/query/migration/transaction/storage design or when a DDD persistence question needs them. The design-phase default reference budget is risk-router/modeling/core; `database.md` is not listed by default.

`superpowers-architect` should not keep bundled copies of migrated DDD/backend or database references. Its README should mark DDD/backend material as moved.

## Hook Strategy

### Claude Track

`superpowers-ddd-architect`:

- May inject a compact DDD Risk Router index for architecture-related upstream workflow skills.
- Should not inject full reference files.
- Should map planning/design workflows to DDD Design Guidance, execution workflows to DDD Implementation Guardrails, and review workflows to DDD Boundary Review.

`superpowers-architect`:

- Removes automatic workflow-skill injection.
- Keeps explicit `$superpowers-architect:standards`.

### Codex Track

`superpowers-ddd-architect`:

- Keeps SessionStart lightweight.
- Does not inject full pattern index at SessionStart.
- Uses explicit `design`, `implement`, and `review` skill invocation as the reliable path.
- May use prompt-time routing only for explicit upstream skill mentions, consistent with current Codex conventions.

`superpowers-architect`:

- Explicit-only.
- No Stop hook.
- No natural-language architecture prompt hook.

## Content Budget

This split must reduce default context pressure, not double the plugin surface.

Requirements:

- The new plugin's default hot path is the DDD Risk Router, not the full DDD reference set.
- `superpowers-architect` automatic dynamic injection is removed, so one workflow should not receive both old and new architecture injections.
- DDD reference files live under plugin-root `references/`, shared by `design`, `implement`, and `review`; they do not live under a single `standards` skill or a root dynamic `design-patterns/` directory.
- Hook injection uses phase-specific reference budgets instead of listing every DDD reference; deeper runtime/taskqueue/event support files are loaded only when the risk router or touched path requires them.
- Phase hook guidance stays compact: design points toward Product semantics intake and Spec trace; implement points toward Design input check, Model-to-code placement, and Implementation trace; review points toward Evidence-to-judgment review, Expected model vs observed code, and Finding triage. Full methods live in the explicit phase skills.
- Probe examples require a short repo calibration before the agent treats hits as evidence.
- New DDD guidance must replace or compress existing DDD prose; it must not create a second full explanation beside the old one.
- Database stays support-level, on-demand, and must not become a second default router.

## Migration Plan

1. Add `superpowers-ddd-architect` to both plugin tracks.
2. Seed plugin-root `references/` with DDD/backend references and a DDD Risk Router.
3. Add explicit DDD `design`, `implement`, and `review` skills for the new plugin.
4. Wire hooks so the new plugin owns DDD/backend workflow guidance.
5. Change `superpowers-architect` to explicit-only by removing automatic workflow injection.
6. Update marketplace metadata and READMEs to point DDD/backend users to the new plugin.
7. Run hook behavior tests to confirm no double injection.
8. Run parity checks across Claude and Codex tracks.

## Acceptance Criteria

1. New plugin directories exist for both tracks: `plugins/superpowers-ddd-architect/` and `codex-plugins/superpowers-ddd-architect/`.
2. The new plugin has DDD-first `design`, `implement`, and `review` skills over a shared Risk Router hot path.
3. DDD/backend guidance is no longer primarily owned by `superpowers-architect`.
4. `superpowers-architect` no longer auto-injects dynamic architecture standards into upstream workflow skills.
5. Explicit `$superpowers-architect:standards` still works for general standards lookup.
6. No single workflow receives automatic architecture guidance from both plugins.
7. Codex SessionStart remains lightweight; no Stop hook is introduced.
8. Natural-language architecture prompts remain quiet unless a future spec changes that explicitly.
9. Claude/Codex plugin track behavior is semantically aligned.

## Risks

| Risk | Mitigation |
|---|---|
| Pattern duplication between old and new plugins grows stale | Remove migrated DDD/backend copies from the old plugin and document the new plugin as the DDD source |
| Users miss DDD guidance after old plugin goes explicit-only | Marketplace and README copy must point backend users to `superpowers-ddd-architect` |
| Hook overlap causes duplicate context | Acceptance criteria require no workflow double injection |
| New plugin expands into all backend concerns | Keep DDD in the name and make database support-level |
| Codex prompt routing becomes noisy | Preserve lightweight SessionStart and natural-language quietness |

## Self-Review

- The new plugin name emphasizes DDD.
- The old plugin directly moves to explicit-only instead of keeping automatic injection.
- The design separates DDD/backend guardrails from general standards lookup.
- The design avoids adding full-content dynamic loading to SessionStart or natural-language prompts.
- The acceptance criteria include hook overlap and old-plugin deactivation checks.
