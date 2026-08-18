The confirmed Billing facts and the scoped Tactical Design exploration draft are
already present. I explicitly authorize reversible implementation exploration in
`internal/billing/invoice.go` only.

Remove the persistence-confirmation responsibility from Invoice. It has no
confirmed business fact, rule, or result and must be deleted, not retained under
a new field, method, event, flag, acknowledgement, or equivalent name. Preserve
the remaining Invoice field and method surface, preserve the accepted settlement
behavior, and do not edit the existing test or any DDD artifact. Run the Go
tests. Return the concrete deletion and test result as
`design_evidence` to Tactical Design for reconciliation; this draft is not ready
for Guard.
