When a held Reservation reaches its hold deadline, the trusted Clock triggers
`Expire Reservation` for that Reservation identity. Reservation remains the
decision authority: only a currently Held Reservation accepts that intent and
establishes `Reservation Expired`.

`Reservation Expired` is terminal. It ends the customer's right to confirm and
returns the held quantity to available capacity. Confirmed, Released, and
Expired are mutually exclusive terminal outcomes; if confirmation,
cancellation, and expiry compete, only the first admissible intent establishes
an outcome. Repeating expiry for the same Reservation identity returns the
established fact without another capacity change.

This closes the only open business edge in the current scope. The lifecycle's
DDD representation is not a product decision.
