# Workflow Contract

Read this contract once when entering any DDD Expert skill.

## Scope and authority

The user's explicit instructions take precedence over this plugin's workflow
guidelines and House Style defaults, within the environment's execution
permissions. Reuse decisions and authorization already established in the
conversation or accepted project documents.

Choose the requested work from the current evidence: explain, discover, refine,
implement, or review. Enter the skill that owns it. A design or review request
ends with that result; implementation proceeds when it is in the user's scope.

## Decisions and confirmation

Investigate repository facts before asking. Ask one material unresolved question
at a time; continue independent authorized work while its answer is pending.
A confirmed proposal can be written directly. Reconfirm only content changed
since that confirmation or an unresolved decision that would change the result.
Explicitly delegated design choices may be resolved with stated assumptions;
record which choices were delegated. Permission to write alone does not settle
unknown business facts or delegate new domain decisions.

When an instruction prevents progress, cite the exact skill or reference file
and clause, explain its effect, and distinguish a requirement from your
interpretation. Complete unaffected authorized work before reporting the blocker.

## Design interview presentation

In EventStorming and Tactical Design interviews, make the current question and
recommendation easy to find. Put the question near the start on its own line,
with only the context needed to understand it. Use these markers with bold text
labels in the user's language; include only those relevant to the turn:

| Marker | Content |
| --- | --- |
| ❓ **Question** | The one unresolved question the user needs to answer. |
| 💡 **Recommendation** | Lead with the recommended choice or content in bold, then its key reason and material tradeoff. Keep the strongest alternative adjacent for comparison. |
| 🔄 **Change** | The affected difference from the previous working view; use before → after when helpful and distinguish a proposed revision from an accepted change. |
| ⚠️ **Conflict** | The incompatible facts or requirements, identifying each source. |

For an unknown business fact, ask for the missing evidence or scenario; a
recommendation belongs only where there is a design judgment to make. Keep
supporting detail subordinate to the question and recommendation, omit repeated
background, and preserve enough context for an integrated confirmation. These
markers organize the conversation; persisted artifacts follow their templates.

## Project conventions and verification

Accepted project decisions and explicit user choices govern the implementation.
Use the plugin's language stack as the default for covered concerns the project
has left open. Existing repository conventions are integration evidence; preserve
them unless the requested change requires a different realization. Selecting a
language does not authorize a framework migration or unrelated reorganization.

Codify runs checks for changed behavior and affected boundaries, reusing valid
existing evidence. Broaden verification only for new changes, failures, or an
unresolved risk. Guard reads the applicable rules and available evidence; commands
in realization references are not instructions to install dependencies, run a
verification campaign, or change the reviewed project. Report an evidence gap
only when it prevents a concrete structural judgment.
