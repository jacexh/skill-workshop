# <Bounded Context> Architecture

<!--
The closed contract catalog of one Bounded Context. Codify adds no contract or task outside it.
Write every row to artifact-layout.md "Architecture writing". Do not list what model.md, domain-objects.md, and context-map.md already fix: Roots, Repositories, Domain Services, Domain-owned Ports, Domain Events, event handlers, Integration Message subscribers, and the Application entry.
Omit a section with no rows, except Query Repositories and Application Ports, which state "None." when empty.
-->

## Query Repositories

| Query Repository | Reads | Read needs | Store | Reason |
|---|---|---|---|---|
| <Concept>QueryRepository | <Concept> facts: <modeled facts it returns> | <Read need>; <read need> | <Storage technology> | <Why this concept needs its own read contract; a second one over the same concept names its different store or read model> |

## Application Ports

| Application Port | Authority | Covers | Adapter | Reason |
|---|---|---|---|---|
| <Authority>Port | <Context or external system> | <Capabilities in the authority's published language> | <Technology or provider> | <Context Map contract or project decision; a role Port across authorities names the Domain fact that selects the realization> |

## Inbound Sources

| Inbound Source | Authority | Receives | Reason |
|---|---|---|---|
| <Source> observer | <External system outside the Context Map> | <What arrives and what it carries> | <Project decision that makes it an input> |

## Tasks

| Task | Advances | Key | Enqueued by | Reason |
|---|---|---|---|---|
| <Task name> | <Root or object it moves forward> | <Deduplication key> | <Policy, Application, Inbound Source, or another task; or `Every <interval>, <timezone>`> | <Policy failure outcome, deferred work, or periodic work; a second task on the same object names its different worker or retry semantics> |

## Mechanisms

| Mechanism | Seam | Serves |
|---|---|---|
| <Mechanism> | <Application, a Root's Repository, a Domain-owned Port, a cataloged contract, Inbound Source or task, or `<Context> subscriber`> | <The delivery constraint or Policy failure outcome, stated in full> |
