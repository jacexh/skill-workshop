# Go Local Transactions

## Applies When

Load when an Application use case runs in one local transaction. That is either
a confirmed atomic change across independent Roots of one Bounded Context and
one local transactional resource, or a use case that dispatches Domain Events to
the Outbox ([ddd-golang-events.md](ddd-golang-events.md#handler-kinds)). Use the
[ordinary persistence guide](ddd-golang-persistence.md) for shared mapping
rules.

Transactions use `github.com/go-jimu/components/transaction` and, on xorm,
`github.com/go-jimu/contrib/transaction/xorm`. Their `go doc` owns nesting, ctx
lifetime, hooks, and error semantics.

## Application Scope

A normal command changes one Aggregate. Only a confirmed Model may authorize one use case to save several independent Aggregate Roots atomically, and only within one Bounded Context and one local transactional resource. Without that complete authority, expose the missing consistency decision instead of hiding it in a transaction or multi-Root Repository.

Application receives `transaction.Transactor` and calls `Within` once at the use-case boundary. Inside its callback it:

1. passes the derived ctx unchanged to every Repository and to the Outbox;
2. loads and locks Roots in stable identity order when locking is required;
3. invokes Domain behavior or the named Domain Service;
4. saves each Root through its own Repository, then dispatches the drained events; and
5. returns an error for any failed decision, save, or dispatch, so the whole scope rolls back.

The callback holds database work only. Effects outside the database run after commit, through the Outbox's Relay. Return the successful result once `Within` commits.

`ErrConflict` and `ErrOutcomeUnknown` follow the recovery the package documents. Without an accepted idempotency key, return them for Transport to map.

`transaction.Transactor` is a shared technical execution contract, not a semantic outbound port: Application depends on it directly, and provider handles such as `*xorm.Session` stay in Infrastructure.

## Repository Participation

Runtime builds one transaction Manager per database from its technology adapter and binds it as `transaction.Transactor`. Every Repository and QueryRepository adapter on that database resolves its session from ctx through the adapter (`DB.Session(ctx)` on xorm), then runs the [ordinary Repository](ddd-golang-persistence.md#ordinary-one-root-repository) statements on that session.

A one-Root write of several statements, such as an Aggregate spread over several tables, runs in the adapter's `WithinOrJoin`; `Within` and `WithinOrJoin` own every transaction's lifecycle. A session is persistence machinery, not evidence that independent Aggregates share one consistency boundary.

## Verification

For changed orchestration, use real Domain behavior and focused Repository
fakes to check that one `Within` encloses the affected loads, decisions, saves,
and dispatch. For changed transaction participation, use real Repository
adapters and MySQL. A fresh observer sees every write after commit, and none
when a later step fails. Callback fakes do not prove physical enlistment.
Reuse unaffected evidence; Guard reads existing results.
