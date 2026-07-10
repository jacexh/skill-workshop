# Accepted Tactical Design

Order is the sole Aggregate Root and invariant owner. OrderLine values are
owned children and are persisted with Order. One command loads and saves one
Order. There are no Domain Events, external side effects, background recovery,
or cross-context writes in this scope.

The write Repository exposes only Get and Save. Product order-history reads use
an Application QueryRepository returning OrderSummary DTOs. One Infrastructure
adapter implements both ports without exposing storage types inward.
