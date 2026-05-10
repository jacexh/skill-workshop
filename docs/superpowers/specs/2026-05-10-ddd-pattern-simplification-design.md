# DDD 设计模式精简设计

- **状态**: Draft
- **日期**: 2026-05-10
- **作者**: xuhao + Claude

## 背景

当前 `superpowers-architect/design-patterns/` 下的 DDD 三件套（`ddd-modeling.md`、`ddd-core.md`、`ddd-golang.md`，双轨各一份）在两处堆积了与"动手编码"距离较远的内容：

1. **Subdomain 划分（Core / Supporting / Generic）**：作为战略 DDD 的术语放在每次设计前必答位（Architecture Gate 头部 + Phase 0 流程槽位），但实际上下游编码决策几乎不引用 —— `ddd-golang.md` 全文仅 line 1226 一次提及，且仅作为"低可靠性事件可跳过 outbox 的条件"的修饰。
2. **Outbox Pattern**：`ddd-golang.md §3.4` 是 ~250 行 outbox 自实现代码，`ddd-core.md §6.2` 把 outbox 列为三层 reliability tier 之一并以流程图突出，`§3.2` 还为 outbox 专门规定了"Repository 在持久化事务内 drain"这条 drain 模式 —— 形成了一种"outbox 是默认推荐做法"的隐性引导，与"大多数集成消息场景靠 broker at-least-once + 消费端幂等就够"的实际工程实践不匹配。

同时，仓库现已具备一个真正的、版本固定的集成消息标准 port：

