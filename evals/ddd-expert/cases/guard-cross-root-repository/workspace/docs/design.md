# Accepted Tactical Design

Order and Payment are independent Aggregate Roots with separate identities,
lifecycles, and repositories. Payment may succeed before Order reflects the
fact. Temporary inconsistency is accepted. A PaymentSucceeded reaction updates
Order idempotently; retry and reconciliation own recovery.

No business invariant requires Order and Payment to share one MySQL transaction.
