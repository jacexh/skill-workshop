---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

<!-- OWNER: Index of reusable code-change recipes.
     Each entry points to a detail file under `playbooks/<slug>.md`.

     BOUNDARY vs other KB files:
     - conventions.md: declarative rules (must / must-not). Playbooks are procedural (do A then B).
     - decisions.md / adr/: WHY a decision was made. Playbooks execute the consequence.
     - docs/superpowers/specs|plans/: one-shot specs and plans. Playbooks are reusable across instances.
     - architecture.md: structural explanation. Playbooks are operational.
     - docs/runbooks/ (NOT KB): live-system operations (incident, deploy, on-call).

     3-GATE CREATION RULE (all must hold):
     1. Recurrence — same class of change has happened ≥2 times.
     2. Multi-step cross-file — ≥3 cross-file or cross-module actions.
     3. Non-obvious — not derivable by reading affected code in isolation.
     Fails any gate → not a playbook. See content-rules.md for routing.

     LAZY SLOT: if no recurring change classes pass the 3-gate rule, omit this file.
     Do NOT create an empty index just to satisfy the schema.

     SIZE CAP: ≤200 lines. Detail files are not counted. -->

# Playbooks

<!-- Entry format (one per line):
     - [<Verb-led title>](playbooks/<slug>.md) — When: <one-line trigger condition>

     The `When:` clause must be scannable — code agents match their current task against
     it without opening the detail file. Be specific about the trigger, not the activity. -->

## Code-change recipes

- [<Verb-led title>](playbooks/<slug>.md) — When: <one-line trigger condition>
- [<Verb-led title>](playbooks/<slug>.md) — When: <one-line trigger condition>

<!-- Optional grouping headings (### ) — only use when there are ≥6 playbooks
     AND a natural cluster (e.g., "Backend changes", "Frontend changes",
     "Plugin changes"). For fewer entries, keep flat. -->
