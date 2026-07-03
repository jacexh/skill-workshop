---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Glossary

**MessageBus** — A component that routes messages.
It has method `Publish(ctx, msg)` which takes a context and message.
It also has method `Subscribe(ctx) (<-chan Msg, error)` returning a channel.
Used across multiple modules in the dispatcher context for event propagation.

**Dispatcher Service** — A long single-line entry that packs far too much semantic content into what is supposed to be a two-line glossary term. It describes the service boundary, the subservices it hosts, the ports it owns, the external dependencies, the event names it publishes, the infrastructure it requires, the multi-instance routing strategy, the ownership directory key format, the peer forwarding headers, and a half-dozen other facts — all of which would belong in architecture.md or an ADR, never in a term dictionary entry meant to be scanned at a glance by a reader who just needs to recognize the word.

**Server** — HTTP entrypoint. → `cmd/server/`
