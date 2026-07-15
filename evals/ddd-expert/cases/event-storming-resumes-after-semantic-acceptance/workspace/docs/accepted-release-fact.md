# Accepted Reservation release fact

Product accepts this complete semantic delta for the current scope:

- the Reservation Holder issues `Release Reservation` and owns that intent;
- only a Held Reservation accepts it;
- a successful release establishes the terminal `Reservation Released` fact,
  returns the held quantity to availability, and ends that Holder's right to
  confirm;
- if release and confirmation compete, only the first admissible intent
  establishes a terminal outcome and the later intent observes it;
- repeating release for an already Released Reservation returns the same
  established outcome without another capacity change.

Product has not selected an Aggregate boundary, lifecycle representation,
event classification, persistence mechanism, or verification approach.
