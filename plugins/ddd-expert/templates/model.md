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

- **<Rule name>:** <One EARS sentence: [When <trigger>, | While <state>, | If <condition>, then | Where <feature applies>,] <concept> <accepted decision, permission, transition, outcome, or invariant>.>

## Policies

- **<Policy name>:** When <trigger fact or time>, <reacting concept> <intent>[ within <duration>]. If <intent> cannot complete, then <business outcome>.
