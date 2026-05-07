---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

<!-- OWNER: Current capabilities of the system — what it can DO now.
     This is the human-readable capability map. Structure (how modules are wired)
     lives in architecture.md; rationale lives in decisions.md + adr/.

     STRUCTURE:
     - ## = capability lifecycle state: Implemented / In Progress / Planned
     - ### = reader-facing capability group
     - #### = individual capability
     - Use fixed fields under each implemented capability:
       Enables / Actors or Entry Points / Capability Boundary / References.

     Do NOT write evolution history here (that lives in decisions.md supersede chains).
     Do NOT write delivery timestamps (those live in docs/superpowers/plans/).
     Do NOT write long single-paragraph capability entries; split into fields.

     EXCLUSIONS (strict — checked by `verify contentShapeLint`):
     - Commit SHAs or commit ranges (e.g., abc1234, bfb1dc1..HEAD)
     - Test counts (e.g., "18 unit tests", "3 integration tests")
     - Scope-boundary blocks ("Not in scope: ...")
     - Per-iteration changelog narrative
     - "Shipped 2026-MM-DD" dates — put in plan filename reference only

     INCLUDE:
     - Externally meaningful current capability
     - Actors, entry points, routes, services, or code paths
     - Capability boundary and use-shaping constraints
     - Pointers to owner files for architecture, ADRs, tech, conventions, glossary -->

# Features

## Implemented

<!-- Group capabilities by reader mental model. Prefer business capability / bounded-context
     language for product groups. Technical platform groups are allowed, but must not be
     presented as business bounded contexts.

### Product Capabilities

#### [Capability Name]

**Enables** — [1-2 sentences: what the system can do now from a user/system perspective.]

**Actors / Entry Points** — [users, services, routes, RPCs, CLIs, or code paths.]

**Capability Boundary** — [what this capability covers; point structural detail to architecture.md.]

**References** — [architecture section, ADRs, specs/plans if useful.]

### Platform Capabilities

#### [Capability Name]

**Enables** — [1-2 sentences.]

**Actors / Entry Points** — [entry points.]

**Capability Boundary** — [externally meaningful boundary.]

**References** — [owner-file pointers.]

## In Progress

<!-- Capabilities currently being built. Remove once they land in Implemented.

### [Capability Group]

#### [Capability Name]

**Intent** — [1 sentence.]
**Source** — [plan/spec pointer.] -->

## Planned

<!-- Capabilities with a spec but not yet started.

### [Capability Group]

#### [Capability Name]

**Intent** — [1 sentence.]
**Source** — [spec pointer.] -->
