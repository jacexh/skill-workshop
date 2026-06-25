---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

<!-- OWNER: Domain term definitions and alias routing (Ubiquitous Language).
     Bounded Context names and aggregate root names APPEAR in architecture.md as component identifiers;
     their BUSINESS MEANING DEFINITIONS belong here.

     PER-ENTRY FORMAT (hard rule):
       **Term** — one-line business definition. → `path/to/code` (ADR-NNN if applicable)

     ≤2 LINES PER ENTRY. If more context is needed, link to architecture.md or
     decisions.md. Do NOT expand the definition inline — the glossary stays a dictionary.

     DELETED-TERM TOMBSTONE (when a term is removed or renamed):
       **Term** — DELETED (ADR-NNN). Replaced by [NewTerm].

     ROOT GLOSSARY ROLE:
     Keep root glossary.md as an alias router for cross-context, ambiguous,
     renamed, or high-risk terms. Move domain-local term clusters into
     `glossary-<domain>.md` shards such as `glossary-runtime.md`.

     INCLUDE terms where:
     - The same word means different things in different Bounded Contexts
     - Business meaning is not obvious from the code name
     - The term maps to a specific code construct (type, interface, module)
     - The term is an alias/tombstone needed to route query to the current owner

     DO NOT include:
     - Standard technical terms (REST, gRPC, JWT, WebSocket, etc.)
     - Terms used only within a single module
     - Struct field lists, enum value catalogs, method signatures (all Exclusion List)
     - Lifecycle/state/invariant explanations; route those to architecture owners

     TARGET: ≤80 lines. -->

<!-- Reference Query Coverage:
     - Can query answer what the term means and who owns it?
     - Does each current term include `→ path` or ADR routing unless it is a
       deleted-term tombstone?
     - Are large domain-local term sets split into reachable `glossary-<domain>.md`
       shards instead of making root glossary.md a default context dump?
     - If the definition needs more than two lines, move the context to the owner
       file and keep only a pointer here. -->

# Glossary

## Term Shards

<!-- Optional. Link domain term shards when they exist.
     Format:
     - [glossary-runtime.md](glossary-runtime.md) — Runtime, sandbox, executor, and delivery aliases.
-->

**TermName** — One-line business definition. → `path/to/code` (ADR-NNN)

**DeletedTerm** — DELETED (ADR-NNN). Replaced by [NewTerm].
