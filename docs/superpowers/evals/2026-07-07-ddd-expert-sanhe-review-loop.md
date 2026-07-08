# ddd-expert sanhe Review Evaluation Loop

## Current Accepted Review-Loop Lesson

The active direction is not the historical axis-ledger, default subagent, risk-router, or smell-queue protocol. Use a short local loop: breadth scan -> Smell List -> merge same-shape smells -> explain why each smell is wrong -> follow related evidence -> synthesize root cause -> final judgment. Layer Baseline is the source of code-shape truth; references explain triggered concepts and mechanisms.

## Current Evaluation Set After sanhe FSM Fix

This section supersedes the earlier K1-K10 scoring set for the next sanhe
review round. Historical rounds below keep their original scores.

- sanhe branch / commit: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`, with uncommitted FSM fix changes in `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, and `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- FSM fix evidence: `go test ./internal/business/tasknegotiation/domain -count=1` passed; `go test ./internal/business/tasknegotiation/... -count=1` passed.
- Retired from active scoring: former K1, the `go-jimu/components v0.10.0` FSM API compile blocker, is fixed in the current sanhe worktree.
- Retired from active scoring: former K9, FSM v0.10 state-polymorphism usage, is fixed enough for this eval by concrete lifecycle states, `SetState`, `fsm.Transit`, and a regression test that `CurrentState()` exposes `taskAgreementLifecycleState` behavior. Future reviews may mention FSM residual design only if they prove a new bypass; do not score the old K9 miss.

Active known issues for the next round:

- K2: succeeded Payment 后仍可能 pre-funded cancellation，Payment 成功事实没有压过取消。
- K3: PaymentSucceeded recovery / reconciler 不可生产触达或未被 wiring 证明。
- K4: split dispute 把 money execution facts 和 agreement terminal facts 混淆。
- K5: Repository/API 跨候选 aggregate / lifecycle owner 协作，缺 candidate classification 或未升级为 return-to-modeling/design。
- K6: delivery/refund/dispute/settlement 行为联动缺 Domain Event / process manager / reconciler 解释。
- K7: accepted design / semantic repository transaction 被当成过强证据或 waiver。
- K8: payment_failed / payment_cancelled 状态语义不清。
- K10: CQRS read/write repository 混杂风险。

Scoring adjustment: keep the total rubric at 100 points. Redistribute the
45-point breadth component across the eight active known issues above. Former
K1/K9 are regression observations only and should not inflate or penalize the
next-round score unless the reviewer identifies a newly introduced FSM problem.

## Round 2026-07-07 v1.14.21 Baseline

- skill-workshop starting point: `main@1ea2037`, released as `ddd-expert` `1.14.21`.
- hotfix branch: `hotfix/ddd-review-lifecycle-evidence`.
- hotfix commit / PR / merge commit / tag: `adc8af482047de9296460df69e36143031c35f02` / PR #75 / `f6e86c0c4a20a8f23758c853dc3b01d31638cccc` / `v1.14.22` (`49150d4db0ddae83f8f8309a689ab854482eff8e`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe equivalent review path used for baseline capture: `/workspaces/sanhe` in container `optimistic_hawking`, same checkout as `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`, ahead of `origin/feature/task-agreement` by 1; dirty `go.mod`, `go.sum`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`

### Raw ddd-expert Review Output

````text
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
````

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

## Round 2026-07-07 v1.14.22 Re-evaluation

- skill-workshop release under evaluation: `v1.14.22`, release commit `49150d4db0ddae83f8f8309a689ab854482eff8e`.
- preceding hotfix: `adc8af482047de9296460df69e36143031c35f02`, PR #75, merge commit `f6e86c0c4a20a8f23758c853dc3b01d31638cccc`.
- next hotfix branch: `hotfix/ddd-review-anti-overclaim`.
- next hotfix commit / PR / merge commit / tag: `9c43a843e365e11007e738b668ab9a87591b2fc2` / PR #76 / `cc403925a5eb3a8c6f55f28ef1310419d74c454e` / `v1.14.23` (`42cc26f`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`, ahead of `origin/feature/task-agreement` by 1; dirty `go.mod`, `go.sum`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex -a never exec -C /home/xuhao/sanhe -s read-only -o /tmp/sanhe-ddd-review-v1.14.22.md '<fixed review prompt>'`

### Raw ddd-expert Review Output

````text
**Findings**

1. **Blocker: FSM 依赖合约与实现不一致，当前工作树无法编译。**
   当前 [go.mod](/home/xuhao/sanhe/go.mod:7) 使用 `github.com/go-jimu/components v0.10.0`，但 [task_agreement_fsm.go](/home/xuhao/sanhe/internal/business/tasknegotiation/domain/task_agreement_fsm.go:24) 仍按旧 FSM API 实现：有 `TransitionTo`，并调用 [TransitionToNext](/home/xuhao/sanhe/internal/business/tasknegotiation/domain/task_agreement_fsm.go:124)。v0.10 的 `fsm.StateContext` 需要 `SetState(next State) error`，且应通过新的 transit API 推进状态。
   我运行的验证命令失败：

   ```bash
   go test ./internal/business/tasknegotiation/domain -run TestTaskAgreementPaymentFundingAndCancellationBoundaries -count=1
   ```

   关键错误是：

   ```text
   *TaskAgreement does not implement fsm.StateContext (missing method SetState)
   taskAgreementStateMachine().TransitionToNext undefined
   ```

   影响：`TaskAgreement` 生命周期域模型无法编译，后续 payment funding、delivery、refund/dispute、settlement 等测试和运行时 wiring 都无法被有效验证。
   建议按本次 DDD 设计中采用的 v0.10 合约迁移：实现 `SetState(next fsm.State) error`，用 v0.10 的状态迁移入口替换 `TransitionToNext`，并把当前 `go.mod/go.sum` 依赖变更纳入同一个可编译提交。若团队决定继续用 v0.9.9，则应回退依赖并在设计/计划里明确版本基线。

**审查结论**

除上面的编译阻断项外，我没有看到实现偏离本次 spec 的核心领域模型：没有引入 `ManagedWorkspace`、`Funding`、`FundedTask/RefundTask/DisputedTask/SettledTask` 这类被设计排除的对象；`TaskAgreement` 仍是 post-agreement 生命周期核心，`Payment` 是支付尝试对象，`PaymentSucceeded` 作为同 BC domain event 被 handler 消费并推进 funding。

我重点核对了这些边界：

- `PaymentSucceeded` 事件处理与恢复路径存在：[payment_succeeded.go](/home/xuhao/sanhe/internal/business/tasknegotiation/application/eventhandler/payment_succeeded.go:38)、[task_agreement_payment.go](/home/xuhao/sanhe/internal/business/tasknegotiation/application/command/task_agreement_payment.go:299)。
- 运行时注册存在：[tasknegotiation.go](/home/xuhao/sanhe/internal/business/tasknegotiation/tasknegotiation.go:130)。
- Delivery accept/reject、refund case、dispute resolution、refund/settlement execution 都通过领域方法表达授权与状态推进。
- generated proto 基本限制在应用适配层：[application.go](/home/xuhao/sanhe/internal/business/tasknegotiation/application/application.go:1216)，未发现泄漏到 domain/command/query。
- SQL 使用单一 `scripts/sql/init.sql` 是当前项目已接受的早期开发约定，本次不作为 migration 缺陷。

**验证状态**

当前工作树还有未提交的 `go.mod/go.sum` 变更，且该变更直接触发了上述 blocker。由于 domain 包已经无法编译，我没有继续声明 full test 或 MySQL integration test 通过；这些需要先修复 FSM 合约后再跑。
````

### Score

- Breadth: 6 / 45. Found K1 and partially K9 through the FSM API mismatch only. Missed K2-K8 and K10.
- Depth: 7 / 45. K1 evidence, impact, and direction were concrete. It did not pursue independent static model review after the compile blocker.
- Review discipline: 3 / 10. It avoided claiming executable verification, but it used the compile blocker plus absence of forbidden objects as a positive alignment shortcut, treated handler registration/callable command as recovery proof, and overclaimed multiple flows.
- Total: 16 / 100.

### Gap Analysis

- Missing finding: K2 irreversible succeeded execution fact did not dominate the open workflow state.
- Missing finding: K3 recovery/reconciler production reachability was incorrectly treated as satisfied because a handler, command, and runtime registration existed.
- Missing finding: K4 terminal lifecycle facts and money execution facts were not separated.
- Missing finding: K5 candidate aggregate/lifecycle-owner classification did not appear.
- Missing finding: K6 delivery/refund/dispute/settlement behavior linkage was asserted without event/reaction/process-manager/reconciler proof.
- Missing finding: K7 accepted design/local convention was still used as a waiver for SQL/migration shape.
- Missing finding: K8 failed/cancelled state semantics were not challenged.
- Shallow finding: K9 stayed at FSM API compatibility and did not inspect state polymorphism.
- Missing finding: K10 CQRS read/write repository blending risk was not reported.
- Overclaim: "no core model deviation" was concluded from compile-blocker scope, absence of forbidden nouns, handler existence, and broad checked-flow assertions.

### Post-review Calibration

- calibration command: `codex -a never exec -C /home/xuhao/sanhe -s read-only -o /tmp/sanhe-ddd-review-v1.14.22-reflection.md '<post-hoc known-issue reflection prompt>'`
- calibration output path: `/tmp/sanhe-ddd-review-v1.14.22-reflection.md`.
- calibration method: after the original review concluded, provide K1-K10 as the known issue / scoring set and ask the reviewer to explain why the original review missed or shallowly found each item.
- reviewer-identified miss patterns:
  - compile blocker anchoring stopped independent static model review after K1;
  - handler existence, command existence, and runtime registration were treated as recovery proof;
  - absence of forbidden tactical nouns was treated as model proof;
  - accepted design and local convention were treated as waivers;
  - checked flows were written as broad alignment without per-row classification;
  - Event Timeline Reconciliation, candidate classification, CQRS split, and FSM state polymorphism were not carried through after API mismatch.
- reviewer-identified downgrades:
  - "no core model deviation" should be an evidence gap until lifecycle/event/recovery/repository/FSM/CQRS rows are classified;
  - same-BC event handler and runtime registration should be evidence gap or return-to-design without production recovery reachability;
  - delivery/refund/dispute/settlement alignment should be return-to-modeling/design without fact separation and collaboration mechanism proof;
  - accepted SQL/local convention cannot waive repository transaction, aggregate boundary, or lifecycle collaboration questions.

### Generic Fix Summary

- Added release assertions that the review protocol reject compile blockers as positive model evidence, block broad model-alignment conclusions until mandatory coverage rows are classified, and reject absence of forbidden nouns as model proof.
- Tightened recovery proof rules generically: handler registration alone and callable commands are not production recovery reachability proof; swallowed/logged dispatch failure after a durable fact requires retry, reconciliation, or command guards.
- Updated review/core/router/event guidance so checked flows require evidence-backed classification rather than broad "aligned" conclusions.
- Added a post-review calibration protocol: when a user provides a known issue or scoring set after the initial review conclusion, compare against the original output, reflect why misses happened, and convert repeated miss patterns into generic rules, output contracts, risk-router changes, or eval assertions.

## Round 2026-07-07 v1.14.23 Re-evaluation

- skill-workshop release under evaluation: `v1.14.23`, release commit `42cc26f`.
- preceding hotfix: `9c43a843e365e11007e738b668ab9a87591b2fc2`, PR #76, merge commit `cc403925a5eb3a8c6f55f28ef1310419d74c454e`.
- next hotfix branch: `hotfix/ddd-review-coverage-matrix`.
- next hotfix commit / PR / merge commit / tag: `8e49640d539a0bd24f88ea5d952fdb67047904c8` / PR #77 / `9dca4837b2c5d448fe177d9a0a2c0a9b8461cf59` / `v1.14.24` (`58da9fc`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never --sandbox read-only review '<fixed review prompt>' > /tmp/sanhe-ddd-review-v1.14.23.md 2>&1`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.23.md`, 15,977 lines, 763,773 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.23-reflection.md`, 104 lines, 10,750 bytes.

### Raw ddd-expert Review Output Summary

The final review block was duplicated in the saved output. Its substantive findings were:

```text
- [P1] Keep the FSM dependency on the implemented API
  go-jimu/components/fsm v0.10.0 requires StateContext.SetState and no longer exposes StateMachine.TransitionToNext, while the implementation still uses the older contract.

- [P1] Provide a reachable payment-success reconciler
  When a succeeded Payment is saved but event dispatch is rejected or missed, the agreement remains payment_pending. The reconciler command is only targeted by TaskAgreementID and only instantiated from tests, with no production Application/Fx/API/scheduler wiring.

- [P2] Keep split refunds from marking agreements refunded
  Split refund/settlement paths set terminal timestamps and emit terminal agreement facts while the agreement is still disputed and before split closure.
```

### Post-review Calibration Summary

- Found: K1, K3, K4.
- Shallowly found: K2, K6, K9.
- Missed: K5, K7, K8, K10.
- Reviewer-identified failure modes:
  - coverage matrix was not enforced;
  - PaymentSucceeded fact precedence was under-generalized to recovery only, not every stale-state retry/cancel/reopen command;
  - FSM review anchored on API mismatch and skipped state-polymorphism conformance;
  - accepted design/tests and semantic repository methods were over-trusted;
  - probe output was not converted into explicit coverage decisions;
  - terminal fact separation stayed a local split-dispute finding rather than a general collaboration/timeline review.

### Score

- Breadth: 26 / 45. Fully found K1, K3, K4; shallowly touched K2, K6, K9; missed K5, K7, K8, K10.
- Depth: 24 / 45. The three concrete findings had useful evidence and impact. The review did not complete candidate classification, stale-state command enumeration, CQRS classification, state-language semantics, or FSM state-polymorphism analysis.
- Review discipline: 6 / 10. It no longer stopped at the compile blocker and avoided the worst broad "all aligned" claim, but it omitted required evidence-gap/return rows, let probes disappear from final output, and duplicated the final answer block.
- Total: 56 / 100.

### Gap Analysis

- Previous optimization effectiveness: partially effective. v1.14.23 improved from 16 to 56 and found K3/K4 after the overclaim/recovery-proof gates, but the final answer still omitted mandatory rows. The optimization approach is changing from more rule reminders to a mandatory coverage matrix/output contract where each probed risk must be classified.
- Missing finding: K5 aggregate/lifecycle-owner candidate classification was loaded in rules but not emitted as finding, evidence gap, or return route.
- Missing finding: K7 accepted design and semantic repository methods were still over-trusted because no candidate classification or repository-boundary row appeared.
- Missing finding: K8 payment_failed/payment_cancelled state-language semantics were probed but not classified.
- Missing finding: K10 CQRS split was probed but not classified; QueryRepository naming was treated as enough.
- Shallow root cause: K2 was framed as missing recovery only; the review did not enumerate every stale workflow command that still permits retry/cancel/reopen/refund after an irreversible fact.
- Shallow root cause: K6 appeared only through one split terminal-fact symptom, not a full same-BC event/process/reconciler collaboration review.
- Shallow root cause: K9 stopped at FSM API compatibility and did not separately review state polymorphism.
- Output contract issue: final review block was duplicated in the saved raw output.

### Generic Fix Summary

- Added release assertions for a mandatory coverage matrix, every probed risk ending as a decision, stale-state command enumeration after irreversible facts, candidate classification for multi-owner repository evidence, fact-to-event/process/reconciler ownership, FSM API/polymorphism subrows, QueryRepository-name insufficiency, state-language semantics, and duplicate final answer rejection.
- Strengthened review output contract so lifecycle reviews classify mandatory rows before broad alignment claims.
- Strengthened risk router rules for stale-state commands, multi-owner repository evidence, event/process/reconciler ownership, FSM subrows, and CQRS proof.
- Strengthened core rules with a mandatory coverage matrix including state-language semantics.

## Round 2026-07-07 v1.14.24 Re-evaluation

- skill-workshop release under evaluation: `v1.14.24`, release commit `58da9fc`.
- preceding hotfix: `8e49640d539a0bd24f88ea5d952fdb67047904c8`, PR #77, merge commit `9dca4837b2c5d448fe177d9a0a2c0a9b8461cf59`.
- next hotfix branch: `hotfix/ddd-review-candidate-ledger`.
- next hotfix commit / PR / merge commit / tag: `a289847e1136a594f428cdb9b69b76435f5949dd` and `9c39ed752ec3bf8e376af79c568f6a081034dc0c` / PR #78 / `11d9d0c6d97b97955036b085584bf18da7959fef` / `v1.14.25` (`cd120ac`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`, ahead of `origin/feature/task-agreement` by 1; dirty `go.mod`, `go.sum`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.24.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.24.md`, 5,417 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.24-reflection.md`, 13,763 bytes.

### Raw ddd-expert Review Output Summary

```text
Finding: Blocker Domain Abstraction PaymentSucceeded 后仍可取消协议
- Durable succeeded Payment can exist while TaskAgreement remains payment_pending, and cancellation only checks agreement state.

Finding: Blocker Code-level DDD/technology PaymentSucceeded reconciler 没有生产可达路径
- ReconcileSucceededPayments exists as a command handler but has no Application/RPC/scheduler/task/runtime production path.

Finding: Blocker Code-level DDD/technology dirty go.mod bumps FSM to v0.10 without adapting StateContext
- Current dirty dependency state requires SetState(next State) while TaskAgreement still implements old TransitionTo shape.

Coverage Matrix:
- Aggregate candidates: checked by naming candidate owners.
- Terminal/execution facts: finding, but only payment success vs cancellation.
- CQRS split: checked, read DTO/query repo separated from write repos.
- State-language semantics: checked for core lifecycle naming and absence of FundedTask/Funding.
```

### Post-review Calibration Summary

- Found: K1, K2, K3.
- Shallowly found: K5, K9, K10.
- Missed: K4, K6, K7, K8.
- Previous optimization effectiveness: partially effective but not stable. The coverage matrix kept more rows visible and improved K2/K3, but it was used as a summary rather than a gate; bare `checked` rows had no per-flow evidence, candidate decisions, or explicit evidence gaps.
- Required approach change: move from "matrix exists" to "candidate ledger and per-flow evidence gate". A checked row must name proof, the rule satisfied, and why it is not a finding; otherwise it becomes evidence gap or return-to-design/modeling.

### Score

- Breadth: 25 / 45. Fully found K1, K2, K3; shallowly touched K5, K9, K10; missed K4, K6, K7, K8.
- Depth: 27 / 45. K1-K3 were evidence-backed with useful impact and direction. K5/K9/K10 were only matrix labels or partial checks without root-cause depth.
- Review discipline: 6 / 10. It no longer stopped at compile blocker and avoided a broad no-finding conclusion, but overclaimed bare `checked` rows, used absence of forbidden nouns for state-language semantics, and let accepted repository/model evidence act too favorably.
- Total: 58 / 100.

### Gap Analysis

- Missing finding: K4 split money execution and agreement terminal closure was missed after being found in v1.14.23.
- Missing finding: K6 delivery/refund/dispute/settlement event/process/reconciler collaboration was not reviewed per flow.
- Missing finding: K7 accepted design and semantic repository transaction evidence still acted as implicit waiver because candidate classification was only a list.
- Missing finding: K8 payment_failed/payment_cancelled state-language semantics were not challenged.
- Shallow root cause: K5 aggregate candidates were enumerated but not classified into a candidate ledger with decision/evidence/return route.
- Shallow root cause: K9 FSM API mismatch was found, but state-polymorphism conformance remained shallow.
- Shallow root cause: K10 CQRS was marked checked without proof of caller semantics, read-model family, or shared implementation separation.
- Overclaim: `checked` rows lacked file/path/proof notes and did not name the specific rule satisfied.

### Generic Fix Summary

- Added release assertions for candidate ledger, per-flow Event Timeline Reconciliation, recovery reachability table, strict checked-row proof fields, split money execution versus aggregate terminal closure, retry-state semantics, and CQRS proof beyond names/shared adapters.
- Strengthened review output contract so checked rows must name evidence, the exact rule satisfied, and why the risk is not a finding.
- Strengthened risk/core rules to separate split execution facts from aggregate terminal closure, route ambiguous failed/cancelled/pending states as state-language semantics risks, and reject shared infrastructure implementation as CQRS proof.

## Round 2026-07-07 v1.14.25 Re-evaluation

- skill-workshop release under evaluation: `v1.14.25`, release commit `cd120ac`.
- preceding hotfix: `a289847e1136a594f428cdb9b69b76435f5949dd` and `9c39ed752ec3bf8e376af79c568f6a081034dc0c`, PR #78, merge commit `11d9d0c6d97b97955036b085584bf18da7959fef`.
- next hotfix branch: `hotfix/ddd-review-output-contract`.
- next hotfix: `9cac0c73d12fd172c91b7bccf92b43ab6037e1a8`, PR #79, merge commit `5b5b4b5548486f88a50e66feec97e7aa61c05d7c`, release `v1.14.26` (`635bacd86401da97d6de44f19bd7ae06ad9973fa`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command template: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message <output> '<fixed review prompt>'`
- complete raw review outputs:
  - A: `/tmp/sanhe-ddd-review-v1.14.25.md`, 4,684 bytes.
  - B: `/tmp/sanhe-ddd-review-v1.14.25-b.md`, 4,570 bytes.
  - C: `/tmp/sanhe-ddd-review-v1.14.25-c.md`, 5,768 bytes.
- post-review calibration outputs:
  - A: `/tmp/sanhe-ddd-review-v1.14.25-reflection.md`, 15,436 bytes.
  - B: `/tmp/sanhe-ddd-review-v1.14.25-b-reflection.md`, 14,210 bytes.
  - C: `/tmp/sanhe-ddd-review-v1.14.25-c-reflection.md`, 12,626 bytes.

### Three-Reviewer Output Summary

- Reviewer A found K1/K2, shallowly covered K3/K9, and missed K4/K5/K6/K7/K8/K10. It produced only two findings and no mandatory ledger/matrix sections.
- Reviewer B found K1/K2/K3, shallowly covered K5/K7/K9, and missed K4/K6/K8/K10. It still used a prose coverage classification rather than the required ledger/matrix sections.
- Reviewer C found K1/K2/K3/K4, shallowly covered K5/K6/K9, and missed K7/K8/K10. It additionally found an infrastructure-owned delivery lifecycle transition, but still collapsed candidate ledger and coverage proof into prose.

### Score

