# Record one Pass use

A Pass Holder presents an already Active Pass at an Access Gate for one access
attempt. The Access Gate issues `Record Pass Use` with a previously unseen Use
Key. Pass is the sole decision authority for its activation, expiry,
remaining-use count, and the outcome for each Use Key.

When the Pass is Active and has at least one remaining use, `Record Pass Use`
reduces its remaining-use count by exactly one and establishes `Use Recorded`.
That fact grants the Pass Holder access for that attempt. Repeating the same Use
Key returns its original established outcome and access decision without
consuming another use.

When the Pass is Expired or has no remaining uses, `Record Pass Use` establishes
`Pass Use Rejected`. Access is denied and the remaining-use count does not
change. A trusted Clock triggers `Expire Pass` when the accepted expiry deadline
arrives, establishing `Pass Expired`; that terminal fact prevents later new Use
Keys but does not rewrite earlier `Use Recorded` facts.

Pass has no dependency on another business context for these decisions. The
Pass Holder, Access Gate, and Clock are actors or triggers, not additional
business authorities.
