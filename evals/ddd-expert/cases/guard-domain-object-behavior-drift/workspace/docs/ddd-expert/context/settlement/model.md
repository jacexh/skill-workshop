# Settlement Model

## Purpose

Settlement owns account settlement decisions.

## Essential Language

- **Settle Account:** Apply one accepted amount to an Account.

## Aggregate Roots

| Aggregate Root | Definition | Consistency boundary |
|---|---|---|
| Account | Owns one settleable balance. | Settlement eligibility and balance change together. |

## Business Rules

- An Account balance never becomes negative.
