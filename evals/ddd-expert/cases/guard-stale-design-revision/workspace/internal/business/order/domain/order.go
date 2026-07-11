package domain

import "errors"

var ErrCannotCancel = errors.New("order cannot be cancelled")

type Status string

const (
	StatusAccepted  Status = "accepted"
	StatusFulfilled Status = "fulfilled"
	StatusCancelled Status = "cancelled"
)

type Order struct {
	id     string
	status Status
}

func NewOrder(id string) *Order {
	return &Order{id: id, status: StatusAccepted}
}

func (o *Order) Status() Status {
	return o.status
}

func (o *Order) Cancel() error {
	if o.status != StatusAccepted {
		return ErrCannotCancel
	}
	o.status = StatusCancelled
	return nil
}

func (o *Order) Fulfill() {
	o.status = StatusFulfilled
}
