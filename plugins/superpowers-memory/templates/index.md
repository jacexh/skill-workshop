---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
covers_branch: <branch>@<short-sha>
---

# Project Knowledge Index

<!-- Keep this file compact. It routes query to owner files, shards, and high-value project objects.
     Include aliases only when user-facing vocabulary differs from implementation vocabulary.
     Do not move owner-file detail into this hot path.

     SLOT CONTRACT:
     - Owner: hot-path routing only.
     - Required shape: ≤50 lines; each file/shard has one-line description plus 1-2 Key points.
     - Conditional shape: include real shards only when they exist and improve routing.
     - Shard rule: index.md never shards.
     - Must not include: expanded owner facts, changelog narrative, copied long summaries, or placeholder shard routes.
     - Verify coverage: index_too_large, stale refs, shard routing, retrieval cost.

     For high-value bounded contexts, services, major modules, product capabilities,
     or cross-service flows, name the owner file/shard that directly answers
     responsibility, layers/components, interactions, key state/flow rules, and source refs. -->

- [architecture.md](architecture.md) — System topology, service cards, data/message flows
  Key points: [1-2 facts that help AI decide whether to load this file in full.
               Good: "System topology here; Orchestrator internals in architecture-orchestrator.md; Portal-to-Executor chain in architecture-runtime-message-chain.md"
               Bad: "system architecture information"]

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: [1-2 decision-relevant facts.
               Good: "Go 1.25 + React 19 + K8s"
               Bad: verbose summaries]

- [features.md](features.md) — Implemented features, in-progress work, roadmap
  Key points: [1-2 facts. Good: "Issue-bound Work references architecture-orchestrator.md"]

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: [1-2 facts. Good: "domain zero deps; gofmt + golangci-lint"]

- [decisions.md](decisions.md) — Decision index / ADR summaries
  Key points: [1-2 facts. Good: "routes to decisions-runtime.md and ADR detail files"]

- [glossary.md](glossary.md) — Domain terminology (Ubiquitous Language)
  Key points: [1-2 facts. Good: "12 domain terms across 4 contexts"]

<!-- Include split shard files ONLY when they exist and help route retrieval.
     Use stable slot-domain names. For architecture, prefer module-first and
     named scenario shards, e.g. architecture-orchestrator.md,
     architecture-runtime-message-chain.md, features-admin.md,
     conventions-testing.md. Omit placeholders. -->

- [architecture-<module>.md](architecture-<module>.md) — Focused module/service architecture
  Key points: [1-2 facts that distinguish when to load this shard.
               Good: "Orchestrator responsibility, internal layers, upstream/downstream events, lifecycle rules, source refs"]

- [architecture-<scenario>.md](architecture-<scenario>.md) — Focused cross-service scenario architecture
  Key points: [1-2 facts that distinguish when to load this shard.
               Good: "Portal-to-Executor runtime message chain phases, participants, authority boundaries, ordering rules, source refs"]
