---
name: review
description: Use when reviewing DDD/backend domain abstractions, specs, plans, or code diffs with concrete files, modules, generated artifacts, runtime wiring, persistence, logging, or boundary evidence to inspect.
---

# Review DDD Evidence

Use this skill when concrete files, modules, plans, or diffs can be inspected. The goal is evidence-to-judgment across separate review axes, not generic DDD advice or redesign.

## When To Use

- Use for Domain Modeling Briefs, designs, plans, diffs, PRs, or code paths where concrete evidence can be inspected.
- Use after implementation or when reviewing an architecture proposal with named files/modules.
- If the request is still choosing boundaries without concrete files, use `design`.
- If the request is placing new code, use `implement`.

## Workflow

1. Confirm there are concrete files, modules, diffs, plans, or evidence to inspect. If boundaries are still being chosen, use `design`; if code is being placed, use `implement`.
2. Read [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md) for shared risk-card routing.
3. Run the Evidence Gate before reporting findings. For any touched surface, verify expected model, repo convention, allowed exceptions, and concrete evidence before deciding severity.
4. Review on separate axes: Domain Abstraction, Spec/Behavior when a spec exists, and Code-level DDD/technology placement.
5. Follow Evidence Preconditions, Evidence map, Expected model vs observed code, risk-card mapping, and Finding triage.
6. Use Severity Calibration and the Minimum Output Contract: keep small reviews focused, do not report harmless local style as a violation, and distinguish evidence gaps from findings.
7. Read deeper references only when a triggered surface, risk card, or review finding requires them:
   - [../../references/ddd-agent-contract.md](../../references/ddd-agent-contract.md) for must-not rules and review self-checks.
   - [../../references/ddd-core.md](../../references/ddd-core.md) for dependency direction, ports, generated type boundaries, Domain Events, and Integration Messages.
   - Active language or Go support references only when evidence touches those paths.

## Evidence Gate

Run this gate before findings. Review can find defects, but it is not the right first place to make placement decisions. Do not rely on review as the first placement gate; if implementation has not happened yet, use `implement` and its Preflight Rule Gate first.

1. Confirm concrete review evidence: diff or plan, touched files, generated artifacts, config, migrations/schema, runtime wiring, tests, logs, and written exceptions when relevant.
2. Classify touched surfaces from paths, imports, generated artifacts, migrations, runtime entrypoints, tests, and logs.
3. Use the surface router below to decide which references and evidence are required. The table is a router, not an inventory. Add or rename surfaces from the repository evidence when the diff touches a domain-specific adapter, security boundary, projection, cache, external API, scheduler, or other stable capability not named here.
4. For each triggered surface, decide one of: `Rules Satisfied / Not Applicable / Exception / Evidence gap`.
5. Evidence gap, not finding: when required proof is missing, report the gap instead of promoting a suspicion into a violation.

| Trigger evidence | Required review route | Evidence to check |
|---|---|---|
| `cmd/**, configs/**, internal/pkg/**`, runtime modules, config profiles, lifecycle hooks | Runtime/config/lifecycle references such as `ddd-golang-runtime.md` plus the active language guide | Entrypoint shape, component `Option` ownership, module assembly, listen/serve/shutdown ordering, cleanup ownership, runtime tests |
| `proto/**, pkg/gen/**, ConnectRPC, gRPC`, generated handlers, codecs | Generated protocol/RPC rules in `ddd-golang-application.md §0.7`, `ddd-golang-scaffold.md §0.4`, `ddd-core.md`, and risk-router cards | Generated contract use, Domain isolation from generated/protocol types, adapter thinness, map -> delegate once -> map response/error, local shortcut conventions |
| `scripts/sql/**, migrations/**, repository/DO/persistence`, schema or optimistic-lock changes | `database.md` plus language persistence rules | Standard fields, timestamp storage semantics, soft delete/version semantics, DO/value conversions, SQL-side version increment, real schema verification |
| `slog`, `sloghelper`, `fx.Lifecycle`, handlers, workers, request/job boundaries | Logging/lifecycle rules from active runtime and language references | Completion log fields, error logging helpers, context/logger propagation, retry/skip/failure outcomes, shutdown evidence |
| Any other repository-specific surface | Relevant risk-router card, local convention, spec/ADR, neighboring implementation, and active language/runtime reference | Ownership, dependency direction, boundary mapping, failure behavior, tests, documented exceptions |

## Evidence Preconditions

Run these preconditions before reporting findings. A precondition is triggered by a candidate violation, risk-card hit, probe hit, or missing expected model; when triggered, collect enough evidence before deciding severity.

- Reconstruct the expected model from design/spec/code before judging observed code.
- Use the risk router's Required evidence and Allowed exception columns before calling a risk-card hit a violation.
- Evidence gaps are not findings: if the bounded context, data authority, invariant owner, generated-code convention, or runtime ownership cannot be reconstructed, report an evidence gap or ask for context.
- Check local convention, neighboring code, architecture tests, and written exceptions before treating package/framework shape as a violation.
- Do not redesign in review. A review may recommend returning to design, but it should not invent a replacement model inside a finding.

## Thinking Framework

### 1. Review axes

Keep axes separate. Do not let a clean code-level implementation hide a wrong domain abstraction, and do not let a good domain abstraction hide unimplemented spec behavior.

