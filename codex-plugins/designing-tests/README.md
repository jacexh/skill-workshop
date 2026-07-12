# designing-tests (Codex)

Hookless, on-demand guidance for choosing verification evidence and designing
regression-protective tests at the right production boundary.

## Installation

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin add designing-tests@skill-workshop-codex
```

Restart Codex so the installed skill is discovered.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

Restart Codex after the marketplace upgrade.

## Capabilities

- **`designing-tests` skill** — Intent / Risk / Evidence selection followed by
  Oracle / Seam / Control / Proof when a test is justified
- **Architecture reference** — turns design goals and sequence phases into
  traceable evidence or residual risk
- **Integration reference** — protects database, transport, contract, and
  production-wiring fidelity
- **Hand-off reference** — distinguishes executed tests and checks from skipped,
  unavailable, or residual risk

The plugin installs no lifecycle hooks and does not inject guidance into other
workflows. Invoke `$designing-tests:designing-tests` explicitly or let its skill
description match test-design work.

If an older installation left a fallback command in `~/.codex/hooks.json` that
points to a deleted designing-tests runtime, remove that entry manually once.
