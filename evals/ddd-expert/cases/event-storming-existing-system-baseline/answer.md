Accept the three-context current-state baseline, with this precise authority:

- Agent Execution owns Agent Run admission, execution identity, lease fencing,
  lifecycle, and terminal execution outcomes.
- Work owns requested business work and the decision that Work is complete.
- Project Knowledge owns knowledge candidates, reconciliation, and the decision
  that a candidate becomes accepted knowledge.

Agent Execution is upstream of Work through the named `Work Agent Run Outcome`
contract and upstream of Project Knowledge through the named `Knowledge Agent
Run Outcome` contract. Each contract publishes the authoritative terminal
Agent Run outcome with stable Agent Run identity. Each downstream context
translates that execution evidence into its own language; it never completes a
Work or accepts a knowledge candidate by itself. Work and Project Knowledge
have no model dependency on one another.

The repository does not yet establish any externally visible recovery fact.
Keep recovery visibility outside this accepted current-state baseline until
the product owner supplies that business meaning.
