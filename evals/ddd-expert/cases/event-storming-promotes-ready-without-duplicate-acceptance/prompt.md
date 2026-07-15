The Reservation Model is accepted and complete. The existing evolving Design
already records the accepted choice that one Reservation Aggregate Root owns a
Reservation Item Value Object whose equality uses resource identity and
positive quantity within accepted capacity. Preserve that applied slice and do
not reopen it.

Across earlier EventStorming turns I explicitly accepted these remaining local
tactical choices:

- a transition table represents Requested -> Held and Held -> Confirmed,
  Released, or Expired; the terminal outcomes are exclusive, repeated intents
  return the established result, and concurrent terminal intents admit only the
  first outcome;
- the established Reservation facts are local Domain Events; this isolated
  context has no Integration Message, Process Manager, or design-significant
  persistence mechanism;
- splitting Reservation Item into another Aggregate would move the capacity
  and terminal-outcome rules across roots, so the single boundary is retained.

Those remaining choices are individually accepted. Merge them into the
existing evolving Design, replay complete coverage, and promote it if no
obligation is missing. Do not ask me to repeat an integrated acceptance that
would add no new decision.
