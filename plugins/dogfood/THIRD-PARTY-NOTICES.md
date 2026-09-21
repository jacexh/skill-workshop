# Third-party notices

The dogfood skill, issue taxonomy, and report template are adapted from:

- ZCode: https://github.com/zai-org/ZCode/tree/872ad960de7ec172591f7e1952f7849229f94521/.agents/skills/dogfood
- Imported revision: `872ad960de7ec172591f7e1952f7849229f94521`.
- Original source: https://github.com/vercel-labs/agent-browser/tree/main/skills/dogfood
- Copyright 2025 Vercel Inc. Licensed under Apache-2.0.
- ZCode modifications: local integration, formatting and adaptations.

ZCode's [third-party notices](https://github.com/zai-org/ZCode/blob/872ad960de7ec172591f7e1952f7849229f94521/THIRD-PARTY-NOTICES.md)
identify these skills as Apache-2.0 and reference the Vercel license at revision
`99c732c18810494593ead9dd96ab6f5f0c78b729`; the original skill import revision is
not recorded there. The referenced license is reproduced in [LICENSE](LICENSE).

Skill Workshop modifications:

- Package the skill as a hookless plugin for Claude Code and Codex, preserving
  explicit invocation through each host's metadata. Remove the Bash allowlist
  that conflicts with report writing and direct-binary guidance.
- Document the external CLI/browser dependency, installed resource paths,
  existing-run preservation, and the scope of authorized test actions. Prefer
  DOM/visible-state readiness over unconditional network-idle waits.
- Keep reusable authentication state outside shareable report output.
- Replace the issue-count target with scope/budget completion; retain intermittent
  observations separately from confirmed findings and disclose unavailable video.
- Extend the report template with coverage, limitations, and unconfirmed observations.

The browser CLI and runtime are external dependencies and are not redistributed
by this plugin.
