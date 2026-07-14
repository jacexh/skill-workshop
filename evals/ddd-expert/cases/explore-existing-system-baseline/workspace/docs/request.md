# Improve recovery visibility

Operators need to see when an agent run was recovered after a lost lease while
the requested work remains active. Recovery must not silently complete the work
or accept a knowledge candidate. The product owner has not yet decided which
execution recovery facts should be visible outside Agent Execution.
