---
status: ready
---

# Settle Account

## Scope and Exclusions

Settle one Account and announce durable completion. Provider delivery is outside scope.

## EventStorming Model

```mermaid
flowchart LR
    subgraph settlement["BC: Settlement"]
        role["Role: Operator"]
        subgraph account["Aggregate: Account"]
            capability["Capability: Settle"]
            event(["Workshop Event: Settlement Completed"])
        end
        role -- "Command: Settle Account" --> capability --> event
    end
```

## Decisions and Reasons

The Account owns eligibility and balance transition. Completion means durable settlement.

## Affected Models

- [Settlement](../context/settlement/model.md)

## Assumptions and Hotspots

- None for the confirmed scope.
