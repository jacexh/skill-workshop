package infrastructure

import (
	"time"

	"example.com/order-review/internal/business/order/application/query"
	"example.com/order-review/internal/business/order/domain"
)

type orderRecord struct {
	id          string
	customerID  string
	displayName string
	placedAt    time.Time
	lines       []orderLineRecord
}

type orderLineRecord struct {
	productID string
	quantity  int
}

func orderToRecord(order *domain.Order) orderRecord {
	lines := make([]orderLineRecord, len(order.Lines))
	for index, line := range order.Lines {
		lines[index] = orderLineRecord{
			productID: line.ProductID,
			quantity:  line.Quantity,
		}
	}
	return orderRecord{
		id:          order.ID,
		customerID:  order.CustomerID,
		displayName: order.DisplayName,
		placedAt:    order.PlacedAt.UTC(),
		lines:       lines,
	}
}

func orderFromRecord(record orderRecord) (*domain.Order, error) {
	lines := make([]domain.OrderLine, len(record.lines))
	for index, line := range record.lines {
		lines[index] = domain.OrderLine{
			ProductID: line.productID,
			Quantity:  line.quantity,
		}
	}
	order := &domain.Order{
		ID:          record.id,
		CustomerID:  record.customerID,
		DisplayName: record.displayName,
		PlacedAt:    record.placedAt,
		Lines:       lines,
	}
	if err := order.Validate(); err != nil {
		return nil, err
	}
	return order, nil
}

func orderSummaryFromRecord(record orderRecord) query.OrderSummary {
	return query.OrderSummary{
		ID:          record.id,
		DisplayName: record.displayName,
		PlacedAt:    record.placedAt,
	}
}
