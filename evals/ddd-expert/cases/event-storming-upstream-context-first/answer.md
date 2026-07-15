Payment establishes `Payment Captured` only when the provider confirms that
funds were captured. Payment may later establish `Payment Reversed` when that
captured outcome is reversed. Payment is authoritative for both facts.

Payment publishes them to Order through the named `Payment Capture Facts`
contract. Each fact carries stable payment and order identity plus Payment's
ordering, so a later reversal can be correlated with the capture it corrects.
Neither fact decides an Order outcome; Order must decide its own reaction.
