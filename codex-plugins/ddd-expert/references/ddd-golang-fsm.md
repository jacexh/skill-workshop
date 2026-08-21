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
`fsm.StateContext`. Define the business behavior interface in Domain, embed
`*fsm.SimpleState` in a base state whose methods return Domain errors, and
override only supported behaviors in concrete states.

```go
const (
	StateUnpaid fsm.StateLabel = "order.unpaid"
	StatePaid   fsm.StateLabel = "order.paid"
	ActionPay   fsm.Action     = "pay"
)

type orderState interface {
	fsm.State
	Pay(amount int) error
	Cancel() error
}

type baseOrderState struct{ *fsm.SimpleState }

func (s *baseOrderState) Pay(int) error {
	return fmt.Errorf("%s cannot pay", s.Label())
}

type unpaidOrderState struct{ baseOrderState }

func newUnpaidOrderState() fsm.State {
	return &unpaidOrderState{baseOrderState{
		SimpleState: fsm.NewSimpleState(StateUnpaid),
	}}
}

func (s *unpaidOrderState) Pay(amount int) error {
	if amount <= 0 {
		return ErrInvalidPaymentAmount
	}
	order := s.Context().(*Order)
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
	initial := newUnpaidOrderState().(orderState)
	order := &Order{state: initial}
	initial.SetContext(order)
	return order
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
	return fsm.Transit(o, fsm.MustGetStateMachine("order"), action)
}

func (o *Order) Pay(amount int) error {
	if err := o.state.Pay(amount); err != nil {
		return err
	}
	return o.transition(ActionPay)
}
```

## Registration and Persistence

Call `RegisterStateBuilder` for every referenced label, add transitions, call
`Check`, then publish the checked machine through `RegisterStateMachine`. Runtime code
uses the frozen `RuntimeStateMachine` returned by `MustGetStateMachine`.

Concrete state behavior owns acceptance. `Condition` selects an edge after the
behavior succeeds. Candidates for one `from + action` are evaluated in add
order; the first match wins. `fsm.Transit` constructs the selected target, sets
its Aggregate context, then delegates state assignment to `SetState`.

Application calls Domain methods such as `Pay` and `Cancel`. Infrastructure
persists the state label and reconstitutes the matching concrete state with its
Aggregate context; transition definitions remain code.

## Verification

Test the real registered machine through Aggregate methods. Cover builder and
machine checks, supported behaviors, Domain rejections, condition order, state
preservation without a matching edge, state-change event recording when
accepted, and reconstitution from the persisted label.
