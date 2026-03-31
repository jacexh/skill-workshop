# Skill Workshop

A [Claude Code](https://claude.ai/code) plugin marketplace for productivity and development workflow extensions.

## Overview

Skill Workshop is a curated collection of plugins that enhance Claude Code's capabilities for software development workflows. Each plugin is designed to solve specific problems in the development lifecycle with a focus on practicality and developer experience.

## Usage

### Add this marketplace to Claude Code

```bash
/plugin marketplace add jacexh/skill-workshop
```

### Install plugins

```bash
# Install a specific plugin
/plugin install superpowers-memory@skill-workshop
```

### Enable auto-update

By default, third-party marketplaces do not auto-update. To automatically receive plugin updates:

**Option 1: Via UI**
```
/plugin → Marketplaces → skill-workshop → Enable auto-update
```

**Option 2: Manual update**
```bash
# Check for available updates
/plugin update --check

# Update a specific plugin
/plugin update superpowers-memory@skill-workshop

# Update all plugins from this marketplace
/plugin update --all
```

## Available Plugins

### superpowers-memory

**Description:** Project knowledge persistence and plan checkpoint tracking for superpowers workflows

**Version:** 1.0.3

**License:** MIT

**Keywords:** superpowers, memory, project-knowledge, plan-tracking

The superpowers-memory plugin addresses two key gaps in the superpowers workflow:

1. **Project Knowledge Base** — Maintains architecture, tech stack, feature list, conventions, and decision records across sessions
2. **Living Plans** — Automatically updates plan checkboxes as tasks are completed, enabling session recovery

**Key Features:**
- Zero-modification design — doesn't change any superpowers core files
- SessionStart hook injects knowledge base context at the right moments
- Three skills for knowledge management: `load`, `update`, and `rebuild`
- Project knowledge stored in your repo under `docs/project-knowledge/`

**Documentation:**
- [Design Spec](docs/superpowers/specs/2026-03-31-superpowers-memory-design.md)
- [Implementation Plan](docs/superpowers/plans/2026-03-31-superpowers-memory.md)

## Repository Structure

```
.
├── .claude-plugin/
│   └── marketplace.json          # Marketplace catalog definition
├── plugins/
│   └── superpowers-memory/       # Plugin source code
│       ├── .claude-plugin/
│       │   └── plugin.json       # Plugin manifest
│       ├── hooks/                # Claude Code hooks (planned)
│       ├── skills/               # Skill definitions (planned)
│       └── templates/            # Knowledge base templates (planned)
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

## License

Plugins in this marketplace are individually licensed. See each plugin's `plugin.json` for license information.

---

*This marketplace is maintained by [xuhao](https://github.com/jacexh).*
