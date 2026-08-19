# Order Domain Objects

## Order

### Order — Aggregate Root (`OrderID`)

- **Definition:** An Order represents one customer's accepted purchase request.
- **State:** Order owns customer identity, display name, placement time, and its Order Lines.
- **Behavior:**
  - `Rename` — Order replaces its display name, producing the updated order identity for display.

### Order Line — Entity (`OrderLineID`)

- **Definition:** An Order Line represents one product and requested quantity inside its Order.
- **State:** Order Line owns product identity and positive quantity.
- **Behavior:**
  - `ChangeQuantity` — Order Line changes its requested quantity, producing a positive line quantity or a rejection.