- Breadth: 30 / 45. Stable coverage: K1, K2. Mostly stable: K3. Unstable/one-run coverage: K4. Shallow coverage: K5, K6, K7, K9. Missed across the ensemble: K8 and K10.
- Depth: 29 / 45. K1-K3 had concrete evidence, impact, and implementation direction in most runs; K4 was deep only in one run. K5/K6/K7/K9 lacked complete candidate decisions, event/process/reconciler proof, accepted-design non-waiver analysis, or state-polymorphism depth.
- Review discipline: 5 / 10. The review no longer always stops at compile blockers, but all three outputs failed to emit mandatory Candidate ledger / Per-flow Event Timeline Reconciliation / Recovery reachability table / Mandatory coverage matrix sections. `checked` rows remained unsupported prose, and high-severity findings still narrowed attention.
- Total: 64 / 100.

### Gap Analysis

- Previous optimization effectiveness: partially effective but not reliable enough. The v1.14.24 fix improved some rows and one reviewer found K4, but the intended Candidate ledger / checked-row proof contract was not actually reflected in final output. The optimization did not become a hard output gate.
- Missing finding: K8 state-language semantics was missed in all three outputs; failed/cancelled/pending style states were not forced into a state-language row.
- Missing finding: K10 CQRS read/write blending was missed or over-checked; QueryRepository/read model naming was still treated too favorably without caller-semantics and shared-adapter proof.
- Shallow root cause: K5 candidate aggregate/lifecycle-owner classification appeared only as prose in B/C, not as a decision ledger with evidence and return route.
- Shallow root cause: K6 behavior linkage was detected in one extra delivery placement finding and one shallow reflection, but not as a full per-flow event/process/reconciler review.
- Shallow root cause: K7 accepted design and semantic repository transaction non-waiver remained weak; the reviewers did not force accepted evidence through candidate classification.
- Shallow root cause: K9 FSM API mismatch was consistently found, but state polymorphism was shallow or masked by compile errors.
- Overclaim: coverage summaries used `checked` without the exact rule satisfied and why the risk was not a finding.
- Strategy change: move from "instructions say produce a ledger" to "final output template contains required lifecycle sections with fixed proof columns, and tests assert those sections/columns exist". Findings or compile blockers cannot remove mandatory sections.

### Generic Fix Summary

- Added release assertions that the review output template must contain explicit `Candidate ledger:`, `Per-flow Event Timeline Reconciliation:`, `Recovery reachability table:`, and `Mandatory coverage matrix:` sections with generic proof columns.
- Strengthened the review output contract so lifecycle sections are required even when findings already exist, compile/build blockers cannot remove sections, and checked-flow prose cannot replace mandatory sections.
- Strengthened core/router rules to state that mandatory lifecycle output sections remain required after high-severity findings and compile blockers.
- Strengthened the aggregate-boundary ledger so multi-candidate Repository/API evidence requires role, owner proof, Repository/API evidence, decision, and return route; unclassified or owner-unproven candidates cannot be marked checked.

## Round 2026-07-08 v1.14.26 Re-evaluation

- skill-workshop release under evaluation: `v1.14.26`, release commit `635bacd86401da97d6de44f19bd7ae06ad9973fa`.
- preceding hotfix: `9cac0c73d12fd172c91b7bccf92b43ab6037e1a8`, PR #79, merge commit `5b5b4b5548486f88a50e66feec97e7aa61c05d7c`.
- next hotfix branch: `hotfix/ddd-review-counterfactual-gateway`.
- next hotfix commits: `f2d0a1c415a86afba11464bf183b0788c4926d81`, `e21625f55376ae6c25437b9de0bf58e45f898075`; PR #80, merge commit `e74441ce82d3a2f530e71f55bcd41032a928d466`, release `v1.14.27` (`ccdc239f16f98755c82da6c1144b590eb1ac4d42`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- sanhe FSM blocker status: fixed in dirty worktree; `go test ./...` passed after migrating to concrete v0.10 FSM states.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command template: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message <output> '<fixed review prompt>'`
- complete raw review outputs:
  - A: `/tmp/sanhe-ddd-review-v1.14.26-a.md`, 5,419 bytes.
  - C: `/tmp/sanhe-ddd-review-v1.14.26-c.md`, 6,414 bytes.
  - B: shutdown before completion after exceeding the new single-subagent objective; excluded from scoring.
- post-review calibration outputs:
  - A: `/tmp/sanhe-ddd-review-v1.14.26-a-reflection.md`, 19,094 bytes.
  - C: `/tmp/sanhe-ddd-review-v1.14.26-c-reflection.md`, 19,150 bytes.

### Output Summary

- Reviewer A found K3 and K4. K5 and K7 were shallow. K2, K6, K8, and K10 were missed.
- Reviewer C found K3 and K5. K2, K6, and K7 were shallow. K4, K8, and K10 were missed.
- Former K1/K9 were not active scoring items after the sanhe FSM fix.

### Score

- Breadth: 26 / 45. Stable coverage: K3. One-run coverage: K4 and K5. Shallow coverage: K2, K6, and K7. Missed across completed runs: K8 and K10.
- Depth: 26 / 45. K3 was evidence-backed with clear impact and fix direction. K4 was deep only in A; K5 was meaningful only in C. K2/K6/K7 lacked root-cause depth, and K8/K10 were absent.
- Review discipline: 6 / 10. v1.14.26 improved by removing compile-blocker anchoring and causing one review to return K5 to modeling, but both outputs still compressed the mandatory ledger/timeline/matrix into prose and treated some checked rows as too easy.
- Total: 58 / 100.

### Gap Analysis

- Previous optimization effectiveness: partially effective but below target. The owner-proof candidate ledger helped C finally classify K5 as return-to-modeling, but the ledger was not consistently emitted or used as a reasoning tool. Mandatory sections became labels/prose rather than a reliable defect-discovery process.
- Missing finding: K8 state-language semantics remains stable miss; reviewers do not ask whether failed/cancelled/pending names describe child-process facts rather than aggregate lifecycle facts.
- Missing finding: K10 CQRS split remains stable miss; reviewers still accept QueryRepository naming without falsifying caller semantics, DTO family, write-side overlap, or shared adapter behavior.
- Shallow root cause: K2 durable succeeded fact precedence was reduced to recovery in A and shallowly reflected in C; reviewers did not enumerate command rights that stale workflow state still grants.
- Shallow root cause: K6 event/process/reconciler collaboration remained shallow and was not reconciled across delivery/refund/dispute/settlement flows.
- Shallow root cause: K7 accepted design and semantic repository transactions were questioned in reflections but not consistently converted into final findings or returns.
- Overclaim: checked rows were not tested against "what evidence would falsify this checked conclusion?"
- Strategy change: stop adding one more scenario rule. Add a counterfactual discovery pass: after draft findings, the reviewer must try to falsify each checked row and ask gateway questions that expose hidden stale-state rights, owner-proof gaps, missing reaction contracts, state-language ambiguity, and CQRS semantic blending.

### Generic Fix Summary

- Added a generic counterfactual review gateway: draft findings and checked rows are provisional until the reviewer tries to falsify them against durable fact precedence, owner proof, reaction/recovery reachability, state-language semantics, and CQRS read/write semantics.
- Added release assertions for the gateway in the review skill, risk router, and core rule cards so future edits cannot silently drop the self-disconfirmation pass.

## Round 2026-07-08 v1.14.27 Re-evaluation

- skill-workshop release under evaluation: `v1.14.27`, release commit `ccdc239f16f98755c82da6c1144b590eb1ac4d42`.
- preceding hotfix: `f2d0a1c415a86afba11464bf183b0788c4926d81` and `e21625f55376ae6c25437b9de0bf58e45f898075`, PR #80, merge commit `e74441ce82d3a2f530e71f55bcd41032a928d466`.
- next hotfix branch: `hotfix/ddd-review-falsification-ledger`.
- next hotfix commit: `b083e1fbfda2ee531fdaecf601877acb7f390808`; PR #81, merge commit `ee253b56419d077b56a34d776cb83596fde9f7f3`, release `v1.14.28` (`b8ca0fa892abb89bb4546b24084c7b361fc80a36`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- reviewer model / reasoning evidence: subagent and nested `codex exec` used no explicit override; `/home/xuhao/.codex/config.toml` sets `model = "gpt-5.5"` and `model_reasoning_effort = "xhigh"`.
- plugin evidence: `codex plugin marketplace upgrade` completed; `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.27`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.27.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.27.md`, 5,457 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.27-reflection.md`, 11,061 bytes.

### Output Summary

- The reviewer found K2/K3 together: succeeded Payment can be durable while agreement remains `payment_pending`, cancellation checks only agreement state, and the reconciler lacks production reachability proof.
- The reviewer found K4: split dispute emits refund/settlement money-execution events while aggregate closure happens separately without a dispute-resolution closure fact.
- The reviewer found K8: `payment_failed` / `payment_cancelled` look like payment-attempt language leaking into agreement lifecycle and are not produced by normal command paths.
- The reviewer missed K5 and K10 outright.
- The reviewer overclaimed K6/K7 by clearing delivery/refund/dispute/settlement linkage with synchronous command/repository transaction shape and accepted design rather than owner proof, event/process/reconciler rationale, and semantic repository non-waiver.

### Score

- Breadth: 29 / 45. Strong coverage: K2, K3, K4, K8. Missed: K5 and K10. K6/K7 were touched only through overclaimed "no concrete finding" rows.
- Depth: 26 / 45. K2/K3/K4/K8 had concrete evidence and direction, but K2 was bundled with recovery instead of separated as durable-fact precedence, and K5/K6/K7/K10 lacked required candidate, collaboration, non-waiver, and CQRS analysis.
- Review discipline: 6 / 10. The review did not stop at executable verification failure and avoided compile-blocker anchoring, but it still omitted the required Mandatory coverage matrix and did not emit an explicit counterfactual defect-hunt / falsification ledger before final checked claims.
- Total: 61 / 100.

### Gap Analysis

- Previous optimization effectiveness: partially effective. The counterfactual gateway likely helped surface K8 and made K2/K3 more explicit, but it remained a prose instruction rather than a hard final-output step.
- Missing finding: K5 aggregate-boundary candidate classification was not run; the review did not classify every repository/API participant as aggregate root, owned child, decision record, execution record, reaction/process artifact, read model, or external fact.
- Missing finding: K10 CQRS read/write blending remained absent; no mandatory row classified write-side repositories, QueryRepositories/read facades, DTO/read-model family, caller semantics, or shared adapter overlap.
- Overclaim: K6 delivery/refund/dispute/settlement behavior linkage was cleared because command/repository transactions looked synchronous; the review did not force each cross-lifecycle transition to choose same-aggregate behavior, Domain Event reaction, process manager, reconciler, Integration Message, or owner-proven synchronous decision record.
- Overclaim: K7 accepted design and semantic repository transaction shape were treated as strong evidence; the review did not restate accepted design as evidence-not-waiver or transaction shape as implementation evidence only.
- Strategy change: move the counterfactual gateway from hidden/prose instruction into the required output schema. Final output must include a `Counterfactual defect hunt:` section with per-row falsification questions and decisions; a `No concrete finding` / `checked` row is invalid unless it names what would falsify it and the evidence inspected.

### Generic Fix Summary

- Added a mandatory counterfactual falsification ledger to the review output contract so checked/no-finding rows must name the falsifier question, inspected evidence, and decision.
- Strengthened risk-router/core rules so no-finding rows remain provisional until falsification evidence is named.
- Removed the unrelated hard 105-line review-skill limit from release tests; the user did not require it and it was pushing protocol text toward harmful compression.

## Round 2026-07-08 v1.14.28 Re-evaluation

- skill-workshop release under evaluation: `v1.14.28`, release commit `b8ca0fa892abb89bb4546b24084c7b361fc80a36`.
- preceding hotfix: `b083e1fbfda2ee531fdaecf601877acb7f390808`, PR #81, merge commit `ee253b56419d077b56a34d776cb83596fde9f7f3`.
- next hotfix branch: `hotfix/ddd-review-proof-artifacts`.
- next hotfix commit: `7aeb2271ca6412c6c0810b68d95d5c0c036d2e69`; PR #82, merge commit `3e0c2f1c2f31a53022d95ca288357156e32286bf`, release `v1.14.29` (`6b15d3143cfc6f90dbca1515b86f9cdf43e954fe`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade` completed; `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.28`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.28.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.28.md`, 9,316 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.28-reflection.md`, 9,381 bytes.

### Output Summary

- The reviewer found K2: durable `PaymentSucceeded` does not close retry/cancel rights while agreement remains open.
- The reviewer found K3: the payment reconciler exists but is not production-reachable.
- The reviewer found K8: `payment_failed` / `payment_cancelled` are unowned agreement states that look like child-process language.
- The reviewer overclaimed K4: it marked split dispute terminal/execution facts checked after seeing separate money execution objects and a split-closure method, without proving every authorization, execution, and aggregate closure fact.
- The reviewer overclaimed K5: it named aggregate-boundary candidates but marked them checked with accepted design and transaction disclaimers instead of owner-proof classification per Repository/API operation.
- The reviewer shallowly covered K6/K7 and overclaimed K10: synchronous command/repository transactions, accepted design, QueryRepository naming, and DTO/package shape were treated as sufficient proof.

### Score

- Breadth: 23 / 45. Found K2, K3, and K8. K6/K7 were touched shallowly. K4/K5/K10 were present only as overchecked rows.
- Depth: 20 / 45. Payment precedence/recovery depth was strong, state-language semantics was adequate, but split facts, aggregate candidate proof, event/process ownership, accepted-design non-waiver, and CQRS falsification were weak.
- Review discipline: 6 / 10. The output included mandatory sections and a counterfactual defect hunt, but it violated the intent by marking several rows checked without their required proof artifacts.
- Total: 49 / 100.

### Gap Analysis

- Previous optimization effectiveness: failed in the intended direction. The falsification ledger appeared, but it covered only a few rows and did not force weak checked rows to downgrade.
- Overclaim: K4 needs a terminal/execution proof artifact. A split or multi-execution flow cannot be checked from object separation alone; it needs authorization fact, execution fact, aggregate closure fact, owner, trigger, persistence boundary, and recovery stance.
- Overclaim: K5 needs a Repository/API candidate proof artifact per operation. A generic candidate list plus accepted design disclaimer is not enough to mark aggregate-boundary risk checked.
- Shallow root cause: K6 needs behavior-linkage classification for every cross-lifecycle transition: same-aggregate invariant, application coordination, Domain Event reaction, process manager, reconciler, Integration Message, or owner-proven synchronous decision record.
- Overclaim: K7 shows that knowing "accepted design is not waiver" is insufficient; checked rows must name independent code evidence implementing the accepted decision, or return/evidence-gap.
- Overclaim: K10 needs a CQRS semantic proof artifact covering caller semantics, port/interface methods, returned model family, write-side overlap, and adapter overlap. QueryRepository names and DTOs are not proof.
- Strategy change: introduce checked-row proof artifacts. A mandatory coverage row can be `checked` only if it cites the artifact type required for that risk family; otherwise it must be finding, evidence gap, or return route.

### Generic Fix Summary

- Added proof-artifact requirements for checked rows: aggregate-boundary rows require candidate classification and owner proof, event/reaction rows require per-flow timeline proof, split/terminal rows require terminal/execution fact proof, and CQRS rows require semantic split proof.
- Added output sections for checked-row proof artifacts, terminal/execution fact table, and CQRS semantic split table.
- Strengthened router/core rules so transaction evidence, accepted design, QueryRepository names, DTOs, and package shape can populate evidence but cannot by themselves satisfy a checked row.

## Round 2026-07-08 v1.14.29 Re-evaluation

- skill-workshop release under evaluation: `v1.14.29`, release commit `6b15d3143cfc6f90dbca1515b86f9cdf43e954fe`.
- preceding hotfix: `7aeb2271ca6412c6c0810b68d95d5c0c036d2e69`, PR #82, merge commit `3e0c2f1c2f31a53022d95ca288357156e32286bf`.
- next hotfix branch: `hotfix/ddd-review-lifecycle-output-gate`.
- next hotfix commit: `b8affb03fffd27893658f906c52545c23e9ff1a5`; PR #83, merge commit `2020cd326e58bac87af8228ee4e5da9d51c85222`, release `v1.14.30` (`5c2a4a05010ace89ab67f8ab562a9836b43d6fe0`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade` completed; `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.29`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.29.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.29.md`, 6,577 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.29-reflection.md`, 10,340 bytes.
- verification inside review: targeted domain/application and eventhandler tests passed; infrastructure-focused test was interrupted after about 120 seconds.

### Output Summary

- The reviewer found K2 with concrete evidence: succeeded Payment can remain durable while agreement cancellation is still allowed.
- The reviewer found K3 with concrete evidence: payment reconciler exists but is not reachable through production API/scheduler/runtime wiring.
- The reviewer reported a minor FSM state-polymorphism drift, but this is outside the active K1/K9-retired scoring set and did not deeply cover K8.
- The reviewer overclaimed K4/K5/K10 as checked and shallowly covered K6/K7/K8. It used candidate/flow/CQRS summary prose instead of the new proof artifact sections.

### Score

- Breadth: 19 / 45. Strong coverage: K2 and K3. Shallow/caveat coverage: K6, K7, K8. Overchecked/missed: K4, K5, K10.
- Depth: 20 / 45. Payment precedence and recovery depth were strong, but split facts, aggregate candidate classification, event/process ownership, accepted-design non-waiver, state-language semantics, and CQRS semantic proof were weak.
- Review discipline: 6 / 10. The review found real blockers and ran useful targeted tests, but it ignored the newly required proof-artifact tables and still used broad "checked" summaries.
- Total: 45 / 100.

### Gap Analysis

- Previous optimization effectiveness: failed. The proof-artifact rules existed in the plugin, but the reviewer did not emit the proof-artifact sections and still used compressed checked-flow prose.
- Overclaim: K4 remains unchecked in substance because the review never produced a terminal/execution fact table for split dispute.
- Overclaim: K5 remains unchecked because the "candidate ledger" was a noun inventory, not a Repository/API operation-level candidate classification with owner proof and return routes.
- Shallow root cause: K6 remains shallow because non-payment flows were grouped as checked without forcing a behavior-linkage mechanism per transition.
- Overclaim: K7 remains shallow because accepted design and semantic transaction shape still lowered proof requirements in checked rows.
- Shallow root cause: K8 was mentioned as a caveat but not converted into a finding/evidence gap/return route.
- Overclaim: K10 remains unchecked because "CQRS checked" appeared without the semantic split table.
- Strategy change: make lifecycle scope a non-compact review. If lifecycle/repository/event/CQRS scope is present, the final answer is invalid unless all required proof-artifact sections are present and non-empty, and prohibited compressed checked phrases are downgraded before final output.

### Generic Fix Summary

- Added a lifecycle review completion gate: lifecycle/repository/event/CQRS scope is not a small review, and the final answer is invalid unless required proof-artifact sections are present and non-empty.
- Added output completion gate columns and explicit downgrade rules for broad checked-flow summaries, checked-with-caveat rows, and accepted-design/naming/transaction/DTO-only proof.
- Strengthened router/core rules so compact lifecycle output and empty required sections become evidence gaps or return routes.

## Round 2026-07-08 v1.14.30 Re-evaluation

- skill-workshop release under evaluation: `v1.14.30`, release commit `5c2a4a05010ace89ab67f8ab562a9836b43d6fe0`.
- preceding hotfix: `b8affb03fffd27893658f906c52545c23e9ff1a5`, PR #83, merge commit `2020cd326e58bac87af8228ee4e5da9d51c85222`.
- next hotfix branch: `hotfix/ddd-review-no-evidence-matrix`.
- next hotfix commit: `92f038cefa52b0c346527a13c4e91a2a969ba2b6`; PR #84, merge commit `6138f8be3a4b5e692ddd782d836a61fdd8fe0ab3`, release `v1.14.31` (`6bb64743d99cfab191756f30624446523e4386db`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade` completed; `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.30`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.30.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.30.md`, 4,316 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.30-reflection.md`, 9,759 bytes.
- verification inside review: `go test ./internal/business/tasknegotiation/domain -count=1`, `go test ./internal/business/tasknegotiation/application -run 'Payment|SplitResolution|Dispute|Refund|Settlement' -count=1`, and `go test ./internal/business/tasknegotiation/... -run '^$' -count=1` passed.

### Output Summary

- The reviewer found K2 with concrete stale-state evidence and fix direction.
- The reviewer found K3 with concrete production reachability evidence.
- The reviewer found K4 with concrete event/fact-language evidence.
- The reviewer overclaimed K5/K7/K10 in an `Evidence Matrix`, treating aggregate candidates, semantic transactions, and CQRS split as directionally correct without mandatory proof artifacts.
- The reviewer missed K6 and K8 in the final artifact.

### Score

- Breadth: 24 / 45. Found K2, K3, and K4. Missed K6 and K8. K5/K7/K10 appeared only as overclaimed checked matrix rows.
- Depth: 24 / 45. K2/K3/K4 had concrete evidence, impact, and direction. K5/K6/K7/K8/K10 lacked candidate classification, behavior-linkage ownership, accepted-design non-waiver, state-language semantics, and CQRS semantic split proof.
- Review discipline: 5 / 10. The review ran useful tests and produced strong findings, but violated the lifecycle output contract by replacing mandatory proof sections with a compact `Evidence Matrix`.
- Total: 53 / 100.

### Gap Analysis

- Previous optimization effectiveness: partially effective. The completion-gate prompt helped recover K4, but did not prevent the reviewer from writing a compact `Evidence Matrix`.
- Overclaim: K5 was reduced to "aggregate candidates basically align with design" without a candidate ledger or return route.
- Missing finding: K6 was not reviewed as per-flow behavior linkage with Domain Event/process manager/reconciler/command-transaction rationale.
- Overclaim: K7 persisted because "semantic transactions match design" was treated as positive evidence rather than a trigger for proof.
- Missing finding: K8 disappeared from the final artifact.
- Overclaim: K10 used "Product reads use query DTO; command side uses domain repositories" as proof without a CQRS semantic split table.
- Strategy change: directly forbid `Evidence Matrix` and other free-form substitute summaries for lifecycle/repository/event/CQRS scope. The final output must use exact mandatory section names; free-form matrices may only appear after mandatory sections and cannot contain `checked` decisions.

### Generic Fix Summary

- Removed the conflicting small-review escape for lifecycle/repository/event/CQRS scope and replaced it with concise-output wording only for non-triggered gates.
- Added explicit rules/tests that `Evidence Matrix`, summary tables, or free-form matrices cannot replace mandatory proof-artifact sections and cannot carry checked decisions.
- Required exact mandatory section names so broad summary matrices cannot satisfy lifecycle output completion.

