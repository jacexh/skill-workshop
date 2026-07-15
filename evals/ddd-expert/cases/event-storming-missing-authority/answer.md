The business calls this responsibility Catalog Pricing.

A Seller issues `Request Price Change` with a requested price and a new Price
Change Request identity. A Category Manager may issue `Approve Price Change`
for that pending request, establishing `Category Manager Approved`. Approval is
required but is not yet a final outcome, so the current catalog keeps its old
price while fraud review is pending.

The fraud system is authoritative for the review result. When it clears the
approved request it establishes `Fraud Cleared`; Catalog Pricing then accepts
the request, establishes the terminal facts `Price Change Accepted` and
`Catalog Price Changed`, and makes the requested price the current catalog
price. If the fraud system instead establishes `Fraud Rejected`, Catalog
Pricing establishes terminal `Price Change Rejected`; the current catalog keeps
its old price. The Category Manager cannot override `Fraud Rejected` for the
same request.

Catalog Pricing owns the current catalog price and the Price Change Request
lifecycle. Accepted and Rejected are mutually exclusive for one request. A
duplicate review result returns the established outcome without changing the
catalog again. After rejection, only the Seller submitting a new Price Change
Request with a new request identity starts the process again.
