# EventStorming Worked Example

One discovery pass on a small clinic story, shown at the three points where the
shape matters: the board, a probe turn, and the integrated proposal. The
conversation may use the user's language; artifacts follow their templates.

## Story

> Patients request appointments online. A receptionist confirms a patient into
> a doctor's slot. Patients check in at the desk, the doctor completes the
> visit, and the billing clerk issues an invoice for the visit.

## Board after steps 1-7

```text
Scope: booking through invoicing for one clinic; excludes insurance claims.

Lane        Timeline (pivotal events marked *)
Patient     Appointment Requested ──────────────────── Patient Checked In
Reception                       Slot Confirmed*
Doctor                                                          Visit Completed*
Billing                                                                          Invoice Issued

Commands   Request Appointment -> Confirm Slot -> Check In -> Complete Visit -> Issue Invoice
Rules      R1 a slot holds one confirmed appointment (evidence: reception SOP §3)
           R2 an invoice needs a completed visit (evidence: billing code)
Hotspots   H1 can a patient cancel after check-in? (unanswered)
Candidates Aggregates: Appointment, Slot, Visit, Invoice
           Contexts: Scheduling (Request..Check In), Care (Visit), Billing (Invoice)
```

Slot Confirmed and Visit Completed are pivotal: responsibility passes from
reception to the doctor, then from the doctor to billing. The segments are
the first context candidates.

## Probe turn (step 8)

Candidate: Appointment as one Root, Slot as another. Concurrent-change probe,
answered from evidence first:

> ❓ **Question** Two receptionists confirm two patients into the same 09:00
> slot at the same moment. Must one confirmation fail, or may both succeed and
> be corrected afterwards?
>
> 💡 **Recommendation** **Slot occupancy and confirmation sit in one
> Aggregate rooted at the doctor's Schedule.** The reception SOP rejects a
> second confirmation at the desk (R1), so the rule is enforced at command
> time. The alternative keeps Appointment and Slot as separate Roots and
> corrects double booking afterwards; it only holds if the clinic tolerates a
> temporary double booking.

User: "It must fail immediately; a double booking is never shown to a patient."

> 🔄 **Change** Appointment + Slot as separate Roots → `Schedule` Root owning
> its Slots; a confirmed Appointment is an owned fact of a Slot. Deletion probe:
> merging Slot into Schedule leaves no decision unclear, so Slot stays an owned
> concept rather than a Root.

## Probe turn (step 9)

Same-word probe on "appointment" between reception and billing, answered from
the billing code: billing works on a completed visit with service codes, never
on a slot. Different meaning, so Scheduling and Billing stay separate, and the
lifecycle-end probe places Visit Completed as the crossing point.

## Integrated proposal

- **Scope**: booking through invoicing; insurance claims excluded.
- **Bounded Contexts**: Scheduling (owns slots and confirmations; same-word
  probe separates it from Billing), Billing (owns invoices; veto probe: only
  billing may void an invoice). Care folded into Scheduling: no probe separated
  it, the doctor only records completion.
- **Aggregate Roots**: `Schedule` — a doctor's day of slots; consistency:
  one confirmed appointment per slot at confirmation time. `Invoice` —
  a billable completed visit; consistency: one invoice per completed visit.
- **Business Rules**: Single occupancy; Invoice requires completed visit.
- **Dependency**: Scheduling -> Billing, Published Fact Contract
  `VisitCompleted`, used to open a billable visit.
- **Non-blocking uncertainty**: H1 cancellation after check-in.

After confirmation, the Context Map and the two Model files are written from
their templates. A Business Rule then reads, for example:

- **Single occupancy:** A Schedule Slot admits one confirmed Appointment; a
  second confirmation into an occupied Slot is rejected at confirmation time.
