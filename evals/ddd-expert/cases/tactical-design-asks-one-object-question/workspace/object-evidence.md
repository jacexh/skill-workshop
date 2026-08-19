# Billing object evidence

- Invoice owns outstanding balance and settlement status.
- Every accepted payment attempt has a stable PaymentAttemptID.
- One product note says rejected attempts are retained for Billing disputes.
- Another says the payment provider alone owns rejected attempts.
- Refund has separate identity and business rules; it is not needed to resolve
  the Invoice composition question.
