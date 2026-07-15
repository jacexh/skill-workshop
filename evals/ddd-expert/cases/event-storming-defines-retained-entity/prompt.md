The accepted Fulfillment Model is complete. Across earlier EventStorming turns we have
already reviewed and explicitly accepted these tactical decisions:

- `FulfillmentOrder` is the Aggregate Root and the single consistency boundary.
  It owns `AllocationLine` as a child Entity. Each line is one resource
  allocation request, has stable `LineId` identity and continuity, belongs to
  exactly one Root, cannot exist outside it, and changes only through Root
  behavior.
- a line has its own lifecycle inside the Aggregate: creation establishes
  Pending; only Pending may establish Allocated or Rejected; both outcomes are
  terminal and mutually exclusive. `AllocateLine` and `RejectLine` are the
  intention-revealing behaviors.
- LineId is unique within one FulfillmentOrder. Quantity is a positive Value
  Object equal by amount; identity Values are equal by their exact identity and
  have no additional business-format rule. Repeated intent for the same LineId
  returns the established result, and concurrent terminal intents establish
  only one outcome.
- `AllocationLineAdded`, `AllocationAccepted`, and `AllocationRejected` are
  local Domain Events. There is no cross-context dependency or Process Manager,
  and no technical mechanism is design-significant for this accepted scope.
- splitting AllocationLine into another Aggregate would move LineId uniqueness
  and terminal exclusivity across roots, so the child Entity remains inside the
  FulfillmentOrder boundary.

Together these accepted decisions close the remaining Fulfillment Design
obligations. Apply their smallest consistency closure to
`docs/ddd-expert/context/fulfillment/design.md`, promote it to `codify_ready`
without asking for a duplicate acceptance, and keep the accepted Model and
Context Map unchanged.
