# ddd-expert behavior evaluations

This suite runs isolated observable-behavior checks for `codify` and `guard`. It complements `scripts/release/test/test_ddd_expert_plugin.sh`, which checks plugin structure plus the EventStorming and Tactical Design workflow contracts deterministically.

## EventStorming evaluation boundary

EventStorming has no release-gated architecture-answer fixtures. A keyword, fixed phrase, expected Bounded Context name, or preselected context boundary cannot prove that an HITP modeling conversation was reasonable. Adding such a case would optimize the Skill for the oracle rather than for domain discovery.

Evaluate EventStorming through:

- deterministic checks for the ten-step order, one-frontier-question contract, pre-confirmation write barrier, integrated-model confirmation, diagram persistence, documentation synchronization, and Strategic stop; and
- manual review of a small representative HITP transcript for evidence gathering, useful questions, credible alternatives, willingness to revise, visible uncertainty, and absence of invented business authority. For Aggregate Capability changes, include one scenario where the same actor intent crosses different pre-states and one where the actor chooses materially different intents; verify that Command normalization, capability granularity, and Command-to-Capability traceability distinguish them without scoring a preferred domain name.

Manual transcript review is product feedback, not a keyword score and not an automated release gate.

## Tactical Design evaluation boundary

Tactical Design is also an interactive judgment workflow, so the suite does not score its design answer by keywords or a preselected sequence. Deterministic checks cover the Design Delta threshold, no-artifact result, complete-sequence and claim contracts, integrated confirmation, artifact lifecycle, and routing. Manually review representative transcripts for whether the Design Delta was material, sequences reached visible outcomes and failures, ownership was explicit, claims were independently falsifiable, and Codify discretion remained broad enough. Include a review that exposes several dependent Model contradictions and verify that Tactical Design sweeps and consolidates them before one EventStorming handback instead of creating a correction cycle per question.

Guard fixtures may include an already accepted Tactical Design when the observable question is whether Guard faithfully detects code that contradicts a specific immutable claim. That tests review behavior, not whether the original design was wise.

## Automated suite

Checked-in `codify` and `guard` cases may assert observable file changes, commands, review families, evidence paths, and structured completion. The runner does not use another LLM as a judge.

A confirmed per-context Model (`model_status: model_ready`) is direct business
authority for both phases. It remains direct implementation authority when no
Design Delta exists; a Guard fixture may add one scoped ready Tactical Design
record and its matching current BC Architecture projection when implementation
fidelity to an accepted collaboration claim is the observable behavior under test.

Validate fixtures and the deterministic scorer without a model call:

```bash
node scripts/eval/ddd-expert.js validate
node scripts/eval/ddd-expert.js doctor
```

Run a smoke suite:

```bash
node scripts/eval/ddd-expert.js run \
  --suite smoke \
  --model <model> \
  --reasoning medium
```

Run all automated cases:

```bash
node scripts/eval/ddd-expert.js run \
  --suite full \
  --model <model> \
  --reasoning high
```

Use `--case <id>` and `--runs 1` while developing one fixture. Raw traces and copied workspaces are written under `/tmp/ddd-expert-evals/<timestamp>` by default. Provider, transport, timeout, and CLI failures are infrastructure failures rather than behavior failures.

## Adding an automated case

Add cases only for an observable Codify or Guard contract that can be judged without pretending to know the correct domain model. Keep each workspace minimal and expectations outside the model-visible input.

Do not add an EventStorming case whose pass condition depends on expected terminology, a fixed architecture answer, or occurrence of design-principle words. Use a human-reviewed transcript when the question is whether the facilitator exercised sound judgment.
