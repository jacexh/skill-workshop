# Review Handoff

## Claim sources

- `docs/ddd-expert/tactical-design/settle-account.md#TD-001`: Application publishes Settlement Completed only after the local transaction commits; any load, Domain, save, or commit failure publishes nothing.
- `SETTLEMENT-MODEL`: `docs/ddd-expert/context/settlement/model.md#Aggregate Capabilities` — Account owns Settle behavior.

## Snapshot

- Base and target: immutable current HEAD.
- Replay: `git status --short`, `git diff --stat HEAD`, and direct reads of the paths below.

## Tactical claim map

- `docs/ddd-expert/tactical-design/settle-account.md#TD-001` -> `internal/settlement/application/settle.go#SettleHandler.Handle`

## Architecture review units

- `settlement-publication-order`
  - Authority: `docs/ddd-expert/tactical-design/settle-account.md#TD-001`
  - Responsibility: Application
  - Assertion: Application publishes Settlement Completed only after commit; failure publishes nothing.
  - Symbols: `internal/settlement/application/settle.go#SettleHandler.Handle`

## Producer checks

- `go test ./...`: exit 0 on this snapshot.

## Producer checkpoint

- `complete`
