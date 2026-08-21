---
name: ddd-python-fsm
description: Python House Style for an accepted python-statemachine Domain lifecycle.
---

# Python Domain FSM

## Applies When

Load this leaf only when Tactical Design or project authority already selected
an FSM for a Python Domain lifecycle.

## Canonical Shape

Use synchronous `python-statemachine` 3.2 inside Domain. The Aggregate owns the
state field, guards, and public business methods. Outer layers call methods such
as `pay()` or `cancel()` and do not call the library dispatcher directly.

- Set `allow_event_without_transition = False`.
- Set `catch_errors_as_events = False`.
- For enum-backed state, use `States.from_enum(..., use_enum_instance=True)`.
- Construct the external-model API as
  `OrderLifecycle(model=order, state_field="_status")` inside the Aggregate
  business method.
- Translate `TransitionNotAllowed` into a stable Domain error at that boundary.
- Persist the accepted business state value, not an opaque machine snapshot.
- Keep callbacks synchronous and I/O-free.

```python
from enum import Enum

from statemachine import StateChart
from statemachine.exceptions import TransitionNotAllowed
from statemachine.states import States


class OrderStatus(Enum):
    UNPAID = "unpaid"
    PAID = "paid"


class OrderLifecycle(StateChart):
    allow_event_without_transition = False
    catch_errors_as_events = False

    states = States.from_enum(
        OrderStatus,
        initial=OrderStatus.UNPAID,
        use_enum_instance=True,
    )
    pay = states.UNPAID.to(states.PAID)


class Order:
    def __init__(self, status: OrderStatus) -> None:
        self._status = status
        self._paid_amount = 0

    def pay(self, amount: int) -> None:
        if amount <= 0:
            raise InvalidPaymentAmountError()
        lifecycle = OrderLifecycle(model=self, state_field="_status")
        try:
            lifecycle.send("pay")
        except TransitionNotAllowed as error:
            raise InvalidOrderTransitionError() from error
        self._paid_amount = amount
```

## Verification

Test the real machine through Aggregate business methods. Cover accepted edges,
guards, rejected actions, state preservation on rejection, reconstitution, and
the persisted state representation.
