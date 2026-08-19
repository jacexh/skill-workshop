The accepted Billing Model and Domain Objects are already present. Implement
their Invoice slice in `internal/billing/invoice.go` only.

Remove the persistence-confirmation responsibility from Invoice. The accepted
object has no such state or behavior, so delete it rather than retaining it
under a new field, method, event, flag, acknowledgement, helper function, or
equivalent name. Preserve Invoice identity and settlement behavior. Do not edit
the existing test or any DDD artifact. Run the Go tests and report the concrete
deletion and verification result.
