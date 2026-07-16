---
context: Order
model_revision: 3
model_status: model_ready
---

# Order Domain Model

## Language

- **Payment Captured:** The upstream fact that Payment has completed settlement.
- **Record Payment:** Order's decision to associate a captured payment with an order.

## Invariants and Policies

Order owns whether a captured payment may be recorded and whether fulfillment
may proceed. A Payment Captured fact is translated into one Record Payment
command; provider delivery concerns do not change the business meaning of that
command.

## Context Boundary

Payment owns settlement and the Payment Captured contract. Order consumes only
that published contract and does not depend on Payment's internal model.

## Accepted Existing Boundaries

This change retains the producer-owned generated Payment Captured Go contract,
the local provider-neutral `messagebus.Subscriber` port, and direct delegation
to the existing Record Payment handler. Provider and serialization integration,
an Application registry, and DTO/Domain assembly are outside this narrow
change.

## Inbound Integration Message and Production Registration

The inbound adapter at
`internal/business/order/transport/messagesubscriber/payment_captured.go`
checks the generated payload, maps it to one Record Payment command, and
delegates exactly once. The production module at
`internal/business/order/order.go` registers exactly one handler with
`messagebus.Subscriber` before consumption starts.

`internal/pkg/messagebus` owns provider acknowledgement, retry policy, consumer
lifecycle, and shutdown. The Order module composes its handler but does not run
the consumer or decide provider failure policy. Adapter and composition tests
are the accepted verification seams.
