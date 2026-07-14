# ddd-expert behavior evaluations

This suite measures observable `ddd-expert` behavior. It complements
`scripts/release/test/test_ddd_expert_plugin.sh`, which remains a deterministic
manifest, mirror, and prompt-surface lint.

The evaluator does not use another LLM as a judge. Each checked-in case defines
approved expectations, and the runner scores:

- structured phase completion, questions, routes, and review conclusions;
- review reason families plus existing evidence paths and valid line numbers;
- the actual workspace change set from the immutable baseline, including
  ignored files, mode changes, and optional exact write-set limits;
- required or forbidden file content;
- real post-run verification commands.

A Guard execution whose required axis workers cannot complete reports
`completion: stopped` and `review_conclusion: incomplete`, with no DDD verdict
or phase route. This keeps execution failures distinct from authority or
verification evidence gaps.

## Commands

Validate the fixtures and scorer without calling a model:

```bash
node scripts/eval/ddd-expert.js validate
node scripts/eval/ddd-expert.js self-test
node scripts/eval/ddd-expert.js doctor
```

`doctor` does not call a model. It verifies Docker tools, the isolated local
marketplace, the uniquely enabled plugin, and the installed source hash.

Run the four fast phase sentinels once:

```bash
node scripts/eval/ddd-expert.js run \
  --suite smoke \
  --model gpt-5.6-sol \
  --reasoning medium
```

Run every case three times. A case passes when at least two complete trials
pass; the suite passes only when every case passes:

```bash
node scripts/eval/ddd-expert.js run \
  --suite full \
  --model gpt-5.6-sol \
  --reasoning high
```

Use `--case <id>` and `--runs 1` while developing one fixture. Raw traces,
structured responses, copied workspaces, and `summary.json` are written under
`/tmp/ddd-expert-evals/<timestamp>` by default.

Provider, transport, timeout, and CLI failures are invalid trials rather than
behavior failures. The runner retries them twice by default. If it still cannot
collect the requested number of valid trials, the suite is `INCONCLUSIVE` and
exits with status 2; a behavior failure exits with status 1. Override the retry
limit with `--infra-retries`.

## Execution model

At startup the runner freezes the selected cases, response schema, minimal
marketplace, and current `codex-plugins/ddd-expert` source. It verifies that the
installed plugin hash matches that snapshot. Each trial receives a fresh
workspace, Git baseline, and independent `CODEX_HOME`; the plugin cache and
minimal marketplace are mounted read-only. The trial is intentionally
non-ephemeral inside that disposable home because Codex collaboration requires
a registered root thread. Expected answers never enter the model container.
Temporary homes, including the copied Codex login, are always removed.

Collaboration events in the retained trace are diagnostic only. The evaluated
process can write its own output channels, so the runner does not treat those
events as a tamper-proof topology attestation or use them as scoring evidence.

The model call and post-run checks run in the checked-in Docker image. Codex's
internal sandbox is disabled only inside a capability-dropped, read-only-root
container. The container sees one isolated home, one case workspace, its result
directory, the response schema, and the minimal marketplace. It does not see
the source repository, other cases, or expected answers. This also avoids
nested user-namespace failures on hosts where bubblewrap cannot start.
The writable trial workspace has a nested read-only `.git` mount, and post-run
checks see the entire workspace read-only. Scoring uses bounded filesystem
snapshots rather than invoking host Git on model-controlled files.

Behavior runs require an explicit model. `summary.json` records the model, reasoning
level, Codex version, plugin/eval/snapshot fingerprints, exact Docker image ID,
run count, discarded infrastructure attempts, and individual assertions. Use
those identities rather than a mutable image tag or Git `dirty` flag when
comparing releases.

## Adding a case

Keep a case focused on one risk. Add a directory under `cases/` containing:

- `case.json`: execution policy and deterministic expectations;
- `prompt.md`: the user request, without expected-answer hints;
- `workspace/`: the smallest project evidence needed to decide the case.

For discovery-order risks, `expect.questions.contains`, `contains_any`, and
`excludes` score only the first question after Unicode normalization. English
matches use word boundaries; spaces in a phrase also accept a dash. A trailing
`*` declares an explicit English word family (`own*` matches `own`, `owns`, and
`ownership`) without reverting to arbitrary substring matching. Chinese
alternatives use continuous normalized text. Each `contains_any` group requires
one alternative, so a case can require several independent semantic signals
without locking the model to one sentence.

File assertions keep `contains` for exact structural or identifier checks.
Use `contains_any` groups for accepted semantic decisions that may be expressed
with equivalent capitalization, line wrapping, inline Markdown decoration, or wording; every group must
match at least one normalized alternative. This matcher proves that a semantic
signal is present, not that its polarity is positive. A completed-write case
must therefore put concrete opposite propositions in `excludes_semantic`, whose
matching is also case- and line-wrap-insensitive, and keep scorer self-tests for
both an accepted paraphrase and a bug-shaped negation. Keep `excludes` for exact
syntax or heading exclusions where normalized substring matching would be too
broad. Use `identifiers_without_format` when accepted Domain identity semantics
must not acquire an implementation format; its relation-aware check distinguishes
an invented rule from an explicit “no such format” statement. Completed Explore
artifacts use `forbid_temporary_trace` so source-item ledgers cannot survive under
alternate coverage or traceability labels.

`expect.git.allowed_paths` is optional. When present, every observed change must
match one of those paths. Combine it with `required_paths` containing the same
members to declare an exact write set: all declared artifacts must change and no
temporary trace, source document, or unrelated artifact may be added. The runner
compares a full pre/post workspace file snapshot outside `.git`, so ignored files
remain part of this check. Unsafe, unreadable, oversized, or special entries fail
closed before artifact inspection.

For topology-discovery risks, pair an answer-neutral read-only sentinel with a
complete-scope write case. The sentinel should verify that missing language or
business authority is resolved before a context-local lifecycle; the write case
should prove that accepted context responsibilities, relationships, and Models
are committed atomically only after the complete discovery scope is accepted.

For staged Shape consensus, keep separate cases for the first tactical choice,
the next focused choice after a local acceptance, the final integrated
acceptance request, and the accepted atomic write. A write case that starts with
every choice already accepted cannot by itself prove the intermediate
read-only gates. Include retained-Entity and retained-Value-Object write cases
when their definition contracts differ materially.

When context nodes are known but an edge is not, use a relationship sentinel
that requires the upstream-owned fact or intent, downstream local meaning, and
contract authority before either context's local lifecycle is explored.

Run `validate`, `self-test`, and `doctor`, then run the new case at least three
times. Guard cases assert both a reason family and concrete evidence. Prefer one
exact `family`; use `families_any` only when the fixture itself cannot distinguish
equivalent root-cause and implementation-surface classifications. The case
expectation is the one-time maintainer judgment. Normal regression runs do not
require manual scoring.

Do not copy fixture-specific issue names into the generic plugin instructions.
Fix repeated misses at the highest reusable reasoning level, then rerun the
unchanged case.
