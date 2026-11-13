# ADR 0018: A Rule Lives With the Owner of Its Decision

- Status: Accepted
- Date: 2026-11-13
- Amends: decisions 1 and 2 of [ADR 0011](0011-ddd-artifact-writing-contract.md)
- Tracking issue: [#207](https://github.com/jacexh/skill-workshop/issues/207)

## Context

ADR 0011 made `model.md` the single home of every Business Rule, "including
rules that Tactical Design discovers", and made each rule one EARS sentence:
"a claim that needs a second sentence becomes a separate rule". It fixed rules
of up to 144 words.

The Model validator made the result measurable. Accepted Models of a
downstream project showed on 2026-11-13:

- the largest `model.md` held 598 Business Rules for three domain objects,
  with a median of 16 words; one Behavior cited 26 of them;
- across eight contexts with domain objects, 1837 rules: 818 cited by exactly
  one Behavior, 151 by two, 47 by three or more, and 821 by none;
- seven rules described how one key identifies and reuses one object, and one
  Behavior cited all seven.

Three properties of the contract produced this:

- The unit of a rule was a sentence, so one decision became several rules,
  and nothing pushed the other way.
- 80% of the cited rules belonged to one Behavior, yet lived in another file
  behind a name.
- Detail flowed upstream. Tactical Design had to write every decision rule it
  found into `model.md`, and EventStorming had to write rules precise enough
  for Tactical Design before any Behavior existed.

## Decision

1. A rule lives with the owner of its decision.

   | The rule | Home | Shape |
   |---|---|---|
   | is a condition or outcome that one Behavior owns | that Behavior in `domain-objects.md` | a clause under the Behavior |
   | holds across Behaviors of one object | that object in `domain-objects.md` | a named Invariant |
   | is shared by several objects, governs a reading, or has no owning Behavior | `model.md`, under `### Context` | a Business Rule |
   | belongs to a Root that Tactical Design has not designed | `model.md`, under that Root | a Business Rule |

2. A Business Rule is one decision: a name, a head sentence, and clauses only
   when the head cannot hold the decision. Every sentence is one EARS
   sentence. Only names are cited; a clause has no name.
3. EventStorming admits a Business Rule when a strategic decision rests on it:
   removing the rule would change a Bounded Context boundary, an Aggregate
   Root, a consistency boundary, a Role's authority, a Policy, or a contract.
   It groups Business Rules by Aggregate Root and hands a finer condition or
   outcome on as an open decision.
4. Tactical Design writes each rule it assigns as a clause or an Invariant. At
   Root confirmation it moves the Business Rules under that Root out of
   `model.md`; the Root confirmation covers the move.
5. Business rules are confirmed in two places: strategic rules in the
   EventStorming proposal, and the rules of an object at its confirmation.
6. EventStorming reads the Invariants and clauses in `domain-objects.md` as
   accepted rules. A new rule for a designed Root waits under that Root in
   `model.md` for Tactical Design.
7. The Model validator checks the shape: each clause and Invariant is one
   sentence of at most 25 words, a `Rules:` citation resolves to an Invariant
   of the Aggregate or a Business Rule or Policy of the Model, and it reports
   the Business Rules outside `### Context` that no Behavior cites.

Considered and not chosen:

- Keep every rule in `model.md` and only group the sentences of one decision.
  It shortens citation lists, but the grouping test is a judgement, and the
  rule stays away from the Behavior that owns it.
- Keep a coarse rule in `model.md` and refine it under the Behavior. One
  meaning then has two homes, which ADR 0011 removed.
- Limit the number of rules or the size of a file. A number invites merged
  rules that no longer state one decision.

The single source of these rules stays the "Business rule writing" section of
`templates/artifact-layout.md`.

## Consequences

- The grouping of rules follows ownership, which Tactical Design already
  decides; its pressures become what it writes.
- `model.md` becomes thinner as Roots are designed. A Root group there means
  that rules wait for Tactical Design.
- Codify reads the rules of a Behavior with the Behavior. Guard counts
  clauses and Invariants with Behaviors.
- EventStorming confirms less: a user sees the rules of a method first at the
  object's confirmation.
- Tactical Design asks for more, because EventStorming no longer supplies the
  detail of each Command.
- Existing Models are not rewritten mechanically. A Root regroups at its next
  Tactical Design pass, and the validator accepts the earlier shape until
  then. Rules that no Behavior cites stay where they are; their admission is a
  review for the next EventStorming pass.
- ADR 0011 decision 5 still holds: a rewrite that splits, merges, or renames a
  rule needs confirmation.
