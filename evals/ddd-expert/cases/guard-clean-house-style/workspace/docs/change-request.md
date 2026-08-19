# Accepted Order Storage and Query Boundaries

The Domain write Repository exposes only Get and Save. Infrastructure restores
existing state through explicit mechanical conversion and copies owned slices
at the mapping boundary.

Order-history reads use an Application-owned QueryRepository returning
OrderSummary DTOs. One Infrastructure Store implements both inward contracts
while keeping them separate.
