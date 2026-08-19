package query

import "context"

type Repository interface {
	ListOrderHistory(context.Context, HistoryFilter) ([]OrderSummary, error)
}
