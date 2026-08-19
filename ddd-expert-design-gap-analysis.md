# ddd-expert 系统设计 Gap 分析

> 历史调查记录：本文分析的是 v1.15.22 至 v1.16.2，并保留当时的候选方案。
> 当前工作流以 [ADR 0009](docs/adr/0009-sparse-current-ddd-artifacts.md) 为准；其中的
> `maintain-artifacts`、Tactical Design draft、claims、Architecture projection 和
> reconciliation 不再是现行设计。

## 调查问题

OpenPoker 的旧会话在十几个小时内不断补充事务、事件、checkpoint 和恢复机制，仍没有得到令人满意的系统设计。新会话 `01a013b1-7666-7242-936a-70b02ef94711` 没有使用 `ddd-expert`，却在获得旧会话最终整理的提示词后，一次性形成了相对优秀的方案。

真正需要解释的不是新会话是否遵守了 `ddd-expert` 流程，而是：

1. 旧会话缺少什么设计能力，为什么反复修补仍无法收敛；
2. 新提示词中哪些信息真正改变了结果；
3. 当前 `ddd-expert` 是否会诱导或放大同类问题；
4. 这些能力应该由哪些 Skill 负责，并且如何避免用更多流程约束再次干扰 LLM。

## 版本边界

旧会话开始时使用的是 `ddd-expert` v1.15.22；该版本还没有 Tactical Design Skill。当前仓库的调查基线是 v1.16.2，Tactical Design 是之后加入的。因此必须分开两个判断：旧会话直接暴露的是当时缺失的系统设计责任；对当前文件的 Review 则判断后来新增的流程是否真正补上该责任，或者仍会用模板和制品约束放大同类错误。不能把旧会话未遵守一个当时不存在的 Skill 当成原因。

## 核心结论

新会话成功的主要原因不是“提示词更详细”，而是它直接给出了一个高度压缩、可以生成其余设计的 **system thesis**：

- 核心对象是谁；
- 每个对象拥有哪部分状态、规则和生命周期；
- 对象之间传递的最小业务结果是什么；
- 谁决定某个业务动作何时发生；
- 哪份状态是运行时权威，数据库又扮演什么角色；
- 哪些旧概念没有独立业务意义，应该删除。

旧会话一直缺少这层中间模型。它从 Strategic Model 的“有哪些 Bounded Context、Aggregate 和 Capability”直接跳到了 Application、Repository、事务、事件和恢复机制。系统中心没有确定，外围机制却越来越完整。

因此，问题不能靠增加更多步骤、分支和完成条件解决。过多的约束会把 LLM 的注意力从“哪个解释最小而且成立”转移到“怎样把规定的制品填完整”。本次改造应当减少预置答案，只保留少数高价值判断：业务事实、对象责任、状态权威、语义流、必要性证明和实现后的整体回看。

## 旧会话为什么始终做不好

### 1. 没有形成 Aggregate 内部的对象责任模型

旧会话知道 `CashGame` 是 Aggregate，却没有形成下面这层生成模型：

```text
Hand
  负责一手牌的规则和结果
  -> 产出 ChipChanges

Table
  负责长期在桌余额
  -> 应用 ChipChanges

CashGame
  组合 Hand 与 Table
  负责业务顺序以及何时调用 Ledger
```

缺少这层以后，LLM 只能围绕一个泛化的 Aggregate Root 不断增加外围协调。`HandCommit`、Clone/Adopt/Restore、额外事件和 checkpoint 都是在替代本应由对象职责解释的系统结构。

### 2. 没有先确定状态权威

OpenPoker 的关键事实是 resident `CashGame` 的内存状态是运行时权威，Repository 保存的是 snapshot/checkpoint。旧设计却从普通 request-scoped Aggregate 的 `Get -> mutate -> Save -> discard` 生命周期出发，把数据库提交当成内存对象是否有效的判据。

一旦这个前提成立，就会自然推导出：

```text
复制工作状态
-> 尝试保存
-> 成功后 Adopt
-> 失败后 Restore
-> 结果不明时重新加载或协调
```

