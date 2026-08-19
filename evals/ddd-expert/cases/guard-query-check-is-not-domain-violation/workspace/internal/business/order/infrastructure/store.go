package infrastructure

import (
	"context"
	"sort"
	"sync"

	"example.com/order-review/internal/business/order/application/query"
	"example.com/order-review/internal/business/order/domain"
)

type Store struct {
	mu     sync.RWMutex
	orders map[string]orderRecord
}

var _ domain.Repository = (*Store)(nil)
var _ query.Repository = (*Store)(nil)

func NewStore() *Store {
	return &Store{orders: make(map[string]orderRecord)}
}

func (s *Store) Get(ctx context.Context, id string) (*domain.Order, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	record, exists := s.orders[id]
	if !exists {
		return nil, domain.ErrOrderNotFound
	}
	return orderFromRecord(record)
}

func (s *Store) Save(ctx context.Context, order *domain.Order) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := order.Validate(); err != nil {
		return err
	}
	record := orderToRecord(order)

	s.mu.Lock()
	defer s.mu.Unlock()

	s.orders[record.id] = record
	return nil
}

func (s *Store) ListOrderHistory(
	ctx context.Context,
	filter query.HistoryFilter,
) ([]query.OrderSummary, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	s.mu.RLock()
	result := make([]query.OrderSummary, 0, len(s.orders))
	for _, record := range s.orders {
		if record.customerID == filter.CustomerID {
			result = append(result, orderSummaryFromRecord(record))
		}
	}
	s.mu.RUnlock()

	sort.Slice(result, func(left, right int) bool {
		if result[left].PlacedAt.Equal(result[right].PlacedAt) {
			return result[left].ID < result[right].ID
		}
		return result[left].PlacedAt.Before(result[right].PlacedAt)
	})
	return result, nil
}
