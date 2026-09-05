# DDD Expert forward trials

These manual trials exercise skill execution. Release checks separately cover
packaging, resource reachability, mirrored content, and template/validator
compatibility. Neither keyword assertions nor one successful model run prove
reliable behavior across all requests.

## Method

Give each evaluator a fresh agent context, the named skill path, the user request,
and only the raw project fixtures needed by that request. Keep this document,
expected outcomes, prior conclusions, and other trial outputs out of its input.
Use an isolated temporary project; allow only local file changes and loopback
HTTP where needed. The coordinator inspects produced artifacts and actual
commands, independently of the evaluator's completion claim.

## Cases

| Case | User request and raw fixture | Observable outcome |
|---|---|---|
| Confirmed strategy | Empty project. The user confirms Catalog/Book and Sales/Order, their consistency boundaries, Sales requiring Catalog's synchronous Book Availability Query, and totals equal to confirmed order-line amounts. Payment, reservation, fulfillment, and refunds are excluded. Ask to record only this integrated strategic model. | Exactly Context Map and two Models; no renewed approval or tactical work; Context Map validator succeeds and Model links resolve. |
| Confirmed object without events | Identity Model with DisplayProfile; existing domain-object file has an unrelated SavedSearch Root. User confirms ProfileID, plain-string DisplayName, Rename trimming and rejecting blank names while preserving the old name; no children, lifecycle, external authority, Value Object, or event. Ask to record only this Root. | Reads object template despite no event; records the complete behavior; preserves SavedSearch; no invented optional sections or renewed confirmation. |
| Outbound adapter on existing stack | README accepts Python >=3.11, urllib, unittest, flat modules. Admission.permits calls BookSaleabilityPort.is_sellable. HTTP adapter reads obsolete available key, while provider now returns available_for_sale. Existing tests use a real local HTTP server with true, false, and malformed non-boolean responses. Ask Codify to fix the adapter and verify. | Narrow adapter fix, existing stack and model preserved; three HTTP-boundary tests pass; no unrelated database verification or dependency installation. |
| Unresolved business authority | Empty project. Group registration has ten places and multi-person orders. User explicitly has not decided whether a place is consumed per order or per person; technical choices are delegated. Ask for EventStorming and documents. | One material business question with a recommendation and alternative; no invented capacity rule or unconfirmed artifact write. |
| Independent review | Fresh reviewer gets the adapter project's resulting files, the complete one-line diff, and actual 3-tests-OK output. Ask Guard for structural review only. | Reviews model and adapter boundary; reuses supplied evidence; no installation, repeated tests, nested reviewer, or project mutation. |

## Observed on 2026-09-05

The pre-change confirmed-strategy trial wrote documents but never read the
templates or ran the validator. The coordinator's actual validator invocation
exited 1: `invalid Context Map: expected exactly one # Context Map heading and no preamble`.
This established an execution-path failure, not a failure of the business model.

After the change, five independent trials reached the expected outcomes:

- Strategy read the workflow contract, artifact layout, and strategic templates;
  the validator returned `valid Context Map: 2 contexts, 1 dependencies`, exit 0.
  Both Model links resolved; no repeated confirmation or implementation followed.
- Tactical Design read the object template, added the accepted DisplayProfile,
  and preserved SavedSearch. The unchanged Context Map was not revalidated.
- Codify changed only the JSON key in the adapter. The existing command
  `python3 -m unittest discover -s tests -v` changed from three KeyError failures
  to three passes through the local HTTP boundary. No dependency installation,
  database checks, or model edits occurred.
- Unresolved strategy asked whether capacity measures people or orders and
  explained the governing clause. Its project directory remained empty.
- Guard read applicable guidance and evidence and reported
  `No DDD structural findings`. It did not execute tests or change the project.

The full `bash scripts/release/test/run-tests.sh` suite passed all 12 scripts.
Both tracks' eight skill frontmatters passed `quick_validate.py`; mirror and
resource-discovery checks and `git diff --check` passed.

These trials are bounded samples in the current agent harness, not a statistical
benchmark or cross-model certification. They do not validate every House Style
code example, real external providers, or performance improvements. The adapter
trial's fixture tests demonstrate that execution path only; they are not an
additional plugin CI suite. Repeat relevant trials after changes to routing,
confirmation, project precedence, or verification instructions.
