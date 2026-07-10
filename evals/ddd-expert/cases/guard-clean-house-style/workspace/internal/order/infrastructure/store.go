package infrastructure

import (
	"context"
	"sync"

	"example.com/order-review/internal/order/application"
	"example.com/order-review/internal/order/domain"
)

type Store struct {
	mu     sync.RWMutex
	orders map[string]orderRecord
}

type orderRecord struct {
	id          string
	customerID  string
	displayName string
	lines       []orderLineRecord
}

type orderLineRecord struct {
	productID string
	quantity  int
}

var _ domain.Repository = (*Store)(nil)
var _ application.QueryRepository = (*Store)(nil)

func NewStore() *Store {
	return &Store{orders: make(map[string]orderRecord)}
}

func (s *Store) Get(_ context.Context, id string) (*domain.Order, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	record, exists := s.orders[id]
	if !exists {
		return nil, domain.ErrOrderNotFound
	}
	lines := make([]domain.OrderLine, 0, len(record.lines))
	for _, line := range record.lines {
		lines = append(lines, domain.RehydrateOrderLine(line.productID, line.quantity))
	}
	return domain.RehydrateOrder(record.id, record.customerID, record.displayName, lines), nil
}

func (s *Store) Save(_ context.Context, order *domain.Order) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	lines := make([]orderLineRecord, 0, len(order.Lines()))
	for _, line := range order.Lines() {
		lines = append(lines, orderLineRecord{productID: line.ProductID(), quantity: line.Quantity()})
	}
	s.orders[order.ID()] = orderRecord{
		id: order.ID(), customerID: order.CustomerID(), displayName: order.DisplayName(), lines: lines,
	}
	return nil
}

func (s *Store) ListOrderHistory(_ context.Context, customerID string) ([]application.OrderSummary, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]application.OrderSummary, 0, len(s.orders))
	for _, order := range s.orders {
		if order.customerID == customerID {
			result = append(result, application.OrderSummary{ID: order.id, DisplayName: order.displayName})
		}
	}
	return result, nil
}
