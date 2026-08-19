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
Conditional backend implementation conventions for realizing an already accepted domain model. House Style does not select business concepts, object ownership, lifecycle, transactions, concurrency, recovery, or runtime commitments.
_Avoid_: universal architecture, modeling authority

**Conditional House Rule**:
A House Style rule with an explicit applicability condition. It is not applied outside that condition; once applicable, its prescribed library and implementation shape are mandatory rather than one option among alternatives.
_Avoid_: preferred default, optional recommendation

**Implementation Upgrade**:
An LLM-selected move to a prescribed House Style mechanism when observed complexity warrants it and the move does not change accepted business meaning, boundaries, consistency, durability, or runtime commitments.
_Avoid_: automatic threshold rule, tactical redesign

**Aggregate Capability**:
An intention-revealing business operation owned by one Aggregate Root. It states the authoritative facts, successful guarantee, and stable rejection without prescribing a signature or exact method count.
_Avoid_: state-qualified scenario branch, CRUD operation, method signature, application workflow

**Business Role**:
A participant whose business decision rights are defined in one Bounded Context. EventStorming identifies the Role and its Commands without equating it to an IAM identity.
_Avoid_: generic Actor, IAM principal, transport identity

**Event-triggered Command**:
A Bounded Context-local business intent required by an established Domain Event or Published Fact Contract. Dispatch and delivery mechanisms are not part of this meaning.
_Avoid_: event handler wiring, automatic callback, transport subscription

**Workshop Event**:
A material past-tense business occurrence used during EventStorming discussion. It remains analytical conversation and does not by itself become a production Domain Event or permanent artifact.
_Avoid_: automatic Domain Event, meeting record

**Integrated Strategic Confirmation**:
The user's explicit acceptance of the compact whole containing scope, Bounded Contexts, Aggregate Roots, strategic business rules, semantic dependencies, and visible uncertainty. It authorizes current strategic artifact updates.
_Avoid_: local answer, partial model approval

**Strategic Model**:
The accepted current explanation of one Bounded Context: its purpose, essential language, Aggregate Roots, and strategic business rules. It excludes Entity details and implementation mechanisms.
_Avoid_: meeting minutes, object catalogue, call graph

**Strategic Business Rule**:
One independently challengeable claim naming a governed business concept or collaboration, any material condition, and an accepted business decision, permission, transition, required outcome, or invariant. It supplies downstream business authority without assigning tactical behavior ownership or prescribing an implementation mechanism.
_Avoid_: vague principle, object responsibility, technical mechanism

**Aggregate Root**:
The externally addressed owner of one immediate consistency boundary. It composes owned Entities and protects the state and rules that must remain valid together.
_Avoid_: service class, table group, feature folder

**Domain Object Slice**:
One confirmed Aggregate Root section in `domain-objects.md`, containing the Root and its owned Entities. Each object records only definition, state, behavior, and actual Domain Events.
_Avoid_: UML, sequence document, implementation plan

**Pressure-led Tactical Design**:
The interview order that completes one Aggregate Root at a time by following its smallest affected business-pressure slice. It expresses essential complexity as pressures traceable to Business Rules, probes candidate behavior ownership, and compares credible object compositions by pressure coverage and accidental design burden. Questions are asked one at a time with a recommended answer and a credible alternative.
_Avoid_: Entity checklist, untraceable scenario, batch questionnaire

**Per-Root Confirmation**:
The user's acceptance of one complete Aggregate Root slice after its object composition and descriptions have been challenged. That slice may be written immediately without waiting for other Roots.
_Avoid_: whole-context write barrier, incremental unconfirmed write

**Behavior Description**:
A concise domain sentence whose subject, action, object, and result expose the concepts involved in one behavior. During design, varying the subject tests credible behavior owners; in the accepted design, the grammatical subject is the owning Root or Entity and normally maps to a method on that object.
_Avoid_: responsibility heading, method signature, caller list

**Actual Domain Event**:
A selected local domain fact that production code must emit or consume for a named reaction or as durable evidence of the occurrence. It is recorded with the object behavior that establishes or consumes it.
_Avoid_: Workshop Event, provider notification, log entry

**Semantic Dependency**:
A one-way `Upstream -> Downstream` Context Map relationship: the upstream owns a named published meaning that influences the downstream model. It is not runtime call direction.
_Avoid_: request arrow, mutual ownership

