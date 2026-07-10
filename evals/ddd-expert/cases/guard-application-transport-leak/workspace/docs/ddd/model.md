# Order Context Model

Order owns order fulfillment. Payment owns payment settlement and publishes the
stable `PaymentCaptured` fact. Order consumes that fact and invokes the
idempotent `RecordPayment` use case; the published payload is not part of the
Order Domain model.
