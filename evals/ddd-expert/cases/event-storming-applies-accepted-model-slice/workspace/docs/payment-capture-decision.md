# Accepted Payment capture facts

These facts are the complete Payment model delta for the current story.

A Payment Capture has one capture identity across retries. After a valid
authorization, Payment requests capture from the provider. Provider confirmation
records Payment Captured; provider refusal records Payment Capture Rejected; an
authorization expiring before confirmation records Payment Capture Expired.

Captured, Rejected, and Expired are terminal outcomes for that Payment Capture.
A refund or chargeback is a separate lifecycle and does not revise the recorded
capture outcome. Repeating a capture request with the same capture identity
returns its recorded terminal outcome. Delivery to consumers may lag or retry
without changing that outcome.

Payment is authoritative for these outcomes. The existing downstream
publication relationship is unchanged and is outside this accepted decision
slice.
