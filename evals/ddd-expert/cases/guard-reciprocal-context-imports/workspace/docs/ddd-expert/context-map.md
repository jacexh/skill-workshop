# Context Map

## Bounded Contexts

| Bounded Context | Purpose | Model |
|---|---|---|
| Payment | Own payment capture outcomes. | [Model](context/payment/model.md) |
| Order | Own fulfillment eligibility. | [Model](context/order/model.md) |

## Semantic Dependencies

| Upstream | Downstream | Published contract | Downstream use |
|---|---|---|---|
| Payment | Order | Payment Captured | Order translates capture into fulfillment eligibility. |
