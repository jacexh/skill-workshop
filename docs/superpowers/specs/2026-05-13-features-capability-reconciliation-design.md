---
date: 2026-05-13
status: accepted
---

# Features Capability Reconciliation Design

## Context

`features.md` is meant to be the current capability map. In practice, update/rebuild runs can produce technically accurate summaries that under-represent the product capabilities named in PRDs, roadmaps, and specs. The Talgent `0515.md` roadmap shows this failure mode: the source requirement names Issue-bound Work, Plugin Marketplace, Attachment/Artifact ownership, queue confirmation, auto reclaim, Project Dashboard, and SCM Port boundaries, but the generated capability map can drift toward runtime components and implementation paths.

## Decision

Strengthen `superpowers-memory` so `features.md` is treated as a product/system capability map, not a technical-component inventory.

The update and rebuild skills will include a Feature Capability Reconciliation step:

1. Extract capability candidates from PRDs, roadmaps, specs, plans, README, and user-facing entry points.
2. Classify each candidate into `Implemented`, `In Progress`, `Planned`, or “not a feature entry”.
3. Preserve product-facing constraints that shape use of the capability.
4. Route wiring, rationale, dependencies, and term definitions to their owner files.
5. Check that implemented capability entries use the fixed fields: `Enables`, `Actors / Entry Points`, `Capability Boundary`, and `References`.

The verify runtime will add a shape check for implemented capability entries missing required fixed fields. This is intentionally structural, not a semantic AI validator; semantic source-to-feature reconciliation belongs in the skills.

Size warnings should not pressure agents to delete valid product capability coverage. `features.md` gets a substantially larger cap because fixed-field capability entries are intentionally line-heavy. `architecture.md` also gets more room for scenario diagrams and cross-module structure. Other files remain more constrained because they should stay summary-like or on-demand.

Implemented capabilities should be organized by reader value, not implementation component. The canonical order is `Product Capabilities`, `User / Operator Workflows`, `Platform Capabilities`, then `Operations`. If a capability can be named in stable product language, it belongs in the product group before any workflow or platform group is considered.

## Scope

- Update Claude and Codex `superpowers-memory` content rules, update skill, rebuild skill, and feature template.
- Update Claude and Codex verify runtimes with the same fixed-field lint.
- Add fixture-based regression coverage.

## Non-Goals

- No hard commit block for missing product capabilities.
- No NLP/LLM semantic checker inside the Node hook runtime.
- No rewrite of existing project KB files in this repository or in Talgent.
