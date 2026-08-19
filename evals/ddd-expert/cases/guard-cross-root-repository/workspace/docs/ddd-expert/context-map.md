# Context Map

## Bounded Contexts

| Bounded Context | Purpose | Model |
|---|---|---|
| Payment | Own payment settlement outcomes. | [Model](context/payment/model.md) |
| Order | Own order fulfillment decisions. | [Model](context/order/model.md) |

## Semantic Dependencies

| Upstream | Downstream | Published contract | Downstream use |
|---|---|---|---|
| Payment | Order | Payment Succeeded | Order records settlement before deciding fulfillment. |