## Round 2026-07-08 v1.14.31 Re-evaluation

- skill-workshop release under evaluation: `v1.14.31`, release commit `6bb64743d99cfab191756f30624446523e4386db`.
- preceding hotfix: `92f038cefa52b0c346527a13c4e91a2a969ba2b6`, PR #84, merge commit `6138f8be3a4b5e692ddd782d836a61fdd8fe0ab3`.
- next hotfix branch: `hotfix/ddd-review-decision-proof-gate`.
- next hotfix commit: `36489eff84ad43a20f335bd1800f160b8b124a7f`; PR #85, merge commit `42d8f555e05e05bc85c53db80c2105bcc3a774fa`, release `v1.14.32` (`f806be7cb54be3540c77231cd16eb7ff988fc046`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade` completed; reviewer reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.31`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: background reviewer in `/home/xuhao/sanhe` using the fixed prompt after plugin upgrade.
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.31.md`, 13,758 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.31-reflection.md`, 10,212 bytes.
- verification inside review: `git diff --check origin/feature/task-agreement` passed; focused Go test could not start in the review sandbox because Go cache/module-cache paths were read-only.

### Output Summary

- The reviewer found K2 with concrete irreversible fact precedence evidence: a durable succeeded payment can leave the agreement `payment_pending`, while cancellation and retry paths still rely on stale agreement state.
- The reviewer found K3 inside the same finding and recovery table: the reconciler exists as a callable command/test path but production RPC/module/scheduler reachability was not proven.
- The reviewer found K4 with concrete split-dispute evidence: money execution facts can emit terminal-looking agreement events before the aggregate closure fact.
- The reviewer found K5/K7 directionally: multi-root semantic repository transactions were returned to modeling/design, and transaction shape was not treated as aggregate-boundary proof.
- The reviewer shallowly covered K6 and K8: linked delivery/refund/dispute/settlement behavior and parent payment failure/cancellation state language appeared as caveats/evidence gaps, not first-class findings or return routes.
- The reviewer overclaimed K10: CQRS was marked checked from QueryRepository names, DTO returns, package split, and absence of generated imports without classifying caller semantics, write-side overlap, or adapter/storage overlap.

### Score

- Breadth: 37 / 45. Clearly found K2, K3, K4, and K7; shallowly covered K5, K6, and K8; overclaimed K10.
- Depth: 30 / 45. Payment fact precedence, recovery reachability, and split terminal fact confusion were strong. Multi-method candidate classification, collaboration mechanism analysis, parent-state language semantics, and CQRS semantic proof remained weak.
- Review discipline: 8 / 10. The review used the fixed prompt, kept mandatory sections, and did not stop at the first blocker. It lost points for `checked with caveat` rows and CQRS checked claims on insufficient proof.
- Total: 75 / 100.

### Gap Analysis

- Previous optimization effectiveness: materially improved. Removing `Evidence Matrix` and enforcing exact sections pushed the reviewer to cover K2/K3/K4/K5/K7 and emit mandatory sections, raising the score from 53 to 75.
- Shallow root cause: K5 remained too compressed because the candidate ledger grouped several Repository/API methods rather than classifying each method, candidate role, owned-child proof, invariant, transaction evidence, and coordination alternative.
- Shallow root cause: K6 was treated as an aggregate-boundary caveat, not a separate collaboration-model question. A synchronous command path was used as a descriptive row instead of forcing event/process manager/reconciler/task/accepted transaction classification.
- Shallow root cause: K8 was downgraded to one evidence-gap row. Parent aggregate states named after child-process outcomes require proof that the parent lifecycle really moved, or a return route.
- Overclaim: K10 was marked checked from surface CQRS separation. Names, DTOs, package layout, absent imports, and shared adapter separation are not semantic proof.
- Discipline gap: mandatory matrices can still become summaries. Rows with caveats or references to another finding must downgrade to finding, return, or evidence gap; they cannot remain checked.
- Strategy change: make mandatory rows decision gates, not summary devices. Add method-level candidate classification, collaboration-model proof, parent-state language proof, and stricter CQRS semantic proof; forbid checked rows that depend on caveats or other findings.

### Generic Fix Summary

- Added release assertions that mandatory rows are decision gates, `checked` rows cannot cite caveats/other findings, and multi-candidate Repository/API review must classify one method per row.
- Added generic review protocol for linked lifecycle collaboration: synchronous command paths are evidence, not collaboration decisions; each linked flow must classify event/process manager/reconciler/task/Integration Message/accepted transaction/evidence gap.
- Added parent-state language proof for aggregate states named after child process outcomes.
- Hardened CQRS proof so checked rows require semantic evidence beyond names, DTOs, package layout, and absent imports.

## Round 2026-07-08 v1.14.32 Re-evaluation

- skill-workshop release under evaluation: `v1.14.32`, release commit `f806be7cb54be3540c77231cd16eb7ff988fc046`.
- preceding hotfix: `36489eff84ad43a20f335bd1800f160b8b124a7f`, PR #85, merge commit `42d8f555e05e05bc85c53db80c2105bcc3a774fa`.
- next hotfix branch: `hotfix/ddd-review-finding-extraction-gates`.
- next hotfix commit: `d51a77eaee30700bde3b8727043f2a549ec21ee5`; PR #86, merge commit `51727db8655da3812901a7ba2639d2a8e8512a42`, release `v1.14.33` (`193f311be3bacc44e011f360b3f1828e21d4007c`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade` completed; reviewer reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.32`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: background reviewer in `/home/xuhao/sanhe` using the fixed prompt after plugin upgrade.
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.32.md`, 12,733 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.32-reflection.md`, 11,985 bytes.
- verification inside review: `go test` could not run because the read-only review sandbox could not create `/tmp/sanhe-codex-gocache`.

### Output Summary

- The reviewer found K2 as an independent blocker: durable `PaymentSucceeded` can leave pre-funded retry/cancel rights open.
- The reviewer found K3 as an independent blocker: `PaymentSucceeded` recovery/reconciler was not proven production reachable.
- The reviewer found the K5/K7 family directionally with method-level repository/API rows, but many rows were still too compressed and some positive rows over-trusted accepted design or semantic names.
- The reviewer shallowly covered K6 by naming synchronous command coordination as a return/design issue, but it did not make missing collaboration model a first-class finding across delivery/refund/dispute/settlement flows.
- The reviewer overclaimed K4: split dispute terminal/execution fact separation was marked checked from high-level command sequencing.
- The reviewer missed K8 except for `payment_pending`; it did not enumerate `payment_failed` / `payment_cancelled`.
- The reviewer overclaimed K10: CQRS was checked from QueryRepository/DTO/package separation plus asserted command-side lookup, without read-shaped method inventory.

### Score

- Breadth: 29 / 45. Strong coverage: K2 and K3. Directional/shallow coverage: K5, K6, K7. Missed/overclaimed: K4, K8, K10.
- Depth: 23 / 45. Payment recovery and stale-command depth were good. Split terminal/execution, non-payment collaboration, per-candidate ledger depth, state-language enumeration, and CQRS method-level proof were weak.
- Review discipline: 6 / 10. Mandatory sections were present, but checked rows still survived while related caveats/returns were unresolved, and important risks remained in tables instead of findings.
- Total: 58 / 100.

### Gap Analysis

- Previous optimization effectiveness: regressed. Method-level tables appeared, but the reviewer treated the table itself as progress and let K4/K10 become checked overclaims while K8 disappeared.
- Overclaim: K4 needs split/multi-execution proof one execution fact at a time. Command sequencing and retry reachability do not prove money execution facts and aggregate closure facts are separated.
- Shallow root cause: K5 still compressed candidate roles and did not force every candidate in every Repository/API method to name owner proof, owned-child proof, invariant/command outcome, failure tolerance, and coordination alternative.
- Shallow root cause: K6 must be extracted as a first-class collaboration-model issue; table rows are not enough when delivery/refund/dispute/settlement links lack event/process/reconciler/task/accepted-atomic-transaction proof.
- Shallow root cause: K7 persists because checked terminal/state/CQRS rows relied on accepted design or semantic names while related boundary/collaboration rows were still returned.
- Missing finding: K8 requires full state vocabulary enumeration, not only the state already implicated by a payment blocker.
- Overclaim: K10 requires inventory of read-shaped methods on write repositories/shared adapters and caller-semantics proof for each; QueryRepository names and DTOs are insufficient.
- Strategy change: add a finding-extraction gate and mechanical inventories. Any mandatory row with `finding`, `return`, or `evidence gap` must become a Finding/evidence-gap paragraph or cite an existing same-scope finding. State-language and CQRS reviews must enumerate candidate vocabulary/methods before any checked claim.

### Generic Fix Summary

- Added release assertions for finding extraction, split/multi-execution proof, parent-state language enumeration, CQRS read-shaped method inventory, and strongest-negative decision inheritance.
- Next plugin changes will make table-only risks invalid output, require one row per split execution fact, enumerate generic child-process state words, and inspect every read-shaped method on write repositories/shared adapters.

## Round 2026-07-08 v1.14.33 Re-evaluation

- skill-workshop release under evaluation: `v1.14.33`, release commit `193f311be3bacc44e011f360b3f1828e21d4007c`.
- preceding hotfix: `d51a77eaee30700bde3b8727043f2a549ec21ee5`, PR #86, merge commit `51727db8655da3812901a7ba2639d2a8e8512a42`.
- next hotfix branch: `hotfix/ddd-review-exact-lifecycle-template`.
- next hotfix commit: `7ea6fae80bcf95625bde47a201f5da8da8d60b0e`; PR #87, merge commit `67695d1b04d0a8fec1662a6a2c2ccb0b892b7cc5`, release `v1.14.34` (`6b3ee938a31adf2c3d6f567cf22bc96b73960d53`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade` completed; reviewer reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.33`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: background reviewer in `/home/xuhao/sanhe` using the fixed prompt after plugin upgrade.
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.33.md`, 8,763 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.33-reflection.md`, 10,962 bytes.
- verification inside review: attempted `go test ./internal/business/tasknegotiation/domain ./internal/business/tasknegotiation/application/command ./internal/business/tasknegotiation/application/eventhandler`, blocked because the read-only sandbox could not create `/tmp/go-build...`.

### Output Summary

- The reviewer found K2 deeply: durable `PaymentSucceeded` can be cancelled or superseded while funding reaction lags.
- The reviewer found K5/K7 as a Major repository/collaboration design issue: multi-owner repository APIs coordinate lifecycle owners and transaction shape is not boundary proof.
- The reviewer shallowly covered K3 in a recovery table but did not extract production recovery reachability as a standalone finding.
- The reviewer shallowly covered K4/K6 by returning terminal/execution and collaboration rows to design, but it did not produce per-execution proof or one collaboration mechanism row per linked flow.
- The reviewer missed K8 except for the obvious `payment_pending` state tied to K2.
- The reviewer overclaimed K10 from QueryRepository/package separation and omitted the required read-shaped method inventory.

### Score

- Breadth: 29 / 45. Found K2, K5, and K7; shallowly covered K3, K4, and K6; missed K8; overclaimed K10.
- Depth: 22 / 45. K2 and broad repository-boundary depth were good. Recovery reachability, split execution facts, collaboration mechanisms, state-language enumeration, and CQRS method inventory were insufficient.
- Review discipline: 6 / 10. It led with real findings and rejected transaction-as-proof, but omitted several exact mandatory sections and left important risks table-only.
- Total: 57 / 100.

### Gap Analysis

- Previous optimization effectiveness: failed. Finding-extraction rules were present, but the reviewer collapsed the new exact sections into a generic `Mandatory review sections` block and omitted the exact `Finding extraction gate`, `Terminal/execution fact table`, `Parent-state language table`, `CQRS read-shaped method inventory`, and `Strongest-decision inheritance` sections.
- Shallow root cause: K3 stayed table-only because the output did not require every `finding/return/evidence gap` table row to cite or create a same-scope Finding paragraph before finalization.
- Shallow root cause: K4 stayed broad because terminal/execution proof was summarized as command sequencing and repository collaboration, not one row per execution fact.
- Shallow root cause: K6 stayed broad because synchronous command path was described but not mechanically classified for every linked behavior.
- Missing finding: K8 persists because state-language enumeration did not run across all parent states.
- Overclaim: K10 persists because CQRS was marked checked without the mandatory read-shaped method inventory.
- Strategy change: enforce the exact lifecycle output template as a hard completion gate. If lifecycle/repository/event/CQRS scope is active, compact `Mandatory review sections` summaries are invalid. The final answer must include every exact section name from the lifecycle template, including finding extraction, terminal/execution, parent-state language, CQRS inventory, and strongest-decision inheritance; missing sections force evidence gaps and no checked/Rules Satisfied conclusion.

### Generic Fix Summary

- Add release assertions that exact lifecycle section names are required and compact `Mandatory review sections` blocks cannot replace them.
- Require the output completion gate to list each exact lifecycle section and mark missing sections as evidence gaps.
- Forbid checked or Rules Satisfied rows when exact mandatory sections are missing.

## Round 2026-07-08 v1.14.34 Re-evaluation

- skill-workshop release under evaluation: `v1.14.34`, release commit `6b3ee938a31adf2c3d6f567cf22bc96b73960d53`.
- preceding hotfix: `7ea6fae80bcf95625bde47a201f5da8da8d60b0e`, PR #87, merge commit `67695d1b04d0a8fec1662a6a2c2ccb0b892b7cc5`.
- next hotfix branch: `hotfix/ddd-review-negative-inventory`.
- next hotfix commit: `c8d58f93ea7c3c1160a8138ccc3c1bbeba5dfbf4`; PR #88, merge commit `bcaabac0578cfcb6d4aadf1cc675c8fd5c4f6a3a`, release `v1.14.35` (`0b71d3b9b9a33c880973a19672dd8c5450e0dc21`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade` completed; reviewer reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.34`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: background reviewer in `/home/xuhao/sanhe` using the fixed prompt after plugin upgrade.
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.34.md`, 8,517 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.34-reflection.md`, 10,960 bytes.
- verification inside review: `git diff --check`, domain tests, application tests, and eventhandler/ui tests passed; full `go test ./internal/business/tasknegotiation/...` was interrupted after about 130 seconds while infrastructure tests were still running.

### Output Summary

- The reviewer found K3 as a blocker: `PaymentSucceeded` durable fact can be lost without a production recovery path.
- The reviewer found K5 as a major issue: repositories bundle independent aggregate roots into multi-aggregate transactions beyond the design exception.
- The reviewer partially covered K2 through stale lifecycle impact but did not enumerate pre-funded cancellation/retry command rights after durable success.
- The reviewer overclaimed K4: terminal/execution fact table said same persistence call prevents immediate divergence and folded the concern into repository F2.
- The reviewer shallowly covered K6 by saying delivery/refund/dispute/settlement flows use transactional coupling, but did not classify each link by collaboration mechanism.
- The reviewer overclaimed K7 by leaving conditional positive language such as acceptable-if/covered-by-transaction without proof artifacts.
- The reviewer missed K8: failed/cancelled parent-state language was not enumerated.
- The reviewer overclaimed K10: CQRS no-finding relied on query DTO separation and a high-level read-shaped method inventory, not per-method semantic proof.

### Score

- Breadth: 27 / 45. Found K3 and K5; shallowly covered K2 and K6; overclaimed K4, K7, and K10; missed K8.
- Depth: 21 / 45. Recovery and repository-boundary evidence were useful, but command-right enumeration, split execution proof, collaboration mechanisms, state vocabulary enumeration, and CQRS per-method proof were still weak.
- Review discipline: 5 / 10. Exact section names appeared, but several sections were shallow prose rather than decision artifacts, and checked/no-finding rows were not earned.
- Total: 53 / 100.

### Gap Analysis

- Previous optimization effectiveness: failed. Exact section names were present, but the reviewer still wrote findings first and used the sections as post-hoc summaries. The structure did not force discovery of K8/K10 or extraction of K4/K6.
- Shallow root cause: K2 needs a command-rights inventory after durable facts, not just a stale-lifecycle impact statement.
- Overclaim: K4 shows that a terminal/execution section can still be written as a transaction justification; the review must derive negative decisions before findings.
- Shallow root cause: K6 remains absorbed by broad repository collaboration instead of classified per linked behavior.
- Overclaim: K7 persists when positive conditional phrases survive beside negative repository findings.
- Missing finding: K8 persists because state-language enumeration was not mechanically required before findings.
- Overclaim: K10 persists because CQRS inventory was category-level prose rather than per-method negative/positive decisions.
- Strategy change: invert the review order. For lifecycle/repository/event/CQRS scope, the reviewer must build a negative decision inventory first, before writing findings or any checked/Rules Satisfied rows. Every mandatory row starts as `unresolved`; only row-local proof can promote it to checked. Findings are generated from unresolved/finding/return/evidence-gap rows after the inventory, not before it.

### Generic Fix Summary

- Add release assertions for a negative decision inventory before findings.
- Require all mandatory lifecycle rows to start `unresolved`, then be promoted only by row-local proof.
- Require finding generation from the inventory; pre-written findings cannot satisfy inventory rows.
- Prohibit checked/Rules Satisfied output until the inventory is complete and every negative row is extracted or cited.

## Round 2026-07-08 v1.14.35 Re-evaluation

- skill-workshop release under evaluation: `v1.14.35`, release commit `0b71d3b9b9a33c880973a19672dd8c5450e0dc21`.
- preceding hotfix: `c8d58f93ea7c3c1160a8138ccc3c1bbeba5dfbf4`, PR #88, merge commit `bcaabac0578cfcb6d4aadf1cc675c8fd5c4f6a3a`.
- next hotfix branch: `hotfix/ddd-review-proof-promotion-gates`.
- next hotfix commit: `599c895853c7f5f3ea185b81c2727ea5cb568fa3`; PR #89, merge commit `94e5ee3ea44be5d8ec1eae23fd0962825d73a8e2`, release `v1.14.36` (`60a8b98232bcff198a1df47c579ee24bc70ce667`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade` completed; reviewer reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.35`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: background reviewer in `/home/xuhao/sanhe` using the fixed prompt after plugin upgrade.
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.35.md`, 16,180 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.35-reflection.md`, 11,767 bytes.
- verification inside review: `git diff --check` had no output; Go tests could not execute because the read-only review sandbox could not create Go cache under `/tmp`.

### Output Summary

- The reviewer found K2 and K3 together as F1: `PaymentSucceeded` recovery is not production-reachable, leaving `TaskAgreement` stale and cancellable.
- The reviewer found K4 as F2: split dispute execution emits parent terminal events before the parent agreement is terminal.
- The reviewer touched K5/K10 through inventory tables, but over-promoted many rows to `Checked` from accepted design, semantic method names, DTO/query names, and transaction shape.
- The reviewer missed/overclaimed K6 by accepting `command transaction` as a collaboration mechanism for delivery/refund/dispute/settlement links.
- The reviewer overclaimed K7 despite stating the correct rule; semantic repository transactions still became promotion evidence.
- The reviewer missed K8 by enumerating only refunded/settled/closed parent states, not failed/cancelled payment-like states.

### Score

- Breadth: 30 / 45. Found K2, K3, and K4; touched K5 and K10 shallowly; missed/overclaimed K6, K7, and K8.
- Depth: 24 / 45. Stronger on payment recovery/cancellation and split terminal events. Still weak on independent owner proof, collaboration mechanism proof, exhaustive state-language enumeration, and CQRS per-method proof.
- Review discipline: 4 / 10. The negative inventory existed, but rows were promoted to checked using transaction/naming/accepted-design evidence, violating the plugin's own guardrails.
- Total: 58 / 100.

### Gap Analysis

- Previous optimization effectiveness: mixed. Negative inventory restored K4 and preserved K2/K3, but it did not prevent invalid row promotion.
- Shallow root cause: K5 table presence became false confidence; multi-candidate methods were checked without independent owner proof per candidate.
- Missing/overclaim: K6 failed because `command transaction` was accepted as final collaboration mechanism instead of being invalid without accepted atomic-transaction and failure-tolerance proof.
- Overclaim: K7 persisted because transaction shape and accepted design still promoted rows despite the written rule.
- Missing finding: K8 persisted because state-language enumeration remained selective rather than exhaustive over configured state words.
- Overclaim: K10 persisted because grouped read-shaped method inventory rows were checked; summary rows cannot prove CQRS semantics.
- Strategy change: add promotion gates. A row cannot be checked unless it has non-transaction model proof, explicit accepted atomic-transaction proof when using synchronous transactions, exhaustive state vocabulary rows, and one row per CQRS method/port. Grouped summary rows and transaction/name/design-only proof must force return/evidence gap.

### Generic Fix Summary

- Add release assertions for non-transaction model proof before checked promotion.
- Reject `command transaction` / synchronous transaction as a final collaboration mechanism unless it names an accepted atomic-transaction decision and failure-tolerance proof.
- Require exhaustive state-language rows for every discovered/declared parent state word in the configured vocabulary.
- Require CQRS read-shaped method inventory to be one row per method/port; grouped rows cannot be checked.
- Add a final overclaim scrub pass that downgrades checked rows whose strongest evidence is transaction shape, accepted design, semantic repository naming, DTO/query naming, or package separation.

## Round 2026-07-08 v1.14.36 Re-evaluation

- skill-workshop release under evaluation: `v1.14.36`, release commit `60a8b98232bcff198a1df47c579ee24bc70ce667`.
- preceding hotfix: `599c895853c7f5f3ea185b81c2727ea5cb568fa3`, PR #89, merge commit `94e5ee3ea44be5d8ec1eae23fd0962825d73a8e2`.
- next hotfix branch: `hotfix/ddd-review-promotion-admission-control`.
- next hotfix commit: `e76a8960314973bf9a384dbb780fdd1446d311ba`; PR #90, merge commit `389853bddfa2ed516cb34ebcff23cb46b8730b89`, release `v1.14.37` (`c1d4f071999b4dfecafc530fbc6aa82a420d554d`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: reviewer reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.36`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: background reviewer in `/home/xuhao/sanhe` using the fixed prompt after plugin upgrade.
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.36.md`, 10,673 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.36-reflection.md`, 10,667 bytes.
- verification inside review: `go test ./...` passed; `git diff --check` passed.

### Output Summary

- The reviewer found K2 and K3 as Finding 1: durable `PaymentSucceeded` can leave the agreement stale, the payment recovery path lacks production reachability, and retry/cancel rights remain open.
- The reviewer found K4 as Finding 2: split dispute partial refund/settlement execution emits terminal agreement facts early and the true split closure event is missing.
- The reviewer found K8 as Finding 3: `payment_failed` and `payment_cancelled` are child Payment outcome language on the parent aggregate without parent fact ownership.
- The reviewer touched K5, K6, K7, and K10 but over-promoted them. It accepted "semantic lifecycle transactions", "synchronous app command plus transaction", and command-side read-shaped methods as checked without row-local owner, collaboration, failure-tolerance, or CQRS proof.

