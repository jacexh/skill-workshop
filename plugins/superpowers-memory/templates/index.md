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
     For high-value bounded contexts, services, major modules, product capabilities,
     or cross-service flows, name the owner file/shard that directly answers
     responsibility, layers/components, interactions, key state/flow rules, and source refs. -->

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: [1-2 facts that help AI decide whether to load this file in full.
               Good: "Orchestrator layering in architecture-orchestrator.md; billing flow sequence here"
               Bad: "system architecture information"]

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: [1-2 decision-relevant facts.
               Good: "Go 1.25 + React 19 + K8s"
               Bad: verbose summaries]

- [features.md](features.md) — Implemented features, in-progress work, roadmap
  Key points: [1-2 facts. Good: "Issue-bound Work references architecture-orchestrator.md"]

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: [1-2 facts. Good: "domain zero deps; gofmt + golangci-lint"]

- [decisions.md](decisions.md) — ADR log (normal + CRITICAL), known issues
  Key points: [1-2 facts. Good: "17 ADRs, 3 CRITICAL"]

- [glossary.md](glossary.md) — Domain terminology (Ubiquitous Language)
  Key points: [1-2 facts. Good: "12 domain terms across 4 contexts"]

<!-- Include split shard files ONLY when they exist and help route retrieval.
     Use stable slot-domain names, e.g. architecture-runtime.md,
     features-admin.md, conventions-testing.md. Omit placeholders. -->

- [architecture-<domain>.md](architecture-<domain>.md) — Focused architecture detail
  Key points: [1-2 facts that distinguish when to load this shard.
               Good: "Orchestrator responsibility, internal layers, upstream/downstream events, source refs"]
