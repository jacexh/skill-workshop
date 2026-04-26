---
name: ddd-modeling
description: Strategic domain modeling guide for DDD. Use BEFORE writing implementation plans to identify bounded contexts, aggregate roots, and aggregate boundaries from business requirements. Provides decision trees, heuristics, and worked examples for domain discovery. Prerequisite to ddd-core and language-specific implementation guides.
---

# Strategic Domain Modeling Guide
## From Business Requirements to Domain Model

**Version**: v1.0
**Date**: 2026-04-15
**Scope**: All backend services using DDD
**Usage**: Complete this modeling phase BEFORE writing implementation plans. The output feeds into [`ddd-core.md`](ddd-core.md) and language-specific guides ([`ddd-golang.md`](ddd-golang.md), [`ddd-python.md`](ddd-python.md)).

---

## 1. Purpose

[`ddd-core.md`](ddd-core.md) and the language-specific guides tell you **how to implement** a domain model. This document tells you **how to discover** the domain model from business requirements.

The two most common modeling errors are:

1. **Wrong bounded context boundaries** — lumping unrelated concerns together or splitting tightly-coupled concepts apart
2. **Wrong aggregate boundaries** — making everything an aggregate root, or stuffing too many entities into one aggregate

Both errors stem from the same root cause: **treating data relationships (foreign keys, "has-many") as modeling boundaries, instead of analyzing business invariants and language boundaries**.

This document provides decision procedures to get these boundaries right.

---

## 2. Bounded Context Discovery

A bounded context is a boundary within which a domain model is consistent and a specific ubiquitous language applies. Identifying bounded contexts is the first and most impactful modeling decision.

### 2.1 Step 1: Identify Business Capabilities

List the major business capabilities the system must support. A business capability is a function the business performs to create value — not a technical component.

```
Example — E-commerce platform:

Business capabilities:
  - Catalog Management     (maintain product information)
  - Inventory Management   (track stock levels)
  - Order Fulfillment      (process and ship orders)
  - Billing / Payments     (charge customers, handle refunds)
  - Customer Management    (registration, profiles, preferences)
  - Notification           (send emails, push notifications)
```

Each business capability is a **candidate bounded context**. Not every capability will become its own context — some may merge — but this is the starting point.

### 2.2 Step 2: Ubiquitous Language Analysis

The strongest signal for a bounded context boundary is **the same term meaning different things**.

**Procedure:**

1. List the key nouns in the business requirements
2. For each noun, check: does it have the same attributes and behaviors everywhere it appears?
3. If the same noun has different shapes in different contexts → bounded context boundary

```
Example — "Product" in an e-commerce system:

Catalog context:
  Product = { name, description, images, categories, SEO metadata }
  Behavior: publish, unpublish, update description

Inventory context:
  Product = { SKU, quantity_on_hand, warehouse_location, reorder_threshold }
  Behavior: reserve, restock, transfer between warehouses

Order context:
  Product = { product_id, name_snapshot, price_at_purchase, quantity }
  Behavior: none — it's a snapshot frozen at order creation time

Three different models for "Product" → three different bounded contexts.
The Catalog team says "update a product" and means change the description.
The Inventory team says "update a product" and means adjust stock levels.
Same word, different meanings → context boundary.
```

**Key signals of a context boundary:**

| Signal | Example |
|--------|---------|
| Same noun, different attributes | "User" in Auth (credentials, roles) vs. "User" in Social (avatar, bio, followers) |
| Same noun, different behaviors | "Account" in Banking (debit, credit) vs. "Account" in CRM (update contact info) |
| Same noun, different owners | "Order" owned by Sales team vs. "Shipment" owned by Logistics team |
| Different lifecycle | Catalog Product lives forever; Order Line Item lives only for the order duration |

### 2.3 Step 3: Boundary Heuristics

Apply these heuristics to validate and refine the boundaries identified in Steps 1-2.

