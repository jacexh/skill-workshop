---
name: review
description: Use when reviewing DDD/backend code, plans, or diffs with concrete files, modules, or boundary evidence to inspect.
---

# Review DDD Boundary Evidence

Use this skill to turn concrete DDD/backend evidence into boundary judgments. Findings need evidence, not generic DDD advice.

## When To Use

- Use for plans, diffs, PRs, or code paths where concrete evidence can be inspected.
- Use after implementation or when reviewing an architecture proposal with named files/modules.
- If the request is still choosing boundaries without concrete files, use `design`.
- If the request is placing new code, use `implement`.

## Workflow

1. Build the Evidence map: changed files/modules, bounded contexts, backend language, layers, generated-code touch points, runtime/taskqueue/message paths, database persistence paths, and tests.
2. Reconstruct the Expected model vs observed code:
   - expected bounded context, data authority, aggregate/policy/service boundary, and layer ownership from the design/spec/codebase;
   - expected commands, queries, Domain Events, Integration Messages, read models, and state lifecycle when relevant;
   - observed imports, types, handlers, ports, repositories, adapters, transactions, event/message handlers, runtime wiring, and tests.
3. Read [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md) first and select only triggered risk cards.
4. Read [../../references/ddd-agent-contract.md](../../references/ddd-agent-contract.md) and the deeper references required by triggered cards.
5. Check evidence before conclusions: cite file/line, dependency direction, type leak, orchestration thickness, state decision, async role, runtime wiring, or test gap.
6. Run Finding triage for each candidate: violation, allowed exception with written evidence, harmless local style, or evidence gap. Do not report a violation when the evidence only shows naming or local style.

## Review Focus

- Cross-context Domain/Application imports.
- Generated protocol DTOs inside Domain or semantic command-side ports.
- Fat RPC/Application methods that contain persistence, transactions, dispatch, enqueueing, or multi-port coordination.
- Command-side Application ports created from dependency-inversion reflex instead of capability classification.
- Python or TypeScript modules that bypass the active language guide's layer/module boundaries.
- Domain Event, Boundary Publisher, Integration Message Handler, and task processor roles collapsed together.
- Business state classification outside Aggregate methods or Domain policies.
- Provider-heavy `cmd` and runtime/cmd pollution.

## Output

Lead with findings:

```text
DDD review:
- Evidence map:
- Expected model vs observed code:
- Finding triage:

Finding: <severity> <title>
- Evidence: <file:line>
- Repo calibration: <bounded-context roots / layer names / generated-code paths / probe rewrites relevant to this finding>
- Violated guardrail: <risk card/reference>
- Triage: <violation | allowed exception | harmless local style | evidence gap>
- Why it matters:
- Fix direction:
```

If no issues are found, say so and list residual test or evidence gaps. If the expected model cannot be reconstructed from design/spec/code, report that as a design evidence gap rather than guessing.
