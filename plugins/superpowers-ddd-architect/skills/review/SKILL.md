---
name: review
description: Use when reviewing DDD/backend code, plans, or diffs for boundary violations: cross-context imports, generated protocol leaks, fat RPC/application methods, misplaced state decisions, Python/TypeScript module leaks, async role mixing, taskqueue/runtime/cmd pollution, or missing evidence.
---

# Review DDD Boundaries

Use this skill to audit DDD/backend changes for concrete boundary risks. Findings need evidence, not generic DDD advice.

## When To Use

- Use for plans, diffs, PRs, or code paths where concrete evidence can be inspected.
- Use after implementation or when reviewing an architecture proposal with named files/modules.
- If the request is still choosing boundaries without concrete files, use `design`.
- If the request is placing new code, use `implement`.

## Workflow

1. Identify the changed bounded contexts, backend language, layers, generated-code touch points, runtime/taskqueue/message paths, and database persistence paths.
2. Read [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md) first and select only triggered risk cards.
3. Read [../../references/ddd-agent-contract.md](../../references/ddd-agent-contract.md) and the deeper references required by triggered cards.
4. Check evidence before conclusions: cite file/line, dependency direction, type leak, orchestration thickness, state decision, async role, runtime wiring, or test gap.
5. Distinguish violation, allowed exception with written evidence, and harmless local style.

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
Finding: <severity> <title>
- Evidence: <file:line>
- Repo calibration: <bounded-context roots / layer names / generated-code paths / probe rewrites relevant to this finding>
- Violated guardrail: <risk card/reference>
- Why it matters:
- Fix direction:
```

If no issues are found, say so and list residual test or evidence gaps.
