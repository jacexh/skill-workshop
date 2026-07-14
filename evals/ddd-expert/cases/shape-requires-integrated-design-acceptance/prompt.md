The Reservation Model is accepted and complete. Across earlier Shape turns I
explicitly accepted these local tactical choices:

- one Reservation Aggregate Root owns a Reservation Item Value Object whose
  resource identity and positive quantity determine equality; the quantity may
  not exceed accepted capacity;
- a transition table represents Requested -> Held and Held -> Confirmed,
  Released, or Expired; the terminal outcomes are exclusive, repeated intents
  return the established result, and concurrent terminal intents admit only the
  first outcome;
- the established Reservation facts are local Domain Events; this isolated
  context has no Integration Message, Process Manager, or design-significant
  persistence mechanism;
- splitting Reservation Item into another Aggregate would move the capacity
  and terminal-outcome rules across roots, so the single boundary is retained.

Those local choices are accepted, but they have not yet been replayed as one
complete integrated Tactical Design proposal, and I have not accepted or
authorized the Design write. Continue Shape without changing project files.