**Modeling Contradiction**:
Concrete implementation or business evidence that conflicts with accepted strategic or domain-object authority. Codify stops; strategic conflicts are decided through EventStorming and object conflicts through Tactical Design before implementation resumes.
_Avoid_: silent design edit, implementation convenience

**Guard Review Unit**:
One independently falsifiable accepted semantic responsibility and the minimum production evidence needed to judge its realization. Guard keeps it read-only and reports `clear`, `violation`, or `evidence_gap`.
_Avoid_: file checklist, general bug hunt

**Persistence House Style**:
The part of House Style governing storage representation and operations across Aggregate persistence, read models, integration state, SQL, and schema evolution. It is an Infrastructure concern related to, but not owned by, the Domain Repository abstraction.
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
A versioned Integration Message contract owned by the Bounded Context authoritative for the fact. The producing Application may translate an internal Domain Event into its own generated Published Fact Contract and submit it through the active language's provider-neutral publisher port.
_Avoid_: shared Domain Event, broker event type

**Asynchronous Intent Contract**:
A versioned Integration Message contract owned by the Bounded Context that receives and decides whether to admit the requested action. A sender reaches it through a local semantic port and Infrastructure translation rather than importing the receiver's internal model.
_Avoid_: sender-owned command, remote Application command

**Best-effort Domain Event Dispatch**:
The conditional Go House Style flow for a same-context, post-commit follow-up whose loss has been accepted: Application persists the Aggregate, drains its `event.Collection`, and submits the batch to the in-memory `event.Dispatcher`. Submission cannot change the already committed command result.
_Avoid_: reliable event delivery, universal Domain Event lifecycle

**Focused Aggregate Read**:
A read-only Application use case that loads exactly one Aggregate through its Domain Repository and maps a result without introducing a distinct read shape, source, freshness, authorization, composition, or performance model.
_Avoid_: product read model, universal non-CQRS shortcut

**Application Assembler**:
Pure Application mapping code that converts existing Application DTO state to and from a Domain Entity. It does not create a new Aggregate in place of a Domain Factory or map protocol and persistence types.
_Avoid_: Domain Factory, protocol mapper, persistence converter

**Infrastructure Converter**:
Pure Infrastructure mapping code that converts persistence representations to and from Domain Entities. It performs no business decisions, I/O, logging, or transaction control.
_Avoid_: Application Assembler, ORM Entity

**Stale Aggregate Instance**:
In the request-scoped optimistic lifecycle only, an Aggregate instance after successful Repository `Save`: its existing state may be read and already-recorded Domain Events may be drained, but it cannot perform another business mutation or be saved again. A resident Aggregate with checkpoint persistence is outside this term.
_Avoid_: universal post-save rule, unusable result, automatically refreshed Aggregate

**Application Use-case Registry**:
A protocol-neutral grouped use-case registry for one Bounded Context. It exposes Command Handlers through a Commands group and Query Handlers through a Queries group without implementing protocol adapters or duplicating handler methods.
_Avoid_: service locator, generated RPC service

**Internal Task Contract**:
A versioned, provider-neutral task type and payload owned by one Bounded Context's Application layer. It describes internal deferred Application work and is never a cross-context collaboration contract.
_Avoid_: Integration Message, Asynq job type

**Task Processor**:
The inbound Transport adapter that decodes one Internal Task Contract, maps it to one Application Command, and maps its outcome to the task provider's completion, retry, or skip contract.
_Avoid_: Application use case, scheduler callback

**Execution Completion Log**:
The single structured operational record owned by the outer Transport or Runtime execution boundary for one request, message, task, event-handler run, or lifecycle operation.
_Avoid_: per-layer completion log, business audit record

**Business Semantic Log**:
An optional Application-owned record of a business-significant decision or fact that has independent operational value. It does not replace a Domain Event, durable audit record, metric, or trace.
_Avoid_: duplicate request completion, durable business fact

**Domain Validation**:
The single validation authority for business data represented as a Domain Entity or Value Object. Application DTOs and persistence Data Objects are converted to Domain state and validated there rather than carrying duplicate validator rules in outer layers.
_Avoid_: per-layer validation schema, transport validation model
