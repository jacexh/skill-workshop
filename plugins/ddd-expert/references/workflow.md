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

## Step order

The steps run in this order: EventStorming, Tactical Design, Architecture
Design, then Codify; Guard reviews Codify's result. When a step completes,
continue to the first later step whose entry condition holds for the whole
change in scope, including what earlier steps accepted, and skip each step
whose condition does not hold. A design-only request ends with the last design
step that applies.

| Step | Entry condition |
| --- | --- |
| Tactical Design | Aggregate internals or domain-object behavior still need a decision. |
| Architecture Design | The change adds, renames, or removes a Root, Domain Service, Domain-owned Port, or Domain Event; adds, removes, or changes a Policy, an Integration Message the context consumes or sends, or a delivery constraint; or adds a read need or an external dependency that the context's `architecture.md` does not cover. |
| Codify | Implementation is in scope. |

## Progressive refinement

The design steps clarify the design progressively. Each step settles the
decisions it owns and has evidence for, and writes only those as accepted
content.

- **Open decision**: a decision whose evidence a later step owns. Hand it on
  with its default, stated as an assumption: record it in the project's spec
  or issue when one exists, otherwise in the conversation hand-off. The step
  that reaches its evidence settles it. Artifacts hold only accepted content.
- **Correction**: when Tactical Design or Architecture Design finds a fact or
  contradiction that changes an earlier artifact, present it as a ⚠️
  **Conflict** with the proposed 🔄 **Change** and obtain confirmation. Write
  it in the current step under the owning skill's template, writing guidance,
  and write checks, then revisit the accepted content after it that the
  correction affects. A correction rests on a business fact or contradiction;
  a realization preference stays within the current step.
- Codify implements an open decision that reaches it under its stated default
  and reports it as an assumption. Codify and Guard leave the artifacts
  unchanged and report contradictions.

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

Record a design or implementation choice through the project's decision
mechanism only when it is hard to reverse, would surprise a future reader
without its context, and resulted from a real trade-off. When the project has
no such mechanism, offer to create an ADR under `docs/adr/` before relying on
the choice.

House Rules are deliberate defaults whose general tradeoffs are already
accepted. When applying one to the case at hand conflicts with a DDD judgment
specific to that case, state a ⚠️ **Conflict** first: the rule and its file, the
competing judgment, and the consequence of each. Then follow the rule unless the
user decides otherwise.

Codify runs checks for changed behavior and affected boundaries, reusing valid
existing evidence. Broaden verification only for new changes, failures, or an
unresolved risk. Guard reads the applicable rules and available evidence; commands
in realization references are not instructions to install dependencies, run a
verification campaign, or change the reviewed project. Report an evidence gap
only when it prevents a concrete structural judgment.
