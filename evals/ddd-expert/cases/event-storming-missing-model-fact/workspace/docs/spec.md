# Order payment

An order should be created and paid in one user operation. The implementation
team proposes `Order` and `Payment` objects and one MySQL transaction.

Product has not decided whether a payment attempt has an independent lifecycle,
which object owns the no-double-charge invariant, whether a succeeded payment
may temporarily precede the order's paid state, or who can reverse a payment.