### Score

- Breadth: 31 / 45. Strong coverage: K2, K3, K4, K8. Touched but not accepted: K10. Overclaimed or softened: K5, K6, K7.
- Depth: 29 / 45. Payment recovery, stale command rights, split terminal/execution facts, and state language were evidence-backed. Aggregate/repository candidate classification, linked behavior collaboration, accepted-design non-waiver, and CQRS method semantics remained too shallow.
- Review discipline: 6 / 10. The output kept the required sections, negative inventory, extraction gate, and overclaim scrub, but then violated its own promotion rules by letting category-level checked rows survive.
- Total: 66 / 100.

### Gap Analysis

- Previous optimization effectiveness: partially effective. Promotion gates fixed K8 and preserved K2/K3/K4, but did not prevent prose/category-level checked conclusions.
- Overclaim: K5 remained unresolved because `semantic lifecycle transaction` was treated as positive proof instead of a red-flag requiring per-method candidate rows with owner/owned-child/invariant/coordination proof.
- Overclaim: K6 remained unresolved because `synchronous app command plus transaction` was accepted as checked collaboration, even though linked lifecycle behavior requires Domain Event, process manager, reconciler, task processor, Integration Message, or explicitly accepted atomic transaction with failure-tolerance proof.
- Overclaim: K7 persisted because the review stated the anti-waiver rule but still used semantic method names and transaction-shaped evidence as practical waivers.
- Shallow root cause: K10 was inventoried but not downgraded; command-handler caller location was treated as enough to accept command-side read-shaped methods without per-method product-read/write-decision semantics.
- Strategy change: add promotion admission-control. Checked is no longer a prose decision. Any grouped/category checked row, semantic-lifecycle-transaction checked row, synchronous-command-plus-transaction checked row, caller-location-only CQRS checked row, or "checked with inherited negative" row must self-downgrade before final output.

### Generic Fix Summary

- Add release assertions for checked-row admission control and prohibited promotion patterns.
- Require checked rows to include a complete proof tuple rather than category labels or prose summaries.
- Treat `semantic lifecycle transaction` as red-flag evidence only; it cannot appear as a checked decision.
- Treat synchronous command plus transaction as invalid checked collaboration unless an explicit atomic-transaction model decision and failure-tolerance proof are named.
- Treat command-handler caller location as CQRS evidence only; per-method read/write semantic proof remains required before checked.

## Round 2026-07-08 v1.14.37 Re-evaluation

- skill-workshop release under evaluation: `v1.14.37`, release commit `c1d4f071999b4dfecafc530fbc6aa82a420d554d`.
- preceding hotfix: `e76a8960314973bf9a384dbb780fdd1446d311ba`, PR #90, merge commit `389853bddfa2ed516cb34ebcff23cb46b8730b89`.
- next hotfix branch: `hotfix/ddd-review-lifecycle-section-hard-gate`.
- next hotfix commit / PR / merge commit / tag: pending.
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade` completed; reviewer reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.37`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.37.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.37.md`, 5,284 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.37-reflection.md`, 10,309 bytes.
- verification inside review: `go test ./internal/business/tasknegotiation/domain -run TestTaskAgreementLifecycleStateUsesConcreteStateBehavior -count=1`, `go test ./internal/business/tasknegotiation/application -run 'Payment|Funding|CancelTaskAgreement|ReconcileSucceededPayments' -count=1`, and `go test ./...` passed.

### Output Summary

- The reviewer found K2 as a Blocker: `PaymentSucceeded` can be followed by agreement cancellation.
- The reviewer found K3 as a Major finding: succeeded-payment reconciler exists but has no production entrypoint.
- The reviewer found K8 as an evidence gap: `payment_failed` and `payment_cancelled` parent states have no production writer.
- The reviewer overclaimed K4/K5/K6/K7/K10 by replacing mandatory lifecycle proof sections with short checked summaries. It did not emit negative decision inventory, terminal/execution fact table, CQRS read-shaped method inventory, strongest-decision inheritance, overclaim scrub, or checked-row admission-control table.

### Score

- Breadth: 24 / 45. Strong coverage: K2, K3, and K8. K4, K5, K6, K7, and K10 were touched only through unsupported checked summaries or omitted proof sections.
- Depth: 20 / 45. Payment precedence and recovery reachability remained deep. Split terminal facts, repository candidate classification, collaboration model, accepted-design non-waiver, and CQRS semantics were shallow or unsupported.
- Review discipline: 3 / 10. The output violated the exact-section and admission-control contract, started with findings, and allowed broad checked flows without the mandatory proof tables.
- Total: 47 / 100.

### Gap Analysis

- Previous optimization effectiveness: failed. The admission-control rule existed in the plugin, but the reviewer did not emit the admission-control table or exact lifecycle sections, so the rule never executed.
- Overclaim: K4 was marked checked through "split-dispute closure requires both execution facts" without one row per execution fact and separate aggregate closure proof.
- Overclaim: K5 remained a method-summary classification, not a per-method candidate ledger with owner proof, owned-child proof, invariant outcome, transaction evidence, and coordination alternative.
- Overclaim: K6 was checked through synchronous command transaction, without classifying the linked lifecycle behavior mechanism or accepted atomic transaction failure tolerance.
- Overclaim: K7 persisted because accepted design/source alignment and semantic repository method names were used as practical proof.
- Overclaim: K10 persisted because CQRS was declared acceptable without the semantic split table or per-method read-shaped inventory.
- Root cause: the exact-section gate is buried as prose and can be ignored. The output contract must make lifecycle/repository/event/CQRS scope a hard preamble: no Findings, no Checked Flows, and no Rules Satisfied may appear until every exact lifecycle section is emitted and admission-control is complete.

### Generic Fix Summary

- Add release assertions that lifecycle/repository/event/CQRS scope must start with exact mandatory sections before findings.
- Prohibit lifecycle-scope final answers from using a Findings-first or Checked-flows-only shape.
- Require the output completion gate to appear before any checked decisions and to enumerate exact required sections.
- State that missing admission-control or exact lifecycle sections invalidates every related checked row and forces evidence gap/return instead of partial summary acceptance.

## Round 2026-07-08 v1.14.38 Re-evaluation

- skill-workshop release under evaluation: `v1.14.38`, release commit `7fc8d7c1d8535fdf71a928c756b621cf4a6aa4f3`.
- preceding hotfix: `056b6a227f3fc791e77e41955adffcaeff4d1db3`, PR #91, merge commit `3bb8698326647fbc9f747fe99e818ddf3b39dc0d`.
- next hotfix branch: `hotfix/ddd-review-row-id-admission-gate`.
- next hotfix commit / PR / merge commit / tag: pending.
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade` completed; reviewer reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.38`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.38.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.38.md`, 10,899 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.38-reflection.md`, 6,972 bytes.
- verification inside review: `go test ./internal/business/tasknegotiation/domain -run 'TestTaskAgreement|TestPayment' -count=1` passed; `go test ./internal/business/tasknegotiation/application -run 'Payment|Funding|CancelTaskAgreement|ReconcileSucceededPayments' -count=1` passed; `go test ./internal/business/tasknegotiation/... -count=1` was interrupted after infrastructure stalled.

### Output Summary

- The reviewer found K2 as F1, K3 as F2, and K8 as F3.
- The reviewer emitted the exact lifecycle sections and moved findings after the sections, so v1.14.38 fixed the v1.14.37 findings-first failure.
- The reviewer still overclaimed K4/K6/K7, wrong-triaged K5, and shallowly handled K10. Exact sections were populated by prose or grouped rows such as "Refund/dispute/settlement terminal split", "delivery/refund/dispute terminal split", and "CQRS query DTO".
- Checked row admission-control was not a real table of row-local proof tuples; it was a paragraph saying checked rows had been inspected.

### Score

- Breadth: 27 / 45. Strong coverage: K2, K3, K8. K4/K5/K6/K7/K10 were touched but stayed unsupported, overclaimed, or wrong-triaged.
- Depth: 23 / 45. Payment precedence and recovery reachability remained concrete. Repository, split execution, collaboration, accepted-design non-waiver, and CQRS analysis stayed summary-level.
- Review discipline: 5 / 10. The exact-section order improved and it avoided full-suite overclaim, but it still converted grouped/prose sections into checked conclusions.
- Total: 55 / 100.

### Gap Analysis

- Previous optimization effectiveness: partial. The hard preamble forced section order and prevented findings-first output, but did not force table-backed row-local proof inside each section.
- Overclaim: K4 persisted because the terminal/execution fact section was a prose sentence, not one row per execution fact plus a separate aggregate closure row.
- Wrong triage: K5 persisted because a grouped repository classification sentence was accepted as "tight paired decision save" without per-method candidate roles, owner proof, owned-child proof, invariant outcome, failure tolerance, or coordination alternative.
- Overclaim: K6 persisted because command-internal lifecycle progression was treated as collaboration proof without per-trigger mechanism and recovery/failure behavior.
- Overclaim: K7 persisted because accepted design plus semantic transaction shape still carried positive decisions.
- Shallow root cause: K10 remained shallow because CQRS read-shaped method inventory was a prose summary rather than one row per method/port.
- Root cause: exact sections are still counted as populated when they contain prose or category rows. Checked admission must be row-id based: every checked row in every mandatory table must have a matching admission-control row with complete proof tuple; prose-only sections and grouped rows cannot produce checked decisions.

### Generic Fix Summary

- Require mandatory lifecycle proof sections to be markdown tables with stable row ids.
- Define prose-only mandatory sections as missing/evidence-gap for related rows.
- Require every checked row in any mandatory section to appear in `Checked row admission control` with the same row id and complete proof tuple.
- Forbid grouped row ids or row scopes that combine multiple methods, flows, execution facts, states, or ports from being checked.
- Require output completion gate to mark a section non-empty only when it has table rows, not prose summaries.

## Round 2026-07-08 v1.14.39 Re-evaluation

- skill-workshop release under evaluation: `v1.14.39`, release commit `5eb79a3c76f04493a542807e0b241210b069ab8d`.
- preceding hotfix: `0b11cdd509feae90195b01aea1cd6330ac63159f`, PR #92, merge commit `a8c689ef5dc1cad7d2e1f9019a2e1464db7f92b8`.
- next hotfix branch: `hotfix/ddd-review-command-admission-matrix`.
- next hotfix commit / PR / merge commit / tag: pending.
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade` completed; reviewer reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.39`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.39.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.39.md`, 4,632 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.39-reflection.md`, 7,477 bytes.
- verification inside review: `git diff --check` passed; Go tests could not run because read-only sandbox prevented creating `/tmp/go-build...`.

### Output Summary

- The reviewer found K4 as a Major split-dispute terminal event finding.
- The reviewer found K8 as a return-to-modeling issue for parent `payment_failed/payment_cancelled` states.
- The reviewer found K3 as an evidence gap / return-to-design for production-unreachable `PaymentSucceeded` recovery.
- The reviewer missed K2: it looked at the normal event reaction and recovery path, but did not test cancel/retry command admission after a durable succeeded payment while the parent agreement projection is stale.
- The reviewer still overclaimed K5/K7, shallowly covered K6, and wrong-triaged K10. It claimed lifecycle sections were covered, but the saved answer did not include the table-backed inventory rows required by v1.14.39.

### Score

- Breadth: 26 / 45. Found K3, K4, and K8. Missed K2. K5/K7/K10 were overclaimed or wrong-triaged; K6 was shallow.
- Depth: 24 / 45. Split terminal/execution and parent-state findings were useful; Payment recovery was correct but incomplete without command-admission counterfactuals. Repository, collaboration, and CQRS remained too summary-level.
- Review discipline: 5 / 10. It reported sandbox test limits honestly, but still used `Checked Rows` and `Lifecycle Sections covered` summaries instead of visible row-id mandatory tables.
- Total: 55 / 100.

### Gap Analysis

- Previous optimization effectiveness: partial and unstable. Row-id backed gates existed in the plugin, but the reviewer bypassed them by asserting "Lifecycle Sections covered" rather than printing the table-backed sections.
- Missing finding: K2 regressed because `PaymentSucceeded` review focused on event reaction/recovery and failed to force a durable-fact command-admission counterfactual for later cancel/retry commands.
- Overclaim: K5 persisted because candidate ledger and Repository/API classification were claimed as covered but not emitted as method-level rows.
- Shallow root cause: K6 persisted because only the split event symptom was found; the wider delivery/refund/dispute/settlement collaboration model still lacked per-trigger mechanism rows.
- Overclaim: K7 persisted because checked/coverage assertions still carried positive conclusions without row-local non-transaction model proof.
- Wrong triage: K10 persisted because CQRS was checked from query repository/DTO naming and did not inventory read-shaped methods on write repositories or shared adapters.
- Root cause: the plugin has exact-section and row-id rules, but it lacks an explicit "coverage claim prohibition". A statement that sections are covered must be treated as invalid unless actual markdown tables follow. It also lacks a mandatory command-admission matrix for irreversible facts that can race with stale workflow-state commands.

### Generic Fix Summary

- Prohibit section-coverage summary claims as substitutes for mandatory tables.
- Add a mandatory `Irreversible fact command-admission matrix` for lifecycle reviews.
- Require every durable succeeded/authorized/completed/executed fact to be checked against later cancel/retry/reopen/refund commands that can still act from stale parent state.
- Extend output completion/admission rules so a section is present only when the actual table follows the heading; a "covered" sentence is evidence gap.

## Round 2026-07-08 v1.14.40 Re-evaluation

- skill-workshop release under evaluation: `v1.14.40`, release commit `89b9826fc1cfa83352b6d12d3caef778334aa233`.
- preceding hotfix: `ddbc0249c6fcca8b51dd45394114ec753d329404`, PR #93, merge commit `bed0d302a51626e535c9582f11a145b401da3723`.
- next hotfix branch: `hotfix/ddd-review-cqrs-write-inventory`.
- next hotfix commit: `2dd5777f2af13f726b3e29fa3f23c124de40d09b`; PR #94, merge commit `83ccd5001e865a1eb0a45641ff8a55b1920b593e`, release `v1.14.41` (`71918a187b765bce95892edcb1d0dc71f2124110`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade` completed; reviewer reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.40`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.40.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.40.md`, 10,659 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.40-reflection.md`, 7,217 bytes.
- verification inside review: `go test ./internal/business/tasknegotiation/domain ./internal/business/tasknegotiation/application/eventhandler ./internal/business/tasknegotiation/application` passed from cache; full `go test ./...` was not run.

### Output Summary

- The reviewer strongly found K2 as F1: succeeded Payment can be invalidated by stale agreement cancel/retry commands.
- The reviewer strongly found K3 via the same F1: reconciler exists but lacks production wiring.
- The reviewer found K4 as F2: split dispute emits terminal `TaskAgreementRefunded/Settled` before terminal agreement closure and misses `TaskAgreementClosedByDisputeResolution`.
- The reviewer found K7 pressure as F3 by challenging cross-root `SaveRefundExecution(refund, agreement)` / `SaveSettlementExecution(settlement, agreement)` instead of waiving semantic transactions.
- The reviewer found K8 as an evidence gap around parent `payment_failed/payment_cancelled` states.
- K5 and K6 were shallow: F3 returned the cross-root execution saves to design, but candidate classification and collaboration mechanism rows were still compressed.
- K10 was overclaimed: CQRS was marked passing from query DTO repository evidence and absence of aggregate returns, without inventorying read-shaped methods on write repositories/shared adapters.

### Score

- Breadth: 37 / 45. Found K2, K3, K4, K7, and K8. Partially covered K5 and K6. Overclaimed K10.
- Depth: 34 / 45. F1 and F2 were evidence-backed and behaviorally precise. F3 was directionally right but did not meet row-per-method candidate/collaboration depth. CQRS proof remained too weak.
- Review discipline: 7 / 10. The review used the new command-admission matrix and reported verification limits, but still wrote an `Output completion gate` overclaim that all rows were checked while K5/K6 were compressed and K10 lacked write-side inventory.
- Total: 78 / 100.

### Gap Analysis

- Previous optimization effectiveness: effective for K2 and table pressure. The command-admission matrix restored the core PaymentSucceeded stale-command finding and improved K4/K7. It did not fully prevent K5/K6 compression or K10 overclaim.
- Shallow root cause: K5 needs a row per repository/API method with one candidate per row or explicit candidate list, owner proof, owned-child proof, invariant outcome, transaction evidence, and coordination alternative. The review named two methods but did not fully classify candidates.
- Shallow root cause: K6 needs one collaboration row per linked lifecycle reaction, with trigger fact, affected owner, mechanism, failure/recovery behavior, and whether synchronous atomic transaction is explicitly accepted.
- Overclaim: K10 persisted because separate query DTO repository proof is not enough. CQRS review must start from write repositories/shared adapters and inventory every read-shaped `Get/List/Find/Query/Count` method or shared adapter read path before any checked conclusion.
- Discipline gap: `Output completion gate` can still state "all rows checked" even when any section has return/finding/evidence-gap decisions or compressed rows.
- Strategy change: add CQRS write-side inventory gate and all-checked contradiction gate.

### Generic Fix Summary

- Require CQRS checked rows to inventory read-shaped methods on write repositories and shared adapters first; query DTO/read-facade evidence alone cannot satisfy CQRS.
- Require checked CQRS rows to name the write-side method/adapter, caller semantics, returned model family, write-side influence, storage/adapter overlap, and why no read facade should own it.
- Reject `all rows checked` or equivalent output-completion claims when any mandatory row is finding/return/evidence gap, grouped, compressed, or missing admission-control proof.
- Strengthen repository/collaboration rows so multi-candidate method and cross-owner linked behavior rows cannot be compressed into broad F3 prose when they are the remaining risks.

## Round 2026-07-08 v1.14.41 Re-evaluation

- skill-workshop release under evaluation: `v1.14.41`, release commit `71918a187b765bce95892edcb1d0dc71f2124110`.
- preceding hotfix: `2dd5777f2af13f726b3e29fa3f23c124de40d09b`, PR #94, merge commit `83ccd5001e865a1eb0a45641ff8a55b1920b593e`.
- next hotfix branch: `hotfix/ddd-review-hard-downgrade-admission`.
- next hotfix commit: `1f8adf8c2b6af6de222cdda2ce9bd56605eab725`; PR #95, merge commit `5fba1b4084ce52761f4cfc1c0885d6d828337f6e`, release `v1.14.42` (`caa80a28f46accb7468ae2993e79748b1112e1c4`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade` and `codex plugin add ddd-expert@skill-workshop-codex` completed; reviewer reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.41`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.41.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.41.md`, 17,081 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.41-reflection.md`, 4,448 bytes.
- verification inside review: `go test ./internal/business/tasknegotiation/domain ./internal/business/tasknegotiation/application -count=1` passed; full `go test ./... -count=1` was interrupted after about 111 seconds, with infrastructure ending `signal: interrupt`.

### Output Summary

- The reviewer found K2/K3 as F1: durable `PaymentSucceeded` recovery is not production reachable and can leave `TaskAgreement` in `payment_pending`.
- The reviewer partially found K8 as F2: `payment_failed` and `payment_cancelled` are child Payment outcomes encoded as parent `TaskAgreement` states, but `payment_pending` was still marked `checked with RR/F1 caveat`.
- The reviewer partially found K10 as F3 by inventorying write-repository read-shaped methods and flagging `ListDeliveriesByTaskAgreement` / `ListRefundCasesByTaskAgreement`.
- The reviewer overclaimed K4: split terminal/execution rows were marked checked from command sequencing and guards, without inspecting terminal lifecycle event emission timing.
- The reviewer overclaimed K5: method rows for cross-candidate saves were checked from `design accepts`, `xorm tx`, and `accepted atomic write`.
- The reviewer overclaimed K6: collaboration rows treated synchronous command paths, command-side checks, and accepted atomic transactions as proof without explicit mechanism/failure-tolerance decisions.
- K7 remained shallow: the review knew the no-waiver rule in CQRS scrub rows, but inconsistently allowed accepted design and semantic transaction evidence in repository/collaboration rows.

### Score

- Breadth: 31 / 45. K2 and K3 were found strongly. K8 and K10 improved to shallow/partial. K4, K5, and K6 were overclaimed in checked rows; K7 was shallow.
- Depth: 27 / 45. Payment recovery depth stayed good, and CQRS inventory improved. Terminal/execution event timing, row-local aggregate-boundary proof, and collaboration mechanism/failure-tolerance proof were not deep enough.
- Review discipline: 6 / 10. Mandatory tables were present and verification limits were reported, but checked rows admitted caveats, accepted-design proof, transaction proof, and command-side mechanism proof that the protocol should have downgraded.
- Total: 64 / 100.

### Gap Analysis

- Previous optimization effectiveness: mixed. The CQRS write-side inventory gate improved K10 from an overclaim to a partial finding, but the same release regressed K4/K5/K6 because weak proof values were still allowed through checked-row admission control.
- Overclaim: K4 needs lifecycle event emission timing and fact durability inspection, not just "both execution commands can eventually close" guard checks.
- Overclaim: K5 needs hard downgrade when owner proof or coordination proof says only `design accepts`, semantic names, transaction shape, or accepted atomic write without an explicit model decision and failure-tolerance proof.
- Overclaim: K6 needs hard downgrade when collaboration proof is only synchronous command path, command transaction, command-side check, or replay/idempotency guard without a named collaboration mechanism and failure tolerance.
- Shallow root cause: K7 requires the same forbidden-promotion scrub across every table, not only the Overclaim scrub section.
- Shallow root cause: K8 shows `checked with caveat` can still survive inside tables; caveated checked rows must be syntactically invalid and downgraded before final output.
- Shallow root cause: K10 still needs full shared-adapter inventory; a QueryRepository/DTO row can be context but cannot be a checked CQRS row when related write-side inventory rows are findings.
- Strategy change: make checked-row admission control a hard downgrade filter over cell values, not only a prose principle. Add terminal lifecycle event timing proof and require explicit model-decision IDs for accepted atomic transactions.

### Generic Fix Summary

- Add release assertions that `checked with caveat`, `design accepts`, `accepted by design`, `xorm tx`, `accepted atomic write`, `command-side check`, and `synchronous command path` cannot appear as the decisive proof in checked rows.
- Require accepted atomic transaction rows to name an explicit model decision and failure-tolerance rule; otherwise downgrade to return/evidence gap/finding.
- Require terminal/execution rows to include lifecycle event emission timing and durable fact ordering before any checked terminal/execution conclusion.
- Require every checked row admission-control entry to list forbidden evidence scrub results and downgrade when any forbidden proof token is present.

