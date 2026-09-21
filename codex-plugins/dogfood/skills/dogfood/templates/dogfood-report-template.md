<!--
Derived from vercel-labs/agent-browser (skills/dogfood/templates/dogfood-report-template.md).
Copyright 2025 Vercel Inc. Licensed under Apache-2.0.
Modified by ZCode: local integration, formatting and adaptations.
Modified by Skill Workshop: portable packaging and evidence-handling guidance.
See THIRD-PARTY-NOTICES.md in the plugin root for license and provenance.
-->

# Dogfood Report: {APP_NAME}

| Field       | Value          |
| ----------- | -------------- |
| **Date**    | {DATE}         |
| **App URL** | {URL}          |
| **Session** | {SESSION_NAME} |
| **Scope**   | {SCOPE}        |

## Summary

| Severity  | Count |
| --------- | ----- |
| Critical  | 0     |
| High      | 0     |
| Medium    | 0     |
| Low       | 0     |
| **Total** | **0** |

## Coverage and Limitations

{Areas and workflows tested; areas skipped or blocked; unavailable evidence.}

## Unconfirmed Observations

{Intermittent observations, existing evidence, and retry outcomes, or None. Excluded from severity totals.}

## Issues

<!-- Copy this block for each confirmed issue found; remove it if there are no findings. Interactive issues should include video + step-by-step screenshots; explicitly note unavailable recording. Static issues (typos, visual glitches) only need a single screenshot -- set Repro Video to N/A. -->

### ISSUE-001: {Short title}

| Field           | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| **Severity**    | critical / high / medium / low                                             |
| **Category**    | visual / functional / ux / content / performance / console / accessibility |
| **URL**         | {page URL where issue was found}                                           |
| **Repro Video** | {relative video link, N/A for static issues, or unavailable with reason}                                  |

**Description**

{What is wrong, what was expected, and what actually happened.}

**Repro Steps**

<!-- Each step has a screenshot. A reader should be able to follow along visually. -->

1. Navigate to {URL}
   ![Step 1](screenshots/issue-001-step-1.png)

2. {Action -- e.g., click "Settings" in the sidebar}
   ![Step 2](screenshots/issue-001-step-2.png)

3. {Action -- e.g., type "test" in the search field and press Enter}
   ![Step 3](screenshots/issue-001-step-3.png)

4. **Observe:** {what goes wrong -- e.g., the page shows a blank white screen instead of search results}
   ![Result](screenshots/issue-001-result.png)

---
