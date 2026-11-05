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

Build the machine once in Domain and freeze it with `fsm.MustFreeze` into a
package-level variable.

Concrete state behavior owns acceptance; a `Condition` only selects among the
edges of one `from + action`. Add guarded edges before an unguarded one.
Register an explicit self-transition when staying in the current state is
accepted behavior. A business method that
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