| # | Heuristic | How to apply |
|---|-----------|--------------|
| 1 | **Change coupling** | Things that change together for the same business reason belong in the same context. If changing "pricing rules" requires touching both product display and invoice generation, those concerns may be coupled. |
| 2 | **Data authority** | Each piece of data has exactly one authoritative source. "Product name" is authoritative in Catalog; other contexts hold read-only copies or snapshots. The context that is the authority owns the concept. |
| 3 | **Team alignment** | If different teams own different capabilities, those are likely different contexts. Conway's Law is a feature here, not a bug. |
| 4 | **Autonomy test** | Could this context deploy independently? Use a different database? If not, it might be too tightly coupled to its neighbor and the boundary may be wrong. |
| 5 | **Communication pattern** | If two candidate contexts need synchronous, real-time data exchange for every operation → they may be one context. If they only need eventual notification → separate contexts. |

### 2.4 Step 4: Context Relationships

Once boundaries are identified, map how contexts relate:

```
┌──────────────┐    domain event     ┌──────────────────┐
│   Catalog    │ ──────────────────► │    Inventory     │
│ (upstream)   │  ProductPublished   │  (downstream)    │
└──────────────┘                     └──────────────────┘
                                              │
                                     domain event
                                     StockReserved
                                              │
                                              ▼
┌──────────────┐    domain event     ┌──────────────────┐
│    Order     │ ◄────────────────── │    Billing       │
│              │   PaymentConfirmed  │                  │
└──────────────┘                     └──────────────────┘
```

**Relationship types:**

| Relationship | When to use | Risk |
|-------------|------------|------|
| **Domain events** (preferred) | Default for all cross-context communication | Eventual consistency |
| **Shared Kernel** | Two contexts co-evolve and share a small, stable set of types | Coupling — keep it tiny |
| **Anti-Corruption Layer** | Integrating with external systems or legacy services | Translation overhead |

> Direct calls between contexts are prohibited. See [ddd-core.md §5](ddd-core.md).

### 2.5 Bounded Context Checklist

Before proceeding to aggregate design, verify:

- [ ] Each context has a clear name that reflects a business capability
- [ ] Each context has its own ubiquitous language (no term means two things within one context)
- [ ] Data authority is clear: every key entity has exactly one owning context
- [ ] Cross-context communication is via domain events (no direct calls)
- [ ] No context is a "god context" responsible for everything

---

## 3. Aggregate Design

An aggregate is a cluster of entities and value objects with a single root entity (the **aggregate root**) that serves as the sole entry point. The aggregate boundary defines a **transactional consistency boundary**.

### 3.1 The True Invariant Rule

> **The only valid reason to put multiple entities in one aggregate is a business invariant that must be enforced within a single transaction.**

A **business invariant** is a rule that must ALWAYS be true. If it can be temporarily false and corrected later (eventual consistency), it does not require transactional consistency and does not justify grouping entities into one aggregate.

**Ask this question for every entity pair:**

> "If entity A changes but entity B is not updated atomically in the same transaction, can the system enter a permanently invalid business state?"

- **Yes** → Same aggregate (transactional consistency required)
- **No, it's temporarily inconsistent but self-corrects** → Separate aggregates (eventual consistency via domain events)
- **No, they're independent** → Separate aggregates

```
Example analysis:

Order and OrderItem:
  Invariant: "Order.total MUST equal SUM(item.price × item.quantity) at all times"
  Can this be temporarily wrong? No — a half-updated order total could cause incorrect charges.
  → Same aggregate. Transactional consistency required.

Order and User:
  Question: "If Order changes, must User be updated atomically?"
  No. Order and User are independent. Order holds a user_id reference.
  → Separate aggregates.

Order and Inventory:
  Invariant: "Stock cannot go negative"
  Can this be temporarily inconsistent? Yes — we can reserve stock via domain events.
  Failure mode: if eventual consistency fails, we compensate (cancel order or backorder).
  → Separate aggregates. Domain events for stock reservation.
```

### 3.2 Aggregate Boundary Decision Tree

