# Codex Marketplace 兼容设计

- **状态**: Draft
- **日期**: 2026-04-26
- **作者**: xuhao + Claude

## 背景

本仓库是 Claude Code 插件市场,提供三个插件:

| 插件 | 当前版本 | 核心能力 |
|---|---|---|
| superpowers-memory | 1.11.0 | 项目知识库持久化 + KB 写锁 + finishing-branch 富注入 |
| superpowers-architect | 1.6.2 | 设计模式标准注入到规划/执行/评审 skill |
| designing-tests | 1.6.0 | 三档测试设计指引(plan / execute / TDD) |

OpenAI 在 2026 年发布的 [Codex CLI](https://developers.openai.com/codex/plugins) 引入了类 Claude 的插件 / hook / skill 机制。Codex 用户能装 `superpowers` 上游插件(包含 `brainstorming`、`writing-plans`、`finishing-a-development-branch` 等 skill),但目前没有等效的 `superpowers-memory` / `superpowers-architect` / `designing-tests` 配套插件。

## 目标

让 Codex 用户通过 marketplace 安装本仓库的三个插件等效版,在目的层面对齐 Claude 版的能力,而非机械翻译协议。

## 非目标

- 不修改现有 `plugins/` 树(策略 A:试验性双树,Claude 版零改动)
- 不抽 `shared/` 公共代码层(此版本接受双份维护)
- 不假装 Codex 协议比实际能力强 —— 协议覆盖不到的场景作为已知 gap 文档化

## Codex 协议关键事实(决定设计走向)

来源:Codex 源码 `openai/codex@main`(`codex-rs/hooks/`、`codex-rs/core-skills/`)。

| 维度 | Codex 实情 |
|---|---|
| 插件 manifest 路径 | `.codex-plugin/plugin.json` |
| 插件可携带 hook 配置吗 | **不可** —— hook 仅从 `~/.codex/hooks.json` / `~/.codex/config.toml` / `<repo>/.codex/hooks.json` / `<repo>/.codex/config.toml` 加载 |
| Marketplace 索引文件 | 优先 `.agents/plugins/marketplace.json`,但兼容 `.claude-plugin/marketplace.json` |
| Marketplace schema | `plugins[].source` 是对象 `{source: "local", path: "./..."}`,需要 `policy.installation`、`policy.authentication`、`category` |
| Marketplace 升级 | **手动**: `codex plugin marketplace upgrade [name]`;无后台自动同步(curated 仓库除外) |
| Hook 事件集 | SessionStart / PreToolUse / PermissionRequest / PostToolUse / UserPromptSubmit / Stop —— **无 UserPromptExpansion** |
| PreToolUse matcher 支持范围 | `Bash`、`apply_patch`、MCP 工具名 —— **不接 skill 调用** |
| Stop 触发时机 | 每个 assistant turn 结束(非 session 结束) |
| Skill 触发 sigil | `$plugin:skill-name`(非 `/`) |
| `UserPromptSubmit.prompt` 字段 | **用户原文**,无 slash/mention 展开(源码 `UserMessageItem::message()` 验证) |
| Skills 自决调用是否触发 hook | **否** —— `InvocationType::Implicit` 不走 hook 流 |

**最关键的协议上限:agent 自决调用 skill 完全不可观测。** 任何依赖"在 skill 调用瞬间切片注入"的设计都需要降级。

## 上游 skill 的触发模式分类

来自用户的实际使用习惯输入:

| 触发模式 | Skill |
|---|---|
| **手动**(用户键入 `$superpowers:xxx`) | `brainstorming`、`finishing-a-development-branch` |
| **自动**(agent 自决调用) | `writing-plans`、`executing-plans`、`subagent-driven-development`、`requesting-code-review`、`receiving-code-review`、`test-driven-development` |

这把 Codex 上的覆盖路径分工锁定:

- **手动触发的 skill** → `UserPromptSubmit` regex 匹配 `$plugin:skill-name`(JIT 注入)
- **自动触发的 skill** → `SessionStart` primer(常驻规则)

## 整体架构

### 顶层目录布局

```
codex-plugins/                                  ← 新增,与现有 plugins/ 并列
├── superpowers-memory/
│   ├── .codex-plugin/plugin.json
│   ├── codex-hooks-snippet.json                ← 声明式 hook 数据
│   ├── hooks/codex-runtime.js                  ← 复制 Claude 版 hook-runtime.js + 平台分支改造
│   ├── skills/
│   │   ├── load/SKILL.md                       ← 复制
│   │   ├── update/SKILL.md                     ← 复制
│   │   ├── rebuild/SKILL.md                    ← 复制
│   │   └── setup/SKILL.md                      ← 新增
│   ├── templates/                              ← 7 份直接复制
│   ├── content-rules.md                        ← 复制
│   └── README.md
├── superpowers-architect/
│   ├── .codex-plugin/plugin.json
│   ├── codex-hooks-snippet.json
│   ├── hooks/codex-runtime.js                  ← 仅 session-start mode
│   ├── design-patterns/                        ← 7 份直接复制
│   ├── skills/setup/SKILL.md
│   └── README.md
└── designing-tests/
    ├── .codex-plugin/plugin.json
    ├── codex-hooks-snippet.json
    ├── hooks/codex-runtime.js                  ← 仅 session-start mode
    ├── skills/
    │   ├── designing-tests/SKILL.md            ← 复制
    │   └── setup/SKILL.md
    ├── references/                             ← 4 份直接复制
    └── README.md

.agents/plugins/marketplace.json                ← 新增,Codex marketplace 索引
.claude-plugin/marketplace.json                 ← 现状不动
```

### Hook 切面汇总

| 插件 | hook 事件 | 主要承担 |
|---|---|---|
| superpowers-memory | SessionStart | KB index 注入 + standing primer(覆盖自动触发 skill) |
|  | UserPromptSubmit | dispatch 2 个手动触发 skill:`$superpowers:brainstorming`(load advisory)、`$superpowers:finishing-a-development-branch`(classifyFinishingState 富注入) |
|  | PreToolUse | matcher = `apply_patch\|mcp__filesystem__.*`,KB 写锁 |
| superpowers-architect | SessionStart | 7 pattern 索引 + 融合元规则(plan apply / review verify 双语义) |
| designing-tests | SessionStart | execution tier 原则 + 4 reference 索引 + 总指令 |

## 逐插件目的驱动平移方案

### 插件 1: superpowers-memory

#### 各能力在 Codex 上的处置

| 能力 | 设计意图(WHY) | Claude 实现 | Codex 实现 |
|---|---|---|---|
| KB index 入场注入 | 让 agent 一开始就持有项目导览,避免摸索浪费 token | SessionStart hook 读 `docs/project-knowledge/index.md` | SessionStart hook 直接对应 |
| 4 个规划/执行 skill 引导 load/update | 在规划/执行心智下提醒 agent KB 存在 | PreToolUse:Skill 切面注入 | **Codex 协议无 JIT 切面** → SessionStart primer 写入祈使规则;接受失去精准时序 |
| finishing-branch 4 路富注入 | 防止 agent 在 KB 不反映 HEAD 的情况下合并 | PreToolUse:Skill + UserPromptExpansion 双路径,共享 `classifyFinishingState()` | 手动触发主路径走 UserPromptSubmit + regex,跑 `classifyFinishingState`;agent 自决调用路径无法获取当下 diff 证据(SessionStart primer 仅承载祈使规则,作为已知 gap) |
| 防绕过写 KB | 强制 KB 写经 update/rebuild 走 verify | PreToolUse:Write/Edit/MultiEdit/NotebookEdit + 锁文件 | PreToolUse:apply_patch + `mcp__filesystem__.*` + 同一把锁(`.git/superpowers-memory.lock`) |
| `load`/`update`/`rebuild` skills | KB 管理的核心机制 | SKILL.md 文件 | 直接复制 |
| 7 份模板 + content-rules.md | 内容规则 SSOT | 文件资产 | 直接复制 |
| KB 写锁 lock/unlock 逻辑 + verify | 平台无关业务逻辑 | hook-runtime.js 中的 mode | 复制到 codex-runtime.js |

#### codex-runtime.js modes

`session-start` / `user-prompt-submit` / `pre-tool-use` / `verify` / `lock` / `unlock` / `lock-status` / `analyze`

相对 Claude 版的改造点(集中在平台分支):
- 删 `user-prompt-expansion` mode
- 新增 `user-prompt-submit` mode(内部跑 classifyFinishingState 或 advisory dispatch)
- PreToolUse matcher 检测从 `Write|Edit|MultiEdit|NotebookEdit` 改成 `apply_patch` + MCP filesystem 兜底
- `${CLAUDE_PLUGIN_ROOT}` 改用 `path.dirname(__filename)` 自解析

#### SessionStart primer 内容(草案)

```
项目知识库已加载;以下是关键标准动作。

[KB index 内容动态读自 docs/project-knowledge/index.md]

标准动作:
- 完成开发后合并前,调用 $superpowers-memory:update 同步 KB
- 调用 $superpowers:finishing-a-development-branch 之前,先确认 KB 反映 HEAD;若不反映,先跑 update
- 对项目结构 / 约定有疑问时,调用 $superpowers-memory:load 拉详细文件
- 编写规划 / 评审时,先 load 项目知识再下手
```

#### UserPromptSubmit dispatch 表

```
$superpowers:brainstorming                  → 注入 1 行 advisory("先调 $superpowers-memory:load")
$superpowers:finishing-a-development-branch → 跑 classifyFinishingState 富注入
```

### 插件 2: superpowers-architect

#### 平移核心决策

5 个 trigger skill 全部自动触发 → **UserPromptSubmit 无目标 skill 可拦,完全砍掉** → Codex 这边只剩 SessionStart 一个 hook。

`plan` vs `review` 两套 wording 因无 JIT dispatch 能力,**采用方案 Y(融合元规则)**:在 SessionStart 一段文本内同时承载 plan apply / review verify 双语义,失去 Claude 的精雕措辞,换取常驻覆盖。

#### codex-runtime.js modes

`session-start` 单 mode。读 `$SP_ARCHITECT_DIR`(全局) + 项目级 pattern 目录(覆盖)→ 构建索引 → 输出。

#### SessionStart 输出(草案)

```
项目设计模式标准 —— 在涉及 $superpowers:writing-plans / executing-plans /
subagent-driven-development 时把以下 pattern 作为强制约束应用(声明哪些适用 / 不适用,
冲突要明说);在涉及 $superpowers:requesting-code-review / receiving-code-review 时
把它们作为核对标准(识别违反 / 冲突 / 改进点)。

[7 个 pattern 索引,name + description + 绝对路径]

按需 Read 深读相关 pattern。
```

### 插件 3: designing-tests

#### 平移核心决策

4 个 trigger skill 全部自动触发 → **UserPromptSubmit 完全砍掉** → 仅 SessionStart 一个 hook。

Three-tier 因无 JIT dispatch,**采用方案 R**:SessionStart 注入 execution tier 原则 + 4 份 reference 索引;TDD 全文档需 agent 主动调 `$designing-tests:designing-tests` 获取(SKILL.md description 写吸引)。

#### SessionStart 输出(草案)

```
测试设计原则 —— 在涉及 $superpowers:writing-plans / executing-plans /
subagent-driven-development / test-driven-development 时参考。

核心原则(execution tier):
- intent-first:从函数意图推导测试,先建测试列表再写实现
- intent comments:每条测试加意图注释
- boundary 选择:测试输入边界 / 边界值 / 决策表
- quality labels:real / shallow / fake 标注

参考资源(按需 Read):
- [layer-selection 路径]
- [risk-catalog 路径]
- [test-case-patterns 路径]
- [test-quality-review 路径]

完整 SKILL.md 在 $designing-tests:designing-tests 调用时获得。
```

## 公共机制

### `setup` skill(每个插件自带一个)

`skills/setup/SKILL.md` 是给 agent 的指令(非可执行 bash),内容为:

1. 读 `~/.codex/hooks.json`(不存在则视作 `{}`)
2. 读本插件目录下 `codex-hooks-snippet.json`(声明式数据,描述本插件需要的 hook 事件)
3. 备份 `~/.codex/hooks.json` → `~/.codex/hooks.json.bak.<timestamp>`
4. 用 marker 注释定位本插件已注入块:
   ```
   // BEGIN <plugin-name>:hooks-v<version>
   ...hook config...
   // END <plugin-name>:hooks
   ```
5. 三种情况处理:
   - 无 marker → 新增完整块
   - 有 marker 且版本与 `codex-hooks-snippet.json` 声明一致 → 报告 "already up to date"
   - 有 marker 且版本不一致 → 替换整块,报告 "updated from vX to vY"
6. 写回,展示 diff
7. 提示用户重启 Codex

Agent 通过 Read/apply_patch 完成所有文件操作,无 bash 依赖。可重入:用户每次 marketplace 升级后再调一次即可。

### `codex-hooks-snippet.json` 契约

每个插件的根目录下声明本插件需要的 hook 事件:

```jsonc
{
  "version": "1.11.0",
  "hooks": {
    "SessionStart": [...],
    "UserPromptSubmit": [...],
    "PreToolUse": [{ "matcher": "apply_patch|mcp__filesystem__.*", ... }]
  }
}
```

`version` 用于 marker 版本协议(见上)。

### Marketplace 升级流程(README 章节)

```
1. codex plugin marketplace upgrade jacexh/skill-workshop
   → 拉取最新插件文件到 ~/.codex/.tmp/marketplaces/

2. 启动 Codex,逐个调用 setup skill:
   $superpowers-memory:setup
   $superpowers-architect:setup
   $designing-tests:setup
   → setup skill 检测自身 marker 版本,判断 up-to-date / 新增 / 更新

3. 重启 Codex 让新 hook 配置生效
```

### `.agents/plugins/marketplace.json` schema

```json
{
  "name": "skill-workshop-codex",
  "interface": {
    "displayName": "Skill Workshop (Codex)"
  },
  "plugins": [
    {
      "name": "superpowers-memory",
      "source": { "source": "local", "path": "./codex-plugins/superpowers-memory" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Productivity"
    },
    ...
  ]
}
```

3 个插件依次注册。

## 已知 Codex 协议 gap

文档化在每个插件的 README 末尾,以及未来 ADR。

1. **Memory:5 个自动触发 skill 的 advisory 仅靠 SessionStart 祈使规则覆盖**
   Claude 用 PreToolUse:Skill 在 `writing-plans` / `executing-plans` / `subagent-driven-development` / `requesting-code-review` / `receiving-code-review` 触发瞬间 JIT 注入;Codex 协议无对应能力,SessionStart 一次注入后随 turn 增加注意力衰减。

2. **Memory:agent 自决调 finishing-a-development-branch 时无 JIT 富证据**
   `classifyFinishingState` 的"当下 commits / diff 范围"输出仅在 UserPromptSubmit 拦到用户键入 slash 时可用;agent 自决路径下只能从 SessionStart primer 拿到祈使规则。

3. **Architect:plan/review wording fork 用融合元规则承载**
   失去 Claude 切面在 plan / review 时刻分别给出"apply"vs"verify"的精雕措辞。

4. **Designing-tests:三档 tier 压成中位数**
   Claude 的 planning tier(轻提醒)/ execution tier(condensed 原则)/ full tier(SKILL.md 全文 + reference index)三档分流不可在 SessionStart 复刻;采用 execution tier + reference 索引作为常驻基线,TDD 全文档需 agent 主动调用 designing-tests skill 获取。

## 平台无关代码资产复用清单

| 资产 | 形式 | 处置 |
|---|---|---|
| 三个插件的 skills(`load`/`update`/`rebuild`/`designing-tests`) | SKILL.md 文件 | 直接复制 |
| 7 份 KB 模板 | 文件 | 直接复制 |
| `content-rules.md` | 文件 | 直接复制 |
| 7 份 design pattern md | 文件 | 直接复制 |
| 4 份 designing-tests reference | 文件 | 直接复制 |
| `classifyFinishingState` / KB 解析 / verify / lock/unlock 逻辑 | 代码 | 从 `hook-runtime.js` 复制到 `codex-runtime.js`;删 UserPromptExpansion + `${CLAUDE_PLUGIN_ROOT}`;新增 UserPromptSubmit + `path.dirname(__filename)` |
| `.git/superpowers-memory.lock` | 运行时文件 | 不复制(由 lock mode 即时创建);Claude 与 Codex 同时运行天然共享 |

## 决策记录

| 决策 | 取舍 | 理由 |
|---|---|---|
| 策略 A:`codex-plugins/` 独立双树,Claude 不动 | 接受 ~2,000 行内容 + ~700 行 runtime 双份维护 | Codex 是试验性,接受漂移;不引入 `shared/` 抽象层 |
| 不在 marketplace 根上做共享 setup 脚本,改为每个插件自带 setup skill | 单点 setup 可能更紧凑,但耦合 marketplace 根 | Codex 心智:agent 用工具完成任务比 bash 脚本更原生;每插件自治 |
| `setup` skill 用 marker 包含版本号做 idempotent | 比单纯文本 diff 复杂 | Codex 升级是手动命令,setup 必须可重入并能识别"我装的是哪版" |
| Architect wording fork 用方案 Y(融合元规则) | 失去 Claude 的精雕分流 | SessionStart 是常驻,X 太臃肿,Z 失语义,Y 是中位数 |
| Designing-tests 用方案 R(execution tier + reference 索引) | 失去三档分流 | 同上理由,中位数最优 |
| Memory `Stop` hook 不移植 | 完全放弃这层防遗忘 | Claude 已在 e6153b8 主动废弃,理由是 per-turn 噪音 > 信号;Codex 上 Stop 同样 per-turn,不重蹈覆辙 |

## 后续

写实现计划:`docs/superpowers/plans/2026-04-26-codex-marketplace-compat-plan.md`
