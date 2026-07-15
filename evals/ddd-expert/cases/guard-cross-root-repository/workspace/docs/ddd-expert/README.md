# DDD Expert Artifacts

## Bounded Contexts

- [Order](context/order/model.md)
- [Payment](context/payment/model.md)

`design.md` lives beside each context's `model.md`. It may be absent before EventStorming applies the first accepted tactical slice, then remains `evolving` until its revision-matched Design becomes `codify_ready`. Context dependencies and named contracts are authoritative in [context-map.md](context-map.md).
