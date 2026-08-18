---
status: ready
---

# Settle Invoice

## Scope and Exclusions

Settle one Invoice. Provider collection and partial payments are outside scope.

## EventStorming Model

```mermaid
flowchart LR
    subgraph billing["BC: Billing"]
        clerk["Role: Billing Clerk"]
        subgraph invoice["Aggregate: Invoice"]
            settle["Capability: Settle Invoice"]
            settled(["Workshop Event: Invoice Settled"])
        end
        clerk -- "Command: Settle Invoice" --> settle --> settled
    end
```

## Decisions and Reasons

The Invoice owns settlement eligibility and balance transition. Completion means durable settlement.

## Affected Models

- [Billing](../context/billing/model.md)

## Assumptions and Hotspots

- None for the confirmed scope.
