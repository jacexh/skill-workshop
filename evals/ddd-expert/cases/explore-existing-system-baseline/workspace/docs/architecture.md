# Current module responsibilities

The Work and Project Knowledge modules each submit agent-run requests through
the Agent Execution API. They do not import one another. Agent Execution does
not import either consumer's model and returns execution facts in its own
language.
