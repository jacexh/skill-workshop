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
and override only supported behaviors in concrete states.

```go
const (
	StateUnpaid fsm.StateLabel = "order.unpaid"
	StatePaid   fsm.StateLabel = "order.paid"
	ActionPay   fsm.Action     = "pay"
)

type orderState interface {
	fsm.State
	Pay(order *Order, amount int) error
	Cancel(order *Order) error
}

type baseOrderState struct{ *fsm.SimpleState }

func (s *baseOrderState) Pay(*Order, int) error {
	return fmt.Errorf("%s cannot pay", s.Label())
}

func (s *baseOrderState) Cancel(*Order) error {
	return fmt.Errorf("%s cannot cancel", s.Label())
}

type unpaidOrderState struct{ baseOrderState }

func newUnpaidOrderState() fsm.State {
	return &unpaidOrderState{baseOrderState{
		SimpleState: fsm.NewSimpleState(StateUnpaid),
	}}
}

func (s *unpaidOrderState) Pay(order *Order, amount int) error {
	if amount <= 0 {
		return ErrInvalidPaymentAmount
	}
	order.paidAmount = amount
	return nil
}
```

## Aggregate Shape

Public business methods call current-state behavior first and then a private
transition helper after that behavior succeeds.

```go
type Order struct {
	state      orderState
	paidAmount int
}

func NewOrder() *Order {
	return &Order{state: newUnpaidOrderState().(orderState)}
}

func (o *Order) CurrentState() fsm.State { return o.state }

func (o *Order) SetState(next fsm.State) error {
	state, ok := next.(orderState)
	if !ok {
		return ErrInvalidOrderState
	}
	o.state = state
	return nil
}

func (o *Order) transition(action fsm.Action) error {
	return fsm.Transit(o, orderMachine, action)
}

func (o *Order) Pay(amount int) error {
	if err := o.state.Pay(o, amount); err != nil {
		return err
	}
	return o.transition(ActionPay)
}
```

## Registration and Persistence

Build the machine once in Domain: call `RegisterStateBuilder` for every
referenced label, add transitions, and freeze it into a package-level variable
with `fsm.MustFreeze`, which runs `Check` and panics on a miswired machine at
startup.

```go
var orderMachine = fsm.MustFreeze(newOrderStateMachine())

func newOrderStateMachine() fsm.StateMachine {
	sm := fsm.NewStateMachine("order")
	sm.RegisterStateBuilder(StateUnpaid, newUnpaidOrderState)
	sm.RegisterStateBuilder(StatePaid, newPaidOrderState)
	sm.AddTransition(StateUnpaid, StatePaid, ActionPay, nil)
	return sm
}
```

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
