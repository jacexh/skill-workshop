---
status: ready
---

# Settle Account

## Scope and Exclusions

Settle one Account and announce durable completion. Provider delivery is outside scope.

## EventStorming Model

```mermaid
flowchart LR
    actor["Actor: Operator"]
    subgraph settlement["BC: Settlement"]
        command["Command: Settle Account"]
        subgraph account["Aggregate: Account"]
            capability["Aggregate Capability: Settle"]
            policy{"Policy: Account is eligible"}
            event(["Workshop Event: Settlement Completed"])
        end
    end
    actor --> command --> capability --> policy --> event
```

## Command-to-Capability Projection

| Bounded Context | Normalized Command | Aggregate Root or coordination owner | Aggregate Capability or explicit coordination |
|---|---|---|---|
| Settlement | Settle Account | Account | Settle |

## Decisions and Reasons

The Account owns eligibility and balance transition. Completion means durable settlement.

## Affected Models

- [Settlement](../context/settlement/model.md)

## Assumptions and Hotspots

- None for the confirmed scope.
