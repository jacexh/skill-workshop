# Superpowers-Architect Risk Router Design

- **Status**: Draft
- **Date**: 2026-07-02
- **Author**: xuhao + Codex

## Context

The talgent audit exposed a pattern: the plugin already contains many of the right DDD constraints, but agents still miss the same architectural failures in real repositories. The problem is not primarily missing theory. It is that the default guidance path is too large, too prose-heavy, and too dependent on the agent remembering which long section matters.

The next optimization should therefore avoid adding another layer of DDD documentation. The goal is to make Superpowers-Architect behave more like a risk router: short default guidance that detects high-risk shapes, points to the right reference only when needed, and gives agents concrete scans and exception gates.

## Architecture Standards

- **Applies**: `superpowers-architect:standards`, DDD agent contract, DDD modeling/core/Go/events/runtime/taskqueue standards, dual Claude/Codex plugin parity.
- **Key constraints**:
  - Keep the Claude and Codex pattern trees semantically aligned.
  - Preserve the Codex lightweight SessionStart policy and avoid Stop-hook reminder spam.
  - Prefer progressive loading over full-content injection.
  - Do not optimize talgent code as part of this change; use it only as a failure-signal corpus.
- **Not relevant**: frontend design, browser QA, REST-specific rules unless a touched pattern mentions REST.
- **Conflict**: existing Codex conventions intentionally keep natural-language architecture prompts quiet. This design treats any broader prompt trigger as a separate, opt-in decision rather than a default requirement.

## Goals

1. Reduce default DDD guidance surface while improving detection of high-risk architecture failures.
2. Replace repeated prose with compact risk cards that follow one shape: smell, scan, decision, allowed exception, reference.
3. Add no net documentation bulk. New guidance must replace, merge, or downgrade existing guidance.
4. Keep long DDD references available, but move them out of the first decision path.
5. Preserve dual-track behavior across `plugins/superpowers-architect/` and `codex-plugins/superpowers-architect/`.

## Non-Goals

- Do not rewrite the DDD framework from scratch.
- Do not introduce an automated linter or CI rule in this spec.
- Do not make Codex inject full pattern indexes for ordinary natural-language prompts.
- Do not change talgent.
- Do not expand frontend, REST, or database standards.

## Design Principle: Shrink the Hot Path

The current DDD material mixes three layers:

1. Agent execution rules.
2. High-risk review checks.
3. Detailed DDD reference material.

The new structure keeps these separate. The hot path should fit in a short review card set. Detailed DDD explanations remain in reference files and are loaded only when a card fires or when the user asks for deeper design work.

Every new sentence must pass a replacement test:

> What existing sentence, paragraph, or default obligation can this remove?

If nothing can be removed, the new content is rejected unless it fixes a critical trigger gap.

## Proposed Information Architecture

### 1. Risk Router in `ddd-agent-contract.md`

Move the first-screen DDD guidance toward a compact "Risk Router" section near the top of `ddd-agent-contract.md`.

The router should contain 6-8 cards, not a long list of prohibitions. Each card uses this format:

```text
Risk: <high-risk failure mode>
Smell: <what code shape should make the agent suspicious>
Scan: <rg/go list/static search shape, when possible>
Decision: <default placement or boundary rule>
Allowed exception: <what written evidence is required>
Reference: <deep pattern section>
```

Initial cards:

1. Cross-context direct imports.
2. Generated protocol types leaking into semantic ports.
3. Fat Go RPC shortcut in `application.go`.
4. Shared umbrella processor behind thin message handlers.
5. Business state classification outside Domain.
6. Command-side Application port by dependency-inversion reflex.
7. Runtime/cmd provider pollution.
8. Technical bounded context exception, only when infrastructure-shaped language is the domain language.

The existing 27-item must-not list becomes a compact appendix or table. It should no longer be the default first path an agent mentally executes.

### 2. Keep Detailed Patterns as Reference

`ddd-modeling.md`, `ddd-core.md`, `ddd-golang.md`, `ddd-golang-events-messages.md`, `ddd-golang-runtime.md`, and `ddd-golang-taskqueue.md` remain the source of truth for detailed design. They should not repeat the full risk-card text.

When a card points to a reference, the reference should contain the deeper rationale and examples. The hot path should contain only enough text to trigger the correct review behavior.

### 3. Add Scan Recipes Without Creating a New Default File

Avoid adding a new top-level pattern file unless it replaces existing bulk. Scan recipes should live near the card or the specific reference section they support.

