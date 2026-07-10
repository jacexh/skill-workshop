# Order Tactical Design

Application is transport-neutral. The inbound Integration Message adapter lives
under `internal/business/order/transport/messagesubscriber`, validates the
producer-owned contract, maps it to `application.RecordPayment`, and delegates
once. Broker envelopes, generated protobuf types, acknowledgement, and retry
disposition do not enter Application.
