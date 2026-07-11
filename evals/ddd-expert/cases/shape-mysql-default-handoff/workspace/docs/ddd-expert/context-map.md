# Context Map

## Bounded Contexts

### Inventory

- **Core responsibility:** Reserve and release sellable stock.
- **Business authority:** Sellable quantity and inventory reservation state.

### Order

- **Core responsibility:** Accept and track customer orders.
- **Business authority:** Order acceptance and fulfillment intent.

## Relationships

### Inventory -> Order

- **Relationship:** Published Language
- **Authority boundary:** Inventory owns reservation outcomes; Order owns the reaction to them.
- **Translation boundary:** Order consumes the published result without importing Inventory's internal model.
