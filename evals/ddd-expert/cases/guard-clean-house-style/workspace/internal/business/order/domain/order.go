package domain

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
)

var (
	domainValidator = validator.New()
	ErrInvalidOrder = errors.New("invalid order")
)

type OrderLine struct {
	ProductID string `validate:"required"`
	Quantity  int    `validate:"gte=1"`
}

type Order struct {
	ID          string      `validate:"required"`
	CustomerID  string      `validate:"required"`
	DisplayName string      `validate:"required"`
	PlacedAt    time.Time   `validate:"required"`
	Lines       []OrderLine `validate:"required,min=1,dive"`
}

func NewOrder(
	id string,
	customerID string,
	displayName string,
	placedAt time.Time,
	lines []OrderLine,
) (*Order, error) {
	order := &Order{
		ID:          strings.TrimSpace(id),
		CustomerID:  strings.TrimSpace(customerID),
		DisplayName: strings.TrimSpace(displayName),
		PlacedAt:    placedAt,
		Lines:       cloneOrderLines(lines),
	}
	if err := order.Validate(); err != nil {
		return nil, err
	}
	return order, nil
}

func (o *Order) Validate() error {
	if o == nil {
		return ErrInvalidOrder
	}
	if err := domainValidator.Struct(o); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidOrder, err)
	}
	return nil
}

func cloneOrderLines(lines []OrderLine) []OrderLine {
	return append([]OrderLine(nil), lines...)
}
