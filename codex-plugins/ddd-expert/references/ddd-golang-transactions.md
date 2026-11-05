# Go Multi-Root Local Transactions

## Applies When

Load only for a confirmed atomic change across independent Roots in one Bounded
Context and one local transactional resource. This leaf owns Application scope,
Infrastructure participation, and the conditional Repository example. Use the
[ordinary persistence guide](ddd-golang-persistence.md) for shared mapping rules.

## Application Scope

A normal command changes one Aggregate. Only a confirmed Model may authorize one Application use case to save several independent Aggregate Roots atomically, and only within one bounded context and one local transactional resource. Without that complete authority, expose the missing consistency decision instead of hiding it in a transaction or multi-Root Repository.

For the confirmed exception, define the provider-neutral contract once for the project rather than once per bounded context:

```go
// internal/pkg/transaction/transactor.go
package transaction

import "context"

type Transactor interface {
	Within(context.Context, func(context.Context) error) error
}
```

Application receives `transaction.Transactor` and calls `Within`. Inside its callback it:

1. passes the derived context unchanged to every participating Repository;
2. loads and locks roots in stable identity order when locking is required;
3. invokes the named Domain Service, which applies business rules through public Aggregate behavior;
4. saves each root through its own Repository; and
5. returns an error for any failed decision or save so Infrastructure rolls back the whole scope.

Application defines the transaction scope; Infrastructure owns begin, enlistment, commit, and rollback. The callback contains no RPC, Kafka, file operation, event publication, or goroutine.

Publish Domain Events and return the successful result only after `Within` commits. Request-scoped Aggregate instances and staged events belong to that transaction scope. A resident Aggregate follows its accepted checkpoint policy rather than acting as a transactional working copy.

The conditional `internal/pkg/transaction.Transactor` is a shared technical execution contract, not a semantic outbound port. Do not duplicate it under each BC's `application`, call it `UnitOfWork`, expose Repository factories through it, or pass options, `*xorm.Session`, or another provider handle inward. Add isolation controls only when the accepted local transaction contract defines them.

## Local Transaction Participation

Ordinary one-Root commands need no shared transaction abstraction. When the confirmed same-BC, one-resource exception exists, `internal/pkg/transaction` owns only the provider-neutral `Transactor` contract and `internal/pkg/database` owns its xorm implementation plus one executor resolver shared by every Repository adapter.

Runtime constructs one resolver and one database Transactor over the same engine/resource identity, supplies the resolver to Repository adapters, and binds the adapter as `transaction.Transactor` for Application use cases. Do not create one transaction implementation per bounded context.

For one-statement operations, the local resolver exposes a shape equivalent to `Resolve(context.Context) (xorm.Interface, error)`. It returns `engine.Context(ctx)` when no Application transaction is active and the current `*xorm.Session` inside the matching callback scope. Keep the typed context key, xorm session, and resource identity private to `internal/pkg/database`.

For a one-Root adapter operation that needs several statements, the same resolver exposes a shape equivalent to `WithinOrJoin(context.Context, func(xorm.Interface) error) error`. It joins the current Application transaction without owning its lifecycle or creates one adapter-local transaction when no scope is active. `WithinOrJoin` is Infrastructure-only participation, not a nested Application `Within`.

The xorm Transactor implementation:

- creates one session, begins once, installs the private transaction declaration, and passes the derived context to the callback;
- invokes the callback exactly once;
- commits after a nil callback result;
- rolls back after a callback error; and
- closes the owned session when the callback scope ends.

The callback context is a scoped capability: pass it unchanged, use it sequentially, and never retain it or use it from a goroutine.

## xorm Repository Adapter — Conditional Resolver Form

This is the conditional form for a project where the confirmed multi-Root exception has activated the shared resolver. Without that authority, keep the ordinary `*xorm.Engine` constructor and `engine.Context(ctx)` operations; do not create `transaction`, Transactor, or resolver machinery preemptively. In either form, always bind external values, select intentional columns, filter accepted deletion state, and wrap provider errors at this first controlled boundary.

The adapter holds `*database.ExecutorResolver` instead of the engine, and
`NewUserRepository(executors)` still returns `domain.Repository`. Each operation
first calls `r.executors.Resolve(ctx)`, wraps a resolve failure under an
`operation` attribute such as `user.get.executor`, and then runs the
[ordinary Repository](ddd-golang-persistence.md#ordinary-one-root-repository)
statements, including its optimistic lifecycle, on the resolved executor.

When one accepted Aggregate maps to several tables, wrap its statements with the shared database `WithinOrJoin`: it joins an active Application scope or owns the complete local lifecycle when no scope exists. Do not let the Repository inspect ownership or call `Begin`, `Commit`, `Rollback`, or `Close` directly. A session is persistence machinery, not evidence that independent Aggregates share one consistency boundary.

## Verification

For changed multi-Root orchestration, use real Domain behavior and focused
Repository fakes to check that one `Within` encloses the affected loads,
decisions, and saves. For changed transaction participation, use real Repository
adapters and MySQL: a fresh observer sees both writes after commit, neither
when a later save fails, and no write when participation is rejected. Callback
fakes do not prove physical enlistment. Reuse unaffected evidence; Guard reads
existing results.
