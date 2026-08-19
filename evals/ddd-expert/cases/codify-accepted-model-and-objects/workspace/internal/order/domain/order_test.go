package domain

import "testing"

func TestOrderRenameProtectsNameInvariant(t *testing.T) {
	order, err := NewOrder("order-1", "Original")
	if err != nil {
		t.Fatal(err)
	}

	if err := order.Rename("Updated"); err != nil {
		t.Fatalf("rename valid order: %v", err)
	}
	if got := order.Name(); got != "Updated" {
		t.Fatalf("name = %q, want Updated", got)
	}

	if err := order.Rename("  "); err == nil {
		t.Fatal("rename with an empty name should fail")
	}
	if got := order.Name(); got != "Updated" {
		t.Fatalf("failed rename changed name to %q", got)
	}
}
