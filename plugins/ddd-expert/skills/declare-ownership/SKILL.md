---
name: declare-ownership
description: Add the DDD Expert artifact-ownership line to this repository's agent instruction file.
disable-model-invocation: true
---

# Declare Ownership

Add one line to the repository's agent instruction file. Other skills never read DDD Expert's own rules, but every agent reads the instruction file on every turn, so this line is how they all learn that `docs/ddd-expert/` is accepted design and not ordinary documentation.

## The line

```markdown
- `docs/ddd-expert/` holds the accepted DDD model and architecture design. Change it only through DDD Expert EventStorming, Tactical Design, or Architecture Design after user confirmation; all other work reads it as authority.
```

## Steps

1. Read `AGENTS.md` and `CLAUDE.md` at the repository root, if they exist.
2. Choose the target files. Each host reads its own file, so the line must reach every file a host in use reads:
   - `CLAUDE.md` imports `@AGENTS.md`, or only `AGENTS.md` exists: `AGENTS.md`.
   - Only `CLAUDE.md` exists: `CLAUDE.md`.
   - Both exist and `CLAUDE.md` does not import `AGENTS.md`: both.
   - Neither exists: create the file your host reads, `CLAUDE.md` for Claude Code or `AGENTS.md` for Codex.
3. For each target, keep an existing mention of `docs/ddd-expert/` as it is and report it, so a rerun changes nothing. Otherwise append the line under a `## DDD Expert` heading at the end of the file.
4. Show the resulting change and report each file written or kept.

The declaration is complete when every target file mentions `docs/ddd-expert/` exactly once.
