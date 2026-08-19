package domain

import (
	"errors"
	"testing"
	"time"
)

func TestNewOrderCopiesOwnedLines(t *testing.T) {
	lines := []OrderLine{{ProductID: "product-1", Quantity: 2}}

	order, err := NewOrder("order-1", "customer-1", "First", time.Now(), lines)
	if err != nil {
		t.Fatalf("NewOrder() error = %v", err)
	}
	lines[0].Quantity = 99
	if order.Lines[0].Quantity != 2 {
		t.Fatalf("Order quantity = %d, want 2", order.Lines[0].Quantity)
	}
}

func TestNewOrderRejectsInvalidState(t *testing.T) {
	placedAt := time.Now()
	validLine := []OrderLine{{ProductID: "product-1", Quantity: 1}}
	tests := []struct {
		name        string
		id          string
		customerID  string
		displayName string
		placedAt    time.Time
		lines       []OrderLine
	}{
		{name: "missing id", customerID: "customer-1", displayName: "Order", placedAt: placedAt, lines: validLine},
		{name: "missing customer", id: "order-1", displayName: "Order", placedAt: placedAt, lines: validLine},
		{name: "missing display name", id: "order-1", customerID: "customer-1", placedAt: placedAt, lines: validLine},
		{name: "missing placement time", id: "order-1", customerID: "customer-1", displayName: "Order", lines: validLine},
		{name: "missing lines", id: "order-1", customerID: "customer-1", displayName: "Order", placedAt: placedAt},
		{name: "missing product", id: "order-1", customerID: "customer-1", displayName: "Order", placedAt: placedAt, lines: []OrderLine{{Quantity: 1}}},
		{name: "non-positive quantity", id: "order-1", customerID: "customer-1", displayName: "Order", placedAt: placedAt, lines: []OrderLine{{ProductID: "product-1"}}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewOrder(tt.id, tt.customerID, tt.displayName, tt.placedAt, tt.lines)
			if !errors.Is(err, ErrInvalidOrder) {
				t.Fatalf("NewOrder() error = %v, want ErrInvalidOrder", err)
			}
		})
	}
}
