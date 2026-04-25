# superpowers-memory KB 写保护实施计划

**Goal:** 阻止 `superpowers-memory:update` / `:rebuild` 之外的任何工具（含 AI 自身的 Write/Edit/MultiEdit/NotebookEdit）修改 `docs/project-knowledge/` 下的文件。根因：现有 `pre-tool-use` hook 仅匹配 `Skill` 工具，文件级写入完全无门槛，导致出现 talgent 中观察到的"AI 在实现任务里随手写 ADR、之后被 update 重写覆盖"的问题。

**Architecture:** 在 `hooks/hook-runtime.js` 增加 `lock` / `unlock` 子命令（基于 `.git/superpowers-memory.lock` 文件 + 60 分钟 TTL）。扩展 `pre-tool-use` 模式分发：当工具是 `Write|Edit|MultiEdit|NotebookEdit`、且目标路径落在 `docs/project-knowledge/` 内时，校验锁是否存在且未过期，否则返回 `decision: "block"` + 修复指引。`hooks.json` 增加对应 PreToolUse matcher。两个 skill（update / rebuild）在流程首尾加显式 lock / unlock Bash 步骤。

**Tech Stack:** Node.js stdlib（fs / path / child_process）+ Markdown skill 文档。无新依赖。

**设计选择（2026-04-25 拍板）：**
- A 范围：保护**整个** `docs/project-knowledge/`（不止 decisions.md / adr/）
- B 放行机制：**hook 管理的 lock 文件**，由 update / rebuild skill 显式 acquire / release
- C 逃生通道：**零通道**——必须走 update（typo 修复也走 update）

---

## File Structure

### Modified
- `plugins/superpowers-memory/hooks/hook-runtime.js` — 加 `lock` / `unlock` / `lock-status` 模式；扩展 `buildPreToolUseOutput` 处理 Write/Edit/MultiEdit/NotebookEdit
- `plugins/superpowers-memory/hooks/hooks.json` — 新增一个 PreToolUse matcher: `Write|Edit|MultiEdit|NotebookEdit`
- `plugins/superpowers-memory/skills/update/SKILL.md` — 在 §Process 起始加 "Step 0: Acquire write lock"，在 §Step 9 commit 之后加 "Step 11: Release write lock"
- `plugins/superpowers-memory/skills/rebuild/SKILL.md` — 同上：在 §Process Step 1 之前加 acquire，在 Step 9 之后加 release
- `plugins/superpowers-memory/README.md` — 在 hooks 章节加一段说明 KB 写保护机制
- `plugins/superpowers-memory/.claude-plugin/plugin.json` — 版本号 bump

### Created
- 无新文件。锁文件 `.git/superpowers-memory.lock` 是运行期产物，不入仓。

---

## Task 1: 实现 hook-runtime.js 的 lock 机制

**Files:**
- Modify: `plugins/superpowers-memory/hook-runtime.js`

- [ ] **Step 1.1: 加锁文件路径解析**

在 `resolveRepoRoot` 之后添加：

```js
function resolveGitDir() {
  const result = cp.spawnSync("git", ["rev-parse", "--git-dir"], {
    cwd: repoRoot, encoding: "utf8", timeout: 5000,
  });
  if (result.status === 0 && result.stdout.trim()) {
    return path.resolve(repoRoot, result.stdout.trim());
  }
  return null;
}
const gitDir = resolveGitDir();
const lockFile = gitDir ? path.join(gitDir, "superpowers-memory.lock") : null;
const LOCK_TTL_MS = 60 * 60 * 1000; // 60 分钟
```

- [ ] **Step 1.2: 加 lock / unlock / isLockHeld 实现**

```js
function acquireLock(skill) {
  if (!lockFile) return { ok: false, reason: "Not a git repo (no .git dir)" };
  const payload = { acquired_at: new Date().toISOString(), skill: skill || "unknown" };
  fs.writeFileSync(lockFile, JSON.stringify(payload, null, 2));
  return { ok: true, lockFile };
}

function releaseLock() {
  if (!lockFile) return { ok: true };
  if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
  return { ok: true };
}

function isLockHeld() {
  if (!lockFile || !fs.existsSync(lockFile)) return false;
  const stat = fs.statSync(lockFile);
  if (Date.now() - stat.mtimeMs > LOCK_TTL_MS) {
    // 自动清理过期锁
    try { fs.unlinkSync(lockFile); } catch {}
    return false;
  }
  return true;
}
```

- [ ] **Step 1.3: 在 main() switch 增加 lock / unlock / lock-status 分支**

```js
if (mode === "lock") {
  const skill = process.argv[3] || process.env.CLAUDE_SKILL_NAME || "unknown";
  process.stdout.write(JSON.stringify(acquireLock(skill), null, 2) + "\n");
  return;
}
if (mode === "unlock") {
  process.stdout.write(JSON.stringify(releaseLock(), null, 2) + "\n");
  return;
}
if (mode === "lock-status") {
  process.stdout.write(JSON.stringify({ held: isLockHeld(), lockFile }, null, 2) + "\n");
  return;
}
```

## Task 2: 扩展 buildPreToolUseOutput 处理写工具

**Files:**
- Modify: `plugins/superpowers-memory/hook-runtime.js`

