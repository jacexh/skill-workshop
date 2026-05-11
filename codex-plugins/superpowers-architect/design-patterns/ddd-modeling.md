---
name: ddd-modeling
description: Strategic domain modeling guide for DDD. Use BEFORE writing implementation plans to identify bounded contexts, aggregate roots, and aggregate boundaries from business requirements. Provides decision trees, heuristics, and worked examples for domain discovery. Prerequisite to ddd-core and language-specific implementation guides. Code agents must read ddd-agent-contract.md first.
---

# Strategic Domain Modeling Guide
## From Business Requirements to Domain Model

**Version**: v1.1
**Date**: 2026-05-11
**Scope**: All backend services using DDD
**Usage**: Complete this modeling phase BEFORE writing implementation plans. The output feeds into [`ddd-core.md`](ddd-core.md) and language-specific guides ([`ddd-golang.md`](ddd-golang.md), [`ddd-python.md`](ddd-python.md), [`ddd-typescript.md`](ddd-typescript.md)).

> **Agents — read this first**: [`ddd-agent-contract.md`](ddd-agent-contract.md) defines the mandatory execution order, stop protocol, and prohibited actions for code agents working on DDD tasks. Do not skip it.

---

## 0. Mandatory Architecture Gate

Use this document as the entry point for all backend, DDD, service-boundary, technical-capability, refactor, implementation planning, execution, and code review work. Do not start with tactical layer placement in `ddd-core.md` or a language guide until this gate has been answered.

Choose the smallest gate level defined in §7 and emit this block before planning, editing, or approving code:

```text
Architecture Gate:
- Gate level: <see §7 for the level definitions>
- Bounded context / business capability: <context and capability>
- Stable language / data authority: <terms and owning source of truth>
- Affected aggregate, policy, or service: <domain object or explicit none>
- Invariants and rules: <rules guarded by this change>
- Technical capability classification: <Domain-facing | Application | Infrastructure, with reason>
- Layer ownership: <Domain / Application / Infrastructure>
- Proceed / Stop: <proceed only if the gate is complete>
```

Stop before implementation when any required answer is unknown. Missing gate answers are design work, not implementation details.

For **Level 1 — Local Change** work, keep the Architecture Gate block but use explicit `n/a — <reason>` values for fields the change does not touch; do not invent bounded contexts, aggregates, invariants, or integration boundaries only to fill the form. Level 2, Level 3, and cross-context changes must fill every affected field with concrete answers.

### 0.1 Technical capability classification

Technical-facing modules still require domain modeling when they own stable language, state transitions, policies, or invariants. Dispatchers, registries, schedulers, routers, connectors, projections, ownership managers, delivery engines, and observability pipelines are not automatically Infrastructure.

Classify the capability before deciding package placement:

| Classification | Use when (and where the rule lives) |
|----------------|-------------------------------------|
| **Domain-facing** | The capability has named states, admission rules, routing policy, ownership semantics, lifecycle rules, or derivation rules that can be tested without external systems. Place the rule in Domain (methods, Value Objects, Domain Services, or policies). |
| **Application orchestration** | The capability sequences a use case, chooses ports, manages transactions, or coordinates Domain objects without owning the rule. Place the orchestration in Application handlers/services and Application-owned ports. |
| **Infrastructure** | The capability adapts storage, network, queues, generated protocols, locks, clocks, telemetry backends, or framework lifecycle without owning the semantic rule. Place the adapter in Infrastructure or a shared technical package. |

If the same rule would otherwise be duplicated across handlers or adapters, name it as Domain-facing and keep the implementation-independent rule in the Domain layer.

### 0.2 Port granularity

Define ports by use-case semantics, not by implementation technology. Adding Redis, MySQL, Kafka, an HTTP client, or another technical dependency does not automatically justify a new Domain/Application interface.

Before adding a port, answer:

