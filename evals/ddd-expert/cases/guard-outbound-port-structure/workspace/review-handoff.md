# Review Handoff

## Claim sources

- `docs/ddd-expert/context/shipping/model.md#Application and outbound boundaries`
- `docs/ddd-expert/context-map.md#Shipping`

## Snapshot

- Target: immutable current `HEAD`; reproduce with `git rev-parse HEAD` and require an empty `git status --short`.
- Producer checkpoint: complete for that target.
- Producer check: `go test ./...` exited 0 on that target.

## Architecture review units

### recipient-notification

- Authority: `docs/ddd-expert/context/shipping/model.md#Application and outbound boundaries`
- House Rule: `ddd-core.md#Application` and `ddd-core.md#Infrastructure`
- Source assertions:
  1. Application depends on a business-language recipient notification capability and exposes no HTTP or provider mechanics.
  2. Infrastructure adapter faithfully implements the supplied inner contract without adding business decisions.
- Symbols:
  - `internal/shipping/application/announce_dispatch.go#HTTPPoster`
  - `internal/shipping/application/announce_dispatch.go#AnnounceDispatch`
  - `internal/shipping/infrastructure/http_poster.go#HTTPPoster`

This handoff contains navigation and producer receipts only. It makes no Guard verdict.
