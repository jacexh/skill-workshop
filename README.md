# Skill Workshop

A [Claude Code](https://claude.ai/code) plugin marketplace for productivity and development workflow extensions.

## Overview

Skill Workshop is a curated collection of plugins that enhance Claude Code's capabilities for software development workflows. Each plugin is self-contained under `plugins/<name>/` with its own hooks, skills, templates, and documentation.

## Usage

### Add this marketplace to Claude Code

```bash
/plugin marketplace add jacexh/skill-workshop
```

### Install plugins

```bash
/plugin install superpowers-memory@skill-workshop
/plugin install superpowers-architect@skill-workshop
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

### superpowers-memory

Project knowledge persistence and plan checkpoint tracking for superpowers workflows.

- **Version:** 1.5.5
- **License:** MIT
- **Details:** [plugins/superpowers-memory/README.md](plugins/superpowers-memory/README.md)

### superpowers-architect

Injects architectural design pattern standards as hard constraints into planning, execution, and code review workflows. Bundled patterns load automatically on install; customize via three-layer override (`SPA_DEFAULTS`, `SPA_GLOBAL`, project `docs/design-patterns/`).

- **Version:** 1.5.6
- **License:** MIT
- **Details:** [plugins/superpowers-architect/README.md](plugins/superpowers-architect/README.md)

### designing-tests

Risk-driven test design guidance for choosing the right boundary, coverage, and regression-protective test cases.

- **Version:** 1.5.7
- **License:** MIT
- **Details:** [plugins/designing-tests/README.md](plugins/designing-tests/README.md)

---

## Repository Structure

```
.
├── .claude-plugin/
│   └── marketplace.json          # Marketplace catalog definition
├── plugins/
│   ├── superpowers-memory/       # Project knowledge persistence
│   ├── superpowers-architect/    # Architectural design patterns
│   └── designing-tests/          # Test design guidance
└── docs/
    └── superpowers/
        ├── specs/                # Plugin design specifications
        └── plans/                # Implementation plans
```

## Contributing

### Adding a new plugin

1. Create a new directory under `plugins/<plugin-name>/`
2. Add `.claude-plugin/plugin.json` with plugin metadata
3. Update `.claude-plugin/marketplace.json` to include the new plugin
4. Add design specs and implementation plans under `docs/superpowers/`

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

## Codex Marketplace (Experimental)

This repository also publishes Codex-compatible variants of the three plugins under `codex-plugins/`. The Codex marketplace catalog lives at `.agents/plugins/marketplace.json` (object-form `source` + `policy` + `category`, distinct from Claude's `.claude-plugin/marketplace.json` schema).

```bash
codex plugin marketplace add jacexh/skill-workshop
```

Then in Codex, register each plugin's hooks into `~/.codex/hooks.json`:

```
$superpowers-memory:setup
$superpowers-architect:setup
$designing-tests:setup
```

Restart Codex. Each plugin has its own README under `codex-plugins/<name>/README.md` with capabilities, upgrade flow, and known protocol gaps relative to the Claude Code variant.

The Claude Code variants under `plugins/` and the marketplace at `.claude-plugin/marketplace.json` are unchanged and remain the primary supported track.

## Releases

This repo uses an automated release pipeline triggered when a pull request merges into `main`. The pipeline:

1. Computes the next version (`vX.Y.Z`) by reading the latest `v*` tag and bumping based on the **PR source branch prefix**:

   | Prefix (`/` or `-` separator) | Bump |
   |---|---|
   | `release/...` | minor |
   | `breaking/...`, `major/...` | major |
   | `fix/`, `hotfix/`, `bugfix/`, `feat/`, `feature/`, anything else | patch |

2. Detects which plugins changed under `plugins/<name>/` and `codex-plugins/<name>/` (the two tracks are **independent** — same-named plugins on both sides may have divergent versions).
3. Bumps the matching `version` fields in `marketplace.json` and each affected `plugin.json`. The marketplace's `metadata.version` always advances.
4. Commits the bump as `github-actions[bot]`, tags the new commit `vX.Y.Z`, and publishes a GitHub Release with auto-generated notes.

> **Tag naming convention:** only `vX.Y.Z` semver tags should ever be created in this repo. Other tag patterns will confuse the auto-release pipeline's "latest tag" lookup.

The pipeline lives in `.github/workflows/auto-release.yml` and delegates its core logic to `scripts/release/*.sh` (each independently unit-tested via `scripts/release/test/run-tests.sh`).

## License

Plugins in this marketplace are individually licensed. See each plugin's `plugin.json` for license information.

---

*This marketplace is maintained by [xuhao](https://github.com/jacexh).*