## Round 2026-07-08 v1.14.42 Re-evaluation

- skill-workshop release under evaluation: `v1.14.42`, release commit `caa80a28f46accb7468ae2993e79748b1112e1c4`.
- preceding hotfix: `1f8adf8c2b6af6de222cdda2ce9bd56605eab725`, PR #95, merge commit `5fba1b4084ce52761f4cfc1c0885d6d828337f6e`.
- next hotfix branch: `hotfix/ddd-review-positive-quarantine`.
- next hotfix commit / PR / merge commit / tag: pending.
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade` completed; reviewer reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.42`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.42.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.42.md`, 18,662 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.42-reflection.md`, 2,444 bytes.
- verification inside review: reported `go test ./...` passed, plus focused domain/application/eventhandler/infrastructure tests.

### Output Summary

- The reviewer found K2 as F1: durable `PaymentSucceeded` can leave agreement stale and allow cancel/retry from `payment_pending`.
- The reviewer found K3 as F2: reconciler exists but has no production RPC/scheduler/worker/startup/admin reachability.
- The reviewer found K8 as F3: `payment_failed` / `payment_cancelled` are child Payment outcomes encoded as parent agreement states without producer evidence.
- The reviewer overclaimed K4: split closure/terminal execution rows were checked without proving lifecycle event emission timing or durable fact ordering before terminal aggregate events.
- The reviewer overclaimed K5: repository/API rows compressed multiple lifecycle owners and marked semantic lifecycle transactions checked without method/candidate row-local owner proof.
- The reviewer overclaimed K6: collaboration rows for acceptance/refund/dispute/split were checked from synchronous command paths/domain guards instead of an explicit collaboration mechanism and failure-tolerance policy.
- The reviewer overclaimed K7: overclaim scrub existed but still allowed positive conclusions from semantic names, DTO/read split, package/import separation, and accepted-design-shaped evidence while model pressure remained unresolved.
- The reviewer overclaimed K10: it listed read-shaped methods, but the inventory lacked the required caller semantics, returned model family, write-side influence, adapter/storage overlap, and read-facade ownership decisions while still marking CQRS checked.

### Score

- Breadth: 23 / 45. K2, K3, and K8 were found strongly. K4, K5, K6, K7, and K10 were touched mainly as unsupported checked rows or positive summaries.
- Depth: 22 / 45. Payment stale-command and recovery reachability depth remained useful. Terminal event timing, aggregate-boundary ownership, collaboration mechanism, non-waiver, and CQRS method semantics were shallow or overclaimed.
- Review discipline: 4 / 10. Required sections were present by name, but several required columns were missing, Output Completion still marked them present, and checked conclusions survived despite known forbidden proof shapes.
- Total: 49 / 100.

### Gap Analysis

- Previous optimization effectiveness: failed. The hard-downgrade language existed in the skill, but the reviewer generated shorter table schemas, marked those schemas complete, and continued to emit checked flows.
- Structural failure: the output template still invites positive `checked` rows and `Checked flows` summaries. The model is optimizing toward filling every mandatory table, not toward withholding positive conclusions when proof is incomplete.
- Overclaim root cause: Output Completion only checks section names and non-empty rows; it must also validate exact required columns, otherwise a truncated table can satisfy the gate.
- Overclaim root cause: Checked row admission control is too easy to fake as a top-level table. If any finding/return/evidence gap exists in lifecycle/repository/event/CQRS scope, positive checked-flow summaries should be quarantined or omitted.
- Strategy change: introduce positive-conclusion quarantine. In high-risk review scope, only finding, return, evidence gap, and not applicable decisions are allowed until every required section has exact columns and every row passes admission. `Checked flows` and `Rules Satisfied` become forbidden when any negative decision exists.

### Generic Fix Summary

- Add release assertions for positive-conclusion quarantine when any lifecycle/repository/event/CQRS finding, return, or evidence gap exists.
- Require Output Completion to validate exact required columns, not just section presence/non-empty rows.
- Replace checked-flow summaries with residual-risk summaries while negative decisions exist.
- Forbid `Rules Satisfied` entries for lifecycle/repository/event/CQRS scopes when any same-scope row is finding, return, evidence gap, grouped, missing exact columns, or not admitted.

## Round 2026-07-08 v1.14.43 Re-evaluation

- skill-workshop release under evaluation: `v1.14.43`, release commit `ee2b9c673500283e9f5c7faadd734b2a170b3d1f`.
- preceding hotfix: `1e2a7ba8edbe80790595d9d46ef26623577bbc23`, PR #96, merge commit `38ab6bedf04b579b613004a9dca4922ebc321b02`.
- next hotfix branch: `hotfix/ddd-review-negative-scope-lock`.
- next hotfix commit / PR / merge commit / tag: pending.
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: reviewer reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.43`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.43.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.43.md`, 19,235 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.43-reflection.md`, 3,443 bytes.
- verification inside review: `go test ./internal/business/tasknegotiation/domain`, `go test ./internal/business/tasknegotiation/application`, and `go test ./internal/business/tasknegotiation/...` passed from cache.

### Output Summary

- The reviewer found K2 as F1/N1/IR1/IR2: durable `PaymentSucceeded` can leave Agreement in `payment_pending`, with retry and cancel still admitted.
- The reviewer found K3 as F2/N2/RR1/EV1/CM1: recovery is not production reachable and handler/command existence is insufficient.
- The reviewer found K8 as F3: parent-state language table enumerated `payment_pending`, `payment_failed`, and `payment_cancelled`; F3 caught failed/cancelled as parent states without durable parent facts, and F1 handled stale `payment_pending`.
- The reviewer found K10 as EG1: read-shaped write-side repository methods need caller/write-side ownership proof; it did not clear CQRS solely via QueryRepository/DTO evidence.
- The reviewer overclaimed K4: split/refund/settlement terminal execution was checked in IR4, MC3, TE2-TE4, CM3, and SD4 without adequate lifecycle event timing/fact-separation proof.
- The reviewer overclaimed K5: REP2/REP3 were checked while coordinating multiple lifecycle candidates; REP3 grouped methods and relied on transaction shape, accepted atomic creation, and owner method names.
- The reviewer overclaimed K6: CM2/CM3 checked synchronous command coordination and command-side reconciliation instead of proving a selected process manager/reconciler/domain-event/atomic-transaction policy.
- The reviewer overclaimed K7: Overclaim scrub said forbidden proof was not used, but checked rows still leaned on accepted design, DTO/query shape, package separation, and semantic names while unresolved model pressure remained.
- Positive-conclusion quarantine worked: raw output explicitly omitted `Checked flows` and positive `Rules Satisfied` while negative decisions existed.

### Score

- Breadth: 34 / 45. K2, K3, K8, and K10 were found. K4, K5, K6, and K7 were touched but overclaimed.
- Depth: 29 / 45. Payment stale-command/recovery and state-language findings were concrete, and CQRS improved to a real evidence gap. Terminal event timing, aggregate-boundary candidate proof, collaboration-policy proof, and non-waiver analysis were still too shallow.
- Review discipline: 7 / 10. Positive summary quarantine worked and verification limits were clear, but table-internal checked rows still violated the review protocol.
- Total: 70 / 100.

### Gap Analysis

- Previous optimization effectiveness: partial. Positive `Checked flows` / `Rules Satisfied` leakage was fixed, and K10 improved to found, but K4/K5/K6/K7 remained false-positive checked rows inside mandatory tables.
- Structural failure: positive rows inside mandatory sections are still treated as harmless even when same-scope negative rows exist. The model obeyed the summary quarantine but not table-internal admission discipline.
- Overclaim root cause: same-scope negative decisions do not currently lock the scope. Rows in the same lifecycle/repository/event/CQRS cluster can still be marked `checked` if they look locally plausible.
- Strategy change: add a negative-scope lock. When any lifecycle/repository/event/CQRS row is finding, return, evidence gap, grouped, missing exact columns, or not admitted, every same-scope `checked` decision is invalid and must become `not admitted`, `not claimed`, `return`, or `evidence gap` unless it is explicitly marked unrelated by a row-local scope boundary.

### Generic Fix Summary

- Add release assertions for negative-scope lock and table-internal checked prohibition.
- Require same-scope `checked` decisions to be downgraded when any related negative row exists.
- Require grouped method/flow/candidate rows to use `not admitted` instead of `checked`.
- Require independent-scope exceptions to name a row-local scope boundary before any checked decision.

## Round 2026-07-08 v1.14.44 Re-evaluation

- skill-workshop release under evaluation: `v1.14.44`, release commit `7ce336f65ba91a08992f313d3bb9fec8d724e0c5`.
- preceding hotfix: `7cea8e6d62b06706b4f7d81309d80dd57c89e3c5`, PR #97, merge commit `5f7d1042a1f74d099a9283d889c6b5b2c925548f`.
- next hotfix branch: `hotfix/ddd-review-not-claimed-extraction`.
- next hotfix commit: `cc73d80c38f86ef1ed4ef3a5fd8d7eb96e347e09`; PR #98, merge commit `3e8f2b8aaca9533bccf2b7801054fc0f26b9676b`, release `v1.14.45` (`4922c43b84e5e8d4d7db89d1eece398bfb0e6d9a`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: reviewer reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.44`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.44.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.44.md`, 10,940 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.44-reflection.md`, 2,732 bytes.
- verification inside review: final saved review reported `go test ./internal/business/tasknegotiation/domain -run TestTaskAgreement -count=1` failed because the read-only sandbox blocked `/tmp/go-build...`.

### Output Summary

- The reviewer found K2: durable `PaymentSucceeded` can leave agreement in `payment_pending`, allowing cancel and duplicate payment start.
- The reviewer shallowly found K3: it reported the production-reachability gap for reconciler, but the recovery table still said `PaymentSucceededHandler` is `fx subscribed | reachable`, treating handler registration too positively.
- The reviewer shallowly touched K4: split closure was `not claimed` / evidence gap, but it did not identify terminal lifecycle events emitted before all execution facts are separated/completed.
- The reviewer overclaimed K5: Repository/API classification used method summaries and `Repository: covered`, not method-level aggregate-boundary candidate ownership proof.
- The reviewer shallowly touched K6: delivery/refund/dispute/settlement collaborations were listed as command transaction/authorization or command coordination and then `not claimed`, without finding the missing collaboration model.
- The reviewer overclaimed K7: it still used positive coverage words such as `covered`, `reachable`, and `shape matches` from accepted design/event lists, DTO/query shape, command sequencing, and handler registration.
- The reviewer shallowly touched K8: it identified `payment_pending` as overloaded, but did not enumerate `payment_failed` / `payment_cancelled` and parent-vs-child meaning.
- The reviewer overclaimed K10: it said CQRS was covered and cited QueryRepository/DTO/read facade evidence, but did not inventory read-shaped methods on write repositories/shared adapters with caller semantics.
- Negative-scope lock worked: no literal same-scope table row was left as `checked`; however, `not claimed` and positive wording became the new escape hatch.

### Score

- Breadth: 24 / 45. K2 was found strongly. K3/K4/K6/K8 were shallow. K5/K7/K10 were overclaimed.
- Depth: 26 / 45. Payment stale-command depth was concrete. Recovery, terminal events, repository ownership, collaboration model, state vocabulary, and CQRS inventory were not carried deep enough.
- Review discipline: 6 / 10. Checked rows were suppressed, but the output used `not claimed`, `covered`, `reachable`, and `shape matches` as substitutes for decision quality.
- Total: 56 / 100.

### Gap Analysis

- Previous optimization effectiveness: mixed/regressive. Negative-scope lock removed table-internal `checked`, but the reviewer replaced it with `not claimed` and positive coverage words, reducing false checked rows while lowering issue extraction depth.
- Structural failure: `not claimed` is now treated as a safe terminal state. It must instead become evidence gap, return, or finding when the row is in mandatory lifecycle/repository/event/CQRS scope.
- Overclaim root cause: words like `covered`, `reachable`, `shape matches`, `appears guarded`, and `no blocker found` are unchecked positive conclusions and should be forbidden while negative decisions exist.
- Strategy change: add not-claimed extraction and positive-word scrub. Any `not claimed` mandatory row must be extracted as evidence gap/return/finding with a reason. Positive coverage words in mandatory rows must be downgraded unless admitted by row-local proof.

### Generic Fix Summary

- Add release assertions that `not claimed` cannot be a final mandatory-row decision.
- Require every not-claimed lifecycle/repository/event/CQRS row to become evidence gap, return, or finding.
- Forbid positive coverage words such as `covered`, `reachable`, `shape matches`, `appears guarded`, and `no blocker found` while negative decisions exist.
- Require grouped CQRS inventory placeholders such as bare method-name lists to become evidence gaps unless every required column is filled.

## Round 2026-07-08 v1.14.45 Re-evaluation

- skill-workshop release under evaluation: `v1.14.45`, release commit `4922c43b84e5e8d4d7db89d1eece398bfb0e6d9a`.
- preceding hotfix: `cc73d80c38f86ef1ed4ef3a5fd8d7eb96e347e09`, PR #98, merge commit `3e8f2b8aaca9533bccf2b7801054fc0f26b9676b`.
- next hotfix branch: `hotfix/ddd-review-inventory-completeness`.
- next hotfix commit: `98a4ec99857f2fec1dbe2e2274402b0c77d77d8c`; PR #99, merge commit `b069220a4836fa6ee5d2bd513b20b7526fb42120`, release `v1.14.46` (`3e1503d`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade` completed; reviewer reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.45`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.45.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.45.md`, 8,185 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.45-reflection.md`, 3,451 bytes.
- verification inside review: `go test -count=1 ./internal/business/tasknegotiation/domain ./internal/business/tasknegotiation/application ./internal/business/tasknegotiation/application/eventhandler` passed.

### Output Summary

- The reviewer found K2: persisted `PaymentSucceeded` while `TaskAgreement` remains `payment_pending`, with stale retry/cancel rights through `StartTaskAgreementPayment` and `CancelBeforeFunding`.
- The reviewer found K3: handler/reconciler exists but is not production-wired; no runtime/API/scheduler entrypoint was found.
- The reviewer missed K4: split/dispute terminal event ordering was absent; terminal/execution table only covered payment success.
- The reviewer shallowly covered K5: it had one repository/API classification row for `SaveCancellationBeforeFunding`, but did not classify all repository/API methods coordinating candidate lifecycle owners.
- The reviewer missed K6: delivery/refund/dispute/settlement collaboration models were not discussed; collaboration table only covered payment funding.
- The reviewer shallowly covered K7: it avoided some positive waivers, but did not systematically apply the no-waiver rule against accepted design, semantic names, DTOs, package layout, or absence of forbidden imports.
- The reviewer shallowly covered K8: state-language semantics were an evidence gap and `payment_failed/payment_cancelled` were mentioned, but `payment_pending` and the full parent-vs-child state vocabulary were not enumerated.
- The reviewer shallowly covered K10: it included one CQRS inventory row for `PaymentRepository.ListPaymentsByTaskAgreement`, but did not inventory all read-shaped write repository/shared adapter methods.

### Score

- Breadth: 24 / 45. K2 and K3 were found. K5, K7, K8, and K10 were shallow. K4 and K6 were missed.
- Depth: 25 / 45. Payment stale-command/recovery depth was useful, but split terminal events, broad repository ownership, collaboration policy, state vocabulary, and CQRS inventory stayed incomplete.
- Review discipline: 7 / 10. Positive-word and not-claimed escape hatches were mostly closed, but mandatory section presence collapsed into one-row inventories around the first blocker.
- Total: 56 / 100.

### Gap Analysis

- Previous optimization effectiveness: partial but coverage-regressive. Not-claimed extraction and positive-word scrub worked, but the reviewer narrowed the inventory to payment/FSM and omitted independent lifecycle flows.
- Structural failure: mandatory sections can be present with one row. A section being non-empty is not enough; it must inventory all accepted model/code seeds for that risk family.
- Miss root cause: first-blocker anchoring persists. Once PaymentSucceeded produced F1/F2, split/dispute, delivery/refund/settlement collaboration, state vocabulary, and full CQRS inventory were not explored.
- Strategy change: add inventory completeness gates. Before decisions, extract required seeds from accepted model sources and code: lifecycle flows, repository/API methods, collaboration trigger facts, terminal execution facts, parent state vocabulary, domain event names, and read-shaped write-side methods/shared adapters. Every seed must have a row and final non-positive decision.

### Generic Fix Summary

- Add release assertions that mandatory sections are incomplete unless all accepted model/code seeds are inventoried.
- Require independent flow inventory after the first blocker; a blocker cannot shrink lifecycle scope.
- Require repository/API, collaboration, terminal/execution, state-language, and CQRS sections to enumerate every discovered seed, not only rows implicated by an existing finding.
- Reject one-row mandatory sections when multiple commands, methods, states, events, or read-shaped methods are present in scope.

## Round 2026-07-08 v1.14.46 Re-evaluation

- skill-workshop release under evaluation: `v1.14.46`, release commit `3e1503d39a5091de865830945286cd6314d2ff5f`.
- preceding hotfix: `98a4ec99857f2fec1dbe2e2274402b0c77d77d8c`, PR #99, merge commit `b069220a4836fa6ee5d2bd513b20b7526fb42120`.
- next hotfix branch: `hotfix/ddd-review-collaboration-state-inventory`.
- next hotfix commit: `c2a2a46bcd4220b1fe137cbfd00618fedb56397b`; PR #101, merge commit `76f10ec990e02418db392a0e7912c82a87540682`, release `v1.14.48` (`f5fc7dc`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: reviewer reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.46`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.46.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.46.md`, 11,438 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.46-reflection.md`, 2,724 bytes.
- verification inside review: attempted focused Go tests, but read-only sandbox blocked build/cache creation at `/tmp/sanhe-go-cache`.

### Output Summary

- The reviewer found K3: handler/command evidence was insufficient and no production recovery entrypoint was found for `PaymentSucceeded` recovery.
- The reviewer found K4: split dispute emits misleading terminal lifecycle facts before execution/lifecycle separation is complete.
- The reviewer found K10: CQRS read-shaped method inventory included caller semantics and write-side overlap, and did not rely only on QueryRepository/DTO/read-facade evidence.
- The reviewer shallowly covered K2: it found durable `PaymentSucceeded` leaving `TaskAgreement.payment_pending` and allowing stale cancellation, but did not enumerate retry/open workflow rights broadly.
- The reviewer shallowly covered K5: method-level repository/API rows existed and transaction-only proof was rejected, but ambiguous aggregate-boundary ownership was not elevated into a clear finding across all candidate lifecycle-owner methods.
- The reviewer missed K6: only payment collaboration was modeled; delivery/refund/dispute/settlement collaboration policy and synchronous command-call ambiguity were not addressed.
- The reviewer shallowly covered K7: it resisted positive waiver through overclaim scrub and not-admitted decisions, but did not explicitly generalize accepted design/names/DTOs/layout/import cleanliness as insufficient.
- The reviewer shallowly covered K8: parent-state table mentioned `payment_failed/payment_cancelled` and `payment_pending`, but did not fully enumerate FSM state semantics or classify each parent state as lifecycle fact vs child/process outcome.
- No known issue was mapped as overclaimed.

### Score

- Breadth: 34 / 45. K3, K4, and K10 were found. K2, K5, K7, and K8 were shallow. K6 was missed.
- Depth: 31 / 45. Split terminal facts, recovery reachability, and CQRS were meaningfully deeper. Stale command rights, aggregate-boundary ownership, collaboration policy, and state vocabulary remained incomplete.
- Review discipline: 7 / 10. The review avoided false checked rows and most positive wording, but inventory completeness was still uneven across collaboration/state areas.
- Total: 72 / 100.

### Gap Analysis

- Previous optimization effectiveness: improved. Inventory completeness restored K4/K10 and avoided overclaims, but it still did not force collaboration policy and state vocabulary to full depth.
- Remaining miss root cause: collaboration inventory does not mandate rows for delivery, refund, dispute, settlement, split closure, and payment. K6 stays missed because payment collaboration satisfies the table too cheaply.
- Remaining shallow root cause: state-language inventory does not require every FSM state word and the parent lifecycle fact vs child/process outcome classification per state.
- Remaining shallow root cause: stale command rights need explicit enumeration of retry, cancel, reopen, refund/open-dispute, and other later commands after each durable fact.
- Strategy change: add specialized full inventories for collaboration policy, state vocabulary, and stale-command rights.

### Generic Fix Summary

- Require collaboration model inventory rows for payment, delivery, refund, dispute, settlement, split closure, and any accepted lifecycle reaction.
- Require every collaboration row to classify mechanism as domain event, process manager, reconciler, task processor, integration message, accepted atomic transaction with failure tolerance, or evidence gap.
- Require full FSM parent-state vocabulary inventory and per-state classification as parent lifecycle fact or child/process outcome.
- Require stale-command rights matrix to enumerate retry/start, cancel, reopen, refund/open-dispute/escalate, execution, and closure commands after durable facts.

## Remediation Plan After v1.14.45

- current baseline: `v1.14.45` score 56/100.
- current hotfix branch: `hotfix/ddd-review-default-deny-risk-axes`.
- next hotfix commit / PR / merge commit / tag: pending.
- focused review inputs:
  - Repository/API axis: current rules still treat multi-candidate lifecycle-owner Repository/API shape as a proof problem. Candidate classification can become shallow positive evidence. The shape should start negative by default.
  - Terminal lifecycle axis: current gates require event timing only in checked rows. They do not first inventory every terminal lifecycle fact/event emission and map it to all required execution facts.
  - Evidence/admission axis: mandatory tables are not independent risk axes. A checked, gap, or no-claim result in one axis can still mask missing collaboration, CQRS, state-language, terminal, or repository-owner review.

### Problem List Update

- K4 root cause update: terminal lifecycle event emission must be default-denied until every required execution fact is mapped, durable, separated or complete, idempotent/replay-safe, and recoverable before closure.
- K5 root cause update: Repository/API methods that save or coordinate several aggregate/lifecycle-owner candidates are dangerous shapes. They should default to return/evidence gap/finding; candidate classification only chooses return route unless row-local owned-child or explicit coordination proof defeats the sentinel.
- K6/K7 root cause update: accepted design, transaction shape, semantic names, command sequencing, local convention, DTO/package separation, or absence of forbidden imports cannot answer the first-principles shape challenge.
- K10 root cause update: CQRS inventory remains an independent axis; it cannot be cleared by repository-shape or evidence-admission rows in another axis.