Examples:

- Cross-context import scan: `go list -deps` or `rg` patterns for `internal/<ctx>/application|domain` imports from another context.
- Proto leakage scan: `rg -n 'pkg/gen|gen/go|connectrpc|proto.Message' internal/**/application/{command,domain}`.
- Fat RPC shortcut scan: search `application.go` for repository calls, `Save`, dispatch, enqueue, transaction/session, or multiple outbound ports inside generated RPC methods.
- Shared processor pressure scan: find multiple one-kind handlers that delegate to the same `Processor` with many message families or dependencies.
- State classification scan: search Application/messagehandler/taskprocessor for helpers such as `isTerminal`, `hasLiveRuntime`, `countsAsActive`, `requiresCleanup`, or branches on `State`/`Status`.

Scans are review signals, not proof. Each scan must say what a legitimate exception looks like.

### 4. Downgrade Low-Value Default Checks

The following rules remain useful but should leave the default DDD hot path:

- `infrastructure/` flat-by-default: keep as preference, but allow technology subpackages for heavy adapters when inward interfaces remain semantic.
- `SELECT *`: enforce for production application queries, not homogeneous bootstrap or one-shot migration scripts.
- REST rules: load only for REST/OpenAPI work.
- Kubernetes `preStop` and detailed shutdown ordering: load only for runtime/deployment work.
- go-jimu stack: enforce only when the repository has adopted this guide's stack or the user explicitly wants that stack.

This reduces false positives and keeps architecture reviews focused on boundaries that actually damage maintainability.

## Hook and Trigger Strategy

### Claude Track

Keep the existing progressive-loading model. The hook should continue injecting an index for architecture-related superpowers workflows. The risk router improves what the agent reads after selecting DDD patterns; it does not require heavier hook output.

### Codex Track

Keep SessionStart lightweight. Do not inject the dynamic pattern index or Architecture Gate at session start.

For natural-language architecture review prompts, this design does not mandate a hook behavior change. A possible follow-up experiment is a one-line non-blocking nudge when the prompt explicitly contains terms such as "DDD review", "architecture review", "bounded context", or "Clean Architecture". That experiment must not inject the pattern index and must be reversible if it creates noise.

## Content Budget

This optimization has an explicit size budget:

- No net increase across the DDD pattern set.
- Target 10-20% reduction in default-path DDD text.
- Any new risk card must remove or compress existing prose.
- Any new example must replace a longer example or move to a non-default reference section.
- Pattern count should not increase unless one existing file is merged or substantially shortened.

Implementation should establish a baseline with `wc -w` or `wc -c` across the DDD pattern files before editing, then compare after editing.

## Acceptance Criteria

1. A fresh agent reading the DDD hot path can identify the known talgent failure modes without reading all DDD reference files.
2. The default path is shorter than before, measured across the sections that the agent contract requires first.
3. The full DDD pattern set has no net word-count increase.
4. The Claude and Codex design-pattern trees remain semantically aligned.
5. Low-value checks are clearly scoped to their actual domains instead of appearing as general DDD violations.
6. No hook starts injecting large content into SessionStart or natural-language prompts.

## Suggested Implementation Phases

1. Measure current DDD pattern sizes and identify repeated paragraphs.
2. Rewrite `ddd-agent-contract.md` top section into the Risk Router.
3. Compress the must-not list into an appendix/table and remove duplicated explanations already owned by reference files.
4. Add scan recipes to the relevant cards or nearby reference sections.
5. Downgrade low-value default checks in the appropriate reference files.
6. Sync `plugins/` and `codex-plugins/`.
7. Run parity and size checks.

## Risks

| Risk | Mitigation |
|---|---|
| Compressing guidance removes nuance | Keep references intact; only shrink the first decision path |
| Scan recipes become false positives | Label scans as review signals and require exception evidence |
| Agents stop reading deeper DDD references | Cards must include explicit reference pointers for non-trivial design work |
| Natural-language prompt trigger creates noise | Treat prompt nudge as a separate reversible experiment, not this spec's baseline |
| Dual-track drift | Require final diff/parity check between Claude and Codex pattern trees |

## Self-Review

- No placeholder sections remain.
- The design focuses on plugin behavior and documentation architecture, not talgent remediation.
- The spec does not require adding a new pattern file or expanding default hook output.
- The size budget is explicit and testable.
- The Codex natural-language trigger conflict is called out and left as a separate experiment.
