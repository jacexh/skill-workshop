---
status: ready
---

# Settle Invoice

## Scope and Exclusions

Billing accepts or rejects one payment against one Invoice. Provider delivery,
storage acknowledgement, retries, and reporting are excluded.

## EventStorming Model

```mermaid
flowchart LR
    clerk["Role: Billing Clerk"] -- "Command: Settle Invoice" --> settle["Capability: Settle Invoice"]
    settle --> settled(["Workshop Event: Invoice Settled"])
```

## Decisions and Reasons

Invoice settlement is established by the Domain decision. No separate business
fact records that storage later acknowledged that decision.

## Affected Models

- [Billing](../context/billing/model.md)

## Assumptions and Hotspots

None.
