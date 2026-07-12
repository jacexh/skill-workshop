# Order acceptance sequence

1. Client -> API: accept order
2. API -> Order Service: AcceptOrder
3. Order Service -> PostgreSQL: transaction writes order and outbox
4. Relay -> Broker: OrderAccepted
5. Broker -> Projection Worker: OrderAccepted
6. Projection Worker -> Read Store: idempotent projection update

The retry budget, replay operator procedure, and compatibility window are not
specified.
