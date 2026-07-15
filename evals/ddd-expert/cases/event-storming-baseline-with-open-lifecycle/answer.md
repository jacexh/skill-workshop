The commerce operator issues `Accept Purchase` after current stock and fraud
evidence is available. Purchase, not Funds or either checking system, owns the
acceptance decision.

If stock is unavailable, Purchase records `Stock Check Failed`. If fraud does
not approve the purchase, Purchase records `Fraud Check Failed`. Either failed
check establishes the terminal outcome `Purchase Rejected` for that acceptance
attempt: fulfillment preparation does not begin and the Purchase may not be
released. A retry requires corrected or new check evidence and a new acceptance
attempt; it does not erase the recorded rejection.

Only when both checks pass does Purchase establish `Purchase Accepted`, which
permits fulfillment preparation to begin. This answer does not settle the
detailed Funds reversal or expiry rules, nor how a later Funds correction
changes Purchase's decision to release fulfillment.
