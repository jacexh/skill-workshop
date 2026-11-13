# <Bounded Context> Model

## Purpose

<What business authority this context owns and why it exists.>

## Essential Language

- **<Term>:** <One sentence: the meaning unique or important in this context.>

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| <Root> | <What business concept this Root represents> | <Facts and rules that must remain consistent together> |

## Business Rules

### <Aggregate Root>

- **<Rule name>:** <Head, one EARS sentence that states the decision: [When <trigger>, | While <state>, | If <condition>, then | Where <feature applies>,] <concept> <accepted decision, permission, transition, outcome, or invariant>.>
  - <Clause, only when the head cannot hold the decision: one EARS sentence for one condition or outcome.>

### Context

- **<Rule name>:** <A rule that several objects share, that governs a reading, or that no Behavior owns, in the same shape.>

## Policies

- **<Policy name>:** When <trigger fact or time>, <reacting concept> <intent>[ within <duration>]. If <intent> cannot complete, then <business outcome>.
