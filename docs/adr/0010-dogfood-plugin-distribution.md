# ADR 0010: Distribute Dogfood as a Dual-Track Plugin

- Status: Accepted
- Date: 2026-09-21

## Context

The requested addition is a distributable plugin based on ZCode's dogfood skill,
not a development skill installed into this repository's `.agents/skills`.
The upstream skill uses the external agent-browser CLI and includes an issue
taxonomy and report template derived from Vercel under Apache-2.0.

## Decision

- Publish hookless `dogfood` packages under `plugins/` and `codex-plugins/`,
  registered in the respective existing marketplace catalogs.
- Pin provenance to ZCode revision `872ad960de7ec172591f7e1952f7849229f94521`,
  retain original attribution, include the referenced Vercel Apache-2.0 license,
  and document modifications in each package's third-party notices.
- Preserve explicit invocation: Claude uses `disable-model-invocation: true`;
  Codex uses `agents/openai.yaml` with `allow_implicit_invocation: false`.
  These host-specific metadata differences are intentional; workflow, taxonomy,
  and report template remain aligned.
- Keep agent-browser and its browser runtime as documented external dependencies.
  Installing the plugin does not install executables or lifecycle hooks.
- Retain the upstream exploration and incremental evidence workflow, with narrow
  adjustments for authentication-state handling, authorized test actions,
  preserving prior output, scope-based completion, intermittent observations,
  and unavailable video evidence.

## Consequences

Users can install the plugin through either marketplace and invoke it against
a target URL. Missing browser dependencies must be reported, and static package
validation alone does not establish that a browser session works.
The plugin has its own Apache-2.0 license rather than inheriting MIT metadata
from neighboring packages. Existing release automation can detect and version
both new plugin paths without changes to the release contract.
