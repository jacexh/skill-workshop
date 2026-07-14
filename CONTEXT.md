# Skill Workshop

Skill Workshop is a marketplace for agent workflow plugins that are published for both Claude Code and Codex CLI.

## Language

**Claude track**:
The primary supported distribution track for Claude Code plugin variants.
_Avoid_: Claude version, legacy track

**Codex track**:
The experimental distribution track for Codex CLI plugin variants.
_Avoid_: Codex version, secondary copy

**Plugin marketplace**:
The repository-level catalog that lets users discover and install Skill Workshop plugins.
_Avoid_: plugin registry, package index

**Release pipeline**:
The automated process that versions changed plugins and publishes repository releases after pull requests merge.
_Avoid_: deployment pipeline, publish script

### DDD Expert References

**House Style**:
The normative backend implementation conventions supplied by `ddd-expert`, including adopted dependencies, API usage, and concrete examples that make those conventions executable.
_Avoid_: generic best practices, technology profile

**Conditional House Rule**:
A House Style rule with an explicit applicability condition. It is not applied outside that condition; once applicable, its prescribed library and implementation shape are mandatory rather than one option among alternatives.
_Avoid_: preferred default, optional recommendation

**Implementation Upgrade**:
An LLM-selected move to the prescribed House Style mechanism when observed complexity warrants it and the move does not change accepted business meaning, boundaries, consistency, durability, or runtime commitments.
_Avoid_: automatic threshold rule, tactical redesign

**Design Escalation**:
An LLM-identified need for a mechanism that would change accepted consistency, persistence, contract, recovery, or runtime responsibilities and therefore must be resolved in Tactical Design before implementation.
_Avoid_: implementation refactor, silent architecture upgrade

**Accepted Design Decision**:
A mechanism or tactical choice explicitly confirmed by the user or recorded as current/accepted in an authoritative Tactical Design, ADR, or equivalent project artifact. Silence, incidental existing code, and an LLM's unconfirmed recommendation are not acceptance.
_Avoid_: inferred approval, existing implementation

**Context Dependency Edge**:
A one-way Context Map dependency from upstream (`U`) to downstream (`D`) that expresses model influence and contract direction rather than a runtime call. Runtime request/response may use that one owned contract, but never creates a second reverse dependency; every named edge must preserve the graph as a DAG.
_Avoid_: bidirectional relationship arrow, mutual-call edge, `<->`

**Persistence House Style**:
The part of House Style governing storage representation and operations across aggregate persistence, read models, integration state, SQL, and schema evolution. It is an Infrastructure concern related to, but not owned by, the Domain Repository abstraction.
_Avoid_: Repository table design, generic database guidance

**Reference authority**:
The kind of claim made by a `ddd-expert` reference statement: a DDD Principle, a House Rule, or a Verified Technology Fact/API Example. Authority is independent of which document contains the statement.
_Avoid_: reference category, file type

**Knowledge leaf**:
A focused reference document that owns reusable DDD knowledge, House Rules, or verified implementation guidance for one cohesive concern.
_Avoid_: checklist fixture, routing prompt

**Navigation index**:
A lightweight reference document that selects relevant Knowledge Leaves without defining phase workflow or duplicating their rules.
_Avoid_: workflow contract, aggregate reference

**House Style Baseline**:
A compact, always-loaded reference that owns cross-guide dependency rules and mandatory technology selection while routing detailed API usage to the responsible Knowledge Leaf.
_Avoid_: pure navigation index, API manual

**Layer Guide**:
A Go House Style Knowledge Leaf that owns one stable layer's responsibilities, dependency direction, placement rules, and local code shapes.
_Avoid_: end-to-end mechanism guide

**Flow Guide**:
A Go House Style Knowledge Leaf that owns an end-to-end flow spanning layers, including the prescribed component APIs and examples, without redefining each layer's general contract.
_Avoid_: layer reference, workflow prompt

**Platform Guide**:
A Go House Style Knowledge Leaf that owns physical layout, composition, configuration, runtime lifecycle, or shutdown concerns without redefining Domain or collaboration semantics.
_Avoid_: infrastructure layer guide, business workflow