For each entity B that appears to "belong to" entity A:

```
Q1: Does B have a meaningful identity independent of A?
    (Can someone refer to "this specific B" without knowing which A it belongs to?)
    │
    ├── Yes → B is likely its own aggregate root.
    │         Go to Q3 to verify.
    │
    └── No → Continue to Q2.

Q2: Can B exist without A?
    (If A is deleted, does B still make sense?)
    │
    ├── Yes → B is its own aggregate root.
    │         The "belongs to" is just a reference, not containment.
    │
    └── No → B is a candidate child of A's aggregate.
              Continue to Q4.

Q3: Is there a business invariant between A and B that MUST be
    enforced in the same transaction?
    │
    ├── Yes → Can you redesign to use eventual consistency?
    │         │
    │         ├── Yes → Separate aggregates + domain events.
    │         │
    │         └── No (rare) → Same aggregate.
    │                         This will be a large aggregate.
    │                         Accept the concurrency trade-off.
    │
    └── No → Separate aggregates. Reference by ID.

Q4: When B is modified, must A's invariants be re-validated?
    (Does changing B potentially violate a rule that A guards?)
    │
    ├── Yes → B is inside A's aggregate. A is the aggregate root.
    │         All access to B goes through A's domain methods.
    │
    └── No → Reconsider: B might be its own aggregate root.
             The lifecycle dependency (B needs A to exist) can be
             enforced via a foreign key or application-level check,
             not by stuffing B into A's aggregate.
```

### 3.3 Entity vs. Value Object Decision

Before deciding aggregate boundaries, classify each concept as Entity or Value Object:

```
Q1: Does this concept need a unique, persistent identity?
    (Do you need to distinguish "this one" from another with identical attributes?)
    │
    ├── Yes → Entity
    │
    └── No → Q2: Is it defined entirely by its attributes?
              (Two instances with the same values are interchangeable?)
              │
              ├── Yes → Value Object (immutable, replace instead of modify)
              │
              └── No → Entity
```

**Common classifications:**

| Concept | Typically | Reasoning |
|---------|-----------|-----------|
| Email, Phone, Address | Value Object | "123 Main St" is "123 Main St" regardless of which instance. Replace, don't mutate. |
| Money (amount + currency) | Value Object | $10 USD is $10 USD. Arithmetic creates new instances. |
| OrderItem (within an Order) | Entity | Need to track "item #3 in this order" to update quantity. But only meaningful within the Order aggregate. |
| Tag, Label | Value Object | Interchangeable if same name. |
| User, Product, Order | Entity (Aggregate Root) | Unique identity, independent lifecycle, externally referenced. |

### 3.4 Aggregate Sizing Rules

| Rule | Explanation |
|------|-------------|
| **Default to small** | Start with the smallest possible aggregate: one root entity + value objects only. Add child entities only when a transactional invariant forces you to. |
| **Beware unbounded collections** | If an aggregate contains a collection that can grow without limit (e.g., "all comments on a post"), the aggregate is almost certainly too big. |
| **3-entity-type limit** | If your aggregate contains more than 3 entity types, re-examine. The odds of all of them sharing a transactional invariant are low. |
| **Concurrency smell** | If two users frequently need to modify the same aggregate simultaneously, it may be too big. Large aggregates create contention via optimistic locking. |
| **Load smell** | If you need the aggregate root but always load dozens of child entities you don't need, the aggregate is too big. |

---

## 4. Worked Examples with Reasoning

### 4.1 E-commerce: Order System

**Requirements:**
- Users place orders with multiple items
- Each item has a product reference, quantity, and unit price
- Order total must equal the sum of (item price × quantity)
- Items can be added/removed before payment
- After payment, order is immutable
- Inventory must be reserved when order is placed

**Modeling analysis:**

**Step 1 — Identify entities:** Order, OrderItem, User, Product, Inventory

**Step 2 — Apply decision tree to each pair:**

