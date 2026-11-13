# Tactical Design Worked Example

One refinement pass on the `Schedule` Root from the EventStorming example,
shown at the four points where the shape matters: the pressure list, a probe
turn, the comparison table, and a confirmed description. The conversation may
use the user's language; artifacts follow their templates.

## Input

From `model.md`:

- **Schedule** — a doctor's day of slots; consistency: one confirmed
  appointment per slot at confirmation time.
- Under `### Schedule`, **Single occupancy:** If a Slot already holds a
  confirmed Appointment, then the Schedule rejects another confirmation into
  that Slot.

Open decision handed on by EventStorming: a receptionist cancels an
Appointment only before its Slot starts (reception SOP §4); default: rejected
after the start.

## Pressure list

```text
P1 Reject a second confirmation into an occupied Slot at command time (Single occupancy)
P2 Allow cancellation only before the Slot's start time; needs the current time (open decision)
P3 Slot occupancy moves Free -> Confirmed -> Free or Completed (Single occupancy, open decision)
P4 Record the completed visit that Billing relies on (Context Map: VisitCompleted)
```

## Probe turn

Candidate Behavior: `Schedule confirms Appointment into Slot`. Knowledge probe
answered from the reception SOP: the decision needs the Slot's occupancy and
nothing else on the Schedule.

> ❓ **Question** When a receptionist cancels, is "before the start time"
> judged against the clock at the moment of cancellation, or can a cancellation
> be back-dated by a supervisor?
>
> 💡 **Recommendation** **Judge against the moment of cancellation and let the
> caller supply the current time as a Supplied Fact.** The SOP names no
> supervisor authority, so the Behavior keeps its decision with a value the
> caller already has. The alternative, a `ClockPort` the Behavior consults,
> only earns its place if the Behavior itself must decide when to read the time.

User: "At the moment of cancellation. No back-dating."

> 🔄 **Change** External authority for P2 → Supplied Fact `now`; no Port.

## Comparison table

Deletion probe: merging Slot into Schedule leaves "which Slot's occupancy
changed" as a Schedule-level bookkeeping decision, so Slot as an Entity is the
strongest alternative to compare.

```text
| Pressure | No split (Schedule owns occupancy per time) | Slot as Entity |
|---|---|---|
| P1 | Schedule rejects second confirmation for time | Slot rejects second confirmation; Schedule confirms Appointment by composing Slot.Confirm Appointment |
| P2 | Schedule releases Appointment for time when now < start | Slot releases Appointment when now < start |
| P3 | Schedule keeps occupancy map keyed by time | Slot.State Free -> Confirmed -> Free / Completed |
| Burden | occupancy map exposes every slot's state to each decision; one lifecycle for all slots | one more identity (time); decisions local to the Slot; Root composes two Behaviors |
```

Slot as Entity localizes P1 to P3 with the state each needs and the Root still
protects the day-level invariant, so it is recommended.

## Confirmed Entity description

Written under a `## Schedule` heading that holds only the Root's accepted
Definition until the Root is confirmed.

```markdown
### Slot — Entity (`SlotTime`, unique per Schedule)

- **Definition:** One bookable time in a doctor's day that admits at most one confirmed Appointment.
- **Facts:**
  - `StartTime` — when the Slot begins; bounds cancellation.
  - `ConfirmedAppointment` — the Appointment identity occupying the Slot, when any.
- **Lifecycle State:**
  - `Free` — no confirmed Appointment.
  - `Confirmed` — one Appointment occupies the Slot.
  - `Completed` — the visit took place; terminal.
- **Behavior:**
  - `Confirm Appointment` — Slot admits an Appointment, transitioning Slot.State from Free to Confirmed.
    - If the Slot already holds a confirmed Appointment, then Slot rejects the confirmation.
  - `Release Appointment` — Slot frees its Appointment, using supplied `now` from the clinic clock, transitioning Slot.State from Confirmed to Free.
    - If `now` is at or after `StartTime`, then Slot rejects the release.
  - `Complete Visit` — Slot records the completed visit, transitioning Slot.State from Confirmed to Completed.
- **Domain Events:**
  - `VisitCompleted` — recorded by `Complete Visit`; published as `VisitCompleted`.
```

The Root entry then reads `Confirm Appointment — Schedule confirms an
Appointment into a Slot by composing Slot.Confirm Appointment.`

Each rule now lives with its owner. `Single occupancy` is the clause of
`Confirm Appointment`, the one Behavior that owns it, and the cancellation
limit that the user confirmed is the clause of `Release Appointment`. At Root
confirmation, `Single occupancy` leaves `model.md` and its `### Schedule`
group is removed; the Root's consistency boundary still states the strategic
fact.