这些机制在各自局部都可能自洽，但它们解决的是错误状态模型制造出来的问题。

### 3. 混淆了业务时序所有权与技术调用执行权

“Application 负责 orchestration，Domain 不调用 provider”容易被理解成：只要最终需要 RPC 或外部服务，调用时机也必须由 Application 决定。

实际上需要区分三件事：

| 责任 | 含义 | OpenPoker 示例 |
|---|---|---|
| Domain business sequencing | 哪个业务条件满足时，下一项业务能力必须发生 | `CashGame` 决定应用筹码变化后何时同步 Ledger |
| Application use-case coordination | 提供调用上下文、事务边界和内层语义 capability 的实现 | Application 向 `CashGame` 提供 Domain-owned `ChipChangesApplier` 的实现 |
| Infrastructure provider execution | 执行 RPC、数据库、SDK、连接和技术 retry | Adapter 调用 Ledger RPC |

Domain 可以调用一个由外层提供、使用领域语言表达的 capability，同时完全不知道 RPC、SDK、timeout 和 provider retry。禁止 Domain 拥有 provider mechanics，不等于把业务调用时机上移到 Application。

### 4. 将“制品完整”当成“设计完整”

旧流程高频要求 rejection、timeout、retry、partial completion、compensation 和 recovery，并要求在模板和时序图中逐项落位。虽然正文同时写了 “material” 和 YAGNI，但更具体、更可检查、更反复出现的完成条件会占据 LLM 的注意力。

这个现象泛化后的核心不是“失败场景写太多”，而是：

> 当流程用可枚举的制品完整度代理难以枚举的设计质量时，LLM 会优化制品，而不是优化解释力。

其后果包括：

- 假想的技术故障被提升为领域状态；
- 每个空模板槽位都暗示“这里应该存在一个概念”；
- 局部一致性被误认为系统正确性；
- 机制数量增长，但支持它们的业务事实没有增长。

更有效的门槛是正向的必要性证明：删除这个状态、事件、checkpoint 或恢复机制后，哪项已确认业务责任或保证无法成立？答不出来就不应引入。

### 5. 局部修正与长上下文形成路径依赖

one-frontier-at-a-time、保留 unaffected conclusions、先写完整初稿再逐项评审，本来适合精修一个基本正确的方案；当系统中心选错时，它们会让每次纠正都变成局部补丁。

错误概念一旦进入 draft/ready 制品，后续 Codify 和 Guard 的目标又是忠实实现与一致性检查。于是错误设计成为 ratchet：它会越来越完整、越来越自洽，也越来越难推翻。

当两次以上纠正都指向同一个对象责任或状态权威错误，或者业务场景没有增加而机制持续增加，应触发整体 reset：只保留已支持的事实，从最小 thesis 重新构造，不再默认保留旧结论。

## 新提示词中真正有用的信息

新提示词最有价值的内容不是具体类名、方法名或禁止词，而是以下五类约束。

### 1. 核心对象的责任压缩

它直接说明了 `Hand`、`Table`、`CashGame` 各自拥有的规则、状态和组合关系。这补上了旧会话始终没有生成的 domain-object model。

### 2. 明确的运行时权威

它明确 resident `CashGame` 才是运行时真相，Repository 只是 checkpoint。这个事实一次性淘汰了以数据库提交为中心的 Clone/Adopt/Restore 体系。

### 3. 最小语义数据流

`Hand -> ChipChanges -> Table` 比“发布某事件，再由某协调器处理”更接近业务本身。它给出了对象之间必须传递的最小结果，而没有预先引入实现机制。

### 4. 业务时序和技术执行的拆分

`CashGame` 决定 Ledger 调用时机，Application 提供语义 capability，Infrastructure 执行 RPC。这个 ownership 切分同时满足领域内聚和依赖倒置。

### 5. 对已污染概念的明确否定

