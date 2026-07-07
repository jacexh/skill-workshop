# ddd-expert sanhe Review Evaluation Loop

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
- next hotfix commit / PR / merge commit / tag: pending.
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
- next hotfix commit / PR / merge commit / tag: pending.
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
