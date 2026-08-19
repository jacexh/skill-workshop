# Review Handoff

## Governing sources

- `docs/ddd-expert/context/settlement/domain-objects.md#Account`: Account settles an accepted amount against its balance, producing a decreased non-negative balance.

## Snapshot

- Base and target: immutable current HEAD.

## Changed production symbols

- `internal/settlement/domain/account.go#SettleAccount`
- `internal/settlement/application/settle.go#SettleHandler.Handle`

## Producer checks

- `go test ./...`: exit 0 on this snapshot.
