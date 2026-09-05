# Verification Hand-off

Use for executed work or a request to summarize verification. Scale the record
to the task; a short result is enough for one risk. Group commands that support
the same claim instead of repeating a fixed template per case.

## Evidence Record

Report the evidence that exists and the material gaps:

- Tests or checks: command or procedure, observed result, and claim supported.
- Unexecuted or skipped evidence: affected claim and remaining impact.
- Residual risk: what remains unproven within the requested scope.

Distinguish your own executions from user-supplied or previously recorded
results. Identify the tested revision or relevant state when available; disclose
uncertain provenance. Planned commands and skipped tests are not passing results.

Use the main skill's verification rule to decide whether a prior result remains
applicable. A design-only hand-off may report planned evidence; a static review
may assess adequacy without executing it. Label both accurately.

**Complete when:** the reader can tell what was observed, what was assessed or
planned, which claims it supports, and which material gaps remain. Optional
sections with no information can be omitted.

## Architecture Evidence

For architecture work, attach evidence to in-scope claims rather than marking
an entire design as proven. Distinguish measured behavior, static checks,
assumptions, and unverified claims. Thresholds or recovery policies that have not
been specified remain assumptions or open questions, not passing evidence.

Reuse the design's claim-to-case mapping if present; add actual outcomes to it
instead of producing another inventory.
