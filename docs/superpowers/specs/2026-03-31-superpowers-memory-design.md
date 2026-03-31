# Superpowers Memory Plugin Design

## Problem

Superpowers 的工作流（brainstorming → writing-plans → executing-plans → finishing-a-development-branch）缺乏跨迭代的项目记忆能力。每次新会话都要从零开始理解项目，无法基于已有架构和决策做增量设计。此外，plan 文件中的 checkbox 不会随执行进度更新，导致中断后无法恢复。

## Solution

一个独立插件 `superpowers-memory`，零修改 superpowers，通过 SessionStart hook 注入行为指引 + TaskCompleted/Stop hook 联动 + 三个独立 skill，解决两个问题：

1. **项目知识库** — 维护项目的架构、技术选型、特性清单、惯例、决策记录
2. **Plan 活文档** — 执行 task 后更新 plan 文件的 checkbox，支持中断恢复

## Plugin Structure

```
superpowers-memory/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   ├── hooks.json
│   ├── run-hook.cmd
│   ├── session-start
│   ├── task-completed
│   └── stop
├── skills/
│   ├── load/
│   │   └── SKILL.md
│   ├── update/
│   │   └── SKILL.md
│   └── rebuild/
│       └── SKILL.md
├── templates/
│   ├── architecture.md
│   ├── tech-stack.md
│   ├── features.md
│   ├── conventions.md
│   └── decisions.md
└── README.md
```

## Project Knowledge Files

存储在用户项目仓库内，随代码版本控制：

```
docs/project-knowledge/
├── architecture.md      # 架构概览：系统结构、模块划分、数据流
├── tech-stack.md        # 技术选型：语言、框架、关键依赖及选择原因
├── features.md          # 已实现特性清单，关联到对应 spec/plan
├── conventions.md       # 设计约束与惯例：编码规范、架构红线、测试策略
└── decisions.md         # 关键决策记录（ADR 格式）
```

知识库拆成 5 个独立文件，便于增量更新时只修改变化的部分。

### File Format

每个知识库文件采用统一的 frontmatter 格式：

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: YYYY-MM-DD-<feature-name>.md
---
```

- `last_updated` 和 `updated_by` 让 Agent 和用户判断知识库新鲜度
- `triggered_by_plan` 记录触发本次更新的 plan 文件名（rebuild 时为 `null`，update 时为具体 plan 文件名）
- `features.md` 关联 spec/plan 文件路径，形成追溯链
- `decisions.md` 采用 ADR（Architecture Decision Record）格式

### Templates

5 个知识库文件的模板存放在插件的 `templates/` 目录下（见 Plugin Structure）。Skill 生成知识库文件时以模板为基础填充内容。各模板的详细格式见：

- `templates/architecture.md` — 架构概览：System Overview、Module Structure、Data Flow
- `templates/tech-stack.md` — 技术选型：Languages & Frameworks 表格、Key Dependencies 表格
- `templates/features.md` — 特性清单：Implemented（关联 spec）、In Progress（关联 plan）
- `templates/conventions.md` — 设计约束：Coding Standards、Architecture Rules、Testing Conventions
- `templates/decisions.md` — 决策记录：ADR 格式（Context、Decision、Alternatives、Reason）

## Hooks

### Hook 1: SessionStart

**触发条件：** 会话启动、clear、compact

**行为：**
- 检测当前项目是否存在 `docs/project-knowledge/` 目录
- 存在时：注入以下行为指引

```
1. 项目知识库位于 docs/project-knowledge/，包含架构、技术选型、特性清单、惯例、决策记录。

2. Brainstorming 前：
   - 先读取项目知识库，理解项目现状
   - 基于已有架构和约束做设计决策，而非从零构建

3. 执行 Plan 中的 Task 时：
   - 完成一个 Task 后，将对应 plan 文件中的 `- [ ]` 更新为 `- [x]`
   - 这样 plan 成为活文档，中断后可恢复

