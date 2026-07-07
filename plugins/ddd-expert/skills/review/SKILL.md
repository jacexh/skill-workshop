---
name: review
description: Use when reviewing DDD/backend domain abstractions, specs, plans, or code diffs with concrete files, modules, generated artifacts, runtime wiring, persistence, logging, or boundary evidence to inspect.
---

# Review

Review concrete evidence against the expected model. A review finds evidence-backed issues, high-risk deviations, or evidence gaps; it does not redesign.

First read [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md), then load deeper references only for triggered evidence.

## Expected model sources

Reconstruct the expected model before judging code:

- Domain Modeling Brief, user stories, strategic decisions, and out-of-scope rules;
- DDD design, testing seams, and **Implementation handoff**;
- model evidence for authority, lifecycle, invariant owner, failure tolerance, integration language, collaboration model, and coordination kind when those boundaries matter;
- spec/issue/ADR/glossary/CONTEXT;
- changed files, neighboring code, tests, generated artifacts, migrations, config, runtime wiring, logs, and documented deviations.

If the expected bounded context, data authority, invariant owner, model evidence, layer owner, or local convention cannot be reconstructed, report an evidence gap instead of inventing a model.

## Evidence gate

Before findings:

1. Confirm concrete evidence exists: diff, plan, files, paths, imports, tests, generated artifacts, schema/config/runtime/log evidence, or written deviation.
2. Start from business facts before code shape: reconstruct the command/trigger, past-tense facts, policies, reactions, and expected consistency before treating repositories, handlers, ports, or transactions as primary evidence.
3. Classify touched surfaces from evidence: domain abstraction, spec behavior, generated/protocol boundary, persistence, runtime/config, messages/tasks, logging, external adapter, or repo-specific surface.
4. Use the risk router and local convention to choose required proof. The examples are a router, not an inventory.
5. Decide each candidate as `Rules Satisfied / Not Applicable / High-risk deviation / Evidence gap`. High-risk deviations cannot be classified as Rules Satisfied.
6. Evidence gap, not finding: missing proof stays a gap unless concrete evidence shows a violation.

## Coverage pass

For lifecycle designs, enumerate named lifecycle, event, and recovery flows from
the spec or design. Mark each as `checked`, `finding`, or `evidence gap`.
Checked flows are a compact audit trail, not an exhaustive checklist. Do not
stop after the first Blocker if other independent flows are in scope.

## Default-first key concept check

Tactical drift reading: when structures look awkward, treat them as upstream model
pressure before suggesting cleanup. For Aggregate, Repository, Domain Event,
Integration Message, Application Port, CQRS read, Bounded Context, and FSM
state, state the default rule before local convention. semantic repository methods are evidence, not proof:
multi-object saves need model evidence for one aggregate/owned children or event-driven coordination. Local convention is evidence to
inspect, not a waiver.

## Review axes

Keep axes separate:

- **Domain Abstraction** — terms, identity, lifecycle, invariants, aggregate/policy/service/read-model boundary, events/messages, bounded-context ownership.
- **Spec/Behavior** — user stories, state transitions, exceptions, and out-of-scope behavior versus the plan or diff.
- **Code-level DDD/technology** — dependency direction, generated/protocol isolation, persistence mapping, runtime/config, logging, tests, and local technology rules.

Report each finding under one primary axis. Mention secondary impact only when it changes severity.

## Fix direction ordering

Do not reduce finding count to make every finding fully templated. Every
finding needs evidence, guardrail, triage, and impact; follow-up fields are
selected by finding type.

- **Model correction** — only for lifecycle, consistency, event-fact, or
  coordination findings; name the invariant owner, lifecycle owner, aggregate
  boundary, failure tolerance, or event fact before mechanisms.
- **Implementation mechanism** — repository, transaction, handler, event, task,
  reconciler, or test mechanism that implements the accepted model.
- **Evidence needed** — for evidence gaps.
- **Test / verification needed** — for missing or insufficient proof.

Do not present repository, port, or transaction shape as a peer alternative to
resolving model ownership.

## Output

Lead with findings. Keep small reviews small.

```text
DDD review:
- Expected model sources:
- Evidence gate:
- Checked flows:
- Rules Satisfied / Not Applicable / High-risk deviation / Evidence gap:

Finding: <severity> <axis> <title>
- Evidence: <file:line>
- Violated guardrail:
- Triage: <violation | high-risk deviation | harmless local style | evidence gap>
- Why it matters:
- Model correction: <only for model-affecting findings>
- Implementation mechanism: <when implementation placement is relevant>
- Evidence needed: <for evidence gaps>
- Test / verification needed: <for proof gaps>
```

No DDD findings: say that directly, then list residual test or evidence gaps. Do not fill a finding template with harmless local style.

Severity is about architectural impact: Blocker for invariant/cross-context/generated/storage/runtime safety breaks; Major for likely boundary drift; Minor for localized maintainability or missing proof; Evidence gap when proof is missing.

Common mistakes: reviewing from grep hits; mixing domain/spec/code axes; treating local naming as a violation; treating tolerated deviations as satisfied; saying "no issues" without residual test/evidence gaps.
