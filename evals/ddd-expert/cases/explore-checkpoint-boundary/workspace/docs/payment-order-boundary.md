# Accepted Payment to Order boundary

These facts are the complete boundary delta for the current story.

Payment is upstream of Order and owns the Published Language contract. Payment
Captured is Payment's authoritative fact that a Payment Capture reached its
terminal Captured outcome. Payment publishes that fact without giving Order
authority to redefine Payment's lifecycle or outcome.

At its boundary, Order translates Payment Captured into the local term Captured
Payment Evidence. That local term means only that Order accepted Payment's
authoritative capture fact; it does not mean the Order is ready for fulfillment.
Order remains the sole authority for the local reaction and for fulfillment
readiness.
