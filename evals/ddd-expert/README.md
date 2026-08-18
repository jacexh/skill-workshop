# ddd-expert behavior evaluations

This suite runs isolated observable-behavior checks for EventStorming decision quality, Tactical Design materialization, `codify`, and `guard`. It complements `scripts/release/test/test_ddd_expert_plugin.sh`, which checks plugin structure and artifact contracts deterministically.

## EventStorming evaluation boundary

EventStorming cases may release-gate observable interaction boundaries: whether the agent establishes the user's purpose, asks one decisive business question, preserves uncertainty, and performs zero writes before confirmation. The suite does not score a preferred architecture name, Bounded Context boundary, Aggregate decomposition, or mechanism.

Evaluate EventStorming through:

- small automated probes that assert exactly one question, zero writes, and no downstream route rather than matching preferred words in that question; and
- manual review of a small representative HITP transcript for evidence gathering, useful questions, credible alternatives, willingness to revise, visible uncertainty, and absence of invented business authority. For Aggregate Capability changes, include one scenario where the same Role intent crosses different pre-states and one where the Role chooses materially different intents; verify that Command normalization, capability granularity, and Command-labeled-edge traceability distinguish them without scoring a preferred domain name.

Manual transcript review remains necessary for question content and design judgment; the automated probes cover only high-signal interaction boundaries that do not encode a solution topology.

## Tactical Design evaluation boundary

Tactical Design is also an interactive judgment workflow, so the suite does not score its design answer by keywords or a preselected sequence. Automated producer cases exercise deterministic validation and confirmation materialization. They do not judge whether the original system thesis was wise. Deterministic release checks cover the Design Delta threshold, domain-object model, responsibility, state authority, semantic flow, necessity proof, minimal sequences, draft exploration/reconciliation boundary, claim accounting, artifact lifecycle, and routing. Manually review representative transcripts for whether object responsibility, state authority, and semantic flow explain the design before mechanisms appear, whether the agent challenges the thesis, and whether implementation evidence can remove an unnecessary concept.

Guard fixtures may include an already accepted Tactical Design when the observable question is whether Guard faithfully detects code that contradicts a specific immutable claim. That tests review behavior, not whether the original design was wise.

## Automated suite

Checked-in EventStorming, Tactical Design materialization, `codify`, and `guard` cases may assert observable questions, file changes, commands, review families, evidence paths, and structured completion. Codify includes a semantic deletion case whose fixed AST-backed test permits only the accepted Invoice business-state surface, rejecting a renamed field, method, type, or package-level state carrier. The runner does not use another LLM as a judge.

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

Add cases only for an observable interaction, Tactical Design materialization, Codify, or Guard contract that can be judged without pretending to know the correct domain model or collaboration design. Keep each workspace minimal and expectations outside the model-visible input.

Do not add an EventStorming case whose pass condition depends on expected terminology, a fixed architecture answer, or occurrence of design-principle words. A question-quality case must admit multiple phrasings and stop before the user supplies the decision. Use a human-reviewed transcript when the question is whether the facilitator exercised broader design judgment.
