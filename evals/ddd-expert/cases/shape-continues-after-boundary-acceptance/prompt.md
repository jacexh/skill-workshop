The accepted Reservation Model is complete. In the previous Shape turn I
explicitly accepted only this tactical decision: one `Reservation` Aggregate
Root owns `Reservation Item` as a Value Object made from resource identity and
positive quantity; it has no independent identity, is valid only within the
accepted capacity, and equality is by those Domain values. That acceptance did
not cover the lifecycle representation or any later event, collaboration,
persistence, or verification choice.

Continue Shape from that accepted boundary decision. Keep project files
unchanged while the next tactical choice is open.
