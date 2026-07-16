# Add order history

Return a customer's paginated order history with display status, total amount,
and creation time. The ticket does not define the missing model details. It does not say
whether the read uses the write Repository, a QueryRepository, or a published
read facade, and it defines no authorization or freshness semantics.
