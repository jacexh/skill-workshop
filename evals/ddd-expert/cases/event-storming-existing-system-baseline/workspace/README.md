# Existing automation backend

Work owns requested work and its business completion. Project Knowledge owns
the accepted project view and candidate reconciliation. Both delegate actual
agent runs to Agent Execution, which owns run admission, execution identity,
lease fencing, and terminal execution outcomes. A run never decides whether a
Work is complete or whether knowledge becomes accepted.
