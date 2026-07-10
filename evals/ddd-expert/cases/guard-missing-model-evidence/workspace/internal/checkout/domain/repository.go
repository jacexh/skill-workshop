package domain

import "context"

type Order struct{ ID string }
type Payment struct{ ID string }

type CheckoutRepository interface {
	GetOrder(ctx context.Context, id string) (*Order, error)
	SaveOrderAndPayment(ctx context.Context, order *Order, payment *Payment) error
}
