# ADR 0002: designing-tests Is Hookless

- Status: Partially Superseded
- Repository evaluation corpus, runner, and release-check decisions superseded by their removal on 2026-08-19.
- Date: 2026-07-12

## Context

`designing-tests` previously installed Claude and Codex hooks that injected a
compact evidence primer when other workflow skills ran. The hook adapters
duplicated policy from `SKILL.md`, coupled this plugin to external skill names,
and created platform-specific runtime, installation, and migration surfaces.

The skill is model-invoked and can also be selected explicitly. Its own
description is the appropriate discovery boundary for test-design work.

The skill description also advertised flaky-test diagnosis. That work depends
on observations across repeated runs and belongs to a diagnosis workflow rather
than test-case design.

## Decision

- Package `designing-tests` as an on-demand, hookless skill in both Claude and
  Codex tracks.
- Remove lifecycle hook configuration, hook runtimes, hook snippets, and the
  legacy hook installer from the plugin.
- Keep the two skill trees byte-aligned, including their reference layout, and
  enforce parity in the release test suite.
- Route test design through Intent, Risk, Evidence, and conditional Test
  Construction with explicit completion criteria.
- Keep only design-time repeatability guidance under Control. Do not expose a
  flaky-test diagnosis branch.
- Preserve one manual migration note for users whose old global Codex hook file
  still points at a deleted designing-tests runtime.

## Consequences

- Installing `designing-tests` no longer injects context into planning, TDD,
  review, or branch-completion workflows.
- Agents reach the skill through its description or explicit invocation.
- The plugin has less runtime coupling and one fewer source of policy truth.
- Existing users with a stale fallback hook may need to remove that entry once.
- Reintroducing automatic hook integration requires a new decision that defines
  its invocation contract, ownership, and cross-platform behavior.

## Verification

- `test_designing_tests_plugin.sh` enforces the hookless package, workflow
  completion criteria, valid links, metadata alignment, and byte parity.
- The auto-release workflow runs the complete release test harness before
  versioning or tagging.
