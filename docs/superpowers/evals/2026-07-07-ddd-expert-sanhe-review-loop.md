# ddd-expert sanhe Review Evaluation Loop

## Round 2026-07-07 v1.14.21 Baseline

- skill-workshop starting point: `main@1ea2037`, released as `ddd-expert` `1.14.21`.
- hotfix branch: `hotfix/ddd-review-lifecycle-evidence`.
- hotfix commit / PR / merge commit / tag: this evaluation-fix commit / pending / pending / pending.
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe equivalent review path used for baseline capture: `/workspaces/sanhe` in container `optimistic_hawking`, same checkout as `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`, ahead of `origin/feature/task-agreement` by 1; dirty `go.mod`, `go.sum`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`

### Raw ddd-expert Review Output

```text
DDD review findings first:

Finding: Blocker Code-level DDD/technology FSM dependency/API mismatch breaks build
- Evidence: [go.mod](/workspaces/sanhe/go.mod:7) now uses `github.com/go-jimu/components v0.10.0`, while [task_agreement_fsm.go](/workspaces/sanhe/internal/business/tasknegotiation/domain/task_agreement_fsm.go:24) asserts the old `fsm.StateContext`, [line 100](/workspaces/sanhe/internal/business/tasknegotiation/domain/task_agreement_fsm.go:100) implements `TransitionTo`, and [line 124](/workspaces/sanhe/internal/business/tasknegotiation/domain/task_agreement_fsm.go:124) calls removed `TransitionToNext`.
- Violated guardrail: Go/FSM runtime contract must match the selected library version.
- Triage: violation.
- Why it matters: current working tree cannot compile, so lifecycle tests and app tests are blocked.
- Implementation mechanism: either pin components back to `v0.9.9`, or migrate the FSM to the v0.10 API (`SetState`, `fsm.Transit` style).
- Test / verification needed: `go test ./internal/business/tasknegotiation/domain -count=1`.

Finding: Blocker Domain Abstraction successful payment can be followed by cancellation/retry before funding reaction
- Evidence: `SucceedSimulatedPayment` saves a succeeded `Payment` before dispatching `PaymentSucceeded` at [task_agreement_payment.go](/workspaces/sanhe/internal/business/tasknegotiation/application/command/task_agreement_payment.go:176); dispatch failure is logged and the command still succeeds at [line 364](/workspaces/sanhe/internal/business/tasknegotiation/application/command/task_agreement_payment.go:364). Tests assert the agreement remains `payment_pending` after missed dispatch at [application_test.go](/workspaces/sanhe/internal/business/tasknegotiation/application/application_test.go:1389). `StartTaskAgreementPayment` only reuses pending payments, ignoring succeeded payments at [task_agreement_payment.go](/workspaces/sanhe/internal/business/tasknegotiation/application/command/task_agreement_payment.go:122). Cancellation only checks agreement state at [line 260](/workspaces/sanhe/internal/business/tasknegotiation/application/command/task_agreement_payment.go:260) and `CancelBeforeFunding` only rejects funded-or-later agreement states at [task_agreement.go](/workspaces/sanhe/internal/business/tasknegotiation/domain/task_agreement.go:255).
- Violated guardrail: business timeline must be `Payment succeeded` -> durable payment fact -> funded agreement via recoverable same-BC reaction; the eventual-consistency gap is internal, not a customer-visible retry/cancel window.
- Triage: violation.
- Why it matters: a dispatch miss can leave a succeeded payment behind a cancelled agreement, or allow a second payment attempt after one already succeeded.
- Model correction: `PaymentSucceeded` must be treated as authoritative for the agreement even before the funding projection/reaction completes.
- Implementation mechanism: guard cancellation/retry against existing succeeded payments, or reconcile/lock the agreement-payment pair before accepting pre-funded cancellation/new payment.
- Test / verification needed: add regression for `succeeded payment + missed dispatch -> cancel/retry rejected or reconciled`.

Expected model sources: spec, DDD design, implementation plan, project memory `architecture.md`/`conventions.md`, branch diff `origin/master...HEAD`, changed domain/application/infrastructure/proto/sql files.

Evidence gate:
- Concrete evidence exists: branch diff, code paths, SQL schema, tests, generated files, and verification output.
- Repo calibration: bounded context `internal/business/tasknegotiation`; layers `domain`, `application/command`, `application/query`, `infrastructure`; generated code under `proto/` and `gen/`; fx wiring in `tasknegotiation.go`.

Checked flows:
- Agreement draft -> payment pending: checked.
- Payment succeeded -> `PaymentSucceeded` -> funded agreement: finding above.
- Funded -> delivery -> acceptance -> settlement: checked.
- Rejection -> refund case -> dispute -> refund/settlement/split closure: checked.
- Pre-funded cancellation: finding above for succeeded-payment gap.
- Generated protocol isolation: checked, no generated imports in `domain`, `application/command`, or `application/query`.

Rules Satisfied / Evidence:
- Protocol boundary: Rules satisfied.
- Generated RPC adapter thinness: Rules satisfied.
- Domain Event vs Integration Message boundary: Rules satisfied; `PaymentSucceeded` stays same-BC.
- Repository transaction shape: accepted semantic lifecycle methods are present, but they do not cover the payment/cancellation invariant gap.
- Verification: `git diff --exit-code -- gen proto` passed; `git diff --check` passed; `go test ./internal/business/tasknegotiation/domain -count=1` and focused application tests failed to compile due the FSM dependency/API mismatch.
```

### Score

- Breadth: 14 / 45. Found K1 and K2; partially touched K9 only through API mismatch. Missed K3-K8 and K10.
- Depth: 15 / 45. K1 and K2 had concrete evidence, root cause, impact, and direction. Missed issues prevent a higher depth score.
- Review discipline: 8 / 10. The review kept static DDD review separate from the compile blocker and did not treat repository transaction shape as aggregate proof. It overclaimed some checked flows without enough evidence.
- Total: 37 / 100.

### Gap Analysis

- Missing finding: K3 recovery/reconciler production reachability was not checked.
- Missing finding: K4 terminal lifecycle facts and money execution facts were not separated in split outcomes.
- Missing finding: K5 repository/API candidate aggregate classification did not appear despite multi-lifecycle repository methods.
- Missing finding: K6 same-BC delivery/refund/dispute/settlement behavior linkage was marked checked without event/reaction/process-manager/reconciler proof.
- Missing finding: K8 payment failed/cancelled state semantics were not challenged.
- Shallow finding: K9 found FSM API mismatch but not state-polymorphism usage.
- Missing finding: K10 CQRS read/write repository blending risk was not reported.
- Overclaim: several flows were listed as checked or Rules Satisfied with weaker evidence than the rule scope required.

### Generic Fix Summary

- Added release assertions for irreversible lifecycle fact precedence, production recovery reachability, terminal lifecycle versus execution fact separation, FSM API/state-polymorphism review, and CQRS read/write split.
- Strengthened `ddd-expert:review` coverage and evidence-gate obligations generically.
- Added risk-router cards for Lifecycle Fact Precedence, FSM Contract Drift, and CQRS Read/Write Blend.
- Added core rules for irreversible fact precedence and CQRS read/write separation.
- Tightened Go event/message review guidance so handlers/reconcilers/process managers require production/runtime wiring proof.
