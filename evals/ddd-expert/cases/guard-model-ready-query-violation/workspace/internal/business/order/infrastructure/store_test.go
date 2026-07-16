package infrastructure_test

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"example.com/order-review/internal/business/order/application/query"
	"example.com/order-review/internal/business/order/domain"
	"example.com/order-review/internal/business/order/infrastructure"
)

func TestStoreRoundTripPreservesOwnedLines(t *testing.T) {
	store := infrastructure.NewStore()
	placedAt := time.Date(2500, time.July, 9, 15, 30, 0, 0, time.FixedZone("UTC+8", 8*60*60))
	inputLines := []domain.OrderLine{
		{ProductID: "product-a", Quantity: 2},
		{ProductID: "product-b", Quantity: 1},
	}
	order := mustOrder(t, "order-1", "customer-1", "First order", placedAt, inputLines)
	inputLines[0].Quantity = 99

	if err := store.Save(context.Background(), order); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	got, err := store.Get(context.Background(), order.ID)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	wantLines := []domain.OrderLine{
		{ProductID: "product-a", Quantity: 2},
		{ProductID: "product-b", Quantity: 1},
	}
	if !reflect.DeepEqual(got.Lines, wantLines) {
		t.Fatalf("Get().Lines = %#v, want %#v", got.Lines, wantLines)
	}
	if got.ID != "order-1" || got.CustomerID != "customer-1" || got.DisplayName != "First order" {
		t.Fatalf("Get() root fields = %#v, want saved root fields", got)
	}
	if !got.PlacedAt.Equal(placedAt) {
		t.Fatalf("Get().PlacedAt = %v, want %v", got.PlacedAt, placedAt)
	}
}

func TestStoreOrderHistoryFiltersAndOrdersDeterministically(t *testing.T) {
	store := infrastructure.NewStore()
	older := time.Date(2026, time.July, 8, 12, 0, 0, 0, time.UTC)
	newer := older.Add(24 * time.Hour)
	orders := []*domain.Order{
		mustOrder(t, "order-b", "customer-1", "Tie B", newer, oneLine()),
		mustOrder(t, "order-other", "customer-2", "Other customer", newer.Add(time.Hour), oneLine()),
		mustOrder(t, "order-old", "customer-1", "Older", older, oneLine()),
		mustOrder(t, "order-a", "customer-1", "Tie A", newer, oneLine()),
	}
	for _, order := range orders {
		if err := store.Save(context.Background(), order); err != nil {
			t.Fatalf("Save(%q) error = %v", order.ID, err)
		}
	}

	got, err := store.ListOrderHistory(
		context.Background(),
		query.HistoryFilter{CustomerID: "customer-1"},
	)
	if err != nil {
		t.Fatalf("ListOrderHistory() error = %v", err)
	}
	wantIDs := []string{"order-a", "order-b", "order-old"}
	gotIDs := make([]string, len(got))
	for index, summary := range got {
		gotIDs[index] = summary.ID
	}
	if !reflect.DeepEqual(gotIDs, wantIDs) {
		t.Fatalf("ListOrderHistory() IDs = %v, want %v", gotIDs, wantIDs)
	}
}

func TestStoreGetReturnsStableNotFoundError(t *testing.T) {
	store := infrastructure.NewStore()

	_, err := store.Get(context.Background(), "missing")
	if !errors.Is(err, domain.ErrOrderNotFound) {
		t.Fatalf("Get() error = %v, want ErrOrderNotFound", err)
	}
}

func mustOrder(
	t *testing.T,
	id string,
	customerID string,
	displayName string,
	placedAt time.Time,
	lines []domain.OrderLine,
) *domain.Order {
	t.Helper()
	order, err := domain.NewOrder(id, customerID, displayName, placedAt, lines)
	if err != nil {
		t.Fatalf("NewOrder() error = %v", err)
	}
	return order
}

func oneLine() []domain.OrderLine {
	return []domain.OrderLine{{ProductID: "product-a", Quantity: 1}}
}
