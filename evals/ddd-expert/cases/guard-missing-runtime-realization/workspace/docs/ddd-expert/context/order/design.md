---
context: Order
based_on_model_revision: 3
design_status: codify_ready
---

# Order Tactical Design

## Accepted Existing Boundaries

This change retains the existing producer-owned generated Payment Captured Go
contract, the local provider-neutral `messagebus.Subscriber` port, and direct
delegation to the existing Record Payment handler. Provider and serialization
integration, an Application registry, and DTO/Domain assembly are not changed
or required by this narrow inbound collaboration. These accepted choices apply
only to this change and do not waive other context or house-style obligations.

## Inbound Integration Message

The generated Payment Captured contract lives at
`gen/payment/integration/v1/payment_captured.pb.go`. The inbound adapter at
`internal/business/order/transport/messagesubscriber/payment_captured.go`
checks that payload type, maps it to one Record Payment command, and delegates
to the accepted Application use case exactly once.

## Production Registration

The Order production module at `internal/business/order/order.go` registers
exactly one Payment Captured handler with `messagebus.Subscriber` before
message consumption starts. Registration is composition, not an Application or
Domain responsibility.

## Runtime Ownership

`internal/pkg/messagebus` owns provider acknowledgement, retry policy, consumer
lifecycle, and shutdown. The Order module registers its handler but does not
run the consumer or decide provider failure policy.

## Verification Seams

Exercise the inbound adapter with a recording Payment Recorder to prove message
selection, payload translation, one-call delegation, failure propagation, and
unexpected-payload rejection. Exercise production composition with a recording
Subscriber to prove exactly one registration without starting provider runtime.
