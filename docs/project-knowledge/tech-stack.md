---
last_updated: 2026-05-09
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---

# Tech Stack

## Languages & Frameworks

| Technology | Role | Notes |
|-----------|------|-------|
| Node.js | Hook runtime — `hook-runtime.js` (Claude) and `codex-runtime.js` (Codex); inline `node -e` for architect bash hook | Primary runtime for all hook logic on both tracks; replaced earlier bash+python3 approach |
| Bash | Thin hook wrapper scripts on Claude side and release automation scripts under `scripts/release/` | Hook wrappers delegate to `hook-runtime.js`; release scripts keep GitHub Actions YAML small and testable |
| Markdown | Skills (`SKILL.md`), templates, documentation, design patterns, references, knowledge base files | CommonMark; YAML frontmatter for metadata |
| JSON | Plugin manifests (`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`), native/fallback hook configs (`hooks.json`, `codex-plugins/superpowers-memory/hooks/hooks.json`, `codex-hooks-snippet.json`), marketplace catalogs (`.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`) | 2-space indent; expanded multi-line array/object style across both tracks |

## Key Dependencies

| Dependency | Purpose | Why Chosen |
|-----------|---------|------------|
| Claude Code plugin runtime | Executes hooks, loads skills, manages Claude marketplace | Primary deployment target for `plugins/` track |
| Codex CLI plugin runtime | Loads plugin manifests, native lifecycle hooks, skills, and marketplace plugins | Experimental deployment target for `codex-plugins/` track (ADR-013, ADR-014) |
| Node.js | JSON parsing, file operations, git command execution in hooks | Available in both Claude Code and Codex environments |
| git | KB staleness detection (`git diff`, `git log`), stale ref verification, branch identification in `classifyFinishingState()` | Present in any development environment |
| jq | Release-script JSON mutation in GitHub Actions and shell tests | Available on `ubuntu-latest`; keeps manifest bumping simple without adding project dependencies |

## Build & Dev Tools

| Tool | Purpose |
|------|---------|
| git | Version control; also used at runtime by hooks |
| GitHub Actions | Release workflow — automated version bumping, tag creation, GitHub Release per plugin |
| `jacexh/action-autotag@v1` | Creates repository-level semver tags after the release workflow pushes a bump commit |
| `softprops/action-gh-release@v1` | Publishes GitHub Releases with generated notes for new tags |
| Claude Code `/plugin` command | Install / update / manage Claude-track plugins |
| Codex CLI `plugin marketplace` command | Install / upgrade / remove Codex-track plugins; native plugin hooks require restart plus `[features] hooks = true` and `plugin_hooks = true` |

## Infrastructure

- **Distribution:** GitHub repository (`jacexh/skill-workshop`) acts as the marketplace source for both tracks. No build step — files served directly.
- **Release:** GitHub Actions auto-release runs after PR merge to `main`, pushes a version-bump commit, creates a repository tag, and publishes a GitHub Release.
- **Versioning:** Plugin versions tracked in Claude manifests, Codex manifests, native Codex hook files, and fallback Codex hook snippets. `.agents/plugins/marketplace.json` has no version field; Codex hook config versions must follow the Codex plugin manifest for the same plugin.
- **No databases, no external services, no hosted infrastructure.**
