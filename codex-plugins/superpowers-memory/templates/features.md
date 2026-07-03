---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

<!-- OWNER: Current capabilities of the system — what it can DO now.
     This is the human-readable capability map. Structure (how modules are wired)
     lives in architecture.md; rationale lives in decisions.md + adr/.

     SLOT CONTRACT:
     - Owner: current capabilities, actors/entry points, capability boundaries, and owner-file references.
     - Required shape: Implemented / In Progress / Planned; implemented entries use Enables, Actors / Entry Points, Capability Boundary, References.
     - Conditional shape: non-trivial products should include product capabilities and user/operator workflows, not only platform mechanisms.
     - Shard rule: split by stable product/platform/operations domain when valid capability content becomes hard to scan.
     - Must not include: commit SHAs, test counts, shipped dates, changelog narrative, detailed wiring, FSMs, schemas, or implementation constants.
     - Verify coverage: feature_missing_field, feature_entry_too_dense, readiness warnings, feature coverage gaps.

     PRODUCT-SOURCE RULE:
     - Treat PRD / roadmap / spec / plan user goals, business objects, actions,
       and use-shaping constraints as capability candidates before summarizing
       implementation paths.
     - Keep stable product language for product-facing capabilities.
     - Do not let runtime components replace product capabilities.

     STRUCTURE:
     - ## = capability lifecycle state: Implemented / In Progress / Planned
     - ### = reader-facing capability group
     - #### = individual capability
     - Use fixed fields under each implemented capability:
       `Enables` / `Actors / Entry Points` / `Capability Boundary` / `References`.

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
     - Pointers to owner files for architecture, ADRs, tech, conventions, glossary
     - For high-value objects or flows, point to the architecture owner/shard
       that carries responsibility, layers/components, interactions, state/flow rules, and source refs.

     Feature Query Coverage:
     - Can query answer "what can users/operators do now?"
     - Can query answer at least one end-to-end user workflow when the product has
       multiple capabilities or platform/operations entries?
     - Can query name entry points, capability boundaries, and the owner files
       that validate each high-value capability? -->

# Features

## Implemented

<!-- Each implemented capability should include stable References.
     Use See:/Related: pointers for cross-owner relationships instead of duplicating architecture, decision, or glossary content.
     When a capability depends on a high-value object or cross-service flow, References should name the architecture owner/shard that answers structural query questions. -->

<!-- Group implemented capabilities in this order when content exists:
     1. Product Capabilities
     2. User / Operator Workflows
     3. Platform Capabilities
     4. Operations

     If a capability can be described in stable product language, put it under
     Product Capabilities before considering workflow or platform groups.

### Product Capabilities

#### [Capability Name]

**Enables** — [1-2 sentences: what the system can do now from a user/system perspective.]

**Actors / Entry Points** — [users, services, routes, RPCs, CLIs, or code paths.]

**Capability Boundary** — [what this capability covers; point structural detail to architecture.md.]

**References** — [architecture owner/shard for core objects or flows, ADRs, specs/plans if useful.]

### User / Operator Workflows

#### [Workflow Capability Name]

**Enables** — [1-2 sentences: what cross-capability workflow users/operators can complete.]

**Actors / Entry Points** — [users/operators and the routes, CLIs, jobs, or services they use.]

**Capability Boundary** — [what the workflow covers; point sequencing detail to architecture.md.]

**References** — [owner-file pointers, including architecture owner/shard for core flow sequencing.]

### Platform Capabilities

#### [Capability Name]

**Enables** — [1-2 sentences.]

**Actors / Entry Points** — [entry points.]

**Capability Boundary** — [externally meaningful boundary.]

**References** — [owner-file pointers, including architecture owner/shard for core platform object structure.]

### Operations

#### [Operational Capability Name]

**Enables** — [1-2 sentences: what deployment/configuration/CI/test operation is supported.]

**Actors / Entry Points** — [operators, maintainers, CI, deployment scripts, or service entry points.]

**Capability Boundary** — [operational boundary; point toolchain detail to tech-stack.md or conventions.md.]

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
