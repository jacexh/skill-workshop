# ddd-expert behavior evaluations

This suite checks the observable behavior of EventStorming, Tactical Design,
Codify, and Guard. Deterministic release tests separately check plugin shape and
artifact contracts.

## EventStorming

Automated probes assert interaction boundaries: establish the user's purpose,
ask exactly one model-changing question at a time, preserve uncertainty, and
write nothing before integrated confirmation. They deliberately do not score a
preferred Bounded Context or Aggregate decomposition. Human transcript review
is still required for question quality and domain judgment.

## Tactical Design

Automated probes cover two high-signal behaviors:

- an unresolved Root or Entity decision produces one evidence-backed question
  and no artifact write; and
- one confirmed Aggregate Root writes only its current slice in
  `domain-objects.md`, preserving other confirmed Root slices.

Manual review checks the depth-first interview itself: Root A, its Entities,
then Root B; one question at a time; a recommendation and strongest credible
alternative; concise object definitions, state, behavior, and actual Domain
Events only.

## Codify and Guard

`model.md` and `domain-objects.md` are the current authority pair. Codify must
stop when required object design is absent or contradicts the request, must not
edit design during implementation, and must realize behavior on its accepted
owner. A function that mainly accepts one Domain object is explicitly tested as
receiver-shaped drift unless it has a concrete ownerless reason.

Guard cases test structural fidelity, evidence gaps, semantic deletion, and
bounded House Style judgments. Test failures or ordinary migrations alone do
not become DDD findings.

## Running

Validate fixtures and the deterministic scorer without a model call:

```bash
node scripts/eval/ddd-expert.js validate
node scripts/eval/ddd-expert.js doctor
```

Run smoke or full behavior cases:

```bash
node scripts/eval/ddd-expert.js run --suite smoke --model <model> --reasoning medium
node scripts/eval/ddd-expert.js run --suite full --model <model> --reasoning high
```

Use `--case <id> --runs 1` while developing one fixture. Add a case only when
the result can be judged from observable interaction, files, checks, or review
evidence without pretending the evaluator knows the one correct domain model.