在旧上下文已经存在 `HandCommit`、Clone/Adopt/Restore 等概念时，明确指出它们没有业务存在理由，能够帮助新会话摆脱锚点。但这些否定适合出现在针对该项目的 reset handoff，不适合成为常驻 Skill 的机制黑名单。常驻规则应该是必要性证明，而不是记住本案例的答案。

## 改造前 ddd-expert 的放大器

### House Style 越界做了建模决定

改造前的 `references/ddd-core.md` 正确地说 Save 后对象是否可继续使用取决于具体 Repository 和事件契约；但 Go、Python、TypeScript 和 Database references 又把 “Save 后 Aggregate stale、不可继续 mutate/save”写成了近似通用规则。

House Style 的正确用途应当是：

- 实现已经选定的设计；
- 约束依赖方向、技术词汇泄漏、mapping、adapter 和运行时机制；
- 对明确成立的生命周期给出条件实现规则。

它不应该决定：

- Aggregate 是 request-scoped 还是 resident；
- 运行时状态和持久化状态谁是权威；
- 业务调用时机由谁拥有；
- 是否需要 rollback、恢复状态、事件或 coordinator。

因此无需把 House Style 扩写成覆盖所有场景的建模百科。只需明确它不拥有这些决定，并把实现规则分成由上游设计选择的条件分支。

### EventStorming 在 Aggregate 内部停得太早

改造前的 EventStorming 可以完成 Bounded Context 分类、Aggregate Root 确立和 Command-to-Capability 映射，但对 core objects 主要记录 identity/lifecycle 等孤立事实，没有要求说明：

- 每个对象拥有哪些事实和规则；
- 各自为什么变化；
- 产生什么最小业务结果；
- Root 是怎样组合它们，而不是吞掉全部行为。

EventStorming 应补充轻量的 responsibility thesis，但只停留在业务事实和结构假设；类、方法和调用方向仍属于 Tactical Design。

### Tactical Design 直接从 Root 跳到技术参与者

原 Tactical Design 的核心制品是若干技术时序图，模板又预置了：

```text
Interface -> Application -> Repository.Get -> Root -> Repository.Save
```

这会在生命周期尚未确定时把 request-scoped persistence 设成视觉锚点。它还要求第一次设计问题之前先写完整 draft，让用户评审 LLM 已经固化的方案，而没有先拷问用户 thesis 或 LLM 自己的 thesis。

Tactical Design 应先形成：

1. domain entity 级 `classDiagram`；
2. 对象责任、生命周期和关系；
3. state-authority matrix；
4. producer/result/consumer/business sequencer/technical executor 语义流；
5. 每个新增概念的 necessity proof；
6. 最后才是从该模型推导出的少量关键时序图。

### 下游把候选制品误当成不可推翻的真相

EventStorming 和 Tactical Design 的制品同时混入了三种不同强度的内容：

- 已确认业务事实；
- Bounded Context/Aggregate/entity 分解假设；
- sequence/interface/checkpoint 等实现候选。

Codify 和 Guard 如果对它们统一执行 fidelity，就会把错误方向固化。正确语义应是：业务事实不能静默违反；结构与战术候选可以被具体实现证据证伪；任何偏差都必须回到对应 owner 对账，不能由代码静默改写模型。

Ratchet 不只发生在写文件时。若 EventStorming 或 Tactical Design 一开始就加载完整的 `maintain-artifacts` 协议，claims、Architecture projection、状态迁移和一致性写集仍会提前占据上下文，把“设计什么”改写成“怎样得到可落盘的 ready 制品”。因此探索阶段只把已有文件当证据读取；候选整体已经成立、确实要校验或写入时，才加载制品机械协议。初始 Tactical Design draft 也不应包含最终 claims 和 Architecture dispositions；这些内容只能在实现证据回来并完成 reconciliation 后增加。

### 其他 Skill 也存在同型注意力问题

以下文件位于 `.agents`，属于外部插件，不在本仓库的维护范围内。本次只记录横向启发，不修改这些文件。