Order ↔ OrderItem:
- Q1: Does OrderItem have independent identity? **No.** "Item #3" only makes sense within "Order #456". Nobody references an OrderItem from outside.
- Q2: Can OrderItem exist without Order? **No.**
- Q4: When OrderItem changes (add/remove), must Order's invariants be re-validated? **Yes** — Order.total must be recalculated.
- **→ OrderItem is a child entity inside Order aggregate.**

Order ↔ User:
- Q1: Does User have independent identity? **Yes.** Users exist before and after orders.
- Q3: Is there a transactional invariant? **No.** Creating an order doesn't need to atomically modify the user.
- **→ Separate aggregates. Order holds user_id.**

Order ↔ Product:
- Same reasoning as User. Product is referenced, not contained.
- **→ Separate aggregates. OrderItem holds product_id + price_snapshot.**

Order ↔ Inventory:
- Q3: Transactional invariant ("stock can't go negative")?
- Can we use eventual consistency? **Yes** — reserve via domain event; compensate on failure.
- **→ Separate aggregates. OrderPlaced event triggers inventory reservation.**

**Result:**
```
Order Aggregate:
  Root: Order { id, user_id, status, total, created_at }
  Child Entity: OrderItem { product_id, name_snapshot, price, quantity }
  Value Objects: Money, OrderStatus

Separate Aggregates:
  User (own aggregate root)
  Product (own aggregate root, in Catalog context)
  Inventory (own aggregate root, in Inventory context)
```

### 4.2 Blog Platform: Post and Comment

**Requirements:**
- Users write blog posts
- Other users can comment on posts
- Posts can have thousands of comments
- Authors can edit their posts; commenters can edit/delete their own comments
- Moderators can hide comments independently

**Modeling analysis — the common mistake:**

Naive model: "Comment belongs to Post → Comment is inside Post aggregate"

**Apply the decision tree:**

Post ↔ Comment:
- Q1: Does Comment have independent identity? **Yes.** Moderators reference "Comment #789" when reviewing reports. Commenters link to specific comments.
- Q3: Is there a transactional invariant between Post and Comment? **No.** Editing a comment doesn't violate any Post invariant. Adding a comment doesn't require atomically updating the Post.
- **→ Separate aggregates.**

**Additional signals:**
- Unbounded collection: A post can have thousands of comments → loading the entire Post aggregate would be prohibitively expensive
- Independent lifecycle: Comments are created/modified/deleted by different users than the post author
- Independent operations: Moderating a comment has nothing to do with the post's state
- Concurrency: Many users commenting simultaneously would cause optimistic lock conflicts if they're all modifying the same Post aggregate

**Result:**
```
Post Aggregate:
  Root: Post { id, author_id, title, content, status, published_at }
  Value Objects: PostStatus

Comment Aggregate (separate!):
  Root: Comment { id, post_id, author_id, content, status, created_at }
  Value Objects: CommentStatus

Cross-aggregate: Comment holds post_id as a reference.
Application-level rule: creating a Comment requires the Post to exist (check, not invariant).
```

**Why the "belongs to" relationship doesn't make it the same aggregate:**
- "Comment belongs to Post" is a **data relationship** (foreign key)
- Aggregate boundaries are defined by **transactional invariant relationships**, not data relationships
- Foreign key ≠ aggregate boundary

### 4.3 Project Management: Project, Task, and Member

**Requirements:**
- A project has a name, status, and members
- A project contains tasks
- Tasks have assignees (must be project members), status, and priority
- A task can have subtasks (checklist items)
- Project is marked complete only when all tasks are done

**Modeling analysis:**

Project ↔ Task:
- Q1: Does Task have independent identity? **Yes.** Users say "I'm working on Task #42". Dashboards show task lists across projects.
- Q3: Transactional invariant?
  - "Assignee must be a project member" — this is a **rule**, but can it be eventually consistent? If a member is removed, their tasks can be unassigned asynchronously. Not an atomic requirement.
  - "Project is complete when all tasks are done" — this is a **derived state**, computable by query, not a transactional invariant. Project status can be updated via domain event when the last task completes.
