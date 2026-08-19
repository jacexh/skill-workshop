# Context Map

## Bounded Contexts

| Bounded Context | Purpose | Model |
|---|---|---|
| Payment | Own payment settlement outcomes. | [Model](context/payment/model.md) |
| Order | Own order fulfillment eligibility. | [Model](context/order/model.md) |

## Semantic Dependencies

| Upstream | Downstream | Published contract | Downstream use |
|---|---|---|---|
| Payment | Order | Payment Captured | Order records the capture before fulfillment. |