- `.agents/skills/grilling/SKILL.md` 的 “every aspect / each branch / one question at a time” 容易形成无止境局部追问，应改为 thesis-first、高影响分支和 diminishing-return stop。
- `.agents/skills/to-spec/SKILL.md` 的 “LONG / extremely extensive user stories” 容易把未确认分支序列化成伪需求。
- `.agents/skills/ask-matt/SKILL.md` 主要用 token 数决定 handoff，却缺少“对象责任或状态权威已多次改变”的语义 reset 条件。
- `.agents/skills/domain-modeling/SKILL.md` 不应把 working conclusion 立即写成持久权威。
- `.agents/skills/implement/SKILL.md` 在责任、权威或调用方向未定时，应返回设计 owner，而不是自行补全。

这些 Skill 不应复制 DDD 语义；它们只需要修正访谈、序列化、handoff 和实现入口的通用纪律。

## 重新划分 Skill ownership

| Gap | Owner | 责任 |
|---|---|---|
| 业务事实、权利义务、业务时间和失败含义 | EventStorming | 发现或拷问事实；区分确认事实与可证伪结构假设 |
| core object 的业务责任与变化原因 | EventStorming | 形成轻量 responsibility thesis，不决定类和调用 |
| domain entity 级对象模型 | Tactical Design | 画 UML，拆解 Root/Entity/Value Object 及关系 |
| 运行时状态权威和 checkpoint | Tactical Design | 明确 live authority、durable authority 和失败后有效性 |
| 最小语义流和调用时机 | Tactical Design | 区分 business sequencer 与 technical executor |
| 参与者/状态/事件/恢复机制的存在理由 | Tactical Design | 执行 necessity/deletion test |
| 可逆实现探索与旧机制真实删除 | Codify | 用代码证据检验 draft；记录偏差，不静默改 authority |
| 最终一致性审查 | Guard | 只评审 reconciliation 后的 ready 设计；未对账偏差返回 Tactical Design |
| 制品读写和状态迁移 | maintain-artifacts | 保持机械，不承担设计判断 |

## 建议的新协作链

```text
业务故事或用户已有 thesis
        |
        v
EventStorming
  confirmed business facts
  + current falsifiable strategic hypothesis
        |
        v
Tactical Design conversation
  domain-object UML
  -> responsibility and state authority
  -> semantic flow
  -> necessity/deletion test
  -> minimal critical sequences
        |
        v
draft design candidate
        |
        v
Codify reversible exploration
        |
        v
Tactical Design reconciliation
  -> ready
        |
        v
Codify verified checkpoint -> Guard -> implemented
```

这条链允许前面的制品被推翻，但不允许下游静默忽略它们。`draft` 是给人和 LLM 共用的候选草稿，设计类请求可以停在这里，而且此时不生成最终 claims；`ready` 必须有实现证据并完成整体对账；`implemented` 才表示 Guard 已经对最终实现完成闭环。即使 EventStorming Model 没变，后续实现证据也可以证明某个 Design Delta 应该换成更小的方案或根本不存在：未确认 draft 直接撤销，未 implemented 的 ready 记录经确认后由新 ready 记录替换，或退役并回指仍然足够的 EventStorming authority；旧 claims 必须同时从当前 Architecture 中移除，不能继续成为棘轮。

## 对 Skill 设计本身的约束

本案例最后反推出一个比 DDD 更普遍的原则：

> Skill 的价值不在于穷举专家可能检查的一切，而在于把模型的注意力放到少数真正改变答案的变量上。

具体表现为：

- 优先写正向判断问题，不写长机制黑名单；
- 模板不展示未经选择的规范拓扑；
- 不为每一种可能失败预留必填槽位；
- 草稿形成前允许自由重构，避免过早锚定；
- 多次模型级纠正后整体重述，不在污染上下文中继续补丁；
- 行为 eval 检查是否发现决定性问题、是否删除无根据概念，而不是检查是否说出预定架构名词；
- 新增 instruction 前先问：它改变默认行为，还是只增加了静态可检查文本和上下文负担？

这也是本次改造是否成功的最终判断标准。
