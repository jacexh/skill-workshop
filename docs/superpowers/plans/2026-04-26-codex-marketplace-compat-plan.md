# Codex Marketplace 兼容实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `codex-plugins/` 新树下完成 superpowers-memory / superpowers-architect / designing-tests 三个插件对 Codex marketplace 的兼容平移,Claude 侧 `plugins/` 树零改动。

**Architecture:** 策略 A —— 独立双树,内容资产直接复制;hook 配置由各插件自带 `setup` skill 写入用户 `~/.codex/hooks.json`(marker 版本协议保证幂等);marketplace 索引新建 `.agents/plugins/marketplace.json`(Codex 对象 source schema)。覆盖路径分工:**手动触发 skill** 走 `UserPromptSubmit` regex 注入;**自动触发 skill** 走 `SessionStart` primer。

**Tech Stack:** Node.js(`codex-runtime.js`)、Markdown(SKILL.md / 模板 / pattern / reference)、JSON(plugin manifest / marketplace / hooks-snippet)、git。

**Spec 路径:** `docs/superpowers/specs/2026-04-26-codex-marketplace-compat-design.md`

**架构标准说明:** superpowers-architect 列出的 7 个 design pattern(database / ddd-* / rest-api / frontend-patterns)**全部不相关** —— 本任务局限在插件市场仓库(Node + Markdown + JSON),无数据库 / 服务架构 / REST API / 前端 UI。

---

## 任务概览

| Phase | 任务范围 | 任务数 |
|---|---|---|
| A | Marketplace 索引 + 三个插件 manifest 骨架 | T1–T5 |
| B | superpowers-memory 平移 | T6–T15 |
| C | superpowers-architect 平移 | T16–T20 |
| D | designing-tests 平移 | T21–T25 |
| E | 集成验证 + 文档 | T26–T28 |

---

## Phase A:Marketplace 索引 + 插件骨架

### Task 1:创建 codex-plugins 顶层目录与三个插件子目录

**Files:**
- Create: `codex-plugins/superpowers-memory/`
- Create: `codex-plugins/superpowers-architect/`
- Create: `codex-plugins/designing-tests/`

- [ ] **Step 1:创建目录树**

```bash
mkdir -p /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/{hooks,skills,templates,.codex-plugin}
mkdir -p /home/xuhao/skill-workshop/codex-plugins/superpowers-architect/{hooks,design-patterns,skills,.codex-plugin}
mkdir -p /home/xuhao/skill-workshop/codex-plugins/designing-tests/{hooks,skills,references,.codex-plugin}
```

- [ ] **Step 2:验证目录结构**

```bash
find /home/xuhao/skill-workshop/codex-plugins -type d | sort
```
Expected:输出 12 个目录(3 插件 × 4 子目录 + 3 插件根 + 1 codex-plugins 根)。

### Task 2:创建 superpowers-memory 的 .codex-plugin/plugin.json

**Files:**
- Create: `codex-plugins/superpowers-memory/.codex-plugin/plugin.json`

- [ ] **Step 1:写 plugin.json**

```json
{
  "name": "superpowers-memory",
  "version": "1.11.0",
  "description": "Project knowledge persistence and KB write-lock for Codex superpowers workflows",
  "author": {
    "name": "xuhao"
  },
  "license": "MIT",
  "keywords": ["superpowers", "memory", "project-knowledge", "kb", "codex"],
  "interface": {
    "displayName": "Superpowers Memory",
    "shortDescription": "Project KB persistence + write-lock for Codex",
    "category": "Productivity",
    "capabilities": ["Read", "Write"]
  },
  "skills": ["./skills/load", "./skills/update", "./skills/rebuild", "./skills/setup"]
}
```

- [ ] **Step 2:验证 JSON 解析**

```bash
node -e 'JSON.parse(require("fs").readFileSync("/home/xuhao/skill-workshop/codex-plugins/superpowers-memory/.codex-plugin/plugin.json"))'
```
Expected:无输出(parse 成功)。

### Task 3:创建 superpowers-architect 与 designing-tests 的 plugin.json

**Files:**
- Create: `codex-plugins/superpowers-architect/.codex-plugin/plugin.json`
- Create: `codex-plugins/designing-tests/.codex-plugin/plugin.json`

- [ ] **Step 1:写 architect plugin.json**

```json
{
  "name": "superpowers-architect",
  "version": "1.6.2",
  "description": "Inject design pattern standards as constraints into planning, execution, and code review (Codex)",
  "author": { "name": "xuhao" },
  "license": "MIT",
  "keywords": ["superpowers", "architect", "design-patterns", "codex"],
  "interface": {
    "displayName": "Superpowers Architect",
    "shortDescription": "Design pattern standards for Codex",
    "category": "Productivity",
    "capabilities": ["Read"]
  },
  "skills": ["./skills/setup"]
}
```

- [ ] **Step 2:写 designing-tests plugin.json**

```json
{
  "name": "designing-tests",
  "version": "1.6.0",
  "description": "Risk-driven test design guidance for Codex",
  "author": { "name": "xuhao" },
  "license": "MIT",
  "keywords": ["testing", "test-design", "quality", "codex"],
  "interface": {
    "displayName": "Designing Tests",
    "shortDescription": "Risk-driven test design for Codex",
    "category": "Productivity",
    "capabilities": ["Read"]
  },
  "skills": ["./skills/designing-tests", "./skills/setup"]
}
```

- [ ] **Step 3:验证两个 JSON**

```bash
node -e 'JSON.parse(require("fs").readFileSync("/home/xuhao/skill-workshop/codex-plugins/superpowers-architect/.codex-plugin/plugin.json"))'
node -e 'JSON.parse(require("fs").readFileSync("/home/xuhao/skill-workshop/codex-plugins/designing-tests/.codex-plugin/plugin.json"))'
```
Expected:两条命令都无输出。

### Task 4:创建 .agents/plugins/marketplace.json(Codex marketplace 索引)

**Files:**
- Create: `.agents/plugins/marketplace.json`

- [ ] **Step 1:创建目录并写 marketplace.json**

