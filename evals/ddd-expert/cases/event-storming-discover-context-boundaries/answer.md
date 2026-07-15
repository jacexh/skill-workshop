For this Scenario Thread, the business calls the four independent decision
responsibilities Program, Registration, Delivery, and Facilitator Pay.

When the program planner establishes `Workshop Cancelled`, Program owns that
fact and publishes it through the named `Workshop Cancellation Facts` contract.
Registration reacts by establishing `Seat Released` for every committed
seat on that workshop and stops promoting waitlisted attendees; Registration
alone owns those seat decisions. Delivery admits nobody and records no new
attendance or no-show after cancellation, but previously accepted attendance
or no-show evidence remains unchanged; Delivery alone owns that evidence.
Facilitator Pay establishes `Earning Revoked` for an earning granted solely for
the undelivered workshop, but an earning already supported by accepted delivery
evidence remains payable; Facilitator Pay alone owns the earning decision.

Each responsibility reacts to `Workshop Cancelled` in its own language. None
may erase or rewrite a fact owned by another responsibility.
