Payment Captured is necessary but not sufficient. Order becomes ready for
fulfillment only after it has all three current Order-local facts for the same
Order: `Payment Captured`, `Inventory Reserved`, and `Fraud Approved`. Order is
the sole authority that decides readiness and establishes `Order Ready for
Fulfillment`; Payment, Inventory, and Fraud do not make that decision.

If Order receives an authoritative later Payment reversal outcome before
fulfillment has been released, it establishes `Fulfillment Readiness Revoked`
and fulfillment may no longer begin. That later outcome belongs to Payment's
separate reversal lifecycle and does not rewrite the historical `Payment
Captured` fact. If fulfillment was already released, the reversal does not
rewind it; recovery is a separate scenario outside this scope.
