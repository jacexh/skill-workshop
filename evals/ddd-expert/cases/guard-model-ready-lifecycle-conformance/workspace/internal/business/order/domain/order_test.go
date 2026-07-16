package domain

import (
	"errors"
	"testing"
)

func TestFulfilledOrderCannotBeCancelled(t *testing.T) {
	order := NewOrder("order-1")
	if err := order.Fulfill(); err != nil {
		t.Fatalf("Fulfill() error = %v", err)
	}

	if err := order.Cancel(); !errors.Is(err, ErrCannotCancel) {
		t.Fatalf("Cancel() error = %v, want %v", err, ErrCannotCancel)
	}
	if order.Status() != StatusFulfilled {
		t.Fatalf("Status() = %q, want %q", order.Status(), StatusFulfilled)
	}
}

func TestAcceptedOrderCanBeCancelled(t *testing.T) {
	order := NewOrder("order-1")

	if err := order.Cancel(); err != nil {
		t.Fatalf("Cancel() error = %v", err)
	}
	if order.Status() != StatusCancelled {
		t.Fatalf("Status() = %q, want %q", order.Status(), StatusCancelled)
	}
}

func TestCancelledOrderCannotBeFulfilled(t *testing.T) {
	order := NewOrder("order-1")
	if err := order.Cancel(); err != nil {
		t.Fatalf("Cancel() error = %v", err)
	}

	if err := order.Fulfill(); !errors.Is(err, ErrCannotFulfill) {
		t.Fatalf("Fulfill() error = %v, want %v", err, ErrCannotFulfill)
	}
	if order.Status() != StatusCancelled {
		t.Fatalf("Status() = %q, want %q", order.Status(), StatusCancelled)
	}
}