4. 派发 SubAgent 时：
   - 在 Context 部分包含项目知识库的关键信息（架构、惯例、技术栈）
   - 告知 subagent 项目知识库路径，以便需要时自行查阅

5. 完成开发分支（finishing-a-development-branch）后：
   - 提醒用户触发项目知识库增量更新
```

- 不存在时：注入简短提示 "项目尚未初始化知识库，可运行 superpowers-memory:rebuild 生成"

### Hook 2: TaskCompleted

**触发条件：** 任何 task 被标记完成时

**行为：** 注入提醒 "请更新对应 plan 文件中的 checkbox `- [ ]` → `- [x]`"

### Hook 3: Stop

**触发条件：** 会话正常结束时

**行为：**
- 通过 `git diff --name-only` 检测本次会话是否修改了 `docs/superpowers/plans/` 下的文件（checkbox 被更新意味着 plan 文件有变更）
- 如果有 plan 文件变更，注入提醒 "建议运行 superpowers-memory:update 更新项目知识库"
- 如果没有 plan 文件变更，不注入任何内容

### hooks.json

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" session-start",
            "async": false
          }
        ]
      }
    ],
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" task-completed",
            "async": false
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" stop",
            "async": false
          }
        ]
      }
    ]
  }
}
```

## Skills

### superpowers-memory:load

**职责：** 读取 `docs/project-knowledge/` 下的全部知识库文件，以结构化方式呈现给 Agent，使其快速建立项目认知。

**触发时机：** Brainstorming 开头的 "Explore project context" 阶段。由 SessionStart hook 指引 Agent 主动调用。

**行为：**
- 读取 5 个知识库文件
- 输出一份精炼的项目上下文摘要
- 如果知识库不存在，提示用户先运行 `superpowers-memory:rebuild`

### superpowers-memory:update

**职责：** 基于本次变更增量更新知识库。

**触发时机：**
- finishing-a-development-branch 完成后，Stop hook 提醒用户触发
- 用户主动调用

**行为：**
- 读取当前知识库
- 读取本次相关的 spec、plan、git diff
- 判断哪些知识库文件需要更新（可能只改 features.md 加一条新特性，或者 architecture.md 需要调整）
- 只修改变化的文件，保留未变化的部分
- 更新 frontmatter：`last_updated`、`updated_by`、`triggered_by_plan`（设为触发更新的 plan 文件名）

### superpowers-memory:rebuild

**职责：** 全量扫描 codebase 重新生成完整知识库。

**触发时机：**
- 项目首次接入插件时
- 用户觉得知识库漂移太多，手动触发校准

**行为：**
- 扫描项目结构、代码、配置文件、已有的 spec/plan 文档、git log
- 以 `templates/` 下的模板为基础，从零生成 5 个知识库文件
- 如果已有知识库，覆盖写入（可通过 git diff 查看变化）
- 更新 frontmatter：`last_updated`、`updated_by`，`triggered_by_plan` 设为 `null`

## Update Strategy

- 增量为主，定期全量校准
- 日常迭代完成后触发 `superpowers-memory:update`（增量）
- 用户感觉漂移时手动触发 `superpowers-memory:rebuild`（全量）

## Zero-Modification Principle

本插件不修改 superpowers 的任何文件。影响 Agent 行为的方式：

1. **SessionStart hook** — 注入行为指引，改变 Agent 在 superpowers 流程中的行为（读知识库、更新 checkbox、传递上下文给 subagent）
2. **TaskCompleted hook** — 在关键节点自动提醒，不依赖 Agent 记忆
3. **Stop hook** — 会话结束时提醒更新知识库
4. **独立 skill** — 提供知识库管理能力，不干扰 superpowers 流程

SubAgent 的项目知识传递通过 controller Agent 完成：SessionStart hook 指引 controller 在派发 subagent 时，将知识库关键信息包含在 prompt 的 Context 部分。