**Reference Implementation**:
A codebase that demonstrates the intended architectural direction and supplies realistic examples without making its current file-level details normative. Details become House Style only after explicit confirmation.
_Avoid_: canonical specification, incidental implementation

**Published Fact Contract**:
A versioned Integration Message contract owned by the bounded context authoritative for the fact. The producing Application may translate an internal Domain Event into its own generated Published Fact Contract and submit it through the active language's provider-neutral publisher port.
_Avoid_: shared Domain Event, broker event type

**Asynchronous Intent Contract**:
A versioned Integration Message contract owned by the bounded context that receives and decides whether to admit the requested action. A sending bounded context reaches it through a local semantic port and an Infrastructure/ACL mapping rather than importing the receiver's contract into its Application layer.
_Avoid_: sender-owned command, remote Application command

**Best-effort Domain Event Dispatch**:
The conditional Go House Style flow for a same-context, post-commit follow-up whose loss has been accepted: Application persists the Aggregate, drains its `event.Collection`, and submits the batch to the in-memory `event.Dispatcher`. Submission does not report handler completion and cannot change the already committed command result.
_Avoid_: reliable event delivery, universal Domain Event lifecycle

**Focused Aggregate Read**:
A read-only Application use case that loads exactly one Aggregate through its Domain Repository and maps a result without introducing a distinct read shape, source, freshness, authorization, composition, or performance model.
_Avoid_: product read model, universal non-CQRS shortcut

**Application Assembler**:
The pure mapping code in a bounded context's Application layer that converts existing Application DTO state to and from a Domain Entity. Its physical module follows the active language guide. It does not create a new Aggregate in place of a Domain Factory or map protocol and persistence types.
_Avoid_: Domain Factory, protocol mapper, persistence converter

**Infrastructure Converter**:
The pure mapping code in a bounded context's Infrastructure layer that converts existing persistence representations to and from Domain Entities. Its physical module follows the active language guide. It performs no business decisions, I/O, logging, or transaction control.
_Avoid_: Application Assembler, ORM Entity

**Stale Aggregate Instance**:
An Aggregate instance after successful Repository `Save`: its existing state may be read, assembled into a result, and its already-recorded Domain Events may be drained, but it cannot perform another business mutation or be saved again. Its in-memory Version is not the newly persisted concurrency token. A subsequent transaction reloads a fresh instance and event collection.
_Avoid_: unusable result, automatically refreshed Aggregate

**Application Use-case Registry**:
A protocol-neutral grouped use-case registry for one bounded context. The active language guide defines its physical module and API shape. It exposes Command Handlers through a Commands group and Query Handlers through a Queries group without implementing protocol adapters or duplicating handler methods.
_Avoid_: service locator, generated RPC service

**Internal Task Contract**:
A versioned, provider-neutral task type and payload owned by one bounded context's Application layer. Its physical module follows the active language guide. It describes internal deferred Application work and is never a cross-context collaboration contract.
_Avoid_: Integration Message, Asynq job type

**Task Processor**:
The inbound Transport adapter that decodes one Internal Task Contract, maps it to one Application Command, and maps its outcome to the active language's task-provider completion, retry, or skip contract.
_Avoid_: Application use case, scheduler callback

**Execution Completion Log**:
The single structured operational record owned by the outer Transport or Runtime execution boundary for one request, message, task, event-handler run, or lifecycle operation. It records end-to-end duration, delivery/protocol outcome, correlation identifiers, and the final unsuppressed error.
_Avoid_: per-layer completion log, business audit record

**Business Semantic Log**:
An optional Application-owned record of a business-significant decision or fact that has independent operational value. It is not emitted mechanically for every Command or Query and does not replace a Domain Event, durable audit record, metric, or trace.
_Avoid_: duplicate request completion, durable business fact

**Domain Validation**:
The single validation authority for business data represented as a Domain Entity or Value Object. Application DTOs and persistence Data Objects are converted to Domain state and validated there rather than carrying duplicate validator rules in outer layers.
_Avoid_: per-layer validation schema, transport validation model
