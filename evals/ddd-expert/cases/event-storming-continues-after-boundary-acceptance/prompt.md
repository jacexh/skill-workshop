In the previous EventStorming turn I explicitly accepted only this tactical
decision: one `Reservation` Aggregate Root owns `Reservation Item` as a Value
Object made from resource identity and positive quantity; it has no independent
identity, is valid only within accepted capacity, and equality is by those
Domain values. Apply that accepted boundary slice before continuing.

The Reservation Model is still evolving for one reason. The accepted scenario
reaches a time-limited `Reservation Held`, but the business evidence does not
yet say who or what reacts when its hold deadline passes, which business fact
that action establishes, or how that outcome changes available capacity and the
customer's right to confirm. This is the only open Scenario Thread edge in the
current scope.

Continue $ddd-expert:event-storming by asking the Domain owner about that
business edge. Leave its answer unapplied. Do not ask the owner to choose how a
lifecycle should be represented.