- **Domain Abstraction:** compare Domain Modeling Brief, glossary/CONTEXT, ADRs, and design against the proposed model. Check terms, identity, lifecycle, invariants, Aggregate boundaries, Domain Events, Repository responsibilities, bounded-context ownership, and existing-model impact.
- **Spec/Behavior:** when a spec/PRD/issue exists, compare required user-visible behavior, state transitions, exceptions, and out-of-scope constraints against the plan or diff.
- **Code-level DDD/technology:** inspect concrete code placement, dependency direction, generated/protocol boundaries, persistence, runtime/config, logging, tests, and local technology rules.

Report each finding under exactly one primary axis. Mention secondary impact only when it changes severity.

### 2. Evidence map

Collect facts before conclusions:

- Domain Modeling Brief, glossary/CONTEXT, ADRs, spec, and design inputs;
- changed bounded contexts and layers;
- generated-code touch points;
- imports and dependency direction;
- handlers, services, ports, repositories, adapters, DTOs, data objects;
- state decisions and invariant checks;
- Domain Events, Integration Messages, task processors, runtime wiring;
- transactions, retries, idempotency, failure policy;
- tests and verification evidence.

### 3. Expected model vs observed code

Reconstruct expected ownership from the design/spec/codebase:

- bounded context and data authority;
- aggregate, policy, service, or explicit none;
- commands, queries, read models, events/messages, and lifecycle rules;
- expected layer and dependency direction.

Compare with observed code. A mismatch is only a candidate finding until it is tied to a rule.

### 4. Risk-card mapping

Use `ddd-risk-router.md` to select triggered cards. Rewrite probes to match repo shape. Treat hits as review targets, not proof.

### 5. Finding triage

Classify each candidate:

- **Violation:** evidence contradicts a DDD boundary rule.
- **Allowed exception:** written design or local convention justifies the shape.
- **Harmless local style:** naming or layout differs, but ownership and dependency direction are intact.
- **Evidence gap:** expected model or proof is missing; ask or report the gap instead of guessing.

### 6. Review output

Lead with real findings. If no issues are found, say so and list residual test/evidence gaps.

## Severity Calibration

Use severity to express architectural impact, not personal style preference.

- **Blocker:** the evidence shows a boundary violation that can corrupt business invariants, break cross-context contracts, leak generated/protocol/storage types into Domain, or make runtime/taskqueue/message lifecycle unsafe.
- **Major:** the evidence shows likely architectural drift that may still work today, such as command-side Application port reflex, fat generated RPC/IDL adapter, umbrella handler, business state decision outside Domain, or provider-heavy entrypoint/composition wiring.
- **Minor:** the evidence shows localized maintainability risk with low boundary impact, such as unclear naming around an otherwise correct owner, missing trace note, or a small test/evidence gap.
- **Harmless local style:** naming, directory, or framework shape differs from the guide but ownership, dependency direction, invariant placement, and boundary mappings are intact. Do not report this as a violation.
- **Evidence gap:** the expected model, local convention, or verification proof is missing. Ask or report the gap; do not upgrade it to Blocker/Major without evidence.

## Review Focus

Risk cards from ddd-risk-router.md, plus evidence gaps and severity calibration. Do not duplicate the router's risk inventory in this skill; use the router to select required evidence, allowed exceptions, and deeper references.

## Minimum Output Contract

Use the smallest output that preserves evidence.

- **Small review:** emit only Evidence, Risk card or rule, Triage, Severity, and Fix direction for each real finding. Use this when the review scope is a small diff or one known layer.
- **Full review:** emit the complete output below. Use this when the review spans multiple axes, multiple layers, new ports, generated types, events/messages, runtime/taskqueue/database behavior, context boundaries, or a plan without enough implementation evidence.
- **No-finding review:** state no DDD findings and list residual test/evidence gaps. Do not fill a finding template with harmless local style.

## Output

Lead with findings:

```text
DDD review:
- Review axes:
  - Domain Abstraction:
  - Spec/Behavior:
  - Code-level DDD/technology:
- Evidence gate:
- Evidence map:
- Expected model vs observed code:
- Risk cards:
- Finding triage:
- Rules Satisfied / Not Applicable / Exception:

Finding: <severity> <axis> <title>
- Evidence: <file:line>
- Repo calibration: <bounded-context roots / layer names / generated-code paths / probe rewrites relevant to this finding>
- Violated guardrail: <risk card/reference>
- Triage: <violation | allowed exception | harmless local style | evidence gap>
- Why it matters:
- Fix direction:
```

If no issues are found, say so and list residual test or evidence gaps. If the expected model cannot be reconstructed from design/spec/code, report that as a design evidence gap rather than guessing.

## Common Mistakes

- Reporting a violation from a grep hit before mapping it to a boundary rule.
- Treating every local naming difference as DDD noncompliance.
- Merging domain abstraction, spec behavior, and code-level concerns into one undifferentiated finding.
- Reviewing code without reconstructing the expected model.
- Stopping at the example surface router rows instead of deriving repository-specific surfaces from the evidence.
- Ignoring allowed exceptions already documented in the design or local architecture tests.
- Saying "no issues" without noting missing tests or evidence gaps.
