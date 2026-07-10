# ddd-expert uses progressive reference knowledge leaves

The ddd-expert plugin separates phase execution from reusable knowledge. The four SKILL files own workflow, acceptance, return routing, and output contracts. References own DDD concepts, house rules, verified technology guidance, and concise navigation. This prevents every phase from loading implementation material and prevents reference files from becoming a second workflow contract.

The canonical common leaves are ddd-modeling, ddd-core, and ddd-collaboration, with database as the single Persistence House Style. The Go baseline routes to Layer Guides for Domain, Application, Transport, and Infrastructure; Flow Guides for CQRS, events/messages, and taskqueue; and Platform Guides for scaffold and Runtime. Files remain flat under references, and the Claude and Codex plugin tracks stay mirrored. Python and TypeScript remain language leaves outside the current content refresh.

House Rules are conditional on their stated concern but mandatory once applicable. Design-changing mechanisms require an accepted decision; covered implementation concerns use the prescribed stack. Concrete code and SQL examples stay with the leaf that owns the rule, while evaluation fixtures and phase checklists stay outside references.

The former ddd-agent-contract and ddd-modeling-gates files are retired. Useful modeling probes move into ddd-modeling; SKILL navigation points directly to the smallest relevant leaf. README inventory, link checks, mirror checks, focused contract assertions, and external eval cases protect this architecture without pinning whole paragraphs or line counts.
