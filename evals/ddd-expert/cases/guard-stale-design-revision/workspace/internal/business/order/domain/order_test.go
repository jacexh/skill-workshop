package domain

import (
	"errors"
	"testing"
)

func TestFulfilledOrderCannotBeCancelled(t *testing.T) {
	order := NewOrder("order-1")
	order.Fulfill()

	if err := order.Cancel(); !errors.Is(err, ErrCannotCancel) {
		t.Fatalf("Cancel() error = %v, want %v", err, ErrCannotCancel)
	}
	if order.Status() != StatusFulfilled {
		t.Fatalf("Status() = %q, want %q", order.Status(), StatusFulfilled)
	}
}
