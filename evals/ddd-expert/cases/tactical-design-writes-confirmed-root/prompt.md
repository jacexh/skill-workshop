We have completed the depth-first Tactical Design discussion for the Invoice
Aggregate Root, including its Payment Attempt Entity. I explicitly confirm the
exact Root slice below. Write this Invoice slice now to the current Billing
`domain-objects.md`, preserving the already confirmed Credit Note slice. Do not
wait for the unrelated Refund Root and do not change the strategic files or
implementation.

- Invoice is an Aggregate Root identified by InvoiceID.
- Definition: Invoice represents the amount Billing is entitled to collect.
- State: currency, outstanding balance, and settlement status.
- Behavior Apply Payment: Invoice applies an accepted Payment to its outstanding balance, producing a reduced or settled balance.
- Domain Event Invoice Settled: Invoice emits Invoice Settled when the accepted payment reduces outstanding balance to zero, producing durable evidence for the receipt reaction.
- Payment Attempt is an Entity identified by PaymentAttemptID inside Invoice.
- Definition: Payment Attempt represents one accepted attempt to reduce this Invoice.
- State: accepted payment quantity and currency.
- Behavior Record Payment: Payment Attempt records an accepted payment quantity, producing evidence used by Invoice settlement.
- Payment Attempt has no actual Domain Event.
