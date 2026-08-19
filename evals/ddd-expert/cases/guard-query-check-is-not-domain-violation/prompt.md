Review the semantic structure of the Order history query boundary against the
current DDD artifacts and accepted `docs/change-request.md`. The producer reports that its order-history
check currently fails. Consume that as a receipt: do not run verification or
turn an ordinary comparator defect into a DDD structural finding. Judge only
the Application-owned QueryRepository, DTO boundary, and Infrastructure
adapter seam; do not edit files.