### Generic Fix Summary

- Add a dangerous-shape default-deny gate before proof promotion.
- Add a first-principles challenge: ask whether the shape is genuinely necessary for the business invariant, or compensating for a wrong aggregate/lifecycle boundary.
- Add a terminal-closure default-deny gate for terminal lifecycle facts/events versus required execution facts.
- Add parallel risk-axis review: shape-sentinel, lifecycle-spec, and evidence-admission axes are run independently and aggregated side-by-side; one axis cannot clear another.
- Add release assertions for the new default-deny, terminal-closure, and risk-axis rules across review skill, risk router, and core references.

## Round 2026-07-08 v1.14.47 Re-evaluation

- skill-workshop release under evaluation: `v1.14.47`, release commit `dd76510`.
- preceding hotfix: `214f041b82958d783266b13de96db5e5392220a1`, PR #100, merge commit `84992f454f843b4f23e8fc55501bb5cefb2cff3f`.
- next hotfix branch: `hotfix/ddd-review-collaboration-state-inventory`.
- next hotfix commit: `c2a2a46bcd4220b1fe137cbfd00618fedb56397b`; PR #101, merge commit `76f10ec990e02418db392a0e7912c82a87540682`, release `v1.14.48` (`f5fc7dc`).
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: initial review confirmed `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.47`; reflection was rerun artifact-only after marketplace advanced to `1.14.48`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.47.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.47.md`, 19,480 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.47-reflection.md`, 3,563 bytes.
- verification inside review: initial review ran with `codex v0.142.5`, approval `never`, read-only sandbox.

### Output Summary

- The reviewer found K3: no production API/scheduler/Fx/proto entrypoint was found for `PaymentSucceeded` recovery; handler registration/callable command/test were not accepted as recovery proof.
- The reviewer found K4: refund/settlement terminal lifecycle events can be emitted before split execution is fully separated/completed, and closure event semantics remain incomplete.
- The reviewer shallowly covered K2: durable `Payment` success while parent stays pre-funded/`payment_pending` was found, but stale retry/cancel/open workflow rights were under-scoped.
- The reviewer shallowly covered K5: it found one Repository/API boundary defect (`SaveDeliverySubmission` mutating aggregate state inside Infrastructure), but did not generalize the dangerous-shape rule across all multi-owner Repository/API coordination.
- The reviewer shallowly covered K6: a collaboration table existed, but missing/ambiguous delivery/refund/dispute/settlement collaboration was not raised as its own issue; synchronous command/domain calls were treated too strongly.
- The reviewer shallowly covered K7: overclaim scrub existed, but design shape, DTO/read facade evidence, package/wiring absence, and semantic transaction evidence still softened risks.
- The reviewer shallowly covered K8: `payment_failed/payment_cancelled` were evidence gaps and `payment_pending` was only covered indirectly through K2, not as a full parent-state contract problem.
- The reviewer shallowly covered K10: CQRS risk was inventoried but not promoted; read DTO/query facade separation still reduced the finding below the needed write/read mixing risk.

### Score

- Breadth: 34 / 45. K3 and K4 were found; K2/K5/K6/K7/K8/K10 were all touched but shallow.
- Depth: 29 / 45. Recovery reachability and terminal execution separation were concrete. Stale command rights, Repository dangerous-shape generalization, collaboration model, state semantics, and CQRS proof remained shallow.
- Review discipline: 7 / 10. Default-deny/output structure appeared in the artifact and overclaiming was limited, but evidence admission still allowed several soft passes.
- Total: 70 / 100.

### Gap Analysis

- Previous optimization effectiveness: mixed. Default-deny shape ledger and terminal-closure gate improved K4 and kept positives restrained, but K5/K6/K7/K10 were still not converted into strong findings.
- Remaining shallow root cause: stale parent-state command rights need full enumeration after durable child/process facts, not one representative impact.
- Remaining shallow root cause: Repository/API dangerous-shape handling must generalize across all multi-owner coordination rows, not only a single boundary defect.
- Remaining shallow root cause: collaboration and CQRS evidence tables still allow soft residual gaps instead of first-principles findings.

### Generic Fix Summary

- Require stale-command rights matrix to enumerate retry/start, cancel, reopen, refund/open-dispute/escalate, execution, and closure commands after durable facts.
- Require collaboration model inventory rows for payment, delivery, refund, dispute, settlement, split closure, and every accepted lifecycle reaction.
- Require full FSM parent-state vocabulary inventory and per-state parent lifecycle fact vs child/process outcome classification.
- Require CQRS and proof-admission rules to reject read DTO/query facade/package-layout evidence as softening proof for write/read mixing risks.

## Round 2026-07-08 v1.14.48 Re-evaluation

- skill-workshop release under evaluation: `v1.14.48`, release commit `f5fc7dc03e6119b2b0896af0397e290c54ee2271`.
- preceding hotfix: `c2a2a46bcd4220b1fe137cbfd00618fedb56397b`, PR #101, merge commit `76f10ec990e02418db392a0e7912c82a87540682`.
- next hotfix branch: `hotfix/ddd-review-proof-artifact-admission`.
- next hotfix commit / PR / merge commit / tag: pending.
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade skill-workshop-codex` completed; `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.48`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.48.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.48.md`, 122 lines, 10,354 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.48-reflection.md`, 20 lines, 4,658 bytes.
- verification inside review: `go test ./internal/business/tasknegotiation/...` passed from cache.

### Output Summary

- The reviewer found K2: durable `PaymentSucceeded` can leave the agreement stale while cancellation and retry paths still rely on parent state.
- The reviewer found K3: `PaymentSucceeded` recovery exists as a handler/reconciler concept but is not production-reachable through `Application`, Fx, RPC, scheduler, or runtime wiring.
- The reviewer shallowly covered K5: it identified multi-candidate Repository/API methods and rejected transaction-only proof, but the candidate classification was still a bare method-name list rather than one row per method/candidate/owner/return route.
- The reviewer shallowly covered K6: collaboration was tabled, but delivery/refund/dispute/settlement links were collapsed into `application coordination + repository semantic transaction`.
- The reviewer shallowly covered K8: it found `payment_failed/payment_cancelled` parent states not written by commands, but did not enumerate `payment_pending` and every parent-state word as parent lifecycle fact vs child/process outcome.
- The reviewer overclaimed K4: it marked split refund + settlement closure as no finding/satisfied from a double-fact gate without one terminal/execution row per execution fact and aggregate closure fact.
- The reviewer overclaimed K7: it stated repository transaction proof limits, but still used query DTO/repo separation, section completion, and split-closure satisfaction as positive proof.
- The reviewer overclaimed K10: it marked CQRS no finding without a read-shaped write-side method inventory and caller semantics/storage-overlap proof.

### Score

- Breadth: 34 / 45. K2 and K3 were found. K5, K6, and K8 were shallow. K4, K7, and K10 were overclaimed.
- Depth: 23 / 45. Payment fact precedence and recovery wiring were strong. Terminal/execution, collaboration, parent-state vocabulary, Repository/API candidate proof, and CQRS method proof were compressed.
- Review discipline: 5 / 10. The output avoided Checked flows, but wrote several positive no-finding/satisfied conclusions without the exact proof artifacts.
- Total: 62 / 100.

### Gap Analysis

- Previous optimization effectiveness: regressed in discipline. Collaboration/state inventory rules made K2/K3 strong and surfaced K5/K6/K8, but they also encouraged compact summary tables that the reviewer treated as sufficient.
- Overclaim root cause: "no finding", "satisfied", "covered", and "output completion gate covered" are still allowed when exact Terminal/execution and CQRS rows are absent or grouped.
- Shallow root cause: collaboration mechanism rows still accept `application coordination`, `repository semantic transaction`, `same DB transaction`, or `command transaction` as final mechanisms.
- Shallow root cause: parent-state vocabulary still focuses on failed/cancelled states and misses pending-like configured parent states.

### Generic Fix Summary

- Forbid terminal/execution no-finding unless the exact Terminal/execution fact table has one row per execution fact and aggregate closure fact.
- Forbid CQRS no-finding unless the exact CQRS inventory has one row per read-shaped write-side method or shared adapter method.
- Forbid collaboration mechanism rows from using application coordination, repository semantic transaction, same DB transaction, or command transaction as final mechanism.
- Require parent-state vocabulary to include pending-like configured parent states such as `payment_pending`, not only failed/cancelled states.

## Round 2026-07-08 v1.14.49 Re-evaluation

- skill-workshop release under evaluation: `v1.14.49`, release commit `ac1eef4dceee108ba362878f8ff67b792e3d65e7`.
- preceding hotfix: `1bca346fb2de215db17221e3c99fc6a4be58e5dd`, PR #102, merge commit `f7869d913fe0e8c9b9b7d6fabce6b603e2a652fe`.
- next hotfix branch: `hotfix/ddd-review-not-admitted-extraction`.
- next hotfix commit / PR / merge commit / tag: pending.
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade skill-workshop-codex` completed; `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.49`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.49.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.49.md`, 226 lines, 22,298 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.49-reflection.md`, 20 lines, 4,964 bytes.
- verification inside review: `go test ./... -count=1` passed; infrastructure package took about 180s.

### Output Summary

- The reviewer found K3: `PaymentSucceeded` reconciler has no production entrypoint through proto, Application, module, scheduler, or runtime.
- The reviewer found K7: overclaim scrub downgraded transaction-only and DTO/name-only evidence, and no positive Rules Satisfied entries were emitted.
- The reviewer found K10: CQRS semantic split and read-shaped method inventory were emitted, and write-side repository list methods were extracted into an evidence gap.
- The reviewer shallowly covered K2: `PaymentSucceeded` + `payment_pending` + `cancel/retry/fund` appeared, but the issue was still collapsed into the recovery gap instead of one row per stale command right.
- The reviewer shallowly covered K4: split refund/settlement/closure appeared in terminal and collaboration tables, but rows stayed `not admitted` and no same-scope finding/evidence gap was extracted for terminal closure ordering.
- The reviewer shallowly covered K5: Repository/API per-method rows existed, but candidates and owner proof were still grouped/placeholder-like and accepted atomic transaction failure tolerance remained broad.
- The reviewer shallowly covered K6: collaboration rows did not enumerate delivery/refund/dispute/settlement mechanisms fully, and `command transaction` still appeared as a mechanism in not-admitted rows.
- The reviewer shallowly covered K8: `payment_pending/payment_failed/payment_cancelled` appeared, but parent-state risk stayed table-only and `payment_pending` was too quickly treated as spec-supported.
- No known issue was mapped as overclaimed.

### Score

- Breadth: 38 / 45. K3, K7, and K10 were found. K2, K4, K5, K6, and K8 were shallow.
- Depth: 27 / 45. CQRS and recovery were much stronger. Stale command rights, split closure ordering, collaboration mechanisms, and state-language ownership remained insufficiently extracted.
- Review discipline: 7 / 10. The output used exact tables and withheld checked/positive conclusions, but `not admitted` rows hid several active issues.
- Total: 72 / 100.

### Gap Analysis

- Previous optimization effectiveness: improved discipline but not final score. The proof-artifact gates stopped K4/K10 overclaims and restored CQRS inventory, but did not force every not-admitted row into a same-scope extracted finding/evidence gap.
- Shallow root cause: `not admitted` is being used as a parking state rather than a final negative decision that must be extracted.
- Shallow root cause: stale command rights can still be grouped as `cancel/retry/fund`, avoiding one row per durable fact and later command pair.
- Shallow root cause: collaboration mechanisms can still mention `command transaction` in not-admitted rows without becoming an evidence gap or finding.

### Generic Fix Summary

- Make `not admitted` invalid as a final mandatory-row decision; every not-admitted lifecycle/repository/event/CQRS/terminal/state/collaboration row must become a same-scope finding, evidence gap, or return route.
- Require one-to-one finding extraction: unrelated rows cannot be grouped under a broad gap id, and every negative row needs its own same-scope extracted paragraph or explicit same-scope finding reference.
- Require stale-command rights matrix rows to be one durable fact and one later command each; grouped command cells such as `cancel/retry/fund` are invalid.
- Require any collaboration row whose mechanism is `command transaction`, `application coordination`, `repository semantic transaction`, or `same DB transaction` to become evidence gap/finding/return unless the same row names an accepted atomic decision and failure-tolerance proof.

## Round 2026-07-08 v1.14.50 Re-evaluation

- skill-workshop release under evaluation: `v1.14.50`, release commit `17ab0edebaa728451a25c49d1fabcd767dce9637`.
- preceding hotfix: `5dd8d54 Extract not-admitted ddd review rows` plus `927adaa Generalize grouped command review example`; PR #103, merge commit `53bcf81fb12ed56ef10db2d5cd3112f7ea6de57b`.
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade skill-workshop-codex` completed/already up to date; `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.50`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.50.md '<fixed review prompt>'`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.50.md`, 48 lines, 7,459 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.50-reflection.md`, 23 lines, 3,682 bytes.
- verification inside review: `go test -count=1 ./...` passed.

### Output Summary

- The reviewer found K3: `PaymentSucceeded` recovery/reconciler is not production-reachable through service/scheduler wiring, and cancellation does not consult durable payment facts.
- The reviewer found K4: split dispute emits money execution events as agreement terminal facts before aggregate closure.
- The reviewer found K2: it directly reported that succeeded Payment can be followed by pre-funded cancellation if the funding event is missed.
- The reviewer shallowly covered K6: it touched payment recovery and split closure, but did not inventory delivery/refund/dispute/settlement collaboration mechanisms row-by-row.
- The reviewer missed K5: it did not produce per-method Repository/API candidate classification, owner proof, return route, or accepted atomic-transaction/failure-tolerance proof.
- The reviewer missed K8: it did not run a parent-state language table for `payment_pending`, `payment_failed`, or `payment_cancelled` as possible child Payment process leakage.
- The reviewer missed K7: it did not visibly waive findings through accepted design or semantic transaction proof, but it also did not evaluate that waiver risk.
- The reviewer overclaimed K10: it claimed CQRS was scoped OK without exact read-shaped write-side method inventory and required caller/model/storage-overlap columns.

### Score

- Breadth: 23 / 45. K2, K3, and K4 were found. K6 was shallow. K5, K7, and K8 were missed. K10 was overclaimed.
- Depth: 25 / 45. The concrete lifecycle findings were clear, but repository, collaboration, parent-state, and CQRS gates were mostly absent.
- Review discipline: 5 / 10. The output used findings well, but stopped after obvious findings and left positive residual claims without completing mandatory gates.
- Total: 53 / 100.

### Gap Analysis

- Previous optimization effectiveness: mixed-to-negative. The not-admitted extraction rule made the reviewer convert K4 into a concrete finding, but the output no longer completed the mandatory repository/collaboration/state/CQRS inventories that v1.14.49 at least attempted.
- Missing finding root cause: mandatory gates are still interruptible by early severe findings. The reviewer can stop after two strong lifecycle findings and skip lower-salience but required risk axes.
- Overclaim root cause: residual positive summaries still survive when mandatory inventories are missing, especially CQRS and naming/package evidence.
- Shallow root cause: stale-command admission still allows one concrete later command to stand in for every later command after a durable fact.
- Wrong direction risk: adding more individual rules is now lower leverage. The next fix should change the review protocol shape so the model must finish an axis ledger before emitting residual positive claims.

### Generic Fix Summary

- Make mandatory lifecycle sections non-skippable before final findings: candidate ledger, repository/API candidate classification, collaboration model table, parent-state language table, CQRS read-shaped method inventory, output completion gate, and checked-row admission control.
- Treat lifecycle/repository/event/CQRS scope as a final-output gate: no final Finding paragraph, summary, no-finding claim, Rules Satisfied entry, or residual-risk summary may be emitted until every mandatory axis ledger has been emitted and classified.
- Require a mandatory axis trigger ledger before findings, with inspected evidence for not-applicable axes and evidence-gap decisions for omitted ledgers.
- Require stale-command matrices to enumerate every later command after each durable success/authorization/execution fact, not only the first concrete failure found.
- Default-deny semantic transactions and command-path coordination until row-local proof names an accepted mechanism plus failure-tolerance rule.
- Treat naming, package separation, DTO/query names, and caller location as routing clues only; forbid them as final positive proof.
- Make Finding paragraphs generated only from completed inventory rows; a broad finding cannot stand in for missing repository/API, collaboration, parent-state, or CQRS inventory rows.

## Round 2026-07-08 v1.14.53 Clean Re-evaluation

- skill-workshop release under evaluation: `v1.14.53`, release commit `85a5c71ef2efb17d40882e37256f2595e6438ec0`.
- preceding hotfixes: PR #105, merge commit `daaa5986f91f75fd9f31520e2b011d81a3688bf8`, release `v1.14.52`; PR #106, merge commit `458b0b33e499c44594d318313e3ccf58b0bbbf08`, release `v1.14.53`.
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: clean run started at `2026-07-08T09:31:36+08:00` with `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.53`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它来理解产品需求，然后使用 $ddd-expert:review 本分支的代码实现`
- review artifact: `/tmp/sanhe-ddd-review-clean-v1.14.53.md`, 25 lines, 4,139 bytes.
- run log: `/tmp/sanhe-ddd-review-clean-v1.14.53-run.log`, 16,170 lines, 991,099 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-clean-v1.14.53-reflection.md`, 21 lines, 3,667 bytes.
- process note: earlier fixed-path v1.14.52/v1.14.53/v1.14.54/v1.14.55 runs were contaminated by duplicate background review processes or terminated without a final artifact. The scored artifact is the clean unique-path run above.
- verification inside review: targeted Go test commands passed; full MySQL integration was not run.

### Output Summary

- The reviewer found K2: a succeeded Payment can leave the agreement in `payment_pending`, allowing pre-funded cancel or another start-payment path.
- The reviewer found K3: the `PaymentSucceeded` recovery/reconciler handler was not wired through `Application`, proto RPC, Fx module, scheduler, or another production entrypoint.
- The reviewer found K4: split dispute resolution emits money execution facts (`TaskAgreementRefunded` / `TaskAgreementSettled`) before final agreement closure, while final closure has no event.
- The reviewer found K5 with moderate depth: command-side Repository/API shape creates multi-aggregate semantic transactions across `TaskAgreement`, `Delivery`, `RefundCase`, `DisputeCase`, `Refund`, and `Settlement`, while the design records no command-side port exception.
- The reviewer shallowly covered K6: it pointed toward event/process-manager or failure-semantics proof, but did not fully enumerate delivery/refund/dispute/settlement collaboration mechanisms in the final artifact.
- The reviewer found K7: transaction/idempotency evidence was not accepted as an aggregate-boundary waiver without explicit design exception and failure semantics.
- The reviewer found K8: `payment_failed` and `payment_cancelled` were called out as parent agreement states that actually belong to the child Payment process.
- The reviewer found K10: write-side repositories expose read-shaped list methods returning domain models while a query facade already exists.

### Score

- Breadth: 41 / 45. K2, K3, K4, K5, K7, K8, and K10 were found; K6 remained shallow.
- Depth: 34 / 45. Payment fact precedence, recovery reachability, terminal event separation, and state-language findings were strong. K5 was root-level but grouped `RA-04..RA-12`; K6 lacked mechanism-by-mechanism collaboration enumeration.
- Review discipline: 8 / 10. The output avoided positive clearance, accepted-design waiver, CQRS overclaim, and repository transaction rationalization; row-id traceability was present.
- Total: 83 / 100.

### Gap Analysis

- Previous optimization effectiveness: successful. Mandatory-axis final-output gating and concise output shape finally prevented early severe lifecycle findings from masking Repository/API, parent-state, and CQRS axes.
- Remaining shallow root cause: collaboration/process mechanism rows still need fuller final-output enumeration for every delivery/refund/dispute/settlement reaction.
- Remaining depth issue: multi-aggregate Repository/API shape was finally identified, but final output grouped several rows under one finding instead of expanding each candidate method/owner/return route.
- Stop condition: this clean round crossed the 80-point target. Later v1.14.52-v1.14.56 fixed-path runs are tracked separately as protocol liveness regressions, not as lower-quality scored reviews.

## Protocol Regression 2026-07-08 v1.14.52-v1.14.56

- v1.14.52 introduced a stronger mandatory-axis final-output gate but did not produce `/tmp/sanhe-ddd-review-v1.14.52.md`; the process log reached interim analysis but no final review conclusion.
- v1.14.53 simplified output shape but still did not produce `/tmp/sanhe-ddd-review-v1.14.53.md`; no final DDD review findings were emitted.
- v1.14.54 added a `multi_agent = true` prerequisite and setup-error path, but the sanhe run still ended without `/tmp/sanhe-ddd-review-v1.14.54.md` or a final assistant message.
- v1.14.55 required internal axis subagent delegation; the run failed before final output when `SpawnAgent` rejected a full-history fork with `agent_type`, model, or reasoning-effort overrides.
- v1.14.56 made the coordinator shorter, but the sanhe run still produced no final review file. It loaded the generic `dispatching-parallel-agents` workflow, spawned five reviewers, then the coordinator continued broad local reads (`task_agreement.go`, repository files, `go.mod`, and `go-jimu` module source) until context exhaustion.
- These versions are non-scorable, not low-scoring: the primary defect is protocol liveness. A review skill must always have a final-output path after static evidence inspection.

### Regression Root Cause

- Mandatory subagent delegation made the review skill depend on an execution surface that may be absent or may reject inherited-history arguments.
- Generic delegation workflows are too broad for this review skill; they encourage full-history or long-context coordination instead of the review-specific axis ledger protocol.
- Numeric output/skill line caps treated brevity as the control mechanism. That compressed the protocol but did not guarantee mandatory-axis completion.
- The repair direction is to keep mandatory-axis ledgers as the quality gate, make subagents optional accelerators only, and use single-process fallback with evidence gaps for uninspected or failed-delegation rows.

## Protocol Regression 2026-07-08 v1.14.57

