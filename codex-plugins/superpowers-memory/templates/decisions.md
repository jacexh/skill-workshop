---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

<!-- OWNER: ADR summary log (always loaded at session start).
     This file carries decision SUMMARIES only. Full context / alternatives /
     consequences live in `adr/ADR-NNN-<slug>.md`, loaded on demand.

     GRANULARITY GATE (see content-rules.md §decisions.md) — all three must hold:
       1. Cross-module scope (≥2 bounded contexts / services / packages)
       2. ≥2 substantive rejected alternatives (each with real paragraph-level analysis)
       3. Not trivially reversible (needs migration / proto wire / contract renegotiation)

     Fails the gate → not an ADR. Route to:
       - tech-stack.md (tool/library pick with single rationale)
       - conventions.md (coding / workflow rule)
       - docs/design/<topic>.md (single-module structural choice)
       - docs/superpowers/plans/ (temporary workaround with cleanup plan)

     PER-ADR SIZE: max 6 non-blank lines in this file. Beyond that, move rationale
     to the detail file.

     SUPERSEDE: collapse the entry to a single heading line; keep the detail file
     with `superseded_by: ADR-MMM` added to its frontmatter. -->

# Decisions

## Known Issues

<!-- Living record of known problems. Remove entries when resolved. -->

### Tech Debt

<!-- Format: **[Area]** (`path/to/file`) — description. Fix: approach. -->

### Known Bugs

<!-- Format: **[Bug]** — symptom. Reproduces when: condition. Location: `path/to/file`. -->

### Security Considerations

<!-- Format: **[Risk]** — description. Mitigation: current approach. -->

---

<!-- ADR summaries below — add new decisions at the top. Do not delete old ADRs;
     collapse superseded ones to the 1-line supersede format. -->

<!--
SUMMARY FORMAT (default — 4 lines per ADR):

## ADR-NNN: [Decision Title]
**Decision:** [What was decided, one sentence]
**Trade-off:** [Known cost or limitation. "None" if none]
→ [adr/ADR-NNN-<slug>.md](adr/ADR-NNN-<slug>.md)

SUPERSEDE (1-line collapsed — replaces original when superseded):

## ADR-NNN: Original Title (Superseded by ADR-MMM)
-->
