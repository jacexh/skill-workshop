---
name: ddd-golang-fsm
description: Go House Style for an accepted components/fsm Domain lifecycle.
---

# Go Domain FSM

## Applies When

Load this leaf only when Tactical Design or project authority already selected
`github.com/go-jimu/components/fsm` for a Go Domain lifecycle.

## State Shape

The Aggregate owns its current concrete state and implements
`fsm.StateContext`. Define the business behavior interface in Domain; its
methods take the Aggregate as a parameter, so states hold only their label.
Embed `*fsm.SimpleState` in a base state whose methods return Domain errors,
and override only supported behaviors in concrete states. Name labels
`<aggregate>.<state>`, such as `order.unpaid`.

## Aggregate Shape

Public business methods call current-state behavior first and then a private
transition helper that calls `fsm.Transit` after that behavior succeeds.
`SetState` accepts only the Domain state interface and returns a Domain error
for any other state.

## Registration and Persistence

Build the machine once in Domain: call `RegisterStateBuilder` for every
referenced label, add transitions, and freeze it into a package-level variable
with `fsm.MustFreeze`, which runs `Check` and panics on a miswired machine at
startup.

Concrete state behavior owns acceptance. `Condition` selects an edge after the
behavior succeeds. Candidates for one `from + action` are evaluated in add
order; the first match wins, so guarded edges come before an unguarded one.
`fsm.Transit` builds the selected target and delegates state assignment to
`SetState`. When edges exist but no condition matches, it returns a
`*fsm.TransitionError` with `Guarded` set; register an explicit self-transition
when staying in the current state is accepted behavior. A business method that
returns an error, from the behavior or from `Transit`, leaves an Aggregate the
caller discards.

Application calls Domain methods such as `Pay` and `Cancel`. Infrastructure
persists the state label and reconstitutes the matching concrete state with
`orderMachine.BuildState(label)` exposed through a Domain reconstitution
function; transition definitions remain code.

## Verification

Test the real frozen machine through Aggregate methods. Cover builder and
machine checks, supported behaviors, Domain rejections, condition order, the
guarded `TransitionError` when no condition matches, accepted self-transitions,
state-change event recording when accepted, and reconstitution from the
persisted label.