- skill-workshop release under evaluation: `v1.14.57`, release commit `8ec4073cc428b0ba2f5f08ee12b34384b802308d`.
- preceding hotfix: PR #110, merge commit `9c1bab6f25b10f51f6f6fbe82a759ce54554c7bf`.
- plugin evidence: `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.57`; installed review skill contained `Coordinator discipline` and `single-process fallback`.
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.57.md '<fixed review prompt>'`
- expected raw review output file: `/tmp/sanhe-ddd-review-v1.14.57.md`.
- actual result: no output file was created.
- session evidence: `/home/xuhao/.codex/sessions/2026/07/08/rollout-2026-07-08T09-53-06-019f3f6d-c534-7540-85db-bf729cc8ff06.jsonl`.
- process evidence: the session reached 223,975 input tokens and 226,763 total tokens after reading the review skill, large risk-router excerpts, memory architecture/conventions, the spec, and the design. The final session events were tool output plus reasoning; there was no `phase=final_answer` assistant message.

### Regression Root Cause

- v1.14.57 removed the mandatory subagent dead end, but it still allowed unbounded preflight reads before any axis ledger was emitted.
- The review skill still told the reviewer to read the risk router first, and the reviewer also invoked project memory. In this repo, those sources are large enough to consume the review before final output.
- The next fix should make review preflight bounded: risk router and memory are routing indexes only, not full-file preload. If a source is too large or missing, the reviewer must continue from the provided spec/design/code seeds and emit evidence gaps instead of reading until the final answer disappears.

## Protocol Regression 2026-07-08 v1.14.58

- skill-workshop release under evaluation: `v1.14.58`, release commit `ba14f81b3e3a1e0f58ee0f08fd4d2dd0ad5da4c3`.
- preceding hotfix: PR #111, merge commit `f73f78041a7aa4cfa075f21ef2c37aa5bf07fb82`.
- plugin evidence: `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.58`; installed review skill contained bounded risk-router and no-default-memory rules.
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.58.md '<fixed review prompt>' > /tmp/sanhe-ddd-review-v1.14.58-run.log 2>&1`
- expected raw review output file: `/tmp/sanhe-ddd-review-v1.14.58.md`.
- actual result: no output file was created.
- session evidence: `/home/xuhao/.codex/sessions/2026/07/08/rollout-2026-07-08T09-59-45-019f3f73-dcbe-7022-851c-fd7791fade52.jsonl`.
- process evidence: the reviewer obeyed the no-memory rule, but then did broad local source/test/SQL reads. Token usage reached 322,449 input tokens and 326,559 total tokens; the final session events again had no `phase=final_answer`.

### Regression Root Cause

- Bounded preflight fixed project-memory overread, but mandatory-axis completion was still interpreted as exhaustive source traversal.
- Long implementation files, integration tests, and SQL/schema evidence were read before any final-output path, so the axis ledger never became a final answer.
- The next fix should make axis ledgers evidence-indexed: inventory with `rg`, open only row-local snippets needed for a negative/checked decision, and turn the rest into evidence gaps instead of reading every implementation/test line.

## Protocol Regression 2026-07-08 v1.14.59

- skill-workshop release under evaluation: `v1.14.59`, release commit `3bb236b19edb2de64b48617b36ba778014882e9d`.
- preceding hotfix: PR #112, merge commit `b929672eaf8aefbfcaeb6195fa03a751e9200dc5`.
- plugin evidence: `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.59`; installed review skill contained `Axis ledgers are evidence-indexed`.
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.59.md '<fixed review prompt>' > /tmp/sanhe-ddd-review-v1.14.59-run.log 2>&1`
- expected raw review output file: `/tmp/sanhe-ddd-review-v1.14.59.md`.
- actual result: no output file was created.
- session evidence: `/home/xuhao/.codex/sessions/2026/07/08/rollout-2026-07-08T10-04-43-019f3f78-6752-7ac3-b9be-9ea3135c861b.jsonl`.
- process evidence: the reviewer skipped project memory and avoided the previous large overread, but the last session event after diff evidence was reasoning only. There was no `phase=final_answer` assistant message and no next row-local tool call.

### Regression Root Cause

- Evidence-indexing reduced source volume, but the review skill still allowed another analysis/tool turn before final output.
- The final-output gate did not explicitly require a final answer after the initial model/spec/diff inventory batch.
- The next fix should add a final-output checkpoint: after the first evidence inventory batch, emit the DDD review from the ledger; any remaining proof needs become evidence gaps unless a single row-local snippet is strictly necessary.

## Protocol Regression 2026-07-08 v1.14.60

- skill-workshop release under evaluation: `v1.14.60`, release commit `585c671849483192b61ec990730c52a5a6e85a41`.
- preceding hotfix: PR #113, merge commit `d782c1f9367a12601484cac02ebf9f64bd954e96`.
- plugin evidence: `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.60`; installed review skill contained `Final-output checkpoint`.
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.60.md '<fixed review prompt>' > /tmp/sanhe-ddd-review-v1.14.60-run.log 2>&1`
- expected raw review output file: `/tmp/sanhe-ddd-review-v1.14.60.md`.
- actual result: no output file was created.
- session evidence: `/home/xuhao/.codex/sessions/2026/07/08/rollout-2026-07-08T10-08-45-019f3f7c-199f-7f41-87a0-b839f62fc5bd.jsonl`.
- process evidence: the run log declared `reasoning effort: xhigh`, loaded the final-output checkpoint, skipped project memory, and gathered useful row-local evidence for parent-state language, payment recovery, repository/API classification, and command exposure. Token usage reached 1,076,019 cumulative input tokens and 1,083,870 cumulative total tokens; the expected output file was still absent.
- final-session evidence: the last recorded assistant-visible progress message was about `ReconcileSucceededPayments` being internally reachable but apparently lacking RPC or scheduled lifecycle entry. The session then ended after tool output; there was no `phase=final_answer` assistant message.

### Regression Root Cause

- The line-count cap was not the root cause and has already been removed. The latest failure happens despite optional subagents, bounded memory/risk-router preflight, evidence-indexed ledgers, and an explicit final-output checkpoint.
- The reviewer can now find the right evidence, but the protocol still does not force conversion from evidence collection into a final artifact.
- Additional numeric brevity caps would be the wrong repair direction. The remaining fix needs an execution-shape change that makes the first review answer final by construction, such as final-only review mode or a hard two-phase harness outside the skill text: collect bounded evidence, then invoke a separate no-tool finalizer on the ledger.

## Round 2026-07-08 v1.14.61 Re-evaluation

- skill-workshop release under evaluation: `v1.14.61`, release commit `3f1ad71`.
- preceding change: PR #114 reverted the review skill to v1.14.53 behavior after v1.14.52-v1.14.60 liveness regressions; release bump commit `3f1ad71`.
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade skill-workshop-codex` was already up to date; `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.61`.
- fixed review prompt: `docs/superpowers/specs/2026-07-06-task-agreement-payment-delivery-design.md 这是本次迭代的spec文档，基于它理解本次迭代的需求，然后 $ddd-expert:review 本分支下的代码实现`
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.61.md '<fixed review prompt>' > /tmp/sanhe-ddd-review-v1.14.61-run.log 2>&1`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.61.md`, 33 lines, 4,805 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.61-reflection.md`, 31 lines, 3,927 bytes.
- verification inside review: `go test ./internal/business/tasknegotiation/domain ./internal/business/tasknegotiation/application/...`, `go test ./internal/business/tasknegotiation/infrastructure -run TestMySQLTaskAgreement -count=1`, and `go test ./...` passed.

### Output Summary

- The reviewer found K2: a durable succeeded `Payment` can leave the agreement `payment_pending`, and later pre-funded cancellation can still rely only on `TaskAgreement` state.
- The reviewer found K3, but bundled it into K2: the reconciler exists as a command but is not exposed in proto or wired through Fx/runtime production paths.
- The reviewer found K4: split refund/settlement execution emits `TaskAgreementRefunded` / `TaskAgreementSettled` terminal-looking facts before the split agreement closure.
- The reviewer shallowly found K5: it named `RC-2..RC-8` multi-owner semantic repository methods as evidence gaps, but did not emit visible per-method candidate classification or a clear return route.
- The reviewer missed K6: delivery/refund/dispute/settlement behavior linkage was not reviewed as a per-flow Domain Event / process manager / reconciler / accepted-atomic-transaction mechanism question.
- The reviewer shallowly covered K7: it said transaction shape/local convention is not proof, but also avoided marking methods as violations when they "match the accepted design", leaving accepted design as a soft waiver.
- The reviewer shallowly covered K8: it returned `payment_failed` and `payment_cancelled` parent states to design, but did not include `payment_pending` in the state-language ambiguity.
- The reviewer overclaimed K10: it said CQRS inventory completed with no product-read finding claimed, without visible row-level read/write repository proof.

### Score

- Breadth: 30 / 45. K2, K3, and K4 were found. K5, K7, and K8 were shallow. K6 was missed and K10 was overclaimed.
- Depth: 25 / 45. Payment precedence/recovery and split terminal fact evidence were concrete. Repository candidate ownership, collaboration mechanisms, accepted-design non-waiver, parent-state vocabulary, and CQRS read/write inventory were too compressed.
- Review discipline: 6 / 10. The run produced a final artifact and verified tests, but it relied on ledger labels without visible row-level proof, skipped subagents, bundled independent findings, and emitted an unsupported CQRS no-finding claim.
- Total: 61 / 100.

### Gap Analysis

- Previous optimization effectiveness: liveness recovered after the revert, but this run scored below the clean v1.14.53 high-water mark. User manual re-runs saw much higher scores, so treat v1.14.61 as directionally promising but unstable rather than fundamentally wrong.
- Structural failure: the final artifact can say mandatory axes completed while only extracting the two obvious lifecycle findings plus one state evidence gap; axis labels are not enough to force independent findings.
- Shallow root cause: K5/K7 remain weak because accepted design and semantic repository methods are still allowed to soften the return-to-modeling/design decision instead of forcing per-method candidate classification.
- Missing root cause: K6 remains absent because collaboration rows are not independently extracted for delivery, refund, dispute, settlement, and split closure once payment recovery and split terminal facts are found.
- Overclaim root cause: K10 remains vulnerable to a "CQRS inventory completed" negative claim without visible method-level read-shaped write-side inventory and caller/model/storage-overlap proof.
- Strategy change: stabilize the promising path by changing execution shape, not by adding a large checklist. The coordinator does a thin main-axis scan, delegates triggered axes for deep analysis, and then merges bounded ledgers. Also make axis completion summary evidence-derived, not declarative: a final artifact may not claim an axis complete or no-finding unless it either cites concrete row ids with visible negative/extracted decisions or explicitly reports an evidence gap for that axis.

### Generic Fix Summary

- Add a main-axis quick scan followed by one focused subagent per triggered heavy axis; subagents must not each run full global reviews, and the coordinator only merges bounded ledgers.
- Require final axis completion rows to cite visible ledger row ids whose decisions appear in the final artifact; bare `RC-*`, `COL-*`, or `CQ-*` completion claims are invalid.
- Require Repository/API candidate rows that coordinate candidate aggregate/lifecycle owners to become return-to-modeling/design unless every candidate has owner proof, owned-child proof, coordination mechanism, and failure-tolerance proof.
- Require collaboration/process mechanism rows for delivery, refund, dispute, settlement, split closure, and payment to be extracted independently of lifecycle/repository findings.
- Forbid CQRS no-finding or "inventory completed" claims unless the final artifact shows read-shaped write-side method rows with caller semantics, returned model family, write-side influence, storage/adapter overlap, and read-facade ownership decision.
- Require parent-state language inventory to include pending/open states such as `payment_pending`, not only failed/cancelled states.

## Protocol Regression 2026-07-08 v1.14.62

- skill-workshop release under evaluation: `v1.14.62`, release commit `e031ab3`.
- preceding hotfix: PR #115 added the main-axis quick scan, focused axis subagents, evidence-derived axis summary, repository/API default-deny rows, collaboration row extraction, and CQRS visible-row proof.
- sanhe project path: `/home/xuhao/sanhe`.
- sanhe branch / commit / dirty files: `feature/task-agreement@8254c4166a2338ec4700311b8cef6c6fcb987719`; dirty `go.mod`, `go.sum`, `internal/business/tasknegotiation/domain/task_agreement_fsm.go`, `internal/business/tasknegotiation/domain/task_agreement_test.go`.
- plugin evidence: `codex plugin marketplace upgrade skill-workshop-codex` installed the latest marketplace revision; `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.62`.
- review command: `codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.62.md '<fixed review prompt>' > /tmp/sanhe-ddd-review-v1.14.62-run.log 2>&1`
- expected raw review output file: `/tmp/sanhe-ddd-review-v1.14.62.md`.
- actual result: no output file was created; the process was stopped after more than 11 minutes without a final artifact.
- run-log evidence: `/tmp/sanhe-ddd-review-v1.14.62-run.log` reached about 799 KB. Its tail showed useful axis progress: Repository/API returned a shape-sentinel result for multi-owner semantic repository methods; collaboration confirmed payment funding recovery was not production-reachable; lifecycle/recovery identified stale `payment_pending` cancellation and duplicate payment consequences after durable `PaymentSucceeded`. The run then stayed at `collab: Wait` while waiting for remaining FSM/CQRS axes.

### Regression Root Cause

- The v1.14.62 direction was correct: the reviewer did run a thin main-axis pass and extracted deeper independent axis evidence than v1.14.61.
- The liveness contract was incomplete: the coordinator was told to wait until every delegated axis result was merged, but it was not told how to represent a missing or late axis.
- Because missing axes had no bounded fallback representation, the review could wait indefinitely instead of emitting a final artifact with completed-axis findings plus evidence gaps for missing axes.
- The next fix should preserve the subagent direction but make delegation a single bounded collection pass: returned axis ledgers are merged once; any missing axis becomes a missing-axis evidence-gap ledger; missing-axis ledgers block same-scope positive claims, not final artifact emission.

## Protocol Regression 2026-07-08 v1.14.63

- skill-workshop release under evaluation: `v1.14.63`, release commit `a265f7a`.
- preceding hotfix: PR #116 converted absent axis ledgers into missing-axis evidence-gap ledgers and stated that missing axis ledgers block positive claims, not final artifact emission.
- plugin evidence: `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.63`.
- review command: `timeout 900s codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.63.md '<fixed review prompt>' > /tmp/sanhe-ddd-review-v1.14.63-run.log 2>&1`
- expected raw review output file: `/tmp/sanhe-ddd-review-v1.14.63.md`.
- actual result: no output file was created; the process was stopped after about 10 minutes when it remained in the same wait pattern.
- run-log evidence: `/tmp/sanhe-ddd-review-v1.14.63-run.log` showed row-local reads and two concrete lifecycle findings, then emitted `collab: Wait` while "waiting for the independent axis ledgers". After the lifecycle subagent returned, it emitted another `collab: Wait` while waiting for repository, FSM/state, and CQRS axis ledgers.

### Regression Root Cause

- v1.14.63 fixed the final-output semantics for absent ledgers, but still allowed the coordinator to enter an open-ended collaboration wait before finalization.
- The model interpreted "bounded collection pass" as permission to wait for more subagent results, rather than as a fire-and-collect rule.
- The next fix should explicitly forbid wait/collab-wait progress loops: after any axis ledger returns, finalize from returned ledgers plus bounded local ledgers or missing-axis evidence-gap ledgers for all remaining axes.

## Protocol Regression 2026-07-08 v1.14.64

- skill-workshop release under evaluation: `v1.14.64`, release commit `c20ed58`.
- preceding hotfix: PR #117 explicitly forbade wait/collab-wait progress loops and required finalization after partial axis returns.
- plugin evidence: `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.64`.
- review command: `timeout 900s codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.64.md '<fixed review prompt>' > /tmp/sanhe-ddd-review-v1.14.64-run.log 2>&1`
- expected raw review output file: `/tmp/sanhe-ddd-review-v1.14.64.md`.
- actual result: no output file was created; the process was stopped after repeated `collab: Wait` loops.
- run-log evidence: `/tmp/sanhe-ddd-review-v1.14.64-run.log` showed useful local evidence for recovery, split terminal events, and transaction-shaped repository/API rows. It then waited for delegated ledgers; after Repository/API and lifecycle axes returned, it still waited for collaboration/FSM/CQRS axis ledgers.

### Regression Root Cause

- Textual bans on wait/collab-wait did not override the current runtime behavior when the skill still required subagent delegation for multi-axis scope.
- In this Codex execution environment, available subagent/collaboration collection is effectively open-ended; using it for review axes can prevent final artifact emission.
- The next fix should keep the user's direction as a preference, but make it conditional: use subagents only when ledgers can be collected without wait/collab wait. If non-waiting collection is unavailable, skip delegation and complete bounded local axis ledgers in the coordinator.

## Round 2026-07-08 v1.14.65 Re-evaluation

- skill-workshop release under evaluation: `v1.14.65`, release commit `ed461c3`.
- preceding hotfix: PR #118 made subagent delegation non-waiting only and required bounded local axis ledgers when non-waiting collection is unavailable.
- plugin evidence: `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.65`.
- review command: `timeout 900s codex --ask-for-approval never exec -C /home/xuhao/sanhe --sandbox read-only --color never --output-last-message /tmp/sanhe-ddd-review-v1.14.65.md '<fixed review prompt>' > /tmp/sanhe-ddd-review-v1.14.65-run.log 2>&1`
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.65.md`, 44 lines, 4,880 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.65-reflection.md`, 17 lines, 2,238 bytes.
- liveness result: recovered. No final `collab: Wait`; final artifact was emitted.

### Score

- Breadth: 24 / 45. K3 was found. K2, K5, K7, and K8 were shallow. K4 and K6 were missed. K10 was overclaimed.
- Depth: 17 / 45. Recovery wiring had useful depth, but stale command admission, split terminal/execution ordering, repository candidate-owner rows, collaboration mechanism rows, and CQRS inventory were missing or grouped.
- Review discipline: 5 / 10. The run avoided the liveness failure and some positive claims, but compacted mandatory axes into grouped rows and still wrote a CQRS no-branch finding without method-level inventory.
- Total: 46 / 100.

### Gap Analysis

- The local fallback solved liveness but lost depth: without subagent rows, the coordinator collapsed required axis ledgers into one-line summaries or evidence gaps.
- K2 stayed shallow because recovery evidence was not extended into stale-command admission rows for cancel/retry/new payment after durable success.
- K4 and K6 were missed because split refund/settlement terminal/execution facts and delivery/refund/dispute/settlement/split-closure collaboration mechanisms were not independently inventoried.
- K5/K7 stayed shallow because repository/API was represented by a grouped example row instead of one row per semantic method with owner proof and return route.
- K10 remained unsafe because `CQRS/read-side` said "No branch finding" without visible method-level read-shaped write-side rows. When local fallback cannot complete a CQRS inventory, the only valid decision is evidence gap, not no-finding.

## Round 2026-07-08 v1.14.66 Re-evaluation

- skill-workshop release under evaluation: `v1.14.66`, release commit `ef90e51`.
- preceding hotfix: PR #119 required local fallback axes to emit row-local ledgers, reject grouped fallback rows, enumerate stale commands and collaboration mechanisms, and downgrade incomplete CQRS inventory to evidence gap.
- plugin evidence: `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.66`.
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.66.md`, 7,553 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.66-reflection.md`.

### Score

- Breadth: 33 / 45. K3 and K7 were found. K2 and K5 were mostly found but shallow. K6 and K8 were shallow. K4 was shallow/effectively missed. K10 remained overclaimed/missing evidence.
- Depth: 25 / 45. The review had stronger evidence for durable success, recovery reachability, repository semantic transactions, and parent-state/FSM. It still lacked retry/new-payment stale-command expansion, split terminal/execution ordering, per-flow collaboration mechanisms, candidate-owner rows, and CQRS method-level rows.
- Review discipline: 7 / 10. Liveness held, tests were focused, and positive claims were mostly blocked. However, the artifact still used generic/summary axis rows where mandatory rows were needed.
- Total: 65 / 100.

### Gap Analysis

- K2 needs stale-command rows after durable `PaymentSucceeded`, including cancel, retry/start, and new payment while parent state remains `payment_pending`.
- K4 must be a distinct terminal/execution row for split refund/settlement: whether terminal agreement facts/events occur before both execution facts and aggregate closure complete.
- K5 must show one candidate-owner row per semantic repository method; example-only repository evidence is still shallow.
- K6 must show one collaboration mechanism row per delivery/refund/dispute/settlement/split-closure flow. A generic repository/process finding cannot absorb these rows.
- K8 must classify `payment_pending` as an open/stale parent state in the same parent-language ledger, not only `payment_failed` and `payment_cancelled`.
- K10 must not say CQRS has no finding unless method-level rows are visible. If rows are not visible, the decision is evidence gap.

## Round 2026-07-08 v1.14.67 Re-evaluation

- skill-workshop release under evaluation: `v1.14.67`, release commit `74e7c05`.
- preceding hotfix: PR #120 added specific local-row requirements for `payment_pending`, split terminal ordering, per-method repository rows, per-flow collaboration rows, and CQRS no-finding discipline.
- plugin evidence: `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.67`.
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.67.md`, 5,559 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.67-reflection.md`.
- verification inside review: focused domain/eventhandler/application lifecycle tests passed; full `go test ./... -count=1` passed with infrastructure integration taking about 183 seconds.

### Score

- Breadth: 20 / 45. K2 and K3 were found. K5/K7/K8 were shallow. K4 and K6 were missed. K10 was overclaimed.
- Depth: 19 / 45. Payment success/cancellation and recovery reachability were concrete, but independent terminal, collaboration, repository candidate-owner, parent-state, and CQRS ledgers were missing.
- Review discipline: 4 / 10. The artifact used a `Checked Coverage` table and positive "未发现" claims to clear independent axes without visible rows.
- Total: 43 / 100.

### Gap Analysis

- The specific local-row rules were not enough because the final artifact could still collapse independent axes under `Checked Coverage`.
- Positive clearance phrases such as "未发现同类问题", "未发现读模型混用问题", and "适配正确" must be forbidden unless the artifact prints row-level admission proof.
- For complex multi-axis review, concision should not omit mandatory ledger appendix rows for terminal/execution, collaboration, repository/API, parent-state, and CQRS axes.
- If a row is triggered but exact proof is incomplete, the decision must be evidence gap or return, never a no-issue coverage entry.

## Round 2026-07-08 v1.14.68 Re-evaluation

- skill-workshop release under evaluation: `v1.14.68`, release commit `89cb963`.
- preceding hotfix: PR #121 forbade checked coverage tables and positive clearance phrases without exact admitted rows.
- plugin evidence: `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.68`.
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.68.md`, 48 lines, 6,886 bytes.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.68-reflection.md`.

### Score

- Breadth: 31 / 45. K2 and K4 were found; K3, K8, and K10 were shallow; K5/K6/K7 remained weak or missed.
- Depth: 27 / 45. The review had strong lifecycle evidence but still did not print candidate-owner, collaboration-mechanism, parent-state, and CQRS method-level ledgers.
- Review discipline: 6 / 10. Positive clearance was mostly avoided, but the artifact claimed rows emitted without showing the mandatory appendix rows.
- Total: 64 / 100.