- **→ Separate aggregates.**

Task ↔ Subtask (checklist items):
- Q1: Does Subtask have independent identity? **No.** "Subtask #2 of Task #42" — not independently referenced.
- Q2: Can Subtask exist without Task? **No.**
- Q4: Does changing a subtask affect Task invariants? **Depends on requirements.**
  - If "Task progress = completed subtasks / total subtasks" must be atomic → same aggregate
  - If subtasks are just a checklist with no invariant → could be either way, but small aggregate principle favors keeping them inside Task (bounded collection, simple lifecycle)
- **→ Subtask is a child entity inside Task aggregate (if count is bounded).**

Project ↔ Member:
- Q1: Does Member have independent identity (as a project member)? The membership itself is a relationship.
- Membership is a **Value Object** within Project: { user_id, role, joined_at }
- Adding/removing members is a Project operation
- Member list is bounded (projects don't have millions of members)
- **→ Membership is a Value Object collection inside Project aggregate.**

**Result:**
```
Project Aggregate:
  Root: Project { id, name, status }
  Value Object: Membership { user_id, role, joined_at }
  Value Object: ProjectStatus

Task Aggregate (separate!):
  Root: Task { id, project_id, assignee_id, title, status, priority }
  Child Entity: Subtask { title, completed }
  Value Objects: TaskStatus, Priority

Cross-aggregate communication:
  TaskCompleted event → Project context checks if all tasks done → updates ProjectStatus
  MemberRemoved event → Task context unassigns affected tasks
```

### 4.4 Anti-Example: The God Aggregate

**Bad model — everything inside Order:**

```
Order Aggregate (WRONG):
  Root: Order
  ├── OrderItem
  ├── Payment          ← should be separate (has its own lifecycle, managed by billing)
  ├── Shipment         ← should be separate (managed by logistics, independent operations)
  ├── Invoice          ← should be separate (legal document, different audit rules)
  └── DeliveryAddress  ← this one is OK (value object, snapshotted at order time)
```

**Why this is wrong:**
- Payment has an independent lifecycle (can be retried, refunded, charged back)
- Shipment is managed by a different team (logistics) with its own tracking and status
- Invoice is a legal document with its own compliance rules
- All three are modified independently of the order → no shared transactional invariant
- Stuffing them into one aggregate means: anyone modifying a shipment status will lock the entire order

**Correct model:**
```
Order Aggregate:        { id, status, total, items[] }
Payment Aggregate:      { id, order_id, amount, status, method }
Shipment Aggregate:     { id, order_id, tracking_number, status, carrier }
Invoice Aggregate:      { id, order_id, amount, issued_at, pdf_url }

Communication: domain events
  OrderPlaced → triggers Payment creation
  PaymentConfirmed → triggers Shipment creation + Invoice generation
```

---

## 5. Common Modeling Mistakes

### 5.1 Foreign Key = Aggregate Boundary

**Mistake:** "The database has a foreign key from Comment to Post, so Comment is inside the Post aggregate."

**Why it's wrong:** A foreign key represents a data relationship. An aggregate boundary represents a transactional invariant boundary. These are different things.

**Fix:** Ask: "Does modifying a Comment require atomically enforcing a Post business rule?" If no → separate aggregates.

### 5.2 "Belongs To" = Containment

**Mistake:** "Task belongs to Project → Task is inside the Project aggregate."

**Why it's wrong:** "Belongs to" in natural language usually means "is associated with", not "must be transactionally consistent with". Most "belongs to" relationships are references (IDs), not aggregate containment.

**Fix:** Apply the decision tree (§3.2). Check for independent identity (Q1) and transactional invariants (Q3/Q4).

### 5.3 UI View = Aggregate

**Mistake:** Designing aggregates based on what a UI screen displays together.

**Why it's wrong:** A product detail page might show product info, reviews, inventory status, and pricing — that doesn't mean they're one aggregate. UI is a read concern; aggregates are a write concern.

**Fix:** CQRS. Build a read-optimized QueryRepository for the UI view. Keep write-side aggregates small.

### 5.4 CRUD Mindset

**Mistake:** One aggregate per database table, with getters/setters instead of domain methods.

**Why it's wrong:** This is an anemic domain model. Aggregates are defined by business behavior and invariants, not by data storage structure.

**Fix:** Focus on what the business does (verbs: "place order", "approve request", "transfer funds"), not on what data it stores (nouns: "order table", "request table").

### 5.5 Premature Splitting

**Mistake:** Splitting every entity into its own aggregate root "for flexibility".

**Why it's wrong:** Unnecessary split means the consistency guarantee is lost. If OrderItem is a separate aggregate, you cannot atomically guarantee that Order.total matches the sum of items.

**Fix:** Split only when there is no transactional invariant (§3.1), or when aggregate size causes real problems (§3.4).

---

## 6. Modeling Process Checklist

Use this step-by-step procedure during the design phase, before writing implementation plans.

### Phase 1: Bounded Context Discovery

1. **List business capabilities** from requirements (§2.1)
2. **Analyze ubiquitous language** — identify terms with context-dependent meanings (§2.2)
3. **Apply boundary heuristics** — validate with change coupling, data authority, team alignment (§2.3)
4. **Map context relationships** — document upstream/downstream and communication patterns (§2.4)
5. **Verify** against the checklist (§2.5)

### Phase 2: Aggregate Design (per bounded context)

6. **List all entities and concepts** within this context
7. **Classify each as Entity or Value Object** using the decision in §3.3
8. **For each entity pair, apply the aggregate boundary decision tree** (§3.2)
9. **State the invariant** that justifies each aggregate boundary — if you can't name it, the entities probably don't belong together
10. **Check aggregate sizing** (§3.4) — flag any aggregate with unbounded collections or >3 entity types
11. **Identify cross-aggregate references** — these are always by ID, never by direct object reference
12. **Design domain events** for cross-aggregate and cross-context communication

### Phase 3: Modeling Output

Document the following for each bounded context:

```
Bounded Context: [Name]
Description: [What business capability this context handles]
Authority over: [What data this context is the single source of truth for]

Aggregates:

  [Aggregate 1 Name]:
    Root: [Entity name + key attributes]
    Child Entities: [list, with justification for why they're inside]
    Value Objects: [list]
    Invariants guarded: [list the business rules this aggregate enforces]
    Repository: [write operations available]
    Domain Events produced: [list]

  [Aggregate 2 Name]:
    ...

Cross-context communication:
  - [Event] → consumed by [Context] to [action]
```

---

## 7. Quick Reference: Decision Summary

### When two entities should be in the SAME aggregate:

- There is a business rule involving both that must ALWAYS be true (no temporary inconsistency allowed)
- One entity cannot be meaningfully identified without the other
- They are always modified together in every use case
- The child entity collection is bounded

### When two entities should be SEPARATE aggregates:

- They can be temporarily inconsistent and self-correct via events
- They have independent identities (referenced from outside)
- They are modified independently by different users or operations
- They belong to different bounded contexts
- One is a collection that can grow without bound
- They have different change frequencies or lifecycles
- Different teams are responsible for them

### The golden test:

> **"If I modify entity A but not entity B in the same transaction, can the system enter a state that violates a business rule that can never be repaired?"**
>
> - Yes → same aggregate
> - No → separate aggregates

---

**References:**
- [ddd-core.md](ddd-core.md) — Tactical architecture specification (use after modeling)
- [Implementing Domain-Driven Design — Vaughn Vernon](https://vaughnvernon.com/?page_id=168) — Chapters 10-11 on aggregate design
- [Effective Aggregate Design — Vaughn Vernon](https://www.dddcommunity.org/library/vernon_2011/) — Three-part essay on aggregate sizing
- [Domain-Driven Design Reference — Eric Evans](https://domainlanguage.com/ddd/reference/) — Strategic design patterns
