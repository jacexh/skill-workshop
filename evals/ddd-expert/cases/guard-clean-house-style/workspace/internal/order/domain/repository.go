package domain

import (
	"context"
	"errors"
)

var ErrOrderNotFound = errors.New("order not found")

type OrderLine struct {
	productID string
	quantity  int
}

type Order struct {
	id          string
	customerID  string
	displayName string
	lines       []OrderLine
}

func RehydrateOrderLine(productID string, quantity int) OrderLine {
	return OrderLine{productID: productID, quantity: quantity}
}

func (line OrderLine) ProductID() string {
	return line.productID
}

func (line OrderLine) Quantity() int {
	return line.quantity
}

func RehydrateOrder(id, customerID, displayName string, lines []OrderLine) *Order {
	return &Order{id: id, customerID: customerID, displayName: displayName, lines: append([]OrderLine(nil), lines...)}
}

func (o *Order) ID() string {
	return o.id
}

func (o *Order) CustomerID() string {
	return o.customerID
}

func (o *Order) DisplayName() string {
	return o.displayName
}

func (o *Order) Lines() []OrderLine {
	return append([]OrderLine(nil), o.lines...)
}

type Repository interface {
	Get(ctx context.Context, id string) (*Order, error)
	Save(ctx context.Context, order *Order) error
}
