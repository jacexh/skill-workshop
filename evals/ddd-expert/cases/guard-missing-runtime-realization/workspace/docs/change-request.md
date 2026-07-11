# Consume Payment Captured

This change delivers production consumption of the upstream Payment Captured
fact. It is complete when the deployed Order process subscribes the inbound
handler and delegates each accepted fact once to the existing Record Payment
use case.
