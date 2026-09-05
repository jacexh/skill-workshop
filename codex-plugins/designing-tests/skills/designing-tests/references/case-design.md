# Deriving Test Cases

Use the sections whose conditions occur in the target behavior. These methods
produce candidate cases for the main skill's Oracle, Seam, Control, Proof, and
suite selection; they are not mandatory test categories.

## Data Partitions and Boundaries

When values change the outcome, group inputs by the rule they exercise. Choose a
representative from each meaningful valid and invalid partition, then examine
boundaries using the domain's actual precision: just below, at, and just above a
limit. Empty, absent, null, malformed, and unknown values are separate only where
the contract distinguishes them.

Include relationships between fields or records, not just individual values:
start before end, owner matching tenant, or total matching line items. Derive
historical and current data shapes when compatibility is in scope. Use fixtures
that expose the distinction, such as different owners or unequal amounts, rather
than uniform defaults that let swapped fields or missing filters pass.

## Interacting Rules

When multiple conditions determine an outcome, make a compact decision table:
conditions, feasible combinations, expected result, and precedence. Include
contrasting cases where changing one decisive condition changes the result.
Identify exclusions and dependencies before sampling combinations.

For example, suppose a coupon requires membership and a pre-discount subtotal
of at least 100. These obligations lead to different witnesses:

| Obligation | Candidate input | Expected outcome |
| --- | --- | --- |
| threshold is inclusive | member, subtotal 100 | coupon accepted |
| lower boundary is rejected | member, subtotal 99 | coupon rejected |
| membership is required | nonmember, subtotal 100 | coupon rejected |
| eligibility uses pre-discount amount | member, subtotal 110, discount 20 | coupon accepted even though final total is 90 |

The amounts assume whole-unit precision for this example. A currency contract
with fractional units changes the adjacent boundary value. If several rules
fail, assert error precedence only when the contract defines it.

Use constrained pairwise sampling for many independent configuration dimensions
when pair interactions are the relevant risk. Keep explicit higher-order cases
for known business interactions; pairwise coverage does not justify omitting them.

## State Histories and Concurrency

For lifecycle behavior, identify relevant states, events, guards, and permitted
or rejected transitions. Include prior history when identical inputs behave
differently after earlier events. Record invariants during the sequence as well
as its terminal outcome.

For async or concurrent behavior, choose orderings that can change the result:
for example, commit followed by a lost reply and client retry, or success followed
by an older callback. Use barriers or controlled delivery to reproduce those
orderings instead of relying on sleeps or repeated lucky runs. Specify allowed
outcomes for concurrent operations from the contract, not the scheduler.

Distinguish safety (something must never happen, such as duplicate durable work)
from progress (something must eventually happen within a specified bound).
An eventual success assertion alone may miss a forbidden intermediate effect.
When ordering, retry identity, or convergence bounds are undefined, mark those
expectations unresolved and design the independently specified cases.

## Failure and Recovery

For a multi-step side effect, identify the durable or external boundaries where
failure leaves meaningfully different state. Choose reachable fault points on
those boundaries rather than failing every line or every mock call.

For each selected fault, specify:

`prior state -> fault point -> observable residue -> recovery action -> final invariants`

Consider failure before a durable change, after it but before the next effect,
and after remote acceptance but before acknowledgement where these occur in the
real flow. Inject faults without replacing the transaction, transport, or storage
behavior being claimed. Observe committed state from outside the failed unit of
work and verify both required effects and absence of forbidden duplicates.

For example, a publish acknowledgement lost after acceptance requires recovery
under uncertain delivery; it is not the same case as a rejected publish. Derive
whether retry, deduplication, compensation, or manual recovery is correct from
the contract. Assert the recovered result and surviving residue, not only the
initial exception. Defer recovery cases whose policy is unspecified with a clear
question or assumption rather than choosing a new product policy.

## Turning Candidates into a Suite

Return candidates to the main skill's suite selection. Trace each to a rule,
interaction, history, or recovery obligation; retain representatives that catch
different plausible defects. A boundary case can also serve as the success case.
Record coverage gaps for the requested behavior, without expanding the scope to
every condition mentioned in an input document.
