# Ready an order after captured payment

As an order operations coordinator, I want an order to become ready for
fulfillment after Payment Captured so that fulfillment can begin.

Order owns fulfillment readiness. An accepted Captured Payment Evidence fact
makes an active Order Ready for Fulfillment. Duplicate delivery of the same
fact does not change readiness. A cancelled Order remains cancelled and cannot
become ready even if Payment Captured arrives later.
