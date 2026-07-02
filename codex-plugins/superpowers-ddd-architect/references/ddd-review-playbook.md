---
name: DDD Review Playbook
description: Phase playbook for turning concrete DDD/backend evidence into boundary findings, allowed exceptions, or evidence gaps.
---

# DDD Review Playbook

Use this with `ddd-risk-router.md` when concrete files, modules, plans, or diffs can be inspected. The goal is evidence-to-judgment, not generic DDD advice.

## Inputs

- Diff, plan, PR, or named file/module set.
- Design/spec/Architecture Gate when available.
- Repo calibration from the risk router.
- Relevant tests, docs, generated code, runtime wiring, persistence paths, and async paths.

## Thinking Framework

### 1. Evidence map

Collect facts before conclusions:

- changed bounded contexts and layers;
- generated-code touch points;
- imports and dependency direction;
- handlers, services, ports, repositories, adapters, DTOs, data objects;
- state decisions and invariant checks;
- Domain Events, Integration Messages, task processors, runtime wiring;
- transactions, retries, idempotency, failure policy;
- tests and verification evidence.

### 2. Expected model vs observed code

Reconstruct expected ownership from the design/spec/codebase:

- bounded context and data authority;
- aggregate, policy, service, or explicit none;
- commands, queries, read models, events/messages, and lifecycle rules;
- expected layer and dependency direction.

Compare with observed code. A mismatch is only a candidate finding until it is tied to a rule.

### 3. Risk-card mapping

Use `ddd-risk-router.md` to select triggered cards. Rewrite probes to match repo shape. Treat hits as review targets, not proof.

### 4. Finding triage

Classify each candidate:

- **Violation:** evidence contradicts a DDD boundary rule.
- **Allowed exception:** written design or local convention justifies the shape.
- **Harmless local style:** naming or layout differs, but ownership and dependency direction are intact.
- **Evidence gap:** expected model or proof is missing; ask or report the gap instead of guessing.

### 5. Review output

Lead with real findings. If no issues are found, say so and list residual test/evidence gaps.

## Severity Calibration

Use severity to express architectural impact, not personal style preference.

- **Blocker:** the evidence shows a boundary violation that can corrupt business invariants, break cross-context contracts, leak generated/protocol/storage types into Domain, or make runtime/taskqueue/message lifecycle unsafe.
- **Major:** the evidence shows likely architectural drift that may still work today, such as command-side Application port reflex, fat RPC shortcut, umbrella handler, business state decision outside Domain, or provider-heavy `cmd` wiring.
- **Minor:** the evidence shows localized maintainability risk with low boundary impact, such as unclear naming around an otherwise correct owner, missing trace note, or a small test/evidence gap.
- **Harmless local style:** naming, directory, or framework shape differs from the guide but ownership, dependency direction, invariant placement, and boundary mappings are intact. Do not report this as a violation.
- **Evidence gap:** the expected model, local convention, or verification proof is missing. Ask or report the gap; do not upgrade it to Blocker/Major without evidence.

## Reference Routing

- Read `ddd-agent-contract.md` for must-not rules and review self-checks when a risk card or diff touches them.
- Read `ddd-core.md` for dependency direction, ports, generated type boundaries, Domain Events, Integration Messages, and review checklist.
- Read the active language guide when package/module shape or language-specific shortcuts matter.
- Read event/message, taskqueue, runtime, or database references only when evidence touches those paths.

## Minimum Output Contract

Use the smallest output that preserves evidence.

- **Small review:** emit only Evidence, Risk card or rule, Triage, Severity, and Fix direction for each real finding. Use this when the review scope is a small diff or one known layer.
- **Full review:** emit the complete output below. Use this when the review spans multiple layers, new ports, generated types, events/messages, runtime/taskqueue/database behavior, context boundaries, or a plan without enough implementation evidence.
- **No-finding review:** state no DDD findings and list residual test/evidence gaps. Do not fill a finding template with harmless local style.

## Output

```text
DDD review:
- Evidence map:
- Expected model vs observed code:
- Risk cards:
- Finding triage:

Finding: <severity> <title>
- Evidence: <file:line>
- Repo calibration:
- Violated guardrail:
- Triage: <violation | allowed exception | harmless local style | evidence gap>
- Why it matters:
- Fix direction:
```

## Common Mistakes

- Reporting a violation from a grep hit before mapping it to a boundary rule.
- Treating every local naming difference as DDD noncompliance.
- Reviewing code without reconstructing the expected model.
- Ignoring allowed exceptions already documented in the design or local architecture tests.
- Saying "no issues" without noting missing tests or evidence gaps.