```bash
mkdir -p /home/xuhao/skill-workshop/.agents/plugins
```

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
    {
      "name": "superpowers-architect",
      "source": { "source": "local", "path": "./codex-plugins/superpowers-architect" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Productivity"
    },
    {
      "name": "designing-tests",
      "source": { "source": "local", "path": "./codex-plugins/designing-tests" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Productivity"
    }
  ]
}
```

- [ ] **Step 2:验证 JSON**

```bash
node -e 'const m = JSON.parse(require("fs").readFileSync("/home/xuhao/skill-workshop/.agents/plugins/marketplace.json")); if (m.plugins.length !== 3) throw new Error("expected 3 plugins")'
```
Expected:无输出。

### Task 5:Phase A commit

- [ ] **Step 1:提交 marketplace + 三份 plugin manifest 骨架**

```bash
cd /home/xuhao/skill-workshop
git add .agents/plugins/marketplace.json codex-plugins/*/.codex-plugin/plugin.json
git commit -m "feat(codex): scaffold marketplace + plugin manifests

Phase A scaffold for codex-plugins/ tree:
- .agents/plugins/marketplace.json (object-form source + policy + category)
- 3 plugin manifests at codex-plugins/<name>/.codex-plugin/plugin.json"
```

---

## Phase B:superpowers-memory 平移

### Task 6:复制平台无关资产(skills + 模板 + content-rules)

**Files:**
- Copy: `plugins/superpowers-memory/skills/{load,update,rebuild}/SKILL.md` → `codex-plugins/superpowers-memory/skills/{load,update,rebuild}/SKILL.md`
- Copy: `plugins/superpowers-memory/templates/*.md` → `codex-plugins/superpowers-memory/templates/`
- Copy: `plugins/superpowers-memory/content-rules.md` → `codex-plugins/superpowers-memory/content-rules.md`

- [ ] **Step 1:复制 skills**

```bash
cp -r /home/xuhao/skill-workshop/plugins/superpowers-memory/skills/load \
      /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/skills/
cp -r /home/xuhao/skill-workshop/plugins/superpowers-memory/skills/update \
      /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/skills/
cp -r /home/xuhao/skill-workshop/plugins/superpowers-memory/skills/rebuild \
      /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/skills/
```

- [ ] **Step 2:复制模板**

```bash
cp /home/xuhao/skill-workshop/plugins/superpowers-memory/templates/*.md \
   /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/templates/
```

- [ ] **Step 3:复制 content-rules.md**

```bash
cp /home/xuhao/skill-workshop/plugins/superpowers-memory/content-rules.md \
   /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/content-rules.md
```

- [ ] **Step 4:验证文件计数与内容一致**

```bash
diff -r /home/xuhao/skill-workshop/plugins/superpowers-memory/skills/load \
        /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/skills/load
diff -r /home/xuhao/skill-workshop/plugins/superpowers-memory/templates \
        /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/templates
diff /home/xuhao/skill-workshop/plugins/superpowers-memory/content-rules.md \
     /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/content-rules.md
```
Expected:三条 diff 命令均无输出。

### Task 7:创建 codex-hooks-snippet.json(memory 声明式 hook 数据)

**Files:**
- Create: `codex-plugins/superpowers-memory/codex-hooks-snippet.json`

- [ ] **Step 1:写 snippet**

```json
{
  "version": "1.11.0",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.codex/plugins/skill-workshop-codex/codex-plugins/superpowers-memory/hooks/codex-runtime.js\" session-start"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.codex/plugins/skill-workshop-codex/codex-plugins/superpowers-memory/hooks/codex-runtime.js\" user-prompt-submit"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "apply_patch|mcp__filesystem__.*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.codex/plugins/skill-workshop-codex/codex-plugins/superpowers-memory/hooks/codex-runtime.js\" pre-tool-use"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2:验证 JSON**

```bash
node -e 'const s = JSON.parse(require("fs").readFileSync("/home/xuhao/skill-workshop/codex-plugins/superpowers-memory/codex-hooks-snippet.json")); if (!s.version || !s.hooks.SessionStart || !s.hooks.UserPromptSubmit || !s.hooks.PreToolUse) throw new Error("schema mismatch")'
```
Expected:无输出。

### Task 8:复制 hook-runtime.js 为基线 codex-runtime.js

**Files:**
- Create: `codex-plugins/superpowers-memory/hooks/codex-runtime.js`(初始为 hook-runtime.js 的精确副本,后续 task 改造)

- [ ] **Step 1:复制基线**

```bash
cp /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/hook-runtime.js \
   /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/hooks/codex-runtime.js
```

- [ ] **Step 2:验证副本可执行(基线测试)**

```bash
cd /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/fixtures/clean
node /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/hooks/codex-runtime.js verify
```
Expected:输出 JSON 包含 `"committable"`、`"ssotViolations": []` 等字段(verify 模式跑通)。

### Task 9:codex-runtime.js 改造 1 —— 删 user-prompt-expansion mode、加 user-prompt-submit mode

**Files:**
- Modify: `codex-plugins/superpowers-memory/hooks/codex-runtime.js`

需要的改动:
1. 删除 `user-prompt-expansion` 分支(`main()` 中)及其辅助函数 `buildUserPromptExpansionOutput`
2. 新增 `user-prompt-submit` 分支:`buildUserPromptSubmitOutput(input)` 函数,内部 regex 匹配 `prompt` 字段:
   - `\$superpowers:brainstorming\b` → 注入 1 行 advisory
   - `\$superpowers:finishing-a-development-branch\b` → 调 `classifyFinishingState()` 已有逻辑构建富注入

- [ ] **Step 1:在 codex-runtime.js 中找到 `user-prompt-expansion` 分支**

```bash
grep -n "user-prompt-expansion\|buildUserPromptExpansionOutput" \
  /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/hooks/codex-runtime.js
```
Expected:列出函数定义行 + main() 分支行。

- [ ] **Step 2:删除 `buildUserPromptExpansionOutput` 函数定义**

打开文件,定位到 `function buildUserPromptExpansionOutput(input) {` 整个函数体(到对应 `}`)并删除。注:此函数依赖 `classifyFinishingState`,后者要保留(下一步 user-prompt-submit 复用)。

- [ ] **Step 3:删除 `main()` 中 `mode === "user-prompt-expansion"` 分支**

定位 `if (mode === "user-prompt-expansion") {` 整个块(约 4 行)并删除。

- [ ] **Step 4:新增 `buildUserPromptSubmitOutput` 函数**

在原 `buildUserPromptExpansionOutput` 删除位置插入:

```js
// Codex UserPromptSubmit hook: detect manual-typed superpowers skill mentions in prompt.
// Codex passes raw user text in `prompt` field (verified against Codex source UserMessageItem::message).
// Two skills are manually-typed in practice: brainstorming and finishing-a-development-branch.
function buildUserPromptSubmitOutput(input) {
  const prompt = (input && typeof input.prompt === "string") ? input.prompt : "";
  const FINISH = /\$superpowers:finishing-a-development-branch\b/;
  const BRAINSTORM = /\$superpowers:brainstorming\b/;

  if (FINISH.test(prompt)) {
    if (!hasKnowledgeBase()) {
      return { hookSpecificOutput: { hookEventName: "UserPromptSubmit",
        additionalContext: "Knowledge base missing at docs/project-knowledge/. " +
          "Run $superpowers-memory:rebuild before invoking finishing-a-development-branch." } };
    }
    const classification = classifyFinishingState();
    if (classification.kind === "rich-injection") {
      return { hookSpecificOutput: { hookEventName: "UserPromptSubmit",
        additionalContext: classification.body } };
    }
    if (classification.kind === "soft-reminder") {
      return { hookSpecificOutput: { hookEventName: "UserPromptSubmit",
        additionalContext: classification.body } };
    }
    return {};
  }

  if (BRAINSTORM.test(prompt)) {
    return { hookSpecificOutput: { hookEventName: "UserPromptSubmit",
      additionalContext: "Before brainstorming, invoke $superpowers-memory:load to ground the discussion in current project knowledge." } };
  }

  return {};
}
```

注:此处依赖 `classifyFinishingState()` 返回 `{ kind, body }` 结构。如果原函数返回结构不同,需要在此处适配。

- [ ] **Step 5:在 `main()` 中新增 `user-prompt-submit` 分支**

在删除原 `user-prompt-expansion` 块的位置添加:

```js
if (mode === "user-prompt-submit") {
  const input = await readStdin();
  process.stdout.write(JSON.stringify(buildUserPromptSubmitOutput(input), null, 2) + "\n");
  return;
}
```

- [ ] **Step 6:验证 verify mode 仍工作**

```bash
cd /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/fixtures/clean
node /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/hooks/codex-runtime.js verify
```
Expected:与 Task 8 Step 2 相同输出(改造未破坏 verify 路径)。

- [ ] **Step 7:手动测试 user-prompt-submit 分支(brainstorming 触发)**

```bash
cd /home/xuhao/skill-workshop
echo '{"session_id":"test","cwd":"'"$(pwd)"'","prompt":"please run $superpowers:brainstorming on idea X"}' | \
  node codex-plugins/superpowers-memory/hooks/codex-runtime.js user-prompt-submit
```
Expected:输出 JSON 含 `additionalContext` 字段提到 `$superpowers-memory:load`。

- [ ] **Step 8:手动测试 user-prompt-submit 分支(无匹配)**

```bash
echo '{"session_id":"test","cwd":"'"$(pwd)"'","prompt":"hello world"}' | \
  node /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/hooks/codex-runtime.js user-prompt-submit
```
Expected:输出 `{}`。

### Task 10:codex-runtime.js 改造 2 —— PreToolUse matcher 检测改 apply_patch

**Files:**
- Modify: `codex-plugins/superpowers-memory/hooks/codex-runtime.js`

Claude 版的 `buildPreToolUseOutput` 检测 `tool_input.file_path`(Write/Edit/MultiEdit/NotebookEdit)。Codex 的 `apply_patch` 工具传入路径方式不同:`tool_input` 通常含 `file_path` 或 `patch` 字段(包含路径)。MCP filesystem 工具(如 `mcp__filesystem__write_file`)用 `path` 字段。

策略:扩展 path 解析,兼容多种字段名;按 `tool_name` 走不同 fallback。

- [ ] **Step 1:找到 `buildPreToolUseOutput` 函数中读取 file_path 的位置**

```bash
grep -n "tool_input\.file_path\|tool_input\[" \
  /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/hooks/codex-runtime.js
```

- [ ] **Step 2:把单点 `tool_input.file_path` 读取替换成 path 解析辅助函数**

在文件靠前位置(其它辅助函数附近)新增:

```js
// Resolve target file path from various Codex tool_input shapes.
// apply_patch: { file_path } or { patch: "*** Update File: <path>\n..." }
// mcp__filesystem__*: { path } or { file_path }
function resolveTargetPath(toolName, toolInput) {
  if (!toolInput || typeof toolInput !== "object") return null;
  if (typeof toolInput.file_path === "string") return toolInput.file_path;
  if (typeof toolInput.path === "string") return toolInput.path;
  if (toolName === "apply_patch" && typeof toolInput.patch === "string") {
    const m = toolInput.patch.match(/^\*\*\* (Update|Add|Delete) File: (.+)$/m);
    if (m) return m[2].trim();
  }
  return null;
}
```

- [ ] **Step 3:替换 `buildPreToolUseOutput` 中读取 file_path 的位置使用 `resolveTargetPath`**

定位到原代码读取 `tool_input.file_path` 的位置(很可能在 KB 写锁判定块内),改为:

```js
const targetPath = resolveTargetPath(toolName, toolInput);
if (!targetPath) return {};  // 不是路径相关工具或无法解析,放行
```

后续相对路径计算和锁判定逻辑保留不变,只把 `tool_input.file_path` 替换为局部变量 `targetPath`。

- [ ] **Step 4:新增 fixture 用于 apply_patch 路径**

```bash
mkdir -p /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/fixtures/codex-apply-patch/docs/project-knowledge
echo '# index' > /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/fixtures/codex-apply-patch/docs/project-knowledge/index.md
```

- [ ] **Step 5:测试 apply_patch 拦截 KB 路径(无锁应阻断)**

```bash
cd /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/fixtures/codex-apply-patch
echo '{"session_id":"t","cwd":"'"$(pwd)"'","tool_name":"apply_patch","tool_input":{"file_path":"docs/project-knowledge/architecture.md"}}' | \
  node /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/hooks/codex-runtime.js pre-tool-use
```
Expected:输出 JSON 含 `permissionDecision: "deny"` 或 `decision: "block"`(具体取决于现有 `buildPreToolUseOutput` 逻辑),原因提到 KB 写锁。

- [ ] **Step 6:测试 apply_patch 不拦非 KB 路径(应放行)**

```bash
echo '{"session_id":"t","cwd":"'"$(pwd)"'","tool_name":"apply_patch","tool_input":{"file_path":"src/main.js"}}' | \
  node /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/hooks/codex-runtime.js pre-tool-use
```
Expected:输出 `{}`。

注:fixture 目录留在 `plugins/superpowers-memory/hooks/fixtures/codex-apply-patch/`,与现有 fixtures 共存,**这是对 Claude 树的最小副作用** —— 仅添加测试 fixture,不改 Claude 运行时;若策略 A 严格禁止,可改放 `codex-plugins/superpowers-memory/hooks/fixtures/`(但需把所有 fixture 全部独立维护)。

### Task 11:codex-runtime.js 改造 3 —— SessionStart primer 注入

**Files:**
- Modify: `codex-plugins/superpowers-memory/hooks/codex-runtime.js`

Claude 版的 `buildSessionStartOutput` 已经读 index.md 注入。Codex 这边在它输出末尾追加 standing primer。

- [ ] **Step 1:找到 `buildSessionStartOutput` 函数**

```bash
grep -n "function buildSessionStartOutput" \
  /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/hooks/codex-runtime.js
```

- [ ] **Step 2:在 SessionStart 输出 additionalContext 中追加 primer**

定位到函数返回输出 `additionalContext` 的位置,把它从 "仅 index 内容" 改为 "index 内容 + primer":

```js
const STANDING_PRIMER =
  "\n\n## Project KB workflow (Codex)\n" +
  "- After completing development and before merging: invoke $superpowers-memory:update to sync KB\n" +
  "- Before invoking $superpowers:finishing-a-development-branch: confirm KB reflects HEAD; if not, run $superpowers-memory:update first\n" +
  "- When uncertain about project structure or conventions: invoke $superpowers-memory:load for detail files\n" +
  "- Before $superpowers:writing-plans / executing-plans / subagent-driven-development: load KB so planning is grounded\n";

// existing code that builds `body` (the index content)...
return {
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: body + STANDING_PRIMER,
  },
};
```

注:Claude 版可能使用了不同的输出 wrapper(`additional_context` flat vs `hookSpecificOutput`)。Codex 统一走 `hookSpecificOutput.additionalContext`。如发现现有代码包了平台分支,把 Codex 分支保留,Claude 分支删掉。

- [ ] **Step 3:测试 SessionStart 输出包含 primer**

```bash
cd /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/fixtures/clean
echo '{}' | node /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/hooks/codex-runtime.js session-start
```
Expected:输出 JSON 的 `additionalContext` 字段同时包含 KB index 文本(来自 fixtures/clean/docs/project-knowledge/index.md)和 "Project KB workflow (Codex)" 这段 primer。

### Task 12:codex-runtime.js 改造 4 —— `${CLAUDE_PLUGIN_ROOT}` 与平台分支清理

**Files:**
- Modify: `codex-plugins/superpowers-memory/hooks/codex-runtime.js`

- [ ] **Step 1:搜索所有 CLAUDE_ 引用**

```bash
grep -n "CLAUDE_\|hookSpecificOutput\|additional_context" \
  /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/hooks/codex-runtime.js
```

- [ ] **Step 2:把 `${CLAUDE_PLUGIN_ROOT}` 引用替换为 `path.dirname(__filename)`**

具体每处都改;如果只有 path 参考(没有 env 读取),用 `__dirname` 即可(Node CommonJS)。

- [ ] **Step 3:`CLAUDE_SKILL_NAME` env 处理**

`lock` mode 中 `process.env.CLAUDE_SKILL_NAME`:Codex 不设此变量。改为:

```js
const skill = process.argv[3] || process.env.CODEX_SKILL_NAME || process.env.CLAUDE_SKILL_NAME || "unknown";
```

(同时兼容两个平台,不破坏现有 fixture 行为。)

- [ ] **Step 4:统一输出协议为 hookSpecificOutput**

如果 Claude 分支用了 `additional_context`(flat)且未走 `hookSpecificOutput.additionalContext`,把 Codex 这版统一走 `hookSpecificOutput.additionalContext`(根据本 task 之前 Step 2 已确立)。检查代码无遗漏的 flat 输出。

- [ ] **Step 5:跑全部 verify fixture 验证未破坏现有行为**

```bash
cd /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/fixtures/clean
node /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/hooks/codex-runtime.js verify

cd /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/fixtures/shape-violation
node /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/hooks/codex-runtime.js verify

cd /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/fixtures/ssot-violation
node /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/hooks/codex-runtime.js verify
```
Expected:三次输出分别表现 clean / shapeViolations / ssotViolations,与 Claude 版相同。

### Task 13:写 memory 的 setup SKILL.md

**Files:**
- Create: `codex-plugins/superpowers-memory/skills/setup/SKILL.md`

- [ ] **Step 1:写 SKILL.md**

```markdown
---
name: setup
description: Use after installing or upgrading superpowers-memory in Codex to register the plugin's hooks into ~/.codex/hooks.json. Re-run after every codex plugin marketplace upgrade. Detects existing version markers and skips if up-to-date, replaces if outdated, or adds fresh if missing.
---

# Setup superpowers-memory hooks for Codex

Use this skill to register superpowers-memory's SessionStart, UserPromptSubmit, and PreToolUse hooks into the user's `~/.codex/hooks.json`. Re-runnable; idempotent via version markers.

## Procedure

### 1. Read the current hook config

Read `~/.codex/hooks.json`. If the file does not exist, treat the current config as `{}` (no hooks installed yet).

### 2. Read the plugin's snippet

Read `codex-plugins/superpowers-memory/codex-hooks-snippet.json` from the installed plugin root (typically under `~/.codex/plugins/skill-workshop-codex/codex-plugins/superpowers-memory/`). Note the `version` field — call it `SNIPPET_VERSION`.

### 3. Locate the existing block (if any)

Within `~/.codex/hooks.json`, search for a JSON-comment-style marker pair:

```
// BEGIN superpowers-memory:hooks-v<X.Y.Z>
... block ...
// END superpowers-memory:hooks
```

(Codex's hook config supports JSON5-style comments — confirm at runtime; if comments are stripped, fall back to a sentinel key like `"_marker_superpowers_memory_version": "<X.Y.Z>"` placed inside the merged block.)

### 4. Decision

| Existing marker | Action |
|---|---|
| Not found | **Fresh install** — merge snippet's `hooks.*` arrays into `~/.codex/hooks.json` `hooks.*`; insert BEGIN/END markers around the appended entries |
| Found, version equals `SNIPPET_VERSION` | **Up-to-date** — report and stop |
| Found, version differs | **Update** — remove the old block (between BEGIN and END), then perform fresh install with new version |

### 5. Backup

Before writing, copy `~/.codex/hooks.json` to `~/.codex/hooks.json.bak.<timestamp>` (timestamp = `YYYYMMDD-HHMMSS`).

### 6. Write and report

Write the merged config back. Report exactly what changed:

- Backup file path created
- Old version → new version (or "fresh install" / "no change")
- Number of hook entries added/replaced

### 7. Tell the user to restart Codex

Hook config is loaded at Codex startup. Suggest the user exit and restart their Codex session.

## Constraints

- Never modify hook entries that are NOT inside the BEGIN/END markers (these belong to the user or other plugins).
- Never overwrite without backup.
- If JSON parsing fails, abort and report; do NOT attempt to repair user's hook config.
```

- [ ] **Step 2:验证 SKILL.md frontmatter**

```bash
node -e 'const fs = require("fs"); const c = fs.readFileSync("/home/xuhao/skill-workshop/codex-plugins/superpowers-memory/skills/setup/SKILL.md", "utf8"); if (!/^---\nname: setup\ndescription:/.test(c)) throw new Error("frontmatter missing")'
```
Expected:无输出。

### Task 14:写 superpowers-memory README

**Files:**
- Create: `codex-plugins/superpowers-memory/README.md`

- [ ] **Step 1:写 README**

```markdown
# superpowers-memory (Codex)

Project knowledge persistence + KB write-lock for Codex superpowers workflows.

## Installation

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin install superpowers-memory
```

Then in Codex, register the hooks:

```
$superpowers-memory:setup
```

Restart Codex. Hooks become active.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

In Codex, re-run `$superpowers-memory:setup`. The setup skill detects the new version marker and replaces the old block. Restart Codex.

Manual hook config (alternative to setup skill): copy the contents of `codex-hooks-snippet.json` into `~/.codex/hooks.json` under `hooks.*` arrays.

## Capabilities

- **SessionStart hook** — injects KB index from `docs/project-knowledge/index.md` plus standing primer for KB workflow
- **UserPromptSubmit hook** — when user types `$superpowers:brainstorming` or `$superpowers:finishing-a-development-branch`, JIT-injects relevant context (load advisory or finishing-readiness rich injection)
- **PreToolUse hook** — blocks `apply_patch` and `mcp__filesystem__.*` writes to `docs/project-knowledge/` unless write-lock is held by `$superpowers-memory:update` or `$superpowers-memory:rebuild`
- **Skills:** `load`, `update`, `rebuild`, `setup`

## Known Codex protocol gaps

The following coverage exists on Claude Code but **cannot be implemented on Codex** due to protocol limitations:

1. **Agent-self-decided invocation of `$superpowers:finishing-a-development-branch`** does not fire any hook in Codex. The agent only receives the standing primer from SessionStart, not the JIT diff evidence (commits since `covers_branch`, files changed). User-typed slash invocation IS covered via UserPromptSubmit.

2. **Auto-triggered planning skills** (`writing-plans`, `executing-plans`, `subagent-driven-development`, `requesting-code-review`, `receiving-code-review`) cannot receive a per-skill JIT advisory in Codex (matcher does not support skill names). Coverage falls back to SessionStart standing primer.
```

### Task 15:Phase B commit

- [ ] **Step 1:提交 memory 平移**

```bash
cd /home/xuhao/skill-workshop
git add codex-plugins/superpowers-memory plugins/superpowers-memory/hooks/fixtures/codex-apply-patch
git commit -m "feat(codex): port superpowers-memory to codex-plugins/

Phase B port:
- Skills/templates/content-rules direct copy
- codex-runtime.js with platform branches:
  * remove user-prompt-expansion mode, add user-prompt-submit dispatch
  * regex match \$superpowers:brainstorming and \$superpowers:finishing-a-development-branch
  * PreToolUse matcher = apply_patch + mcp__filesystem__.*
  * SessionStart primer appended to KB index
  * \${CLAUDE_PLUGIN_ROOT} -> path.dirname(__filename)
- codex-hooks-snippet.json (declarative hook config for setup skill)
- setup/SKILL.md (agent instructions for ~/.codex/hooks.json idempotent merge)
- README with install / upgrade / known protocol gaps"
```

---

## Phase C:superpowers-architect 平移

### Task 16:复制 design-patterns 资产

**Files:**
- Copy: `plugins/superpowers-architect/design-patterns/*.md` → `codex-plugins/superpowers-architect/design-patterns/`

- [ ] **Step 1:复制全部 pattern 文件**

```bash
cp /home/xuhao/skill-workshop/plugins/superpowers-architect/design-patterns/*.md \
   /home/xuhao/skill-workshop/codex-plugins/superpowers-architect/design-patterns/
```

- [ ] **Step 2:验证文件计数(应为 7)**

```bash
ls /home/xuhao/skill-workshop/codex-plugins/superpowers-architect/design-patterns/*.md | wc -l
```
Expected:`7`。

- [ ] **Step 3:diff 验证内容一致**

```bash
diff -r /home/xuhao/skill-workshop/plugins/superpowers-architect/design-patterns \
        /home/xuhao/skill-workshop/codex-plugins/superpowers-architect/design-patterns
```
Expected:无输出。

### Task 17:写 architect 的 codex-runtime.js(仅 session-start mode)

**Files:**
- Create: `codex-plugins/superpowers-architect/hooks/codex-runtime.js`

业务逻辑参考 `plugins/superpowers-architect/hooks/pre-tool-use`(bash 脚本),但简化:Codex 这边不分 plan/review wording,而是统一融合元规则。

- [ ] **Step 1:写 codex-runtime.js**

```js
#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const mode = process.argv[2];

const FUSED_HEADER =
  "## Project Architecture Standards\n" +
  "When invoking $superpowers:writing-plans / executing-plans / subagent-driven-development, " +
  "treat the patterns below as STRICT CONSTRAINTS to apply: state which apply, which do not, " +
  "and call out any conflicts explicitly rather than silently ignoring them. " +
  "When invoking $superpowers:requesting-code-review / receiving-code-review, " +
  "treat them as VERIFICATION CRITERIA: identify violations, conflicts, and improvements.\n\n";

function listPatternFiles() {
  const localDir = path.join(__dirname, "..", "design-patterns");
  const globalDir = process.env.SP_ARCHITECT_DIR ||
    path.join(process.env.HOME || "", ".claude", "superpowers-architect", "design-patterns");

  const files = new Map(); // filename -> absolute path; project-local overrides global by filename
  for (const dir of [globalDir, localDir]) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith(".md")) continue;
      files.set(entry, path.join(dir, entry));
    }
  }
  return files;
}

function readPatternHeader(filePath) {
  // Extract first H1 (name) and the first paragraph following it (description).
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  let name = path.basename(filePath, ".md");
  let description = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m1 = line.match(/^#\s+(.+?)\s*$/);
    if (m1) { name = m1[1]; continue; }
    if (name && !description && line.trim() && !line.startsWith("#")) {
      description = line.trim();
      break;
    }
  }
  return { name, description };
}

function buildSessionStartOutput() {
  const files = listPatternFiles();
  if (files.size === 0) {
    return { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "" } };
  }

  let body = FUSED_HEADER;
  for (const [filename, absPath] of files) {
    const { name, description } = readPatternHeader(absPath);
    body += `- **${name}** (${filename}): ${description}\n  Path: ${absPath}\n`;
  }
  body += "\nLoad full pattern via Read when relevant.\n";

  return {
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: body },
  };
}

async function main() {
  if (mode === "session-start") {
    process.stdout.write(JSON.stringify(buildSessionStartOutput(), null, 2) + "\n");
    return;
  }
  process.stderr.write("Unknown hook mode: " + mode + "\n");
  process.exit(1);
}

main().catch((e) => {
  process.stderr.write((e.stack || e.message) + "\n");
  process.exit(1);
});
```

- [ ] **Step 2:测试 session-start 输出**

```bash
node /home/xuhao/skill-workshop/codex-plugins/superpowers-architect/hooks/codex-runtime.js session-start
```
Expected:输出 JSON 含 `additionalContext` 字段,内含 "Project Architecture Standards" 与 7 个 pattern 索引(name + 描述 + path)。

- [ ] **Step 3:测试 SP_ARCHITECT_DIR 优先级**

创建临时全局目录覆盖 `database.md`:

```bash
mkdir -p /tmp/sp-arch-test
echo -e "# Override Database\n\nThis is the global override." > /tmp/sp-arch-test/database.md

SP_ARCHITECT_DIR=/tmp/sp-arch-test \
  node /home/xuhao/skill-workshop/codex-plugins/superpowers-architect/hooks/codex-runtime.js session-start | \
  grep -A 2 "Override Database\|database.md"
```
Expected:输出含 "Override Database" 名字(全局先加载,但项目目录有同名 → 项目目录覆盖,所以最终应是 plugins 下的原版)。

注:本测试主要验证项目本地优先级。如果输出是 plugins 内的版本(非 Override),正确;如果是 Override,需检查 listPatternFiles 中遍历顺序确保项目目录后加载并覆盖。

- [ ] **Step 4:清理临时目录**

```bash
rm -rf /tmp/sp-arch-test
```

### Task 18:写 architect 的 codex-hooks-snippet.json + setup SKILL.md

**Files:**
- Create: `codex-plugins/superpowers-architect/codex-hooks-snippet.json`
- Create: `codex-plugins/superpowers-architect/skills/setup/SKILL.md`

- [ ] **Step 1:写 snippet**

```json
{
  "version": "1.6.2",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.codex/plugins/skill-workshop-codex/codex-plugins/superpowers-architect/hooks/codex-runtime.js\" session-start"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2:写 setup SKILL.md(同 memory 模板,改插件名)**

```markdown
---
name: setup
description: Use after installing or upgrading superpowers-architect in Codex to register the plugin's SessionStart hook into ~/.codex/hooks.json. Re-run after every codex plugin marketplace upgrade. Idempotent via version markers.
---

# Setup superpowers-architect hooks for Codex

Use this skill to register superpowers-architect's SessionStart hook into `~/.codex/hooks.json`. Re-runnable; idempotent via version markers.

## Procedure

### 1. Read the current hook config

Read `~/.codex/hooks.json`. If the file does not exist, treat as `{}`.

### 2. Read the plugin's snippet

Read `codex-plugins/superpowers-architect/codex-hooks-snippet.json` (typically under `~/.codex/plugins/skill-workshop-codex/...`). Note the `version` field — call it `SNIPPET_VERSION`.

### 3. Locate the existing block

Search for marker:

```
// BEGIN superpowers-architect:hooks-v<X.Y.Z>
... block ...
// END superpowers-architect:hooks
```

### 4. Decision

| Existing marker | Action |
|---|---|
| Not found | Fresh install: append snippet's `hooks.SessionStart` entries; insert markers |
| Version matches | Up-to-date; report and stop |
| Version differs | Replace block with new version |

### 5. Backup, write, report

Same as superpowers-memory's setup skill. Backup `~/.codex/hooks.json.bak.<timestamp>` first; write merged config; report changes; suggest Codex restart.

## Constraints

Same as superpowers-memory: never touch entries outside markers, never write without backup, never repair user's malformed JSON — abort and report instead.
```

- [ ] **Step 3:验证 JSON + frontmatter**

```bash
node -e 'JSON.parse(require("fs").readFileSync("/home/xuhao/skill-workshop/codex-plugins/superpowers-architect/codex-hooks-snippet.json"))'
node -e 'const c = require("fs").readFileSync("/home/xuhao/skill-workshop/codex-plugins/superpowers-architect/skills/setup/SKILL.md", "utf8"); if (!/^---\nname: setup/.test(c)) throw new Error("frontmatter")'
```
Expected:无输出。

### Task 19:写 architect README

**Files:**
- Create: `codex-plugins/superpowers-architect/README.md`

- [ ] **Step 1:写 README**

```markdown
# superpowers-architect (Codex)

Inject design pattern standards as constraints into planning, execution, and code review workflows.

## Installation

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin install superpowers-architect
```

In Codex:

```
$superpowers-architect:setup
```

Restart Codex.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

In Codex, re-run `$superpowers-architect:setup`. Restart.

## Capabilities

- **SessionStart hook** — injects 7 design pattern indexes (name + description + absolute path) plus a fused meta-rule covering both planning ("apply") and review ("verify") modes
- Two-layer pattern dirs: global (`$SP_ARCHITECT_DIR`) + project-local (`./design-patterns/`); project overrides global by filename
- 7 bundled patterns: database, ddd-core, ddd-modeling, ddd-golang, ddd-python, ddd-typescript, frontend-patterns, rest-api

## Known Codex protocol gap (vs Claude Code)

Claude Code's PreToolUse:Skill hook intercepts the 5 trigger skills (writing-plans / executing-plans / subagent-driven-development / requesting-code-review / receiving-code-review) and injects different wording for plan vs review. Codex's PreToolUse matcher does not support skill names, so all wording is fused into the SessionStart primer (always present, never per-skill targeted). The agent self-disambiguates based on its current task.
```

### Task 20:Phase C commit

- [ ] **Step 1:提交 architect 平移**

```bash
cd /home/xuhao/skill-workshop
git add codex-plugins/superpowers-architect
git commit -m "feat(codex): port superpowers-architect to codex-plugins/

Phase C port:
- 7 design-patterns/*.md direct copy
- hooks/codex-runtime.js single mode (session-start) — fused meta-rule
  covering both plan-apply and review-verify wording, plus pattern index
  with absolute paths for two-layer override (global SP_ARCHITECT_DIR
  + project-local design-patterns/)
- codex-hooks-snippet.json + skills/setup/SKILL.md (agent instructions
  for ~/.codex/hooks.json idempotent merge)
- README documenting fused-wording known gap vs Claude two-mode JIT"
```

---

## Phase D:designing-tests 平移

### Task 21:复制 designing-tests skill + references

**Files:**
- Copy: `plugins/designing-tests/skills/designing-tests/SKILL.md` → `codex-plugins/designing-tests/skills/designing-tests/SKILL.md`
- Copy: `plugins/designing-tests/references/*.md`(若不存在则按实际路径调整) → `codex-plugins/designing-tests/references/`

- [ ] **Step 1:确认 references 路径**

```bash
ls /home/xuhao/skill-workshop/plugins/designing-tests/
find /home/xuhao/skill-workshop/plugins/designing-tests -name "*.md" -not -name "SKILL.md" -not -name "README.md"
```

- [ ] **Step 2:复制 skill**

```bash
mkdir -p /home/xuhao/skill-workshop/codex-plugins/designing-tests/skills/designing-tests
cp /home/xuhao/skill-workshop/plugins/designing-tests/skills/designing-tests/SKILL.md \
   /home/xuhao/skill-workshop/codex-plugins/designing-tests/skills/designing-tests/SKILL.md
```

- [ ] **Step 3:复制 references(根据 Step 1 实际路径调整)**

```bash
# 假设 references 在 plugins/designing-tests/skills/designing-tests/references/
# 根据 Step 1 实际输出调整源路径
find /home/xuhao/skill-workshop/plugins/designing-tests -name "layer-selection.md" -o -name "risk-catalog.md" -o -name "test-case-patterns.md" -o -name "test-quality-review.md" | \
  while read f; do cp "$f" /home/xuhao/skill-workshop/codex-plugins/designing-tests/references/; done
```

- [ ] **Step 4:验证 4 份 reference 全部到位**

```bash
ls /home/xuhao/skill-workshop/codex-plugins/designing-tests/references/*.md | wc -l
```
Expected:`4`(layer-selection / risk-catalog / test-case-patterns / test-quality-review)。

### Task 22:写 designing-tests 的 codex-runtime.js(仅 session-start)

**Files:**
- Create: `codex-plugins/designing-tests/hooks/codex-runtime.js`

- [ ] **Step 1:写 codex-runtime.js**

```js
#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const mode = process.argv[2];

const EXECUTION_TIER_BODY =
  "## Test Design Principles (Codex)\n" +
  "When invoking $superpowers:writing-plans / executing-plans / subagent-driven-development / test-driven-development, follow:\n\n" +
  "1. **Intent-first**: derive tests from function intent BEFORE reading implementation; build a test list as a planning step.\n" +
  "2. **Intent comments**: every test gets a one-line comment naming the intent it verifies.\n" +
  "3. **Boundary selection**: cover Equivalence Partitions, Boundary Value Analysis, and Decision Tables relevant to the intent.\n" +
  "4. **Quality labels**: tag each test as `real` (real impl + real deps), `shallow` (real impl + faked deps), or `fake` (no impl, only mocks).\n" +
  "5. **Layer selection**: pick unit / integration / E2E by what the intent actually crosses; do NOT default to unit.\n";

function buildSessionStartOutput() {
  const refsDir = path.join(__dirname, "..", "references");
  const refs = [];
  if (fs.existsSync(refsDir)) {
    for (const entry of fs.readdirSync(refsDir).sort()) {
      if (!entry.endsWith(".md")) continue;
      refs.push({ name: entry.replace(/\.md$/, ""), path: path.join(refsDir, entry) });
    }
  }

  let body = EXECUTION_TIER_BODY;
  if (refs.length) {
    body += "\n## References (Read on demand)\n";
    for (const ref of refs) body += `- **${ref.name}** — ${ref.path}\n`;
  }
  body += "\nFull SKILL.md available via $designing-tests:designing-tests when test work begins.\n";

  return {
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: body },
  };
}

async function main() {
  if (mode === "session-start") {
    process.stdout.write(JSON.stringify(buildSessionStartOutput(), null, 2) + "\n");
    return;
  }
  process.stderr.write("Unknown hook mode: " + mode + "\n");
  process.exit(1);
}

main().catch((e) => {
  process.stderr.write((e.stack || e.message) + "\n");
  process.exit(1);
});
```

- [ ] **Step 2:测试 session-start 输出**

```bash
node /home/xuhao/skill-workshop/codex-plugins/designing-tests/hooks/codex-runtime.js session-start
```
Expected:输出 JSON 含 `additionalContext`,内含 "Test Design Principles (Codex)"、5 条原则、"References (Read on demand)" 段及 4 个 reference name + path。

### Task 23:写 designing-tests 的 codex-hooks-snippet.json + setup SKILL.md

**Files:**
- Create: `codex-plugins/designing-tests/codex-hooks-snippet.json`
- Create: `codex-plugins/designing-tests/skills/setup/SKILL.md`

- [ ] **Step 1:写 snippet**

```json
{
  "version": "1.6.0",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.codex/plugins/skill-workshop-codex/codex-plugins/designing-tests/hooks/codex-runtime.js\" session-start"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2:写 setup SKILL.md**

```markdown
---
name: setup
description: Use after installing or upgrading designing-tests in Codex to register the plugin's SessionStart hook into ~/.codex/hooks.json. Re-run after every codex plugin marketplace upgrade. Idempotent via version markers.
---

# Setup designing-tests hooks for Codex

Use this skill to register designing-tests' SessionStart hook into `~/.codex/hooks.json`.

## Procedure

### 1. Read current `~/.codex/hooks.json`

Treat absent file as `{}`.

### 2. Read plugin snippet

Read `codex-plugins/designing-tests/codex-hooks-snippet.json`. Note `version` as `SNIPPET_VERSION`.

### 3. Locate existing marker

Search for:

```
// BEGIN designing-tests:hooks-v<X.Y.Z>
... block ...
// END designing-tests:hooks
```

### 4. Decision

| Existing marker | Action |
|---|---|
| Not found | Fresh install: merge `hooks.SessionStart` entries; insert markers |
| Version matches | Up-to-date; report and stop |
| Version differs | Replace block with new version |

### 5. Backup, write, report

Backup → write → report changes → suggest Codex restart.

## Constraints

Same as superpowers-memory and superpowers-architect setup skills.
```

- [ ] **Step 3:验证 JSON + frontmatter**

```bash
node -e 'JSON.parse(require("fs").readFileSync("/home/xuhao/skill-workshop/codex-plugins/designing-tests/codex-hooks-snippet.json"))'
node -e 'const c = require("fs").readFileSync("/home/xuhao/skill-workshop/codex-plugins/designing-tests/skills/setup/SKILL.md", "utf8"); if (!/^---\nname: setup/.test(c)) throw new Error("frontmatter")'
```
Expected:无输出。

### Task 24:写 designing-tests README

**Files:**
- Create: `codex-plugins/designing-tests/README.md`

- [ ] **Step 1:写 README**

```markdown
# designing-tests (Codex)

Risk-driven test design guidance.

## Installation

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin install designing-tests
```

In Codex:

```
$designing-tests:setup
```

Restart Codex.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

In Codex: `$designing-tests:setup`. Restart.

## Capabilities

- **SessionStart hook** — injects execution-tier test design principles (intent-first, intent comments, boundary selection, quality labels, layer selection) plus 4 reference file indexes
- **`designing-tests` skill** — full guidance on demand via `$designing-tests:designing-tests`
- 4 references (read on demand): layer-selection, risk-catalog, test-case-patterns, test-quality-review

## Known Codex protocol gap (vs Claude Code)

Claude Code's PreToolUse:Skill hook intercepts the 4 trigger skills with three different tiers:
- **planning tier** for `writing-plans` (lightweight reminder)
- **execution tier** for `executing-plans` / `subagent-driven-development` (condensed principles)
- **full tier** for `test-driven-development` (entire SKILL.md + reference index)

Codex's PreToolUse matcher does not support skill names, so all three tiers collapse into the SessionStart primer (always-present execution tier + reference index). The full SKILL.md is not auto-injected — it loads on demand when the agent invokes `$designing-tests:designing-tests`.
```

### Task 25:Phase D commit

- [ ] **Step 1:提交 designing-tests 平移**

```bash
cd /home/xuhao/skill-workshop
git add codex-plugins/designing-tests
git commit -m "feat(codex): port designing-tests to codex-plugins/

Phase D port:
- skills/designing-tests + 4 references direct copy
- hooks/codex-runtime.js single mode (session-start) — execution tier
  principles + reference path index; full SKILL.md on demand via
  \$designing-tests:designing-tests
- codex-hooks-snippet.json + skills/setup/SKILL.md
- README documenting three-tier collapse known gap vs Claude"
```

---

## Phase E:集成验证 + 文档

### Task 26:根 README 增加 Codex 章节

**Files:**
- Modify: `README.md`(项目根)

- [ ] **Step 1:读现状根 README**

```bash
cat /home/xuhao/skill-workshop/README.md
```

- [ ] **Step 2:在文末追加 Codex 章节**

在根 README 末尾追加(具体位置取决于现状结构,但应在"Plugins"或类似章节之后):

```markdown
## Codex Marketplace (Experimental)

This repository also publishes Codex-compatible variants of the three plugins under `codex-plugins/`. See `.agents/plugins/marketplace.json` for the Codex marketplace catalog.

```bash
codex plugin marketplace add jacexh/skill-workshop
```

Then in Codex:

```
$superpowers-memory:setup
$superpowers-architect:setup
$designing-tests:setup
```

Each plugin has its own README under `codex-plugins/<name>/README.md` with capabilities, upgrade flow, and known protocol gaps relative to the Claude Code variant.

The Claude Code variants under `plugins/` and the marketplace at `.claude-plugin/marketplace.json` are unchanged and remain the primary supported track.
```

- [ ] **Step 3:验证 README 渲染**

```bash
cat /home/xuhao/skill-workshop/README.md | grep -A 3 "Codex Marketplace"
```
Expected:输出含上述章节起始几行。

### Task 27:整体集成验证

- [ ] **Step 1:验证三个 codex-runtime.js 都可执行**

```bash
node /home/xuhao/skill-workshop/codex-plugins/superpowers-memory/hooks/codex-runtime.js verify 2>&1 | head -5
node /home/xuhao/skill-workshop/codex-plugins/superpowers-architect/hooks/codex-runtime.js session-start 2>&1 | head -3
node /home/xuhao/skill-workshop/codex-plugins/designing-tests/hooks/codex-runtime.js session-start 2>&1 | head -3
```
Expected:三条命令都输出 JSON,无 error。memory 的 verify 在仓库根目录跑会触发 staleRefs(因为 KB 引用真实路径),但 JSON 结构应有效。

- [ ] **Step 2:验证 marketplace.json 与 plugin 路径一致**

```bash
node -e '
const m = JSON.parse(require("fs").readFileSync("/home/xuhao/skill-workshop/.agents/plugins/marketplace.json"));
const fs = require("fs");
for (const p of m.plugins) {
  const manifestPath = "/home/xuhao/skill-workshop/" + p.source.path + "/.codex-plugin/plugin.json";
  if (!fs.existsSync(manifestPath)) throw new Error("missing manifest: " + manifestPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  if (manifest.name !== p.name) throw new Error("name mismatch: " + p.name + " vs " + manifest.name);
}
console.log("OK: 3 plugins consistent");
'
```
Expected:`OK: 3 plugins consistent`。

- [ ] **Step 3:验证三个 codex-hooks-snippet.json schema**

```bash
node -e '
const fs = require("fs");
const expected = ["superpowers-memory", "superpowers-architect", "designing-tests"];
for (const name of expected) {
  const p = "/home/xuhao/skill-workshop/codex-plugins/" + name + "/codex-hooks-snippet.json";
  const s = JSON.parse(fs.readFileSync(p));
  if (!s.version || !s.hooks) throw new Error("snippet schema: " + name);
  if (!s.hooks.SessionStart) throw new Error("missing SessionStart: " + name);
}
console.log("OK: all snippets have SessionStart");
'
```
Expected:`OK: all snippets have SessionStart`。

- [ ] **Step 4:确认 plugins/ 树未被改动(策略 A 红线)**

```bash
cd /home/xuhao/skill-workshop
git diff main -- plugins/ | head -20
```
Expected:无输出,**或**仅显示 Task 10 Step 4 新增的 fixtures/codex-apply-patch/ 目录(若选择放在 plugins/ 下)。如果有其它改动,违反策略 A,需回退。

### Task 28:最终 commit + 项目知识更新提示

- [ ] **Step 1:提交 README 与最终验证状态**

```bash
cd /home/xuhao/skill-workshop
git add README.md
git commit -m "docs: add Codex marketplace section to root README

Pointers to codex-plugins/ tree and per-plugin setup skills."
```

- [ ] **Step 2:输出最终摘要**

```bash
git log --oneline main..HEAD
ls /home/xuhao/skill-workshop/codex-plugins/
ls /home/xuhao/skill-workshop/.agents/plugins/
```
Expected:看到本计划全部 phase 的 commit;`codex-plugins/` 含 3 个插件子目录;`.agents/plugins/marketplace.json` 存在。

- [ ] **Step 3:提示用户运行 KB 更新**

实现完成后,提示用户:**这个分支引入了新功能(Codex 兼容)+ 修正了 KB 已知漂移(Stop hook 早已删除但 KB 未修)。建议合并前运行 `$superpowers-memory:update`,把 features.md / architecture.md 的 Codex 章节与 Stop hook 漂移一并纠正。**

---

## 自检清单

**1. Spec 覆盖检查:**
- ✅ `codex-plugins/` 顶层布局(spec § 整体架构 → Phase A/B/C/D)
- ✅ 三个 plugin manifest(spec § 整体架构 → Task 2-3)
- ✅ `.agents/plugins/marketplace.json`(spec § 整体架构 → Task 4)
- ✅ Memory 三 hooks(SessionStart / UserPromptSubmit / PreToolUse,spec § 插件 1 → Task 9-12)
- ✅ Memory standing primer(spec § 插件 1 → Task 11)
- ✅ Memory UserPromptSubmit dispatch 表(spec § 插件 1 → Task 9)
- ✅ Architect 单 hook + 融合元规则(spec § 插件 2 → Task 17)
- ✅ Designing-tests 单 hook + execution tier + reference index(spec § 插件 3 → Task 22)
- ✅ Setup skill marker 版本协议(spec § 公共机制 → Task 13/18/23)
- ✅ codex-hooks-snippet.json 契约(spec § 公共机制 → Task 7/18/23)
- ✅ Marketplace 升级流程(spec § 公共机制 → 三个 README)
- ✅ 已知 gap 文档化(spec § 已知 Codex 协议 gap → 三个 README)

**2. Placeholder 扫描:**已逐 task 给出实际命令、JSON、JS 代码;无 TBD。

**3. 类型/命名一致性:**
- `superpowers-memory` / `superpowers-architect` / `designing-tests` 三个插件名贯穿一致
- `codex-hooks-snippet.json` 文件名前后统一
- Marker 格式 `// BEGIN <plugin>:hooks-v<version>` / `// END <plugin>:hooks` 三处一致
- Setup SKILL.md 步骤编号(1-7)三处一致
- `classifyFinishingState` 在 Task 9 引用,假设 Claude 版有此函数;Task 9 Step 4 注释中已声明"如果原函数返回结构不同,需要在此处适配",留有适配空间

## 测试策略

按设计指南要求(Test Design Planning hook):

- **codex-runtime.js 中的代码改造** 用现有 fixture 模式(`plugins/superpowers-memory/hooks/fixtures/<scenario>/`)做功能测试。新增 fixture `codex-apply-patch`(Task 10 Step 4)用于 apply_patch 路径检测的边界。
- **测试在实现之前** 体现在 Task 9 / 10 / 11 / 17 / 22 的 verify step 上 —— 每次改造后立即跑相应 fixture 验证行为。
- **测试意图** 标注在每个 Step 的 "Expected" 行中。
- **boundary selection** 在 Task 10 中体现 EP/BVA:apply_patch 命中 KB 路径(应阻断)+ apply_patch 非 KB 路径(应放行)是 EP 的两个分区;path 字段缺失或为对象(Step 2 的 resolveTargetPath 处理)是 BVA 边界值。

## 执行交付选择

**Plan complete and saved to `docs/superpowers/plans/2026-04-26-codex-marketplace-compat-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
