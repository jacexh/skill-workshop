Design regression evidence for the supplied reservation service. Do not edit the
workspace.

Production uses PostgreSQL. `Reserve(resourceID, requestID)` should create at
most one active reservation per resource and write a matching outbox event in
the same transaction. An incident produced either two active reservations under
concurrency or a reservation without an outbox row after failure. Existing tests
mock both persistence ports and assert call counts. Propose concrete integration
tests, setup, coordination, assertions, and residual risk.