- [`github.com/go-jimu/components/ddd/message@v0.9.2`](https://pkg.go.dev/github.com/go-jimu/components@v0.9.2/ddd/message) ——  package doc.go 自述「protobuf-first integration message primitives for **direct, non-transactional** communication across boundaries」。库本身就把"事务性投递"明确划在范围之外（`ddd/message/outbox` 是独立子模块，需要的人自己取用）。
- [`github.com/go-jimu/contrib/message/kafka@v0.3.0`](https://pkg.go.dev/github.com/go-jimu/contrib/message/kafka@v0.3.0) —— 上述 port 的 franz-go 后端实现，自带 `<topic>.retry` / `<topic>.dlq` 与手动 commit 语义。

这让"删 outbox + 收敛 drain 模式 + 直接用库"成为一个一致的方向：库已经用类型系统把 outbox 降级了，文档照着库的边界写就好。

## 目标

1. 移除 subdomain 三类正式分类作为强制设计输入项；保留"如果是包装第三方系统就用 ACL，不必走完整 aggregate 设计"这一条**对编码有真实影响**的判断。
2. 移除 outbox 作为 reliability 默认推荐路径的呈现；保留作为一句话已知逃生口；**不**移除 Domain Event vs Integration Message 的边界划分本身。
3. 把 `ddd-golang.md` 集成消息生产/消费实现指引从"自己设计 port"切换为"直接用 `ddd/message` + `contrib/message/kafka`"，给读者一个开箱即用的范式。
4. 双轨（`plugins/` 与 `codex-plugins/`）保持内容一致。
5. `ddd-python.md` / `ddd-typescript.md` 本次**不动** —— 等 Go 侧定型后再考虑后续语言镜像。

## 非目标

- 不重写 DDD 核心概念（aggregate、bounded context、ubiquitous language、CQRS、ACL、protocol contract 等保持不变）。
- 不引入新的 DDD 概念或换库 —— 只是改用项目已有的 `ddd/message`。
- 不修改 `ddd-python.md` / `ddd-typescript.md`，不评估 Python/TypeScript 侧是否要做平行裁剪。
- 不改 `superpowers-architect` 的 hook、skill、router、Architecture Gate 注入逻辑（注入的内容仅来自 pattern 文件本身）。
- 不为 outbox 提供任何实现示例；`ddd/message/outbox` 子模块的存在仅一句话提及。

## 关键设计决策

### D1: Subdomain 分类降级为 wrap-vs-build 提示

- **删除** `ddd-modeling.md`：
  - §1A "Subdomain Classification" 整节（三类表 + Procedure + 引用）
  - §0 Architecture Gate 模板中 "Technical capability classification" 行**保留**，但**移除**任何隐含的 subdomain 槽（当前模板里没有 subdomain 槽，确认；如有遗漏在实施时一并清理）
  - §6 "Phase 0: Subdomain Classification" 整段
- **新增**（在 §1 "Purpose" 之后、§2 "Bounded Context Discovery" 之前，插入一个轻量小节，约 6–10 行）：

  > "如果一项能力本质上是包装第三方系统（auth、邮件、对象存储、监控、计费 SaaS 等），优先用 Anti-Corruption Layer（§5.6 in ddd-core.md）包一层，而不必走完整的 bounded context / aggregate / repository 设计流程。这一判断只决定该能力是否进入后续建模流程，不进入 Architecture Gate。"

- **下游清理**：`ddd-modeling.md §7 Planning Gates` 中所有 "subdomain" 字样移除；`ddd-core.md §10 Architecture Review Checklist` 中 subdomain 引用（如有）移除。

### D2: Outbox 降级为一句话逃生口，drain 模式收敛为单模式

- **删除**：
  - `ddd-golang.md §3.4` 中整段 "Outbox Pattern Implementation"（含 `OutboxDO`、`outboxRowsFromDomainEvents`、Repository 内嵌 outbox、`OutboxWorker` 全部 ~250 行代码示例）
  - `ddd-golang.md §3.4` 标题以下的 "Conditional: outbox row model / outbox translator / outbox drainer worker" 三行文件清单
  - `ddd-golang.md §3.1 Domain Event Collection Contract` 中 "Reliable Outbox" 与 "Outbox plus same-process notifications" 两支 drain 模式
  - `ddd-golang.md §5.2 Integration Events` 中"低可靠性事件可跳过 outbox 的条件"特例段（line 1226 周围）—— subdomain 与 outbox 都没了，这段失去存在前提
  - `ddd-core.md §3.1 Domain Event Collection` 中 "For reliable Outbox delivery, a Repository or transaction-aware event bus may read pending events..." 段
  - `ddd-core.md §6.2 Reliability Tiers` 三层表的中间行（Outbox Pattern）与下方 Outbox 流程图
  - `ddd-core.md §10 Architecture Review Checklist` 中第 9、16 项关于 reliability tier / Outbox 的引用，简化为单条
- **改写**：
  - `ddd-golang.md §3.1 Domain Event Collection Contract` 收敛为单一 drain 模式：「Aggregate Save 成功后，**Application 层**调用 `aggregate.Events.Drain()` 并通过 `event.Dispatcher.DispatchAll(...)` 进程内分发。Repository 永不 drain。Drain 是 one-shot —— 第二次 drain 返回空切片。」
  - `ddd-golang.md §5.2 Integration Events` 整节重写：基于 `ddd/message` 的最小可运行范式（生产 / 消费各一段），见 D3。
  - `ddd-core.md §6.2 Reliability Tiers` 重写为一段散文：「跨上下文 Integration Event 的默认实现是 broker（如 Kafka）at-least-once 投递 + 消费端幂等处理；进程内 Domain Event 用 in-memory 总线，可接受崩溃丢失。极少数业务场景（支付、库存、合规）不能容忍 publish 前丢失的，可以采用 transactional outbox / inbox / CDC 等模式 —— 本指南不展开实现细节，参考各语言生态的标准方案。」
  - `ddd-core.md §3.4 Infrastructure Layer` 中技术泄漏规则（line 357 附近）保留 outbox 作为反例之一（你拍板的 (c) 选项）：保留 "do not create `OutboxWriter`, `BrokerPublisher`, `UnitOfWork`, `TransactionalEventPublisher` ..." 这条规则**作为反例叙述**；这并不构成"推荐 outbox"，而是"如果你确实用了 outbox，也不要让它泄露成 port"。
  - `ddd-core.md §5.3 Domain Events and Integration Events` 表格的 "Typical mechanism" 行：`Outbox + message queue` 改为 `Message queue + idempotent consumer`，去掉 outbox 突出地位。

### D3: ddd-golang.md 集成消息章节用 `ddd/message` 重写

新版 §5.2 "Integration Events" 提供两段最小可运行示例（生产 + 消费），分别对应 Application 层依赖 `message.Publisher`、消费端实现 `message.Handler`。**不**展示 outbox。

**生产侧（Application 层）—— 依赖 port `message.Publisher`，库提供，不自定义**：

```go
// application/order_service.go
import (
    "context"

    "github.com/go-jimu/components/ddd/event"
    "github.com/go-jimu/components/ddd/message"
    orderv1 "<module>/pkg/gen/order/v1"
)

type OrderService struct {
    repo       OrderRepository
    dispatcher event.Dispatcher    // in-process Domain Event
    publisher  message.Publisher   // cross-context Integration Message
}

func (s *OrderService) Complete(ctx context.Context, id OrderID) error {
    order, err := s.repo.Get(ctx, id)
    if err != nil { return err }

    if err := order.Complete(); err != nil { return err }

    if err := s.repo.Save(ctx, order); err != nil { return err }

    domainEvents := order.Events.Drain()
    _ = s.dispatcher.DispatchAll(ctx, domainEvents...) // best-effort, in-process

    msg, err := message.New(
        message.KindOf(&orderv1.OrderCompleted{}),
        &orderv1.OrderCompleted{
            OrderId:     order.ID().String(),
            UserId:      order.UserID().String(),
            TotalAmount: order.Total().String(),
            OccurredAt:  timestamppb.Now(),
        },
        message.WithKey(order.ID().String()),
    )
    if err != nil { return err }

    return s.publisher.Publish(ctx, msg)
}
```

**消费侧 —— 实现 `message.Handler`，注册到任何 `message.Subscriber`（同进程 Router 或 Kafka Consumer）**：

```go
// application/order_completed_handler.go
type OrderCompletedHandler struct { /* deps */ }

func (h *OrderCompletedHandler) Listening() []message.Kind {
    return []message.Kind{message.KindOf(&orderv1.OrderCompleted{})}
}

func (h *OrderCompletedHandler) Handle(ctx context.Context, msg message.Message) error {
    payload, ok := msg.Payload().(*orderv1.OrderCompleted)
    if !ok { return fmt.Errorf("unexpected payload kind=%s", msg.Kind()) }
    // call domain method or another aggregate's use case; return nil to ack
    return nil
}
```

**Wiring（main / fx 模块）—— 库提供 Kafka 后端，应用只 wire**：

```go
// infrastructure/messaging/kafka.go
import (
    "github.com/go-jimu/components/ddd/message"
    "github.com/go-jimu/contrib/message/kafka"
    "github.com/twmb/franz-go/pkg/kgo"
    orderv1 "<module>/pkg/gen/order/v1"
    "google.golang.org/protobuf/proto"
)

func NewKafkaPublisher(client *kgo.Client) message.Publisher {
    return kafka.NewPublisher(client)
}

func NewKafkaConsumer(client *kgo.Client, handlers []message.Handler) (*kafka.Consumer, error) {
    registry := message.NewPayloadRegistry()
    if err := registry.Register(
        message.KindOf(&orderv1.OrderCompleted{}),
        func() proto.Message { return &orderv1.OrderCompleted{} },
    ); err != nil { return nil, err }

    consumer := kafka.NewConsumer(client, kafka.WithPayloadResolver(registry))
    for _, h := range handlers {
        if err := consumer.Subscribe(h); err != nil { return nil, err }
    }
    return consumer, nil
}
```

**关键文档要点（围绕代码示例的散文）**：

- `message.Kind` 默认推荐用 `message.KindOf(&pb.MessageType{})` 派生 protobuf full name —— Kind 与契约 schema 强绑定，避免 Kind 与 payload 结构漂移。**简单场景或迁移路径**可以使用语义字符串字面量（如 `"orders.paid"`），库不强制（这是你拍板的 (c) 选项）。
- `Kind` 不是 broker topic、不是 partition、不是 routing key。库的语义边界即为：消费者按 Kind 路由 handler；broker topic 由 `kafka.WithTopicResolver` 决定（默认 Kind == topic）。
- 生产侧一律依赖 `message.Publisher` interface；不要为了"加 Kafka"而新增 Application port。
- 消费侧：业务逻辑写在 `message.Handler.Handle` 里，retry / DLQ / commit 一律由库的 Kafka adapter 决定（`<topic>.retry`、`<topic>.dlq`，可通过 `WithRetryPolicy` / `WithDLQTopicResolver` / `WithDLQDisabled` / `WithErrorHandler` 调整）。Handler 返回 `nil` 即 ack，返回 error 走 retry/DLQ 决策。
- `kgo.DisableAutoCommit()` 是 Kafka adapter 的硬性要求 —— 由它做手动 commit。
- Domain Event vs Integration Message 的边界（`ddd-core.md §5.3`）保持不变 —— Domain Event 用 `ddd/event`，进程内、可丢；Integration Message 用 `ddd/message`，跨进程、依赖 broker 投递保证 + 消费端幂等。
- 一句话逃生口：「极少数业务（支付、库存、合规）不能容忍 publish 前丢失的，可参考 `ddd/message/outbox` 子模块或外部 transactional outbox / inbox / CDC 方案，本指南不展开。」

### D4: ddd-core.md 同步收敛

- §3.1 Domain Event Collection 改写：单一 drain 模式（"After a successful `Save()`, the Application layer calls a drain method... Drain is one-shot"），删除 outbox 分支。
- §3.4 Infrastructure Layer 技术泄漏规则保留 outbox 反例（D2 已定）；`Repository / event bus interface` 那段轻量改写：把 "Outbox rows, retry counters, broker adapters" 措辞缓和为通用"reliability mechanisms"，但例子保留。
- §5.3 Domain Events and Integration Events 表格 Typical mechanism 行调整（D2 已定）。
- §5.7 Protocol Contracts 不变。
- §6 标题从 "Domain Events and Reliability" 改为 "Domain Events and Dispatch Timing"（reliability 章已经被 D2 重写为一段）。
- §10 Review Checklist：合并第 9、16 项为单条 "Events are drained by the Application layer after a successful `Save()` and dispatched once; Repository never drains"；其它 outbox / reliability tier 引用清理。

### D5: 双轨同步 + KB 同步

- 所有改动同步到 `codex-plugins/superpowers-architect/design-patterns/` 下三份同名文件。两边内容当前完全一致，实施时直接同步覆盖即可。
- `docs/project-knowledge/conventions.md`：
  - "DDD pattern ownership" 行：`ddd-core.md` 不再 own outbox tier；提及 Integration Message port = `ddd/message`、默认 broker 实现 = `contrib/message/kafka`。
  - "DDD event boundary rule" 改写：去掉"Reliable outbox delivery reads pending Domain Events inside persistence/delivery infrastructure..."一段；改为"Domain Events 进程内通过 `ddd/event`，Integration Messages 跨进程通过 `ddd/message` + broker adapter（默认 `contrib/message/kafka`）"。
  - "DDD event collection drain ownership" 改写：单一 drainer = Application；移除 Repository drain 选项。
  - 其它 outbox 引用按裁剪结果同步。
- `docs/project-knowledge/architecture.md` / `features.md` / `glossary.md` / `tech-stack.md` —— 实施完成后由 `superpowers-memory:update` 增量更新即可，本 spec **不**预写。

### D6: 实施顺序

按依赖方向自上而下：

1. `ddd-modeling.md`（subdomain 删除 + wrap-vs-build 段加入）
2. `ddd-core.md`（§3.1 / §3.4 / §5.3 / §6 / §10 收敛与改写）
3. `ddd-golang.md`（§3.1 drain 收敛 + §3.4 outbox 整段删除 + §5.2 用 `ddd/message` 重写 + §6.2 文件清单清理 + §7 技术栈表加 `ddd/message` 与 `contrib/message/kafka`）
4. 双轨同步（`plugins/` ↔ `codex-plugins/`）
5. `docs/project-knowledge/conventions.md` 同步
6. 提交 PR
7. PR 合并后 `superpowers-memory:update` 跟进 KB 增量更新

## 设计依据 / 参考

- `ddd/message@v0.9.2` 源码读取自 `/home/xuhao/go/pkg/mod/github.com/go-jimu/components@v0.9.2/ddd/message/`（doc.go、message.go、router.go、resolver.go、option.go、errors.go）。`Publisher` / `Subscriber` / `Handler` / `Runner` / `Kind` / `Message` / `PayloadRegistry` 等 API 与本文档示例对应。
- `contrib/message/kafka@v0.3.0` 源码读取自 `/home/xuhao/go/pkg/mod/github.com/go-jimu/contrib/message/kafka@v0.3.0/`（README.md、publisher.go、consumer.go）。`NewPublisher` / `NewConsumer` / `WithPayloadResolver` / `WithTopicResolver` 等签名与本文档示例对应。
- 现有 `ddd-golang.md` `ddd/event` 用法保持原状（line 313、393、424、926、1027、1367 等引用不变）；本次只改 `ddd/message` 相关部分。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 删除 outbox 后，团队遇到"必须不丢"的真实场景找不到指引 | 一句话逃生口指向 `ddd/message/outbox` 与外部 transactional outbox / CDC 资料 |
| 删除 subdomain 后，"该不该建 aggregate"的判断失去抓手 | 保留 wrap-vs-build 提示段；§3 Aggregate Design 自身的 invariant rule 已经是更具体的判断标准 |
| `ddd-python.md` / `ddd-typescript.md` 与 `ddd-modeling.md` / `ddd-core.md` 出现局部不一致（python/ts 仍引用已删除的 subdomain / outbox 锚点） | 接受 —— 用户明确 "本次只动 Go"；后续 spec 再处理 |
| 双轨复制时遗漏 codex 侧某个文件 | 实施 plan 中显式列出 6 个目标文件路径并设置交叉验证步骤（diff plugins ↔ codex-plugins 应为 0） |
| `ddd/message@v0.9.2` 标注 experimental（README 与 doc.go） | 接受 —— 文档明确指出版本号锁定 v0.9.2，未来升级需要同步评估 |

## 体量预估

- 净减约 600 行：subdomain ~80 行 + outbox 实现 ~250 行 + drain 多模式简化 ~80 行 + 配套规则/checklist 缩减 ~120 行 + outbox tier 流程图 ~30 行 + 文件清单等零碎 ~40 行。
- 新增约 130 行：wrap-vs-build 段 ~10 行 + `ddd/message` 重写示例与文档 ~120 行。
- 净变化：每份文件 -470 行左右；双轨同步后总计削减约 940 行。

## 验收标准

1. 在 `ddd-modeling.md` 中 grep `Subdomain Classification` / `Core Domain` / `Supporting Subdomain` / `Generic Subdomain` 全部为 0 命中（保留 §5.6 ACL 中"external systems"通用语义无关字眼）。
2. 在三份 DDD 文件中 grep `OutboxDO` / `OutboxWorker` / `outbox table` / `outbox row` 全部为 0 命中；`outbox` 词频压缩到 ≤5 处（`ddd-core.md §3.4` 反例引用 + 一句话逃生口 + `ddd-golang.md §5.2` 逃生口、零星 schema-evolution / 历史引用），不再以 outbox 为节标题或流程图主语。
3. `ddd-golang.md §5.2 Integration Events` 中包含 `message.Publisher`、`message.Handler`、`kafka.NewPublisher`、`kafka.NewConsumer` 至少各一处。
4. `plugins/superpowers-architect/design-patterns/ddd-{modeling,core,golang}.md` 与 `codex-plugins/superpowers-architect/design-patterns/ddd-{modeling,core,golang}.md` 内容字节级一致（`diff` 输出为空）。
5. `docs/project-knowledge/conventions.md` "DDD pattern ownership"、"DDD event boundary rule"、"DDD event collection drain ownership" 三条文本与本 spec D5 对齐。
6. `ddd-python.md` 与 `ddd-typescript.md` **未被修改**（git diff 为空）。
