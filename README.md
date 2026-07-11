# Skill Workshop

A dual-track [Claude Code](https://claude.ai/code) and Codex CLI plugin marketplace for productivity and development workflow extensions.

## Overview

Skill Workshop is a curated collection of plugins that enhance agentic software development workflows. Claude Code remains the primary supported track under `plugins/<name>/`; the experimental Codex CLI track lives under `codex-plugins/<name>/`. Each plugin is self-contained with its own hooks, skills, templates, and documentation.

## Claude Code Usage

### Add this marketplace to Claude Code

```bash
/plugin marketplace add jacexh/skill-workshop
```

### Install plugins

```bash
/plugin install superpowers-memory@skill-workshop
/plugin install superpowers-architect@skill-workshop
/plugin install ddd-expert@skill-workshop
/plugin install designing-tests@skill-workshop
```

### Enable auto-update

By default, third-party marketplaces do not auto-update. To automatically receive plugin updates:

**Option 1: Via UI**
```
/plugin → Marketplaces → skill-workshop → Enable auto-update
```

**Option 2: Manual update**
```bash
/plugin update --check
/plugin update superpowers-memory@skill-workshop
/plugin update --all
```

---

## Available Plugins

Current versions are declared in `.claude-plugin/marketplace.json` and each Codex plugin's `.codex-plugin/plugin.json`. The release pipeline bumps those manifests; this README intentionally avoids duplicating version numbers.

### superpowers-memory

Project Knowledge Base query, ingest, lint, and write-lock support for superpowers workflows.

- **License:** MIT
- **Claude details:** [plugins/superpowers-memory/README.md](plugins/superpowers-memory/README.md)
- **Codex details:** [codex-plugins/superpowers-memory/README.md](codex-plugins/superpowers-memory/README.md)

### superpowers-architect

Injects architectural design pattern standards as constraints into planning, execution, and code review workflows. Bundled patterns load automatically on install; customize via layered overrides (`SPA_DEFAULTS`, `SPA_GLOBAL`, project `docs/design-patterns/`). You can also invoke `$superpowers-architect:standards` explicitly when you want the same standards workflow on demand.

- **License:** MIT
- **Claude details:** [plugins/superpowers-architect/README.md](plugins/superpowers-architect/README.md)
- **Codex details:** [codex-plugins/superpowers-architect/README.md](codex-plugins/superpowers-architect/README.md)

### ddd-expert

Standalone hookless DDD/backend architecture expert skills for code agents. Provides `explore`, `shape`, `codify`, and `guard` skills for Strategic Modeling, Tactical Modeling, Model Realization, and parallel Design Realization/House-Style Conformance review, plus the shared DDD reference set. The skills use common development workflow descriptions for discovery instead of binding to another workflow plugin.

Invoke `ddd-expert` directly for DDD/backend exploration, tactical model shaping, model-to-code codification, and reviews that distinguish missing design realization from incorrect implementation. Explore first tests a story set against the accepted context topology, establishes any missing context boundaries, then projects the stories through the Context Map, closes each affected context and relationship separately, and checkpoints accepted business facts before the final Shape handoff. This is especially important when turning specs into explicit domain objects, or when touching bounded contexts, Domain/Application/Transport/Infrastructure boundaries, generated RPC/protocol code, Go/Python/TypeScript runtime and lifecycle wiring, taskqueue/message behavior, database persistence, or backend logging.

- **License:** MIT
- **Claude details:** [plugins/ddd-expert/README.md](plugins/ddd-expert/README.md)
- **Codex details:** [codex-plugins/ddd-expert/README.md](codex-plugins/ddd-expert/README.md)

### designing-tests

Evidence-first verification guidance for choosing tests, checks, dry-runs,
smoke validation, and residual-risk reporting from intent and observable risk.
Includes architecture-aware evidence design, integration quality, and hand-off
evidence gates.

- **License:** MIT
- **Claude details:** [plugins/designing-tests/README.md](plugins/designing-tests/README.md)
- **Codex details:** [codex-plugins/designing-tests/README.md](codex-plugins/designing-tests/README.md)

---

## Repository Structure

```
.
├── .claude-plugin/
│   └── marketplace.json          # Claude Code marketplace catalog
├── .agents/
│   └── plugins/
│       └── marketplace.json      # Codex marketplace catalog
├── plugins/
│   ├── superpowers-memory/       # Claude track: project knowledge persistence
│   ├── superpowers-architect/    # Architectural design patterns
│   ├── ddd-expert/               # Standalone DDD/backend skills
│   └── designing-tests/          # Test design guidance
├── codex-plugins/
│   ├── superpowers-memory/       # Codex track: project knowledge persistence
│   ├── superpowers-architect/    # Codex track: architectural design patterns
│   ├── ddd-expert/               # Codex track: standalone DDD/backend skills
│   └── designing-tests/          # Codex track: test design guidance
├── CONTEXT.md                    # Project glossary
├── docs/
│   └── agents/                   # Agent workflow configuration
│       ├── issue-tracker.md
│       ├── triage-labels.md
│       └── domain.md
├── scripts/
│   └── release/                  # Release automation and tests
└── .github/
    └── workflows/
        └── auto-release.yml      # PR-merge release workflow
```

## Contributing

### Adding or changing plugins

1. For Claude Code support, create or update `plugins/<plugin-name>/`, add `.claude-plugin/plugin.json`, and update `.claude-plugin/marketplace.json`.
2. For Codex support, create or update `codex-plugins/<plugin-name>/`, add `.codex-plugin/plugin.json`, add native hooks under `hooks/hooks.json` when needed, and update `.agents/plugins/marketplace.json`.
3. For cross-plugin or release/distribution changes, create or update GitHub issues/specs/tickets using `docs/agents/issue-tracker.md`; record ADRs under `docs/adr/` only for long-lived repo or release decisions.
4. Keep same-named Claude Code and Codex plugin tracks semantically aligned unless the difference is intentionally host-specific.

### README synchronization rule

When any plugin README under `plugins/<name>/README.md` or `codex-plugins/<name>/README.md` changes, review the root `README.md` in the same change. Update it when install flow, capabilities, marketplace schema, hook behavior, repository structure, release flow, or cross-track support changed. If no root README update is needed, state that explicitly in the PR or change summary.

### Plugin structure requirements

Each plugin must follow the [Claude Code plugin format](https://docs.anthropic.com/en/docs/claude-code/plugins):

```
plugins/<plugin-name>/
├── .claude-plugin/
│   └── plugin.json           # Required: plugin manifest
├── hooks/                    # Optional: Claude Code hooks
├── skills/                   # Optional: skill definitions
└── ...                       # Plugin-specific files
```

Codex plugins follow the native Codex plugin layout:

```
codex-plugins/<plugin-name>/
├── .codex-plugin/
│   └── plugin.json           # Required: Codex plugin manifest
├── hooks/
│   └── hooks.json            # Optional: native lifecycle hook config
├── skills/                   # Optional: skill definitions
└── ...                       # Plugin-specific files
```

## Codex Marketplace (Experimental)

This repository also publishes Codex-compatible variants of the plugins under `codex-plugins/`. The Codex marketplace catalog lives at `.agents/plugins/marketplace.json` (object-form `source` + `policy` + `category`, distinct from Claude's `.claude-plugin/marketplace.json` schema).

```bash
codex plugin marketplace add jacexh/skill-workshop
```

Enable plugin hooks in `~/.codex/config.toml`:

```toml
[features]
hooks = true
plugin_hooks = true
```

Install the Codex plugins you need:

```bash
codex plugin add superpowers-memory@skill-workshop-codex
codex plugin add superpowers-architect@skill-workshop-codex
codex plugin add ddd-expert@skill-workshop-codex
codex plugin add designing-tests@skill-workshop-codex
```

Restart Codex. Current Codex versions load plugin lifecycle hooks from each plugin's `.codex-plugin/plugin.json` and `hooks/hooks.json`; users do not run setup skills after install or upgrade. If you previously used setup-era fallback hooks, remove stale entries from `~/.codex/hooks.json` using the relevant plugin README. If hooks do not appear after restart, open `/hooks` to review and trust plugin hooks, confirm both feature flags are enabled, and upgrade Codex if needed.

Upgrade the Codex marketplace with:

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

Each plugin has its own README under `codex-plugins/<name>/README.md` with capabilities, upgrade flow, stale fallback-hook cleanup guidance, and known protocol gaps relative to the Claude Code variant.

The Claude Code variants under `plugins/` and the marketplace at `.claude-plugin/marketplace.json` are unchanged and remain the primary supported track.

## Releases

This repo uses an automated release pipeline triggered when a pull request merges into `main`. The pipeline:

1. Computes the next version (`vX.Y.Z`) by reading the latest `v*` tag and bumping based on the **PR source branch prefix**:

   | Prefix (`/` or `-` separator) | Bump |
   |---|---|
   | `release/...` | minor |
   | `breaking/...`, `major/...` | major |
   | `fix/`, `hotfix/`, `bugfix/`, `feat/`, `feature/`, anything else | patch |

2. Detects which plugins changed under `plugins/<name>/` and `codex-plugins/<name>/`. Same-named Claude Code and Codex plugin tracks are synchronized: changing either track bumps both manifests when both tracks exist.
3. Bumps the matching `version` fields in `marketplace.json`, each affected `plugin.json`, and Codex hook snippets when present. The marketplace's `metadata.version` always advances.
4. Commits the bump as `github-actions[bot]`, tags the new commit `vX.Y.Z`, and publishes a GitHub Release with auto-generated notes.

> **Tag naming convention:** only `vX.Y.Z` semver tags should ever be created in this repo. Other tag patterns will confuse the auto-release pipeline's "latest tag" lookup.

The pipeline lives in `.github/workflows/auto-release.yml` and delegates its core logic to `scripts/release/*.sh` (each independently unit-tested via `scripts/release/test/run-tests.sh`).

## License

Plugins in this marketplace are individually licensed. See each plugin's `plugin.json` for license information.

---

*This marketplace is maintained by [xuhao](https://github.com/jacexh).*
