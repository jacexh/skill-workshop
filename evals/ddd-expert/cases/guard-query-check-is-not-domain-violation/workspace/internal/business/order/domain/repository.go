package domain

import (
	"context"
	"errors"
)

var ErrOrderNotFound = errors.New("order not found")

type Repository interface {
	Get(context.Context, string) (*Order, error)
	Save(context.Context, *Order) error
}
