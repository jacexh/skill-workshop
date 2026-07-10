package application

import "context"

type OrderSummary struct {
	ID          string
	DisplayName string
}

type QueryRepository interface {
	ListOrderHistory(ctx context.Context, customerID string) ([]OrderSummary, error)
}
