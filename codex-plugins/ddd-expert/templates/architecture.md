---
context: "<Bounded Context>"
architecture_revision: 1
last_changed_by: "../../tactical-design/<tactical-design-slug>.md"
---

# <Bounded Context> Architecture

<!-- This artifact is the current software-architecture authority for one Bounded Context. Create this file only when at least one current row exists. Increment the revision only for a confirmed semantic change, replace or remove superseded rows instead of retaining history, and keep each Source linked to the confirming Tactical Design claim. `last_changed_by` normally names the ready or implemented Tactical Design that made the current projection; after direct retirement of stale claim rows, it may name the just-superseded record solely as removal provenance while no Source points to it. -->

## Current Architecture Decisions

<!-- Record only durable, BC-specific choices that outlive one Design Delta and materially constrain a future Codify choice. Do not repeat canonical Model facts, generic House Style, complete Tactical Design sequences, code structure, or historical rationale. -->

| Decision ID | Concern | Current BC-specific architecture decision | Source |
|---|---|---|---|
| <a id="ARCH-001"></a>ARCH-001 | <State/transaction/concurrency/event/failure/recovery/Interface> | <One current implementation-shaping decision> | [TD-001](../../tactical-design/<tactical-design-slug>.md#TD-001) |
