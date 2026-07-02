---
name: review
description: Use when reviewing DDD/backend code, plans, or diffs with concrete files, modules, or boundary evidence to inspect.
---

# Review DDD Evidence

Use this skill as the review-phase entry point. It routes the agent to the review playbook and keeps the output contract small.

## When To Use

- Use for plans, diffs, PRs, or code paths where concrete evidence can be inspected.
- Use after implementation or when reviewing an architecture proposal with named files/modules.
- If the request is still choosing boundaries without concrete files, use `design`.
- If the request is placing new code, use `implement`.

## Workflow

1. Confirm there are concrete files, modules, diffs, plans, or evidence to inspect. If boundaries are still being chosen, use `design`; if code is being placed, use `implement`.
2. Read the default entry pair: [../../references/ddd-review-playbook.md](../../references/ddd-review-playbook.md) for the review thinking framework and [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md) for risk-card routing.
3. Follow the playbook's Evidence map, Expected model vs observed code, risk-card mapping, and Finding triage.
4. Use the playbook's Severity Calibration and Minimum Output Contract: keep small reviews focused, do not report harmless local style as a violation, and distinguish evidence gaps from findings.
5. Read deeper references only when a triggered risk card or review finding requires them:
   - [../../references/ddd-agent-contract.md](../../references/ddd-agent-contract.md) for must-not rules and review self-checks.
   - [../../references/ddd-core.md](../../references/ddd-core.md) for dependency direction, ports, generated type boundaries, Domain Events, and Integration Messages.
   - Active language or Go support references only when evidence touches those paths.

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
