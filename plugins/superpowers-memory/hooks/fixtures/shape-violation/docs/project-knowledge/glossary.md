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

**Server** — HTTP entrypoint. → `cmd/server/`
