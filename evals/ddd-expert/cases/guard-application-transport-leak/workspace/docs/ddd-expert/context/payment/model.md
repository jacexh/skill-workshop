---
context: Payment
model_revision: 1
---

# Payment Domain Model

## Authority and Ownership

Payment owns payment settlement and capture facts.

## Context Dependencies

Payment publishes Payment Captured for consumers. Order owns how that external
fact affects order fulfillment.
