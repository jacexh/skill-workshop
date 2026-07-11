# Ready an order after captured payment

As an order operations coordinator, I want an order to become ready for
fulfillment after Payment Captured so that fulfillment can begin.

Order owns fulfillment readiness. Product has not decided whether Captured
Payment Evidence is sufficient by itself or whether Order must also require
another local condition such as reserved inventory or completed fraud review.