- [ ] **Step 2.1: 抽出 Skill 路径**

把原 `buildPreToolUseOutput` 重命名为 `handleSkillPreToolUse`。新写一个 dispatch：

```js
function buildPreToolUseOutput(input) {
  let parsed = {};
  try { parsed = JSON.parse(input || "{}"); } catch {}
  const toolName = parsed.tool_name || "";
  const toolInput = parsed.tool_input || {};

  if (toolName === "Skill") return handleSkillPreToolUse(parsed);
  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(toolName)) {
    return handleWritePreToolUse(toolName, toolInput);
  }
  return {};
}
```

- [ ] **Step 2.2: 实现 handleWritePreToolUse**

```js
function handleWritePreToolUse(toolName, toolInput) {
  const targetPath = toolInput.file_path || toolInput.notebook_path;
  if (!targetPath) return {};

  const absTarget = path.isAbsolute(targetPath)
    ? targetPath : path.resolve(repoRoot, targetPath);
  const rel = path.relative(knowledgeDir, absTarget);
  const insideKB = rel && !rel.startsWith("..") && !path.isAbsolute(rel);
  if (!insideKB) return {};

  if (isLockHeld()) return {};

  return {
    decision: "block",
    reason:
      "Direct edits to docs/project-knowledge/ are forbidden. " +
      "This directory is owned by superpowers-memory:update " +
      "(or superpowers-memory:rebuild for full regeneration). " +
      "To record an architectural decision: document it in your plan/spec under " +
      "docs/superpowers/plans/, then run superpowers-memory:update to materialize " +
      "the entry per content-rules.md. " +
      "(blocked tool=" + toolName + ", path=" + path.relative(repoRoot, absTarget) + ")",
  };
}
```

## Task 3: 更新 hooks.json 加 Write matcher

**Files:**
- Modify: `plugins/superpowers-memory/hooks/hooks.json`

- [ ] **Step 3.1: 把 Skill matcher 替换为联合 matcher**

```json
"PreToolUse": [
  {
    "matcher": "Skill|Write|Edit|MultiEdit|NotebookEdit",
    "hooks": [
      {
        "type": "command",
        "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" pre-tool-use",
        "async": false
      }
    ]
  }
]
```

## Task 4: update SKILL.md 加 lock / unlock 步骤

**Files:**
- Modify: `plugins/superpowers-memory/skills/update/SKILL.md`

- [ ] **Step 4.1: 在 §Process 第一个子节之前插入 Step 0**

```markdown
### 0. Acquire write lock

`docs/project-knowledge/` is write-protected. Acquire the lock before any KB edit:

\`\`\`bash
node "${CLAUDE_PLUGIN_ROOT:-plugins/superpowers-memory}/hooks/hook-runtime.js" lock superpowers-memory:update
\`\`\`

Lock has a 60-minute TTL — if this skill aborts midway, the lock auto-expires.
```

并把后续步骤的编号顺延（1→1，2→2 不变；最后加 11）。

- [ ] **Step 4.2: 在 §10. Report changes 之后加 Step 11**

```markdown
### 11. Release write lock

\`\`\`bash
node "${CLAUDE_PLUGIN_ROOT:-plugins/superpowers-memory}/hooks/hook-runtime.js" unlock
\`\`\`

Always run this — even if the commit in Step 9 failed. The lock is courtesy cleanup; the 60-min TTL is the safety net.
```

## Task 5: rebuild SKILL.md 加 lock / unlock 步骤

**Files:**
- Modify: `plugins/superpowers-memory/skills/rebuild/SKILL.md`

- [ ] **Step 5.1: 在 §Process §1 Phase 1 之前插入 Step 0**

镜像 update 的 Step 0，把 `superpowers-memory:update` 换成 `superpowers-memory:rebuild`。

- [ ] **Step 5.2: 在 §9 Report 之后加 Step 10 Release**

镜像 update 的 release 步骤。

## Task 6: 端到端验证

- [ ] **Step 6.1: 无锁拦截**
  - 在 talgent（不要真的写）或在 skill-workshop 自身 docs/project-knowledge/ 上 dry-run：
  - 不调用 lock，直接 Write 一个 KB 文件 → 应被 hook 阻断
- [ ] **Step 6.2: 加锁通过**
  - `node hook-runtime.js lock test`
  - Write 同样的文件 → 应通过
- [ ] **Step 6.3: 解锁后再次拦截**
  - `node hook-runtime.js unlock`
  - 再 Write → 应被阻断
- [ ] **Step 6.4: 过期锁**
  - 加锁后用 `touch -t YYYYMMDDhhmm <lockfile>` 改 mtime 到 90min 前
  - Write → 应被阻断（且锁文件被自动删）

## Task 7: 文档与版本

- [ ] **Step 7.1: README.md 加一段 "KB Write Lock" 说明**
- [ ] **Step 7.2: plugin.json 版本号 bump（v1.8.3 → v1.9.0，breaking 因 hook 行为变化）**

---

## Rollback

如果新 hook 误伤了用户某个工作流，临时禁用方法：从 `hooks.json` 移除 `Write|Edit|MultiEdit|NotebookEdit` matcher 即可，无需回退 hook-runtime.js。
