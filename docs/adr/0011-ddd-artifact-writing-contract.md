# ADR 0011: DDD Artifact Writing Contract

- Status: Accepted
- Date: 2026-11-03
- Refines: the Model and domain-object content rules in [ADR 0009](0009-sparse-current-ddd-artifacts.md)

## Context

ADR 0009 made the DDD artifacts sparse in structure, but left their prose
unbounded. A project that used the plugin across many iterations showed the
result on 2026-11-03:

- one `domain-objects.md` file was 50 KB for three objects; its entries had a
  median of 52 words and a maximum of 342 words;
- one `model.md` file had 69 Business Rules with a median of 37 words and a
  maximum of 144 words;
- one meaning appeared in a Business Rule, a Domain Service Behavior, and a
  Domain Event consumer at the same time;
- Behavior entries mixed business rules with display, persistence
  coordination, migration history, and clarifications of past misreadings;
- a history section with ADR references stayed in `domain-objects.md`,
  although the artifact layout already prohibited design history.

Each iteration added text, because adding felt safe and removing felt risky.
Codify then read long, mixed entries as its semantic constraint.

## Decision

1. `model.md` is the single home of every Business Rule of a context,
   including rules that Tactical Design discovers. A Behavior in
   `domain-objects.md` owns the decision and cites its governing rules by
   name after `Rules:`; it does not restate the rule text.
2. Each Business Rule is one sentence in an EARS pattern (Ubiquitous, Event,
   State, Unwanted, Optional). A claim that needs a second sentence becomes a
   separate rule.
3. Artifact content is English in ASD-STE100 Simplified Technical English at
   about 80% strictness: Ubiquitous Language terms are the technical names,
   sentences are active, have at most 25 words, and state one fact, rule, or
   behavior. The conversation may still use the user's language.
4. Each field records business meaning only. Display, persistence,
   coordination, transport, migration history, and rationale belong in project
   decisions or code.
5. A write that changes an entry's meaning rewrites the whole entry to this
   contract. A rewrite that splits, merges, or renames a Business Rule or
   Policy needs confirmation; a wording-only rewrite does not. There is no
   separate migration step for existing artifacts.

The single source of these rules is the "Artifact writing" and "Business rule
writing" sections of `templates/artifact-layout.md`.

## Consequences

- Behavior entries become short ownership statements; rule text is read in
  one place, so a rule change is a one-place edit.
- Existing artifacts converge to the contract as their entries change.
  Unchanged entries keep the old style until then.
- Artifacts written in another language move to English as their entries change.
- The contract is still prose. Write checks reread entries against it, but no
  script enforces sentence length or field content yet.
