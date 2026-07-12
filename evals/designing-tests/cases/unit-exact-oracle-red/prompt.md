Design the unit-test change for the supplied TypeScript module. Do not repair
the production implementation.

Contract: `payable(totalCents, activeMember)` applies a 10% discount to an active
member when `totalCents >= 10_000`, capped at 3,000 cents. Currency remains in
integer cents. Review the existing test and propose the smallest
regression-protective suite.