- What semantic capability does the caller need? (name it in domain terms, not "calls Redis")
- Which layer owns the rule behind that capability? (apply §0.1's classification table — Domain-facing, Application orchestration, or Infrastructure)
- Does the caller need a separate failure policy, consistency boundary, or replacement strategy?
- Would the caller's code change if the implementation switched from Redis to MySQL, or from cache-aside to write-through?

If the caller still needs the same aggregate collection or read model, keep the existing Repository / QueryRepository / semantic port and compose the technical dependency inside Infrastructure. For example, a high-traffic read path may implement `UserQueryRepository` with MySQL plus Redis cache-aside; it must not expose a separate `Cacher` port unless caching behavior itself is a named use-case concern.

The source of a port's request/response types does not decide the port's layer. Generated protocol messages, database rows, queue payloads, or external DTOs are boundary shapes; they are mapped to the layer-owned model before invoking the semantic port. If the capability is Domain-facing but the external call is expressed with Protobuf messages, keep the port in Domain and add an Application/Infrastructure mapper from proto DTOs to Domain entities, value objects, commands, or events.

**Worked example — proto-typed Domain-facing port.** Suppose a `MessageRecorder` records a Domain fact (state transition / invariant) whose wire format is generated from Protobuf. By §0.1 the capability is Domain-facing, so the port lives in `domain/` with a Domain-typed signature such as `Record(ctx, RecordCommand) error`, where `RecordCommand` is a Domain command/value object. The Application handler (or an Infrastructure inbound adapter) maps the incoming `pb.Message` into `RecordCommand` before calling the port. The wrong move — placing the port in `application/` with `pb.Message` directly in its signature — couples Domain rules to a transport schema and tends to fragment the same rule across handlers.

## 1. Purpose

[`ddd-core.md`](ddd-core.md) and the language-specific guides tell you **how to implement** a domain model. This document tells you **how to discover** the domain model from business requirements.

The two most common modeling errors are:

1. **Wrong bounded context boundaries** — lumping unrelated concerns together or splitting tightly-coupled concepts apart
2. **Wrong aggregate boundaries** — making everything an aggregate root, or stuffing too many entities into one aggregate

Both errors stem from the same root cause: **treating data relationships (foreign keys, "has-many") as modeling boundaries, instead of analyzing business invariants and language boundaries**.

This document provides decision procedures to get these boundaries right.

---

### 1.1 When the capability is a vendor wrapper

If a candidate business capability is essentially an integration with a third-party system — authentication providers, transactional email, object storage, observability backends, billing SaaS, payment gateways, etc. — prefer adapting it through an Anti-Corruption Layer (see [ddd-core.md §5.6](ddd-core.md)) and skip the full bounded context / aggregate / repository design flow for that capability.

This judgment only decides whether the capability enters the modeling process described below. It does not relax the Architecture Gate (§0) for capabilities that *do* enter modeling, and it does not preempt §2's discovery for any capability whose rules and language the team genuinely owns.

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
┌──────────────┐  integration message  ┌──────────────────┐
│   Catalog    │ ──────────────────► │    Inventory     │
│ (upstream)   │  ProductPublished   │  (downstream)    │
└──────────────┘                     └──────────────────┘
                                              │
                                   integration message
                                     StockReserved
                                              │
                                              ▼
┌──────────────┐  integration message  ┌──────────────────┐
│    Order     │ ◄────────────────── │    Billing       │
│              │   PaymentConfirmed  │                  │
└──────────────┘                     └──────────────────┘
```

**Relationship types:**

| Relationship | When to use | Risk |
|-------------|------------|------|
| **Integration messages** (default for cross-context state propagation) | One context's state changes should trigger reactions in others | Eventual consistency |
| **Cross-context queries** (read-only) | A context needs a current snapshot of data owned elsewhere, with no write side-effects | Coupling to query DTO shape; live-read latency |
| **Protocol contracts** (Protobuf, OpenAPI, GraphQL SDL) | Cross-service / cross-repository structured data contracts | Schema-evolution discipline required |
| **Anti-Corruption Layer** | Integrating with external / legacy systems whose model you cannot adopt | Translation overhead |
| **Shared Kernel** | Two contexts co-evolve and share a small, stable set of types | Coupling — keep it tiny; avoid by default |

> Direct calls into another context's Domain model or Application Service are prohibited. See [ddd-core.md §5](ddd-core.md) for the full rules of each mechanism.

### 2.5 Context Map Relationship Patterns

§2.4 told you *which mechanism* to use for cross-context communication. This section covers the orthogonal axis: *what kind of relationship* exists between two contexts. The relationship pattern is determined by team / power dynamics, not by transport choice.

| Pattern | When it fits | Power dynamic | Typical mechanism |
|---------|-------------|---------------|--------------------|
| **Customer-Supplier** | Downstream depends on upstream's published model, but downstream's needs influence upstream's roadmap | Balanced — upstream commits to backward compatibility for downstream's roadmap | Integration messages + Cross-context queries |
| **Conformist** | Downstream depends on upstream but has no influence (vendor, large-org platform team, legacy core) | Upstream-dominant | Conform to upstream's model directly; downstream pays the integration cost |
| **Anti-Corruption Layer (ACL)** | Downstream cannot or will not adopt upstream's model (legacy systems, third-party APIs with bad models) | Downstream protects itself | ACL adapter in Infrastructure (see [ddd-core.md §5.6](ddd-core.md)) |
| **Open-Host Service (OHS)** | One context serves many downstream consumers and exposes a stable, well-defined integration API | Upstream offers, downstream conforms | Protocol contracts, REST/gRPC published API |
| **Published Language** | Cross-context contract uses a well-documented schema (Protobuf, JSON Schema, GraphQL SDL) so neither side owns the language | Symmetric | Schema files in a shared location; generated code on both sides ([ddd-core.md §5.7](ddd-core.md)) |
| **Partnership** | Two contexts are mutually dependent and co-evolve together; failure on one side breaks the other | Symmetric, high coupling | Synchronous APIs + shared release cadence; **smell** — re-examine whether they should be one context |
| **Shared Kernel** | A small, stable set of types is genuinely shared between two contexts | Symmetric, high coupling | Shared library; keep tiny; avoid by default |
| **Separate Ways** | Two contexts have no business reason to integrate; do not force a relationship | Independent | None — duplicate the small overlap rather than couple |
| **Big Ball of Mud** | An existing legacy region with no clear boundaries; treat it as one opaque context | N/A | Wrap with ACL when integrating; do not extend it |

**How to use this table during planning:**

1. For each cross-context edge in your context map (§2.4), pick a relationship pattern.
2. State the pattern explicitly in design docs — "Order is a **Customer** of Catalog (**Supplier**); Catalog publishes `ProductPublished` events; Order subscribes via ACL because Catalog's payload uses legacy field names."
3. Re-examine relationships marked **Partnership** — they are usually a sign that two contexts should be merged or further split.
4. **Conformist** and **ACL** are mutually exclusive answers to the same question ("can we adopt upstream's model?"). Choose explicitly; do not drift into Conformist by accident.

> Mechanism (§2.4) and relationship pattern (§2.5) are orthogonal. A Customer-Supplier relationship can be implemented with Integration Messages, cross-context queries, or protocol contracts — choose both axes deliberately.

### 2.6 Bounded Context Checklist

Before proceeding to aggregate design, verify:

- [ ] Each context has a clear name that reflects a business capability
- [ ] Each context has its own ubiquitous language (no term means two things within one context)
- [ ] Data authority is clear: every key entity has exactly one owning context
- [ ] Cross-context communication uses one of: Integration Messages, queries through explicit query interfaces, ACL, or protocol contracts (no direct calls into another context's Domain model or Application Service)
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
  Can this be temporarily inconsistent? Yes — we can reserve stock via Integration Messages.
  Failure mode: if eventual consistency fails, we compensate (cancel order or backorder).
  → Separate aggregates. Domain Events inside each context, Integration Messages for stock reservation across contexts.
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
    │         ├── Yes → Separate aggregates + Domain Events / Integration Messages.
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
| **3-entity-type limit** (heuristic, not a hard rule) | If your aggregate contains more than 3 entity types, re-examine. The odds of all of them sharing a transactional invariant are low. The number is a guideline borrowed from common practice; the binding rule is still §3.1's invariant test. |
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
- Can we use eventual consistency? **Yes** — reserve via Integration Message if Inventory is another bounded context; compensate on failure.
- **→ Separate aggregates. OrderPlaced Domain Event stays inside Order; an OrderPlaced Integration Message triggers inventory reservation across the context boundary.**

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

Communication: Integration Messages
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
4. **Map context relationships** — document upstream/downstream and communication mechanisms (§2.4)
5. **Choose context map relationship patterns** — Customer-Supplier, Conformist, ACL, OHS, Published Language, Partnership, Shared Kernel, or Separate Ways (§2.5)
6. **Verify** against the checklist (§2.6)

### Phase 2: Aggregate Design (per bounded context)

7. **List all entities and concepts** within this context
8. **Classify each as Entity or Value Object** using the decision in §3.3
9. **For each entity pair, apply the aggregate boundary decision tree** (§3.2)
10. **State the invariant** that justifies each aggregate boundary — if you can't name it, the entities probably don't belong together
11. **Check aggregate sizing** (§3.4) — flag any aggregate with unbounded collections or >3 entity types
12. **Identify cross-aggregate references** — these are always by ID, never by direct object reference
13. **Design Domain Events for intra-context propagation and Integration Messages for cross-context communication**

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
  - [Integration Message] → consumed by [Context] to [action]
```

---

## 7. Planning Gates

Modeling output (§6) describes the steady-state design. **Planning gates** describe how much design rigor each new change requires before implementation begins. Apply this gating *every time* a developer is about to write or edit code, not just for the initial design.

Choose the smallest gate that fits the change.

### 7.1 Level 1 — Local Change

Use for changes inside an existing bounded context that do not add a new aggregate, repository, QueryRepository, domain event, or external integration.

Plan must state:

- bounded context and layer changed
- aggregate or use case affected
- technical capability classification, when the code is a dispatcher, registry, scheduler, router, connector, projection, ownership mechanism, delivery mechanism, or observability/audit mechanism
- write path or read path
- tests for the changed layer

Verify the change against the dependency rules ([ddd-core.md §1.3](ddd-core.md)) and layer responsibilities ([ddd-core.md §3](ddd-core.md)) — Domain keeps business rules, Application only orchestrates, Infrastructure stays technical, and Repository / QueryRepository responsibilities remain separate.

### 7.2 Level 2 — New Use Case

Use for a new command, query, event handler, repository method, QueryRepository, DTO, assembler, or external integration inside an existing bounded context.

Plan must state:

- use case kind: Command, Query, or Event Handler
- aggregate root and invariants involved
- technical capability classification and rule owner, if the use case coordinates a technical-facing capability
- Repository / QueryRepository interfaces needed
- DTO and assembler changes
- external integration boundary, if any
- Infrastructure implementation
- Domain Events produced or consumed; Integration Messages published or subscribed for cross-context communication
- transaction boundary and event dispatch timing; if the use case proposes one transaction that writes multiple aggregates, include the multi-aggregate exception evidence required by [ddd-core.md §3.2](ddd-core.md)

Check against [ddd-core.md §3.1-§3.4](ddd-core.md), [§5](ddd-core.md), and the relevant language-specific implementation guide before implementation.

### 7.3 Level 3 — New Bounded Context or Aggregate

Use for a new bounded context, aggregate root, domain event family, repository, or cross-context communication channel.

Spec must include:

- bounded context, business capability, ubiquitous language, and data authority (see §2)
- aggregate root, entities, value objects, and guarded invariants (see §3)
- technical capability classification for any runtime coordination, routing, scheduling, delivery, registry, projection, ownership, observability, or audit concern
- transaction boundary for each command; any proposed multi-aggregate transaction must stay inside one bounded context and satisfy the exception gate in [ddd-core.md §3.2](ddd-core.md)
- Integration Messages and minimum required payload fields (see [ddd-core.md §5.4](ddd-core.md))
- cross-context communication mechanism: Integration Messages, queries, ACL, or protocol contracts (see [ddd-core.md §5.2](ddd-core.md))
- language-specific package layout (see the corresponding implementation guide: [ddd-golang.md](ddd-golang.md), [ddd-python.md](ddd-python.md), [ddd-typescript.md](ddd-typescript.md))

Check aggregate boundaries against §3, tactical rules against [ddd-core.md](ddd-core.md), and language-specific placement rules against the relevant implementation guide.

Do not treat existing code as precedent when it conflicts with the dependency rules.

### 7.4 Cross-Context Change Without a New Context

If a change adds or modifies cross-context communication (a new Integration Message with subscribers in another context, a new query exposed across contexts, an ACL adapter, etc.) but does not introduce a new bounded context or aggregate, treat it as **Level 2 on each affected side** and produce one plan per side:

- Producing side: the new Integration Message / query / contract, its payload contract, and dispatch (or response) timing
- Consuming side: the handler / consumer, idempotency strategy, and transaction boundary

If the change crosses three or more contexts, or if the contract itself is unstable, escalate to Level 3 and treat the contract as a first-class design artifact.

### 7.5 Gate Failure

If the plan cannot answer the required items for its level, stop and complete the missing design before writing code.

---

## 8. Quick Reference: Decision Summary

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
