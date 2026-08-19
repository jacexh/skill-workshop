Review only the accepted Order write-repository and order-history CQRS boundary
described in `docs/change-request.md`. The current DDD artifacts define the
Order model and objects. The supplied
Domain, Application-query, and Infrastructure declarations are the complete
semantic-structure surface for this narrow boundary. Test files are producer
evidence, not a Guard search surface. Application handlers, Interface, Runtime,
and database-backed deployment are outside this review. Do not invent unrelated
scope, run verification, or edit files.
