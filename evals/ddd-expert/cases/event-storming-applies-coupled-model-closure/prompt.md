Business owners explicitly accept the semantic delta in
`docs/payment-order-boundary.md` and `docs/story.md`. It changes one dependency
and the corresponding facts in Payment and Order, so those canonical artifacts
form the smallest consistency closure. Apply that accepted closure, keep both
source documents unchanged, mark the resulting Models `shape_ready`, and stop
at the Strategic Model boundary. No other business facts are open.