### Gap Analysis

- The output contract still lets the reviewer mention row ids in summaries without printing the row-local ledger appendix.
- The existing template says `Ledger appendix: <omit unless needed/requested...>`, which is wrong for complex lifecycle/repository/event/CQRS review. In these reviews the appendix is mandatory evidence, not optional verbosity.
- Next fix: make ledger appendix mandatory before Findings for complex scope. Axis summaries may only cite row ids that appear in the appendix, and missing appendix rows become evidence gaps.

## Design Pivot 2026-07-08 Smell Queue / Correct Shape Whitelist

- v1.14.69 improved lifecycle findings but still showed the same structural weakness: fixed-axis ledgers encouraged summary claims and did not reliably force repository/API, collaboration, parent-state, and CQRS rows to be investigated with equal depth.
- User guidance changed the review architecture: the main axis should own breadth by spotting code-shape/model-pressure deviations, while subagents or local passes own depth by investigating one smell at a time.
- The next fix changes review orchestration from fixed-axis delegation to a Smell Queue:
  - first define the correct DDD/backend shape whitelist;
  - compare touched code shape to that whitelist;
  - record any non-mapping shape as a smell row;
  - investigate exactly one smell per subagent or bounded local pass;
  - append spawned smells to the same queue until all rows reach terminal verdict;
  - generate findings only from closed negative smell rows.
- This is intentionally not a bad-smell inventory. The rule is whitelist-first: express correct shape, then treat deviations as smells.

## Round 2026-07-08 v1.14.71 Re-evaluation

- skill-workshop release under evaluation: `v1.14.71`, release commit `5b41772`.
- preceding hotfix: PR #124 changed review orchestration to coordinator breadth plus one subagent per coarse smell family, with axes as classification tags.
- plugin evidence: `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.71`.
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.71.md`, 35 lines.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.71-reflection.md`.
- verification inside review: `go test -count=1 ./...` passed.
- depth execution evidence: final output reported 5 explorer subagents by smell family: payment fact precedence, terminal/execution facts, repository aggregate boundary, CQRS split, and FSM/state vocabulary.

### Score

- Known-issue hits: K2 full, K4 full, K5 partial, K7 partial, K8 partial, K10 partial, K3 missed, K6 missed.
- Total: 50 / 100.

### Gap Analysis

- The orchestration change worked: review used subagents by smell family and avoided broad fixed-axis delegation.
- The final output still compressed returned depth results too aggressively. K3 recovery/reconciler production wiring and K6 collaboration mechanisms did not appear in findings, returns, no-finding notes, or selected working evidence.
- K5 repository/API candidate-owner proof remained grouped under a broad repository finding instead of visible per-method candidate-owner decisions.
- K8 parent-state vocabulary identified `payment_failed` and `payment_cancelled`, but did not explicitly include `payment_pending` in the state-language return.
- K10 named two read-shaped write repository methods but still lacked visible method-level CQRS inventory/proof columns before product-read no-finding.

### Next Fix

- Add a coordinator merge contract: every returned smell-family verdict must land in Findings, Evidence gaps / returns, No-finding notes, or Selected working evidence.
- Keep the final answer concise, but require selected working evidence for non-finding verdicts in recovery wiring, collaboration mechanisms, repository candidate-owner classification, state vocabulary, and CQRS method inventory.
- Prevent broad findings from absorbing linked depth verdicts; one repository or fact-precedence finding cannot hide independent production-wiring, collaboration, state-language, or CQRS decisions.

## Round 2026-07-08 v1.14.72 Re-evaluation

- skill-workshop release under evaluation: `v1.14.72`, release commit `3ecdbe2`.
- preceding hotfix: PR #125 required returned smell-family verdicts to land in Findings, Evidence gaps / returns, No-finding notes, or Selected working evidence.
- plugin evidence: `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.72`.
- complete raw review output: `/tmp/sanhe-ddd-review-v1.14.72-rerun.md`, 50 lines.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.72-rerun-reflection.md`.
- depth execution evidence: final output reported subagent dispatch was not used because nested tool policy required explicit subagent request, so bounded local depth was used instead.

### Score

- Known-issue hits: K3 full, K4 full, K2 partial, K5 partial, K7 partial, K6 missed, K8 missed, K10 missed.
- Total: 48 / 100.

### Gap Analysis

- The merge contract did not solve the root failure. The review still produced a small set of findings and broad no-finding notes while missing repository candidate-owner, collaboration mechanism, parent-state vocabulary, and CQRS method-level inventory.
- CQRS regressed into a positive no-finding without visible method-level proof.
- Repository/API smell was reframed as an infrastructure-domain-transition issue, while semantic repository methods coordinating multiple lifecycle-owner candidates were not classified.
- The run did not use subagents despite the installed plugin expecting Codex/Claude Code subagent capability.

### Next Fix

- Shift from more final-output constraints to smell burden of proof.
- A smell is a failed correct-shape match, not a neutral question. Depth starts from wrong shape and classifies root cause.
- Define layer-level correct shapes for Domain, Application, Infrastructure, Interface, and Runtime. Any layer behavior outside those shapes becomes a smell family.
- Default-deny examples: Repository/API touching non-aggregate roots or multiple aggregate roots is wrong shape; Application code reading entity state to decide domain behavior is wrong shape.
- Do not negotiate local corner cases inside review. If a shape needs an exception to be valid, return to modeling or design so the exception is explicit upstream.

## Round 2026-07-08 v1.14.73 Re-evaluation

- skill-workshop release under evaluation: `v1.14.73`, release commit `ca5a490`.
- preceding hotfix: PR #126 changed smell depth from proof/falsification to root-cause explanation, added layer-level required/forbidden shape whitelist, and removed field-heavy output/proof contracts from the smell protocol.
- plugin evidence: `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.73`.
- clean worktree review output: `/tmp/sanhe-ddd-review-v1.14.73-clean.md`.
- first dirty-worktree output `/tmp/sanhe-ddd-review-v1.14.73.md` was discarded for scoring because `/home/xuhao/sanhe` had unrelated uncommitted FSM adaptation changes and the review naturally focused that diff.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.73-clean-reflection.md`.
- depth execution evidence: final output reported 4 focused depth explainers: lifecycle fact precedence, repository/API shape, parent state vocabulary, and CQRS read/write split.

### Score

- Known-issue hits: K2 full; K3 missed; K4 partial; K5 partial; K6 partial; K7 partial; K8 partial; K10 partial.
- Total: 52 / 100.

### Gap Analysis

- The root-cause explainer shift restored subagent usage and produced a strong K2 finding.
- The main-axis queue still did not spawn linked smell families after finding a wrong shape. Payment fact precedence should have spawned recovery production wiring; repository/API shape should have spawned terminal/execution timing and collaboration mechanism families; parent-state vocabulary should have included `payment_pending`; CQRS no-finding still lacked visible method-level inventory.
- Grouped returns are still too lossy. A broad repository/API return cannot stand in for candidate-owner, collaboration, terminal timing, and accepted-transaction-waiver decisions.

### Next Fix

- Add linked-family seeding rules to the smell protocol: when a lifecycle/repository/event/CQRS smell appears, the coordinator must enqueue the adjacent correct-shape sentinels that can be invalidated by that smell.
- Keep depth explainers as "why wrong" agents, but make sibling scope concrete enough that recovery wiring, terminal/execution timing, collaboration mechanisms, parent-state vocabulary, and CQRS method inventory do not disappear into grouped returns.

## Round 2026-07-08 v1.14.74 Re-evaluation

- skill-workshop release under evaluation: `v1.14.74`, release commit `a9baceb`.
- preceding hotfix: PR #127 added concise first-hop breadth sentinels for Domain state/event vocabulary, Application durable-fact admission/recovery, Repository/API candidate-owner/collaboration, CQRS read-shaped write methods, and Interface/runtime reachability.
- plugin evidence: `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.74`.
- clean worktree review output: `/tmp/sanhe-ddd-review-v1.14.74-clean.md`, 22 lines.
- run log: `/tmp/sanhe-ddd-review-v1.14.74-clean-run.log`.
- post-review calibration output: `/tmp/sanhe-ddd-review-v1.14.74-clean-reflection.md`.
- depth execution evidence: run log showed 4 explorer subagents: repository/aggregate boundary, event recovery wiring, FSM/state vocabulary, and CQRS inventory. Explorer waits returned eventually, so this was slow but not a no-output liveness regression.

### Score

- Known-issue hits: K3 full; K2 partial; K5 partial; K6 partial; K8 partial; K4 missed; K7 missed; K10 missed.
- Total: 35 / 100.

### Gap Analysis

- First-hop breadth improved in the run log, not in the final artifact. The coordinator recognized recovery wiring and repository/FSM/CQRS families, but the final answer compressed or cleared several returned verdicts.
- K3 improved from missed to full because recovery production reachability became a first-class finding.
- K2 regressed from full to partial: the final finding named `Payment=succeeded` not funding the agreement, but omitted `payment_pending` stale parent state and unsafe cancel/retry/new-payment admission.
- K4 remained missed because terminal/execution timing did not become its own family or final verdict.
- K5/K6 stayed partial because repository/API and collaboration were grouped into one return-to-design paragraph instead of separate candidate-owner and mechanism decisions.
- K7 missed because the final answer softened repository concerns when application code called domain behavior before repository persistence.
- K10 regressed to missed because CQRS was cleared without visible method-level write-repository inventory.

### Next Fix

- Do not add more breadth sentinels yet. The bottleneck moved to coordinator merge/final extraction: every triggered first-hop family must either land as a finding/return/evidence gap or be explicitly marked missing, and `Cleared` must be disallowed for any triggered smell family without visible verdict.

### Follow-up Direction After Review

- Drop default subagent depth execution for now. The measured gain did not justify added latency, token use, and merge risk.
- Use local smell synthesis instead: breadth scan -> Smell List -> merge same-shape smells -> explain why each smell is wrong -> synthesize the shared root cause -> final judgments.
- Treat layer baselines as the source of truth and remove the `risk-router` middle layer. Phase skills should load baseline/protocol references directly, then load strategic or tactical references only when the triggered smell needs explanation.
- Repository/API breadth rule is default-deny: a Repository normally exposes only `Get` and `Save`; extra methods, multi-root saves, and cross-aggregate same-transaction requirements start as smells. The valid modeling exits are one Aggregate Root or Domain Event/process/reconciler collaboration with eventual consistency.

## Unreleased Local Optimization After v1.14.74

- Replaced the `review` hot path with one inline Workflow: breadth scan -> first-hop completion -> merge -> explain one family -> expand siblings -> close Smell List -> synthesize -> report.
- Removed the separate `ddd-risk-router.md` and `ddd-review-smell-protocol.md` references from both plugin tracks.
- Moved layer correct-shape baseline into `review/SKILL.md`; review now derives smells from missing required shape or present forbidden shape.
- Collapsed `ddd-core.md` back into compact DDD defaults and evidence rules. Removed review-protocol vocabulary such as positive-shape, depth-axis, counterfactual gateway, proof artifact, family proof tuple, and matrix proof.
- Contract reference now provides cross-phase reporting facts only; phase skills own their output shapes.
- Release test now protects the simplified structure and includes negative assertions so the deleted risk-router/protocol/depth-axis vocabulary does not return.

Next evaluation should be against the first released version after this local branch, not against v1.14.74.

## Round 2026-07-08 v1.14.75 Re-evaluation

- skill-workshop release under evaluation: `v1.14.75`, release commit `13d5b5a`.
- preceding hotfix: PR #128 removed the separate risk-router and review-smell-protocol references, moved Workflow and Layer Baseline into `review/SKILL.md`, removed default subagent depth execution, and synced current memory docs with the route-only hook contract.
- plugin evidence: `codex plugin add ddd-expert@skill-workshop-codex --json` installed `ddd-expert` version `1.14.75`.
- official clean worktree: `/tmp/sanhe-ddd-review-v1.14.75-clean`, detached at sanhe `8254c41`.
- clean review output: `/home/xuhao/skill-workshop/.tmp/ddd-review-evals/v1.14.75-clean/original-review-final.md`, 15 lines.
- clean run log: `/home/xuhao/skill-workshop/.tmp/ddd-review-evals/v1.14.75-clean/original-review.raw.log`.
- clean post-review calibration output: `/home/xuhao/skill-workshop/.tmp/ddd-review-evals/v1.14.75-clean/reflection-final.md`.
- verification inside clean review: focused lifecycle tests passed, and `go test ./...` passed including infrastructure tests (`171.053s`).
- discarded dirty-worktree side run: `/home/xuhao/skill-workshop/.tmp/ddd-review-evals/v1.14.75/original-review-final.md`. It found K2/K3/K4 full and K5/K6/K7 partial, but `/home/xuhao/sanhe` had uncommitted `go.mod`, `go.sum`, `task_agreement_fsm.go`, and `task_agreement_test.go` changes, so it is not the official score.

### Score

- Known-issue hits: K2 full; K3 full; K8 partial; K4, K5, K6, K7, and K10 missed.
- Breadth: 17 / 45. Payment fact precedence and recovery reachability were found, but the review closed delivery/refund/dispute/settlement and CQRS as no-finding without visible smell verdicts.
- Depth: 17 / 45. K2 and K3 were concrete and useful, including cancel and repeat-start payment admission. The remaining triggered families were not explained; K8 was only adjacent to the durable-fact finding.
- Review discipline: 5 / 10. The final answer was concise and verification was real, but it used spec/design shape and object split as positive proof for broad no-finding notes.
- Total: 39 / 100.

### Gap Analysis

- Removing subagent/default depth and simplifying Workflow improved K2/K3 clarity, but the local Smell List still does not force every first-hop smell family to survive into final output.
- The biggest regression is no-finding admission: "objects are split" and "QueryRepository returns DTO/read models" were accepted as enough proof to clear K4/K5/K6/K10.
- The review still trusts accepted design/spec shape too early. Accepted design must be evidence to inspect, not a waiver for repository/API candidate-owner, collaboration mechanism, terminal/execution ordering, or CQRS method inventory.
- K5 needs repository/API method-shape admission before no-finding: extra semantic methods and cross-owner transaction shapes must be either findings/returns or explicit evidence gaps.
- K6 needs collaboration-mechanism admission before no-finding: delivery/refund/dispute/settlement behaviors need Domain Event / process manager / reconciler / task / explicit operator command explanation.
- K10 needs method-level CQRS admission before no-finding: query DTOs alone do not prove write repositories are not serving product reads.
- Next fix should not add another protocol file. Add no-finding admission rules directly to `review/SKILL.md`: no-finding notes are allowed only for non-smell surfaces with observed correct shape, and triggered first-hop families cannot be cleared by package names, object splitting, accepted design, or DTO/read-model presence alone.

## Round 2026-07-08 v1.14.76 Re-evaluation

- skill-workshop release under evaluation: `v1.14.76`, release commit `01f58f8`.
- preceding hotfix: PR #129 tightened no-finding admission in `review/SKILL.md`, especially weak positive proof such as object splitting, accepted design, DTO presence, QueryRepository presence, and passing tests.
- plugin evidence: `codex plugin list` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.76`.
- official clean worktree: `/tmp/sanhe-ddd-review-v1.14.76-clean`, detached at sanhe `8254c41`.
- clean review output: `/home/xuhao/skill-workshop/.tmp/ddd-review-evals/v1.14.76-clean/original-review-final.md`, 3 findings.
- clean run log: `/home/xuhao/skill-workshop/.tmp/ddd-review-evals/v1.14.76-clean/original-review.raw.log`.
- clean post-review calibration output: `/home/xuhao/skill-workshop/.tmp/ddd-review-evals/v1.14.76-clean/reflection-final.md`.
- verification inside clean review: `go test ./internal/business/tasknegotiation/domain ./internal/business/tasknegotiation/application` passed; `go test ./internal/business/tasknegotiation/...` was interrupted after 101.641s with `infrastructure` marked FAIL, so it is not full-suite evidence.

### Score

- Known-issue hits: K2 full; K3 full; K5 partial; K6 partial; K4, K7, K8, and K10 missed.
- Breadth: 22 / 45. It found payment fact precedence, recovery reachability, and one infrastructure-owned delivery transition, but did not inventory repository/API candidate owners, terminal/execution facts, state vocabulary, or CQRS read/write methods.
- Depth: 22 / 45. K2/K3 were concrete; K5/K6 were adjacent symptoms only. The review still treated object splitting and semantic repository transactions as positive signals.
- Review discipline: 5 / 10. It separated interrupted infra verification from passed focused tests, but still used weak positive proof in Notes.
- Total: 49 / 100.

### Gap Analysis

- No-finding admission wording improved the run log behavior but not final breadth. The final artifact still collapsed most non-payment families into a positive note.
- The review found a new useful symptom, "Delivery submission state transition is in MySQL repository", but did not generalize it into Repository/API candidate-owner classification across payment/delivery/refund/dispute/settlement.
- K7 is the decisive failure mode: the final Notes used "拆分基本符合 spec" and "语义 repository 方法做事务持久化" as waiver-like positive evidence.
- The next fix should remove remaining workflow micro-protocols and make the hot path a positive recipe, not more admission/proof text: six steps, smell guilty-presumption, related evidence follow-up, and weak positive proof downgraded inline in Output.

## Round 2026-07-08 v1.14.77 Re-evaluation

- skill-workshop release under evaluation: `v1.14.77`, release commit `6c360a7`.
- preceding hotfix: PR #130 collapsed `review/SKILL.md` to a six-step smell-list recipe, removed Default-first / no-finding / review-axis / fix-direction micro-protocol sections, and marked stale risk-router docs as superseded.
- plugin evidence: `codex plugin list --json` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.77`.
- official clean worktree: `/tmp/sanhe-ddd-review-v1.14.77-clean`, detached at sanhe `8254c41`.
- clean review output: `/home/xuhao/skill-workshop/.tmp/ddd-review-evals/v1.14.77-clean/original-review-final.md`, 2 findings plus 1 design return.
- clean run log: `/home/xuhao/skill-workshop/.tmp/ddd-review-evals/v1.14.77-clean/original-review.raw.log`.
- clean post-review calibration output: `/home/xuhao/skill-workshop/.tmp/ddd-review-evals/v1.14.77-clean/reflection-final.md`.
- verification inside clean review: `go test ./...` passed; MySQL-backed infrastructure package ran about `180.798s`.

### Score

- Known-issue hits: K3 full; K2 partial; K4 partial; K5 partial; K6 partial; K7 missed; K8 missed; K10 missed with an opposite no-finding note.
- Breadth: 20 / 45. The review found recovery wiring, delivery-in-infra, and event-vocabulary gaps, but did not keep durable fact precedence, candidate-owner classification, state vocabulary, or CQRS inventory alive.
- Depth: 18 / 45. K3 is concrete. K2 stops at funding recovery and misses cancel/retry admission. K4 is reduced to event vocabulary. K5/K6 remain local symptoms rather than aggregate boundary / collaboration mechanism analysis.
- Review discipline: 8 / 10. Verification was strong and the output was concise, but the CQRS no-finding note used QueryRepository/DTO presence as sufficient proof.
- Total: 46 / 100.

### Gap Analysis

- The six-step recipe improved run-log exploration, but final extraction still selects a small subset of families and drops adjacent family obligations.
- K2 regression is important: recovery reachability did not force the next command-admission question, "what commands can still happen while the durable success fact is not reflected on the parent aggregate?"
- K4/K6 improvement is narrow: missing events are visible, but money execution facts, agreement terminal facts, and collaboration mechanism/recovery are not separated.
- K10 shows the same weak-proof pattern in a different form: Product reads through a QueryRepository can be a positive clue, but it cannot clear CQRS without inventorying write repositories and shared adapters for read-shaped methods.
- Next fix should not add a new section. Tighten the workflow output shape itself: Breadth scan must output required family rows for durable fact precedence, terminal/execution split, repository candidate-owner, collaboration mechanism, parent state vocabulary, and CQRS inventory; Report must account for each required family row rather than only each finding.

## Round 2026-07-08 v1.14.78 Re-evaluation

- skill-workshop release under evaluation: `v1.14.78`, release commit `2fc8c15`.
- preceding hotfix: PR #131 required breadth scan and report to account for required family rows: durable-fact admission, terminal/execution split, repository candidate-owner, collaboration mechanism, parent state vocabulary, and CQRS inventory.
- plugin evidence: `codex plugin list --json` reported `ddd-expert@skill-workshop-codex` installed/enabled at `1.14.78`.
- official clean worktree: `/tmp/sanhe-ddd-review-v1.14.78-clean`, detached at sanhe `8254c41`.
- clean review output: `/home/xuhao/skill-workshop/.tmp/ddd-review-evals/v1.14.78-clean/original-review-final.md`, 2 findings plus 1 evidence gap.
- clean run log: `/home/xuhao/skill-workshop/.tmp/ddd-review-evals/v1.14.78-clean/original-review.raw.log`.
- clean post-review calibration output: `/home/xuhao/skill-workshop/.tmp/ddd-review-evals/v1.14.78-clean/reflection-final.md`.
- verification inside clean review: focused tasknegotiation tests passed, `go test ./...` passed including infrastructure MySQL integration tests, and `git diff --check master...HEAD` passed.

### Score

- Known-issue hits: K3 full; K4 full; K2 partial; K6 partial; K8 partial; K5, K7, and K10 missed.
- Breadth: 24 / 45. The review now keeps recovery reachability, split terminal/execution semantics, and parent-state vocabulary in the final output, but still drops repository/API candidate classification, accepted-design waiver, and CQRS inventory.
- Depth: 20 / 45. K3 and K4 are concrete and actionable. K2 stops at recovery and does not reach pre-funded cancellation admission. K6 is local to payment/split closure rather than full delivery/refund/dispute/settlement collaboration.
- Review discipline: 8 / 10. Verification is strong and the output is concise, but CQRS receives an unsupported positive no-finding from QueryRepository presence.
- Total: 52 / 100.

### Gap Analysis

- Required family rows helped K4 and K8, but the model still narrowed scope before scanning Repository/API and CQRS rows.
- K5 needs a mandatory Repository/API inventory for lifecycle reviews: domain repository interfaces, application repository calls, infrastructure store methods, and every method outside `Get`/`Save` classified as same root, owned child, read model, or independent lifecycle owner.
- K7 needs a mandatory accepted-design waiver row: if the spec/design accepts semantic repository transactions or multi-lifecycle saves, the review must still test whether those transactions prove model ownership or merely hide a boundary conflict.
- K10 needs a mandatory CQRS inventory row: a QueryRepository/read facade is only one side of the proof; write repositories and shared adapters must be scanned for read-shaped methods before no-finding.
