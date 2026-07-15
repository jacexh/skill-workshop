---
context: Payment
model_revision: 1
model_status: shape_ready
---

# Payment Domain Model

## Authority and Ownership

Payment is the sole authority for payment processing and payment outcome facts.

## Context Dependencies

Payment is upstream of Order. It publishes accepted payment facts without
giving consumers authority over Payment's internal language or lifecycle.
