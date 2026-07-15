A Customer issues `Place Paid Order` with a stable Order identity and
user-operation key. Order accepts that intent by establishing `Order Payment
Pending`, then requests `Capture Payment` using the same operation key and one
Payment-owned `Payment Attempt ID`.

Payment Attempt is a Payment-owned business object with its own identity and
lifecycle: `Requested -> Captured`, `Requested -> Failed`, and `Captured ->
Reversed`. Provider confirmation establishes `Payment Captured`; provider
refusal establishes `Payment Failed`. Payment owns the no-double-charge
invariant. Repeating the same user-operation key never captures funds twice and
returns the same established Payment Attempt outcome.

Payment publishes `Payment Captured`, `Payment Failed`, and `Payment Reversed`
to Order through the named `Payment Outcome Facts` contract. Each fact carries
the stable Payment Attempt, Order, and operation identities. Payment remains
authoritative for payment outcomes; Order remains authoritative for its own
lifecycle.

When a pending Order receives its correlated `Payment Captured`, Order issues
its local `Record Order Paid` decision and establishes `Order Paid`; fulfillment
may then begin. If it receives `Payment Failed`, Order establishes terminal
`Order Payment Failed`, remains unpaid, and fulfillment does not begin.

`Payment Captured` may be established before Order can record `Order Paid`. If
recording the paid outcome fails after capture, Order establishes `Paid Order
Completion Failed`, remains unavailable for fulfillment, and begins recovery
for that same operation. The Finance Operator is the business authority that
issues `Authorize Payment Reversal`; the recovery then requests `Reverse
Payment`, Payment establishes `Payment Reversed`, and Order establishes
terminal `Order Payment Reversed`. This closes the failed operation without a
second charge. Duplicate recovery work observes those established facts and
does not reverse or charge twice.
