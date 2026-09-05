# Architecture Test Design

Use when deriving test claims from an architecture proposal, ADR, sequence
diagram, or message flow. Preserve the task mode: a document can support design,
implementation, or review without making all three necessary.

## Extract the Relevant Claims

Start with the requested goals and affected contracts. Follow only the owners,
interactions, and dependencies needed to understand those claims. A complete
architecture document provides context; it does not expand a local test request.

For the relevant flow, identify:

- ownership: authoritative state writer, allowed transitions, and decision owner
- contracts: APIs, messages, schemas, and callbacks crossing the boundary
- failure behavior: commit, retry, timeout, compensation, and recovery guarantees
- qualities: specified consistency, durability, latency, or other measurable goals

Feed these claims into the main skill's Intent and Risk, then Evidence. Missing
ownership, ordering, retry, or quality policy is an unresolved expectation;
implementation evidence alone cannot establish the intended policy.

**Complete when:** each in-scope design goal has a testable claim or an explicit
assumption, and the components carrying its risk are identified or still unknown.

## From Flows to Cases

For a sequence-dependent claim, identify the initial state, meaningful phases,
durable or externally visible changes, and observation points. Read the State
Histories and Concurrency and Failure and Recovery sections of
[case-design.md](case-design.md) to derive histories and fault positions.

For ownership claims, select the relevant counterexamples: a non-owner mutation,
an older generation overwriting newer state, or a projection becoming an
accidental writer. Derive permitted outcomes from the design; locks, leases, or
particular recovery mechanisms are not requirements unless the contract uses them.

Use a matrix when several claims or phases need tracing. Example rows below
illustrate different claims, not mandatory cases for every architecture:

| Claim | History or fault | Expected observation | Candidate evidence |
| --- | --- | --- | --- |
| job and outbox persist atomically | failure after job write, before outbox write | fresh observer finds neither committed | repository integration |
| retry does not repeat a business effect | remote acceptance, lost acknowledgement, redelivery | same final business state without duplicate effect | producer/consumer integration |
| stale callbacks cannot undo success | success followed by older failure callback | success remains authoritative | handler or state-transition test |

Return candidates to the main skill for oracle, boundary, control, and suite
selection. Several phases may share one proof; an arrow alone does not require
a separate case. Use integration fidelity only for the boundaries selected.

## Quality Thresholds

A quality claim needs a measurable target and conditions under which it applies:

- latency or convergence: percentile or deadline, workload, and observation point
- capacity: request or message rate, data distribution, concurrency, and saturation
- recovery: failure model, allowable loss, replay bounds, or recovery time
- compatibility: supported API, message, schema, or historical-data versions
- observability: failure signal and the diagnostic information it must expose

Use the supplied targets. If none exists, report that gap; a fast sample or vague
property is not proof of an unspecified SLO. Designing a load or recovery exercise
does not require executing it as part of a design-only request.

## Coverage and Delivery

Extend the main skill's claim-to-case mapping with a phase or quality threshold
only where useful. Include existing evidence and material gaps for the requested
goals; reuse this mapping for the eventual verification hand-off.

**Complete when:** the relevant goals, histories, ownership rules, and specified
thresholds have selected evidence or explicit gaps, and proposed evidence is
clearly distinguished from observed results.
