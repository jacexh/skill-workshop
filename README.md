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

Injects architectural design pattern standards as hard constraints into planning, execution, and code review workflows.

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

## License

Plugins in this marketplace are individually licensed. See each plugin's `plugin.json` for license information.

---

*This marketplace is maintained by [xuhao](https://github.com/jacexh).*
