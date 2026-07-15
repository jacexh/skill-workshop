package query

import "time"

type OrderSummary struct {
	ID          string
	DisplayName string
	PlacedAt    time.Time
}

type HistoryFilter struct {
	CustomerID string
}
