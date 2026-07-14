# Accepted Agent execution dependency model

This is the complete integrated Model target for the migration.

Agent Execution, Work, and Project Knowledge remain separate Bounded Contexts.
Agent Execution owns Agent Run admission, identity, lifecycle, and terminal
outcomes. Work owns Work lifecycle and completion. Project Knowledge owns
Knowledge Candidate evaluation and acceptance.

Agent Execution is upstream of Work through the named `Work Agent Run Outcome`
contract. It publishes the authoritative terminal Agent Run outcome with a
stable Agent Run identity. Work accepts that outcome only as execution evidence
and translates it into Work language; an Agent Run outcome never completes a
Work by itself.

Agent Execution is upstream of Project Knowledge through the named `Knowledge
Agent Run Outcome` contract. It publishes the authoritative terminal Agent Run
outcome with a stable Agent Run identity. Project Knowledge accepts that outcome
only as execution evidence and translates it into Candidate evaluation
language; an Agent Run outcome never accepts a Knowledge Candidate by itself.

Work and Project Knowledge have no model or published-contract dependency on
one another. They cannot import or decide one another's lifecycle. Runtime
request and response flow does not add another Context Map edge.

Replace the retired detached Relationships inventory with the canonical Global
View, each context's direct Local View, and both sides of the two named
contracts. Replace each affected Model's retired `Context Relationships`
section with its accepted local `Context Dependencies`. Advance all three
affected Models from revision 1 to revision 2 in the same accepted transaction.
Keep the context inventory and root navigation links unchanged, but replace the
root README's retired `Context relationships are authoritative` sentence with
the canonical `Context dependencies and named contracts are authoritative`
sentence in that same transaction.
