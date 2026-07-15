Registration publishes the named `Seat Commitment Facts` contract to Delivery.
It contains `Seat Committed` when Registration grants a named participant a
seat for a workshop and `Seat Released` when Registration later removes that
right. Each fact carries stable registration, participant, and workshop
identity plus Registration's ordering, so Delivery can determine the latest
Registration-owned fact. Registration remains authoritative for both facts.

Delivery translates a current `Seat Committed` with no later `Seat Released`
into admission eligibility. Eligibility does not dictate admission: Delivery
still owns the admission decision. A later `Seat Released` prevents a later
admission but does not erase attendance that Delivery has already recorded.
The model influence is only from Registration to Delivery.
