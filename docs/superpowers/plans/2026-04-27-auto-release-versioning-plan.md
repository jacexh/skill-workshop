# 自动化 Marketplace / Plugin 版本发布实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把手动 workflow_dispatch 风格的 release 流程,替换为 PR-merge 自动触发、跨双轨 R-X 差异 bump 的自动化发布管线,并清理 39 个历史 per-plugin tag。

**Architecture:** workflow YAML 仅做编排,核心逻辑(算下一版本号、检测变更插件、jq 改 manifest)抽到 `scripts/release/` 三个 bash 脚本,每个脚本单元测试 + 一个集成测试在临时 git repo 跑通 P1-Forward 全链路。一次性 tag 清理 + seed `v1.12.0` 在 plan 末尾以独立 destructive 任务呈现,需用户显式批准。

**Tech Stack:** GitHub Actions、bash、jq、git、`jacexh/action-autotag@v1`、`softprops/action-gh-release@v1`。无新增第三方依赖(jq、git、bash 都是 ubuntu-latest runner 自带)。

**Spec 路径:** `docs/superpowers/specs/2026-04-27-auto-release-versioning-design.md`

**架构标准说明:** superpowers-architect 列出的 7 个 design pattern(database / ddd-* / rest-api / frontend-patterns) **全部不相关** —— 本任务是 CI 自动化 + 脚本工程,无后端服务架构、数据库、REST API、前端 UI。

---

## 任务概览

| Phase | 范围 | 任务数 |
|---|---|---|
| A | 抽离脚本骨架 + 测试基础设施 | T1 |
| B | TDD 三个核心脚本 | T2–T4 |
| C | 集成测试(临时 git repo 端到端) | T5 |
| D | Workflow YAML + 删旧 workflow + README | T6–T8 |
| E | 一次性 destructive migration(用户显式批准) | T9 |
| F | 提交 PR + 首次自动 release 观察 + KB 更新 | T10–T12 |

---

## Phase A:脚本骨架 + 测试基础设施

### Task 1:创建 `scripts/release/` 与测试目录骨架

**Files:**
- Create: `scripts/release/`
- Create: `scripts/release/test/`
- Create: `scripts/release/test/run-tests.sh`

- [ ] **Step 1:建目录**

```bash
mkdir -p /home/xuhao/skill-workshop/scripts/release/test
```

- [ ] **Step 2:写测试 harness**

```bash
cat > /home/xuhao/skill-workshop/scripts/release/test/run-tests.sh <<'EOF'
#!/usr/bin/env bash
# Minimal test harness — runs every test_*.sh file and reports pass/fail.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0
for t in "$HERE"/test_*.sh; do
  [ -f "$t" ] || continue
  echo "=== $(basename "$t") ==="
  if bash "$t"; then
    echo "  PASS"
    PASS=$((PASS+1))
  else
    echo "  FAIL"
    FAIL=$((FAIL+1))
  fi
done
echo
echo "Summary: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
EOF
chmod +x /home/xuhao/skill-workshop/scripts/release/test/run-tests.sh
```

- [ ] **Step 3:验证 harness 在无测试文件时正确退出**

```bash
cd /home/xuhao/skill-workshop && bash scripts/release/test/run-tests.sh
```

Expected:输出 `Summary: 0 passed, 0 failed`,退出码 0。

- [ ] **Step 4:Commit**

```bash
git add scripts/release/test/run-tests.sh
git commit -m "chore(release): add minimal shell test harness"
```

---

## Phase B:TDD 三个核心脚本

### Task 2:`compute-next-version.sh`(算下一个版本号)

**Files:**
- Create: `scripts/release/test/test_compute-next-version.sh`
- Create: `scripts/release/compute-next-version.sh`

**契约:**
- 输入:env `BRANCH`(PR 源分支名,在 workflow 中由 `GITHUB_HEAD_REF` 透传);可选 env `GIT_DIR_OVERRIDE`(测试用,改变 `git tag` 的目标 repo)
- 输出:stdout 三行 KEY=VAL —— `PREV_TAG=...`、`BUMP_TYPE=patch|minor|major`、`NEXT=X.Y.Z`
- 取 prev tag:`git tag --sort=version:refname | tail -1`,空时回落 `v0.0.0`
- 分支映射:`release/*` 或 `release-*` → minor;`breaking/*`、`major/*` 或带 `-` 同义形式 → major;其余(含 `fix/`、`hotfix/`、`bugfix/`、`feat/`、`feature/`、未识别) → patch

- [ ] **Step 1:写失败测试**

```bash
cat > /home/xuhao/skill-workshop/scripts/release/test/test_compute-next-version.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../compute-next-version.sh"

setup_repo() {
  local dir
  dir=$(mktemp -d)
  cd "$dir"
  git init -q
  git config user.email t@t
  git config user.name t
  git commit -q --allow-empty -m init
  echo "$dir"
}

assert_eq() {
  if [ "$1" != "$2" ]; then
    echo "  FAIL: expected '$2', got '$1'"
    exit 1
  fi
}

# Case 1: hotfix/* → patch from v1.12.0
dir=$(setup_repo)
git -C "$dir" tag v1.12.0
out=$(cd "$dir" && BRANCH=hotfix/codex bash "$SCRIPT")
assert_eq "$(echo "$out" | grep ^PREV_TAG=)" "PREV_TAG=v1.12.0"
assert_eq "$(echo "$out" | grep ^BUMP_TYPE=)" "BUMP_TYPE=patch"
assert_eq "$(echo "$out" | grep ^NEXT=)" "NEXT=1.12.1"

# Case 2: release/* → minor from v1.12.5
dir=$(setup_repo)
git -C "$dir" tag v1.12.5
out=$(cd "$dir" && BRANCH=release/2026-q2 bash "$SCRIPT")
assert_eq "$(echo "$out" | grep ^BUMP_TYPE=)" "BUMP_TYPE=minor"
assert_eq "$(echo "$out" | grep ^NEXT=)" "NEXT=1.13.0"

# Case 3: breaking/* → major from v1.12.5
dir=$(setup_repo)
git -C "$dir" tag v1.12.5
out=$(cd "$dir" && BRANCH=breaking/api-v2 bash "$SCRIPT")
assert_eq "$(echo "$out" | grep ^BUMP_TYPE=)" "BUMP_TYPE=major"
assert_eq "$(echo "$out" | grep ^NEXT=)" "NEXT=2.0.0"

# Case 4: no tags at all → v0.0.0 baseline → 0.0.1
dir=$(setup_repo)
out=$(cd "$dir" && BRANCH=feat/foo bash "$SCRIPT")
assert_eq "$(echo "$out" | grep ^PREV_TAG=)" "PREV_TAG=v0.0.0"
assert_eq "$(echo "$out" | grep ^NEXT=)" "NEXT=0.0.1"

# Case 5: hyphen-separated branch (release-q2) also treated as minor
dir=$(setup_repo)
git -C "$dir" tag v1.0.0
out=$(cd "$dir" && BRANCH=release-q2 bash "$SCRIPT")
assert_eq "$(echo "$out" | grep ^BUMP_TYPE=)" "BUMP_TYPE=minor"

# Case 6: unrecognized branch → patch (default)
dir=$(setup_repo)
git -C "$dir" tag v3.4.5
out=$(cd "$dir" && BRANCH=random-name bash "$SCRIPT")
assert_eq "$(echo "$out" | grep ^BUMP_TYPE=)" "BUMP_TYPE=patch"
assert_eq "$(echo "$out" | grep ^NEXT=)" "NEXT=3.4.6"

echo "  6 cases passed"
EOF
chmod +x /home/xuhao/skill-workshop/scripts/release/test/test_compute-next-version.sh
```

- [ ] **Step 2:运行测试,确认失败(脚本不存在)**

```bash
cd /home/xuhao/skill-workshop && bash scripts/release/test/run-tests.sh
```

Expected:`Summary: 0 passed, 1 failed`,失败原因类似 `compute-next-version.sh: No such file or directory`。

- [ ] **Step 3:写实现**

```bash
cat > /home/xuhao/skill-workshop/scripts/release/compute-next-version.sh <<'EOF'
#!/usr/bin/env bash
# Compute next semver tag based on the latest v* tag and PR source branch.
# Inputs (env):
#   BRANCH         — PR source branch name (in CI: GITHUB_HEAD_REF)
# Outputs (stdout): three lines —
#   PREV_TAG=vX.Y.Z   (or v0.0.0 if no v* tags exist)
#   BUMP_TYPE=patch|minor|major
#   NEXT=X.Y.Z
set -euo pipefail

BRANCH="${BRANCH:-}"
if [ -z "$BRANCH" ]; then
  echo "ERROR: BRANCH env var required" >&2
  exit 2
fi

PREV_TAG=$(git tag --sort=version:refname | tail -n 1)
PREV_TAG=${PREV_TAG:-v0.0.0}

if [[ "$BRANCH" =~ ^(release)[/-] ]]; then
  BUMP=minor
elif [[ "$BRANCH" =~ ^(breaking|major)[/-] ]]; then
  BUMP=major
else
  BUMP=patch
fi

VER=${PREV_TAG#v}
IFS='.' read -r MAJ MIN PAT <<< "$VER"
case "$BUMP" in
  patch) PAT=$((PAT+1));;
  minor) MIN=$((MIN+1)); PAT=0;;
  major) MAJ=$((MAJ+1)); MIN=0; PAT=0;;
esac

echo "PREV_TAG=$PREV_TAG"
echo "BUMP_TYPE=$BUMP"
echo "NEXT=$MAJ.$MIN.$PAT"
EOF
chmod +x /home/xuhao/skill-workshop/scripts/release/compute-next-version.sh
```

- [ ] **Step 4:运行测试,确认通过**

```bash
cd /home/xuhao/skill-workshop && bash scripts/release/test/run-tests.sh
```

Expected:`Summary: 1 passed, 0 failed`,且每个用例打印 `6 cases passed`。

- [ ] **Step 5:Commit**

```bash
git add scripts/release/compute-next-version.sh scripts/release/test/test_compute-next-version.sh
git commit -m "feat(release): add compute-next-version script with branch-prefix bump rules"
```

---

### Task 3:`detect-changed-plugins.sh`(R-X 物理路径检测)

**Files:**
- Create: `scripts/release/test/test_detect-changed-plugins.sh`
- Create: `scripts/release/detect-changed-plugins.sh`

**契约:**
- 输入:`$1=PREV_REF`(必填,与 HEAD 做 diff 的基准 ref);CWD 为目标 git repo
- 输出:stdout 两行 —
  - `CLAUDE_PLUGINS=foo bar`(空格分隔;空时为 `CLAUDE_PLUGINS=`)
  - `CODEX_PLUGINS=foo`
- 检测规则:`git diff --name-only $PREV_REF..HEAD` 中,以 `plugins/<name>/` 开头的路径,提取 `<name>` 去重排序;同样规则对 `codex-plugins/<name>/`

- [ ] **Step 1:写失败测试**

```bash
cat > /home/xuhao/skill-workshop/scripts/release/test/test_detect-changed-plugins.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../detect-changed-plugins.sh"

setup_repo() {
  local dir
  dir=$(mktemp -d)
  cd "$dir"
  git init -q
  git config user.email t@t
  git config user.name t
  mkdir -p plugins/foo plugins/bar codex-plugins/foo codex-plugins/baz docs
  echo init > plugins/foo/x.md
  echo init > plugins/bar/x.md
  echo init > codex-plugins/foo/x.md
  echo init > codex-plugins/baz/x.md
  echo init > docs/x.md
  git add -A
  git commit -q -m init
  git tag v1.0.0
  echo "$dir"
}

assert_eq() {
  if [ "$1" != "$2" ]; then
    echo "  FAIL: expected '$2', got '$1'"
    exit 1
  fi
}

# Case 1: change one Claude plugin only
dir=$(setup_repo)
echo change >> "$dir/plugins/foo/x.md"
git -C "$dir" add -A && git -C "$dir" commit -q -m c
out=$(cd "$dir" && bash "$SCRIPT" v1.0.0)
assert_eq "$(echo "$out" | grep ^CLAUDE_PLUGINS=)" "CLAUDE_PLUGINS=foo"
assert_eq "$(echo "$out" | grep ^CODEX_PLUGINS=)" "CODEX_PLUGINS="

# Case 2: change Claude + Codex plugins (different names) + a docs file
dir=$(setup_repo)
echo c >> "$dir/plugins/bar/x.md"
echo c >> "$dir/codex-plugins/foo/x.md"
echo c >> "$dir/codex-plugins/baz/x.md"
echo c >> "$dir/docs/x.md"
git -C "$dir" add -A && git -C "$dir" commit -q -m c
out=$(cd "$dir" && bash "$SCRIPT" v1.0.0)
assert_eq "$(echo "$out" | grep ^CLAUDE_PLUGINS=)" "CLAUDE_PLUGINS=bar"
assert_eq "$(echo "$out" | grep ^CODEX_PLUGINS=)" "CODEX_PLUGINS=baz foo"

# Case 3: only docs change → both lists empty
dir=$(setup_repo)
echo c >> "$dir/docs/x.md"
git -C "$dir" add -A && git -C "$dir" commit -q -m c
out=$(cd "$dir" && bash "$SCRIPT" v1.0.0)
assert_eq "$(echo "$out" | grep ^CLAUDE_PLUGINS=)" "CLAUDE_PLUGINS="
assert_eq "$(echo "$out" | grep ^CODEX_PLUGINS=)" "CODEX_PLUGINS="

# Case 4: same plugin touched in two commits → reported once (sort -u)
dir=$(setup_repo)
echo c >> "$dir/plugins/foo/x.md"
git -C "$dir" add -A && git -C "$dir" commit -q -m c1
echo c2 >> "$dir/plugins/foo/y.md"
git -C "$dir" add -A && git -C "$dir" commit -q -m c2
out=$(cd "$dir" && bash "$SCRIPT" v1.0.0)
assert_eq "$(echo "$out" | grep ^CLAUDE_PLUGINS=)" "CLAUDE_PLUGINS=foo"

echo "  4 cases passed"
EOF
chmod +x /home/xuhao/skill-workshop/scripts/release/test/test_detect-changed-plugins.sh
```

- [ ] **Step 2:运行测试,确认失败**

```bash
cd /home/xuhao/skill-workshop && bash scripts/release/test/run-tests.sh
```

Expected:`Summary: 1 passed, 1 failed`(compute 通过,detect 失败因脚本不存在)。

- [ ] **Step 3:写实现**

```bash
cat > /home/xuhao/skill-workshop/scripts/release/detect-changed-plugins.sh <<'EOF'
#!/usr/bin/env bash
# Detect which Claude/Codex plugins changed between PREV_REF and HEAD.
# Per-physical-path rule (R-X): the two tracks are evaluated independently.
# Inputs:
#   $1 — PREV_REF (any git rev: tag, sha, branch)
# Outputs (stdout):
#   CLAUDE_PLUGINS=<space-separated names, sorted; empty if none>
#   CODEX_PLUGINS=<space-separated names, sorted; empty if none>
set -euo pipefail

PREV="${1:-}"
if [ -z "$PREV" ]; then
  echo "ERROR: PREV_REF arg required" >&2
  exit 2
fi

extract() {
  local prefix="$1"
  git diff --name-only "$PREV"..HEAD -- "$prefix/" \
    | awk -F/ -v p="$prefix" 'index($0, p"/")==1 && NF>=2 {print $2}' \
    | sort -u \
    | grep -v '^$' \
    | tr '\n' ' ' \
    | sed 's/ $//'
}

CLAUDE=$(extract plugins || true)
CODEX=$(extract codex-plugins || true)

echo "CLAUDE_PLUGINS=$CLAUDE"
echo "CODEX_PLUGINS=$CODEX"
EOF
chmod +x /home/xuhao/skill-workshop/scripts/release/detect-changed-plugins.sh
```

- [ ] **Step 4:运行测试,确认通过**

```bash
cd /home/xuhao/skill-workshop && bash scripts/release/test/run-tests.sh
```

Expected:`Summary: 2 passed, 0 failed`。

- [ ] **Step 5:Commit**

```bash
git add scripts/release/detect-changed-plugins.sh scripts/release/test/test_detect-changed-plugins.sh
git commit -m "feat(release): add detect-changed-plugins script with R-X path detection"
```

---

### Task 4:`bump-versions.sh`(jq 改 manifest)

**Files:**
- Create: `scripts/release/test/test_bump-versions.sh`
- Create: `scripts/release/bump-versions.sh`

**契约:**
- 输入(env):
  - `NEXT`(必填,如 `1.12.1`)
  - `CLAUDE_PLUGINS`(空格分隔列表,可空)
  - `CODEX_PLUGINS`(空格分隔列表,可空)
- 行为:
  - 始终更新 `.claude-plugin/marketplace.json` 的 `metadata.version`(#1)
  - 对 `CLAUDE_PLUGINS` 中每个 name `N`:
    - 更新 `.claude-plugin/marketplace.json` 内 `plugins[name=N].version`(#2)
    - 更新 `plugins/N/.claude-plugin/plugin.json` 的 `version`(#3)
    - 跳过且 stderr 警告:目录不存在
  - 对 `CODEX_PLUGINS` 中每个 name `N`:
    - 更新 `codex-plugins/N/.codex-plugin/plugin.json` 的 `version`(#4)
    - 跳过且 stderr 警告:目录不存在
- 不动 `.agents/plugins/marketplace.json`(#5)

- [ ] **Step 1:写失败测试**

```bash
cat > /home/xuhao/skill-workshop/scripts/release/test/test_bump-versions.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../bump-versions.sh"

setup_repo() {
  local dir
  dir=$(mktemp -d)
  mkdir -p "$dir/.claude-plugin"
  cat > "$dir/.claude-plugin/marketplace.json" <<JSON
{
  "name": "skill-workshop",
  "metadata": { "version": "1.0.0" },
  "plugins": [
    { "name": "foo", "version": "1.0.0" },
    { "name": "bar", "version": "1.0.0" }
  ]
}
JSON
  mkdir -p "$dir/plugins/foo/.claude-plugin" "$dir/plugins/bar/.claude-plugin"
  echo '{"name":"foo","version":"1.0.0"}' > "$dir/plugins/foo/.claude-plugin/plugin.json"
  echo '{"name":"bar","version":"1.0.0"}' > "$dir/plugins/bar/.claude-plugin/plugin.json"
  mkdir -p "$dir/codex-plugins/foo/.codex-plugin"
  echo '{"name":"foo","version":"1.0.0"}' > "$dir/codex-plugins/foo/.codex-plugin/plugin.json"
  mkdir -p "$dir/.agents/plugins"
  echo '{"name":"skill-workshop-codex"}' > "$dir/.agents/plugins/marketplace.json"
  echo "$dir"
}

assert_eq() {
  if [ "$1" != "$2" ]; then
    echo "  FAIL: expected '$2', got '$1'"
    exit 1
  fi
}

# Case 1: bump claude foo and codex foo → metadata + foo entries change
dir=$(setup_repo)
( cd "$dir" && NEXT=1.2.3 CLAUDE_PLUGINS=foo CODEX_PLUGINS=foo bash "$SCRIPT" )
assert_eq "$(jq -r .metadata.version "$dir/.claude-plugin/marketplace.json")" "1.2.3"
assert_eq "$(jq -r '.plugins[]|select(.name=="foo").version' "$dir/.claude-plugin/marketplace.json")" "1.2.3"
assert_eq "$(jq -r '.plugins[]|select(.name=="bar").version' "$dir/.claude-plugin/marketplace.json")" "1.0.0"
assert_eq "$(jq -r .version "$dir/plugins/foo/.claude-plugin/plugin.json")" "1.2.3"
assert_eq "$(jq -r .version "$dir/plugins/bar/.claude-plugin/plugin.json")" "1.0.0"
assert_eq "$(jq -r .version "$dir/codex-plugins/foo/.codex-plugin/plugin.json")" "1.2.3"
# .agents/plugins/marketplace.json must remain untouched
assert_eq "$(cat "$dir/.agents/plugins/marketplace.json")" '{"name":"skill-workshop-codex"}'

# Case 2: empty plugin lists → only metadata bumps
dir=$(setup_repo)
( cd "$dir" && NEXT=2.0.0 CLAUDE_PLUGINS= CODEX_PLUGINS= bash "$SCRIPT" )
assert_eq "$(jq -r .metadata.version "$dir/.claude-plugin/marketplace.json")" "2.0.0"
assert_eq "$(jq -r '.plugins[]|select(.name=="foo").version' "$dir/.claude-plugin/marketplace.json")" "1.0.0"
assert_eq "$(jq -r .version "$dir/plugins/foo/.claude-plugin/plugin.json")" "1.0.0"
assert_eq "$(jq -r .version "$dir/codex-plugins/foo/.codex-plugin/plugin.json")" "1.0.0"

# Case 3: multiple plugins on Claude side
dir=$(setup_repo)
( cd "$dir" && NEXT=3.1.0 CLAUDE_PLUGINS="foo bar" CODEX_PLUGINS= bash "$SCRIPT" )
assert_eq "$(jq -r .metadata.version "$dir/.claude-plugin/marketplace.json")" "3.1.0"
assert_eq "$(jq -r '.plugins[]|select(.name=="foo").version' "$dir/.claude-plugin/marketplace.json")" "3.1.0"
assert_eq "$(jq -r '.plugins[]|select(.name=="bar").version' "$dir/.claude-plugin/marketplace.json")" "3.1.0"
assert_eq "$(jq -r .version "$dir/plugins/bar/.claude-plugin/plugin.json")" "3.1.0"

# Case 4: nonexistent plugin name → skip with warning, no crash, others still updated
dir=$(setup_repo)
out=$( cd "$dir" && NEXT=4.0.0 CLAUDE_PLUGINS="foo ghost" CODEX_PLUGINS= bash "$SCRIPT" 2>&1 )
echo "$out" | grep -q "ghost" || { echo "  FAIL: expected stderr warning about ghost"; exit 1; }
assert_eq "$(jq -r .version "$dir/plugins/foo/.claude-plugin/plugin.json")" "4.0.0"

# Case 5: idempotent — running twice with same NEXT yields same final state
dir=$(setup_repo)
( cd "$dir" && NEXT=5.0.0 CLAUDE_PLUGINS=foo CODEX_PLUGINS=foo bash "$SCRIPT" )
hash1=$(find "$dir" -name '*.json' | sort | xargs sha256sum | sha256sum)
( cd "$dir" && NEXT=5.0.0 CLAUDE_PLUGINS=foo CODEX_PLUGINS=foo bash "$SCRIPT" )
hash2=$(find "$dir" -name '*.json' | sort | xargs sha256sum | sha256sum)
assert_eq "$hash1" "$hash2"

echo "  5 cases passed"
EOF
chmod +x /home/xuhao/skill-workshop/scripts/release/test/test_bump-versions.sh
```

- [ ] **Step 2:运行测试,确认失败**

```bash
cd /home/xuhao/skill-workshop && bash scripts/release/test/run-tests.sh
```

Expected:`Summary: 2 passed, 1 failed`(bump-versions 失败因脚本不存在)。

- [ ] **Step 3:写实现**

```bash
cat > /home/xuhao/skill-workshop/scripts/release/bump-versions.sh <<'EOF'
#!/usr/bin/env bash
# Bump version fields across marketplace + plugin manifests per R-X rule.
# Inputs (env):
#   NEXT             — new version, e.g. "1.12.1" (required)
#   CLAUDE_PLUGINS   — space-separated plugin names changed under plugins/ (may be empty)
#   CODEX_PLUGINS    — space-separated plugin names changed under codex-plugins/ (may be empty)
# Behavior:
#   1) always set .claude-plugin/marketplace.json .metadata.version = $NEXT
#   2) for each name N in CLAUDE_PLUGINS:
#        - .claude-plugin/marketplace.json .plugins[name=N].version = $NEXT
#        - plugins/N/.claude-plugin/plugin.json .version = $NEXT
#      (skip with stderr warning if directory absent)
#   3) for each name N in CODEX_PLUGINS:
#        - codex-plugins/N/.codex-plugin/plugin.json .version = $NEXT
#      (skip with stderr warning if directory absent)
#   .agents/plugins/marketplace.json is never touched.
set -euo pipefail

NEXT="${NEXT:-}"
CLAUDE_PLUGINS="${CLAUDE_PLUGINS:-}"
CODEX_PLUGINS="${CODEX_PLUGINS:-}"

if [ -z "$NEXT" ]; then
  echo "ERROR: NEXT env var required" >&2
  exit 2
fi

write_jq() {
  # write_jq <file> [jq args...] <expr>
  local file="$1"; shift
  local tmp
  tmp=$(mktemp)
  jq "$@" "$file" > "$tmp"
  mv "$tmp" "$file"
}

# (1) marketplace metadata
MK=".claude-plugin/marketplace.json"
[ -f "$MK" ] || { echo "ERROR: $MK not found" >&2; exit 3; }
write_jq "$MK" --arg v "$NEXT" '.metadata.version = $v'

# (2) Claude side per-plugin
for N in $CLAUDE_PLUGINS; do
  if [ ! -d "plugins/$N" ]; then
    echo "WARN: plugins/$N missing — skipping Claude bump for '$N'" >&2
    continue
  fi
  PJ="plugins/$N/.claude-plugin/plugin.json"
  if [ ! -f "$PJ" ]; then
    echo "WARN: $PJ missing — skipping" >&2
    continue
  fi
  write_jq "$MK" --arg n "$N" --arg v "$NEXT" \
    '(.plugins[] | select(.name == $n) | .version) = $v'
  write_jq "$PJ" --arg v "$NEXT" '.version = $v'
done

# (3) Codex side per-plugin
for N in $CODEX_PLUGINS; do
  if [ ! -d "codex-plugins/$N" ]; then
    echo "WARN: codex-plugins/$N missing — skipping Codex bump for '$N'" >&2
    continue
  fi
  PJ="codex-plugins/$N/.codex-plugin/plugin.json"
  if [ ! -f "$PJ" ]; then
    echo "WARN: $PJ missing — skipping" >&2
    continue
  fi
  write_jq "$PJ" --arg v "$NEXT" '.version = $v'
done
EOF
chmod +x /home/xuhao/skill-workshop/scripts/release/bump-versions.sh
```

注意:`jq` 改第一遍后会重写 `marketplace.json`,Case 5 要求"再跑一次结果相同" —— `jq --arg v X '.metadata.version = $v'` 是幂等的,但 `jq` 的 key 顺序在不同输入上可能漂移,Case 5 用 sha256 验证。这里写实现完成后跑测试如果 Case 5 失败,可改为先用 `jq -S`(sorted keys)规范化。

- [ ] **Step 4:运行测试,确认通过**

```bash
cd /home/xuhao/skill-workshop && bash scripts/release/test/run-tests.sh
```

Expected:`Summary: 3 passed, 0 failed`,`bump-versions` 用例报 `5 cases passed`。

如果 Case 5 失败(键顺序漂移),改 `write_jq` 为:
```bash
jq -S "$expr" "$file" > "$tmp"
```
重跑,直到 5 个用例全过。

- [ ] **Step 5:Commit**

```bash
git add scripts/release/bump-versions.sh scripts/release/test/test_bump-versions.sh
git commit -m "feat(release): add bump-versions script for R-X manifest updates"
```

---

## Phase C:集成测试(端到端)

### Task 5:在临时 git repo 中跑通 P1-Forward 流水线

**Files:**
- Create: `scripts/release/test/test_integration.sh`

**目的:**单元测试覆盖每个脚本的输入/输出契约;集成测试验证三脚本串起来在真实 git repo 上的端到端结果(预算 next → diff 检测 → bump → tag 数字一致)。

- [ ] **Step 1:写集成测试**

```bash
cat > /home/xuhao/skill-workshop/scripts/release/test/test_integration.sh <<'EOF'
#!/usr/bin/env bash
# Integration: simulate the workflow's Step 2/3/4 chain on a fresh git repo,
# verify the resulting NEXT, plugin lists, and manifest state are consistent.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS="$HERE/.."

dir=$(mktemp -d)
cd "$dir"
git init -q
git config user.email t@t
git config user.name t

# Seed marketplace + 2 claude plugins + 2 codex plugins
mkdir -p .claude-plugin plugins/alpha/.claude-plugin plugins/beta/.claude-plugin \
         codex-plugins/alpha/.codex-plugin codex-plugins/beta/.codex-plugin .agents/plugins
cat > .claude-plugin/marketplace.json <<JSON
{
  "name": "test-mk",
  "metadata": { "version": "1.11.0" },
  "plugins": [
    { "name": "alpha", "version": "1.11.0" },
    { "name": "beta",  "version": "1.6.2" }
  ]
}
JSON
echo '{"name":"alpha","version":"1.11.0"}' > plugins/alpha/.claude-plugin/plugin.json
echo '{"name":"beta","version":"1.6.2"}'  > plugins/beta/.claude-plugin/plugin.json
echo '{"name":"alpha","version":"1.11.0"}' > codex-plugins/alpha/.codex-plugin/plugin.json
echo '{"name":"beta","version":"1.6.2"}'  > codex-plugins/beta/.codex-plugin/plugin.json
echo '{"name":"test-mk-codex"}' > .agents/plugins/marketplace.json

git add -A && git commit -q -m baseline
git tag v1.12.0

# Now make a change: only plugins/alpha/ touched
echo "skill change" >> plugins/alpha/skill.md
git add -A && git commit -q -m "feat(alpha): tweak"

# Step 2: compute next
out=$(BRANCH=feat/alpha-tweak bash "$SCRIPTS/compute-next-version.sh")
NEXT=$(echo "$out" | grep ^NEXT= | cut -d= -f2)
PREV=$(echo "$out" | grep ^PREV_TAG= | cut -d= -f2)
[ "$NEXT" = "1.12.1" ] || { echo "FAIL NEXT=$NEXT (want 1.12.1)"; exit 1; }
[ "$PREV" = "v1.12.0" ] || { echo "FAIL PREV=$PREV"; exit 1; }

# Step 3: detect changed
out=$(bash "$SCRIPTS/detect-changed-plugins.sh" "$PREV")
CLAUDE=$(echo "$out" | grep ^CLAUDE_PLUGINS= | cut -d= -f2-)
CODEX=$(echo "$out" | grep ^CODEX_PLUGINS= | cut -d= -f2-)
[ "$CLAUDE" = "alpha" ] || { echo "FAIL CLAUDE=$CLAUDE"; exit 1; }
[ "$CODEX" = "" ] || { echo "FAIL CODEX=$CODEX"; exit 1; }

# Step 4: bump
NEXT="$NEXT" CLAUDE_PLUGINS="$CLAUDE" CODEX_PLUGINS="$CODEX" \
  bash "$SCRIPTS/bump-versions.sh"

# Verify final state
[ "$(jq -r .metadata.version .claude-plugin/marketplace.json)" = "1.12.1" ] \
  || { echo "FAIL metadata.version"; exit 1; }
[ "$(jq -r '.plugins[]|select(.name=="alpha").version' .claude-plugin/marketplace.json)" = "1.12.1" ] \
  || { echo "FAIL alpha mk entry"; exit 1; }
[ "$(jq -r '.plugins[]|select(.name=="beta").version' .claude-plugin/marketplace.json)" = "1.6.2" ] \
  || { echo "FAIL beta mk entry should stay"; exit 1; }
[ "$(jq -r .version plugins/alpha/.claude-plugin/plugin.json)" = "1.12.1" ] \
  || { echo "FAIL alpha plugin.json"; exit 1; }
[ "$(jq -r .version plugins/beta/.claude-plugin/plugin.json)" = "1.6.2" ] \
  || { echo "FAIL beta plugin.json should stay"; exit 1; }
[ "$(jq -r .version codex-plugins/alpha/.codex-plugin/plugin.json)" = "1.11.0" ] \
  || { echo "FAIL codex/alpha (R-X: only Claude side changed)"; exit 1; }
[ "$(cat .agents/plugins/marketplace.json)" = '{"name":"test-mk-codex"}' ] \
  || { echo "FAIL .agents marketplace must not be touched"; exit 1; }

echo "  integration: full pipeline correct"
EOF
chmod +x /home/xuhao/skill-workshop/scripts/release/test/test_integration.sh
```

- [ ] **Step 2:运行所有测试,确认全过**

```bash
cd /home/xuhao/skill-workshop && bash scripts/release/test/run-tests.sh
```

Expected:`Summary: 4 passed, 0 failed`。

- [ ] **Step 3:Commit**

```bash
git add scripts/release/test/test_integration.sh
git commit -m "test(release): add end-to-end pipeline integration test"
```

---

## Phase D:Workflow YAML + 删旧 workflow + README

### Task 6:写新 workflow `auto-release.yml`

**Files:**
- Create: `.github/workflows/auto-release.yml`

- [ ] **Step 1:写 workflow**

```bash
cat > /home/xuhao/skill-workshop/.github/workflows/auto-release.yml <<'EOF'
name: Auto Release

on:
  pull_request:
    branches: [main]
    types: [closed]

permissions:
  contents: write

jobs:
  release:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          ref: main
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      - name: Compute next version
        id: preview
        env:
          BRANCH: ${{ github.event.pull_request.head.ref }}
        run: |
          set -euo pipefail
          out=$(bash scripts/release/compute-next-version.sh)
          echo "$out"
          {
            echo "next=$(echo "$out" | grep ^NEXT= | cut -d= -f2)"
            echo "prev_tag=$(echo "$out" | grep ^PREV_TAG= | cut -d= -f2)"
          } >> "$GITHUB_OUTPUT"

      - name: Detect changed plugins
        id: changed
        run: |
          set -euo pipefail
          out=$(bash scripts/release/detect-changed-plugins.sh "${{ steps.preview.outputs.prev_tag }}")
          echo "$out"
          {
            echo "claude=$(echo "$out" | grep ^CLAUDE_PLUGINS= | cut -d= -f2-)"
            echo "codex=$(echo "$out"  | grep ^CODEX_PLUGINS=  | cut -d= -f2-)"
          } >> "$GITHUB_OUTPUT"

      - name: Bump version fields
        env:
          NEXT: ${{ steps.preview.outputs.next }}
          CLAUDE_PLUGINS: ${{ steps.changed.outputs.claude }}
          CODEX_PLUGINS: ${{ steps.changed.outputs.codex }}
        run: bash scripts/release/bump-versions.sh

      - name: Commit and push bump
        id: bump
        run: |
          set -euo pipefail
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add -A
          if git diff --cached --quiet; then
            echo "no-op release: nothing to bump"
            echo "bumped=false" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          git commit -m "chore: bump versions to v${{ steps.preview.outputs.next }}"
          git push origin main
          echo "bumped=true" >> "$GITHUB_OUTPUT"

      - name: Auto Tag
        id: autotag
        if: steps.bump.outputs.bumped == 'true'
        uses: jacexh/action-autotag@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          default_bump: patch

      - name: Create GitHub Release
        if: steps.bump.outputs.bumped == 'true' && steps.autotag.outputs.new_tag != ''
        uses: softprops/action-gh-release@v1
        with:
          tag_name: ${{ steps.autotag.outputs.new_tag }}
          name: ${{ steps.autotag.outputs.new_tag }}
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
EOF
```

- [ ] **Step 2:语法快查**

```bash
# 用 yq 或 python 做语法 sanity check (ubuntu 自带 python3 + PyYAML 可能没装,
# 用 python -c 'import yaml; yaml.safe_load(open(...))' 即可)
python3 -c "import yaml; yaml.safe_load(open('/home/xuhao/skill-workshop/.github/workflows/auto-release.yml'))" \
  && echo "YAML OK"
```

Expected:`YAML OK`。如果 PyYAML 缺失,改用 `cat`+人眼 review,不阻塞流程。

- [ ] **Step 3:Commit**

```bash
git add .github/workflows/auto-release.yml
git commit -m "feat(ci): add auto-release workflow orchestrating release scripts"
```

---

### Task 7:删除旧 `release.yml`

**Files:**
- Delete: `.github/workflows/release.yml`

- [ ] **Step 1:确认旧 workflow 没有正在运行的实例**

```bash
gh run list --workflow=release.yml --limit 3 2>/dev/null || echo "(gh not available or no runs)"
```

任何运行中的 instance 在删除前应等待结束。

- [ ] **Step 2:删除文件**

```bash
git rm /home/xuhao/skill-workshop/.github/workflows/release.yml
```

- [ ] **Step 3:Commit**

```bash
git commit -m "chore(ci): remove legacy manual release workflow (superseded by auto-release)"
```

---

### Task 8:更新 README,记录 release 约定

**Files:**
- Modify: `README.md`(在文件末尾追加 "## Releases" 章节)

- [ ] **Step 1:读现有 README 末尾,定位插入点**

```bash
tail -30 /home/xuhao/skill-workshop/README.md
```

找到合适的 anchor(例如最后一个二级标题之后)。如果文件已有 "## Releases" 或类似章节,改为更新而非追加。

- [ ] **Step 2:追加 Releases 章节**

```bash
cat >> /home/xuhao/skill-workshop/README.md <<'EOF'

## Releases

This repo uses an automated release pipeline triggered when a pull request
merges into `main`. The pipeline:

1. Computes the next version (`vX.Y.Z`) by reading the latest `v*` tag and
   bumping based on the **PR source branch prefix**:
   | Prefix (`/` or `-` separator) | Bump |
   |---|---|
   | `release/...` | minor |
   | `breaking/...`, `major/...` | major |
   | `fix/`, `hotfix/`, `bugfix/`, `feat/`, `feature/`, anything else | patch |
2. Detects which plugins changed under `plugins/<name>/` and `codex-plugins/<name>/`
   (the two tracks are **independent** — same-named plugins on both sides may
   have divergent versions).
3. Bumps the matching `version` fields in `marketplace.json` and each affected
   `plugin.json`. The marketplace's `metadata.version` always advances.
4. Commits the bump as `github-actions[bot]`, tags the new commit `vX.Y.Z`,
   and publishes a GitHub Release with auto-generated notes.

> **Tag naming convention:** only `vX.Y.Z` semver tags should ever be created
> in this repo. Other tag patterns will confuse the auto-release pipeline's
> "latest tag" lookup.

The pipeline lives in `.github/workflows/auto-release.yml` and delegates its
core logic to `scripts/release/*.sh` (each independently unit-tested via
`scripts/release/test/run-tests.sh`).
EOF
```

- [ ] **Step 3:Commit**

```bash
git add /home/xuhao/skill-workshop/README.md
git commit -m "docs: document automated release pipeline and tag convention"
```

---

## Phase E:一次性 destructive migration

### Task 9:清理历史 tag + seed v1.12.0 baseline ⚠️ DESTRUCTIVE

> **执行者注意**:这一任务包含**不可逆的远程 tag 删除**(39 个 per-plugin tag + `v1.0.2`)。在跑任何 `git push origin --delete` 之前,**必须**等用户(交互式会话)显式 confirm "go ahead"。如果你是 subagent / 批量执行,在 step 2 之前 STOP 并把 dry-run 输出反馈给主代理或用户。

**Files:** 无文件改动。仅 git refs 操作。

- [ ] **Step 1:列出所有要删的 tag(dry-run)**

```bash
cd /home/xuhao/skill-workshop && git fetch --tags --prune
echo "=== per-plugin tags to delete (must be 39): ==="
git tag --list '*-v*' | tee /tmp/tags-to-delete-pluginlike.txt
echo
echo "=== global tag to delete: ==="
echo v1.0.2
echo
echo "=== count ==="
wc -l /tmp/tags-to-delete-pluginlike.txt
```

Expected:per-plugin tag 39 行(designing-tests-v* / superpowers-architect-v* / superpowers-memory-v* 三族,合计 39 行——以 `wc -l` 输出为准),`v1.0.2` 单独 1 个。

**STOP HERE — present the output to the user and request explicit approval to proceed.**

- [ ] **Step 2:远程批量删 per-plugin tag**

仅在用户 confirm 后执行:

```bash
cd /home/xuhao/skill-workshop && \
xargs -a /tmp/tags-to-delete-pluginlike.txt -n1 -I{} \
  git push origin --delete {}
```

Expected:每行 `- [deleted]         <plugin>-vX.Y.Z`,共 39 行。

- [ ] **Step 3:远程删 v1.0.2**

```bash
cd /home/xuhao/skill-workshop && git push origin --delete v1.0.2
```

Expected:`- [deleted]         v1.0.2`。

- [ ] **Step 4:本地清理(对应 ref)**

```bash
cd /home/xuhao/skill-workshop && \
xargs -a /tmp/tags-to-delete-pluginlike.txt git tag -d && \
git tag -d v1.0.2
```

Expected:每行 `Deleted tag '<name>' (was <sha>)`,共 40 行。

- [ ] **Step 5:确认仅剩一个 baseline 候选**

```bash
cd /home/xuhao/skill-workshop && git tag -l
```

Expected:输出为空。

- [ ] **Step 6:在当前 hotfix/codex 分支 HEAD 种 baseline `v1.12.0`**

```bash
cd /home/xuhao/skill-workshop && git tag v1.12.0 && git push origin v1.12.0
```

Expected:`* [new tag]         v1.12.0 -> v1.12.0`。

- [ ] **Step 7:复核**

```bash
cd /home/xuhao/skill-workshop && git tag -l
echo "---"
git tag --sort=version:refname | tail -1
```

Expected:仅一行 `v1.12.0`,`tail -1` 也是 `v1.12.0`。

⚠️ **不要 commit** —— 此任务无文件改动。tag 操作是远程/本地 git refs 的副作用,不进入 commit 历史。

---

## Phase F:提交 PR + 首次自动 release 观察 + KB 更新

### Task 10:推 hotfix/codex 分支 + 开 PR

**Files:** 无新文件;此任务仅做 git 推送 + PR 创建。

- [ ] **Step 1:Push 分支到 origin**

```bash
cd /home/xuhao/skill-workshop && git push -u origin hotfix/codex
```

Expected:正常推送,无冲突。

- [ ] **Step 2:开 PR 到 main**

```bash
cd /home/xuhao/skill-workshop && gh pr create \
  --base main \
  --head hotfix/codex \
  --title "feat(release): automated marketplace/plugin versioning" \
  --body "$(cat <<'BODY'
## Summary
- 引入 `.github/workflows/auto-release.yml`:PR 合并到 main 即自动算下一个 `vX.Y.Z`、依据 R-X 物理路径检测变更插件、jq bump 对应 manifest、commit、autotag、Release。
- 抽出 `scripts/release/{compute-next-version,detect-changed-plugins,bump-versions}.sh`,各自带单元测试 + 一个端到端集成测试。
- 删除旧 `.github/workflows/release.yml`(手动 workflow_dispatch,只覆盖 Claude 轨)。
- README 增 "Releases" 章节说明分支前缀映射 + tag 约定。
- 一次性清理 39 个 `<plugin>-v*` tag 与 `v1.0.2`,种 `v1.12.0` baseline(已在 PR 之外的 git 操作中完成,见 Task 9)。

## Test plan
- [ ] 本地 `bash scripts/release/test/run-tests.sh` 全过(单元 3 + 集成 1)
- [ ] PR 合并后,Auto Release workflow 第一次运行
  - [ ] preview 输出 `NEXT=1.12.1`、`PREV_TAG=v1.12.0`
  - [ ] detect 输出 `CLAUDE_PLUGINS=` 和 `CODEX_PLUGINS=`(本 PR 仅改 docs/CI/scripts,不动 plugins/)
  - [ ] bump 仅更新 `.claude-plugin/marketplace.json` 的 `metadata.version`(`1.11.0 → 1.12.1`)
  - [ ] bot commit `chore: bump versions to v1.12.1` 出现在 main
  - [ ] tag `v1.12.1` 落在 bot commit 上
  - [ ] GitHub Release `v1.12.1` 自动创建

## 关联设计
- Spec: `docs/superpowers/specs/2026-04-27-auto-release-versioning-design.md`
- Plan: `docs/superpowers/plans/2026-04-27-auto-release-versioning-plan.md`
BODY
)"
```

Expected:输出 PR URL。

- [ ] **Step 3:在 PR 上做 self-review,确认 diff 不包含意外改动**

```bash
gh pr view --json files | jq -r '.files[].path' | sort
```

Expected:列表只包含
- `.github/workflows/auto-release.yml`(新增)
- `.github/workflows/release.yml`(删除)
- `README.md`(修改)
- `docs/superpowers/plans/2026-04-27-auto-release-versioning-plan.md`(新增)
- `docs/superpowers/specs/2026-04-27-auto-release-versioning-design.md`(新增)
- `scripts/release/*.sh`(新增 3 个脚本)
- `scripts/release/test/*.sh`(新增 5 个测试 + harness)

如果列表里出现任何 `plugins/*` 或 `codex-plugins/*` 路径,**STOP** —— 设计上这次 PR 不应改动任何 plugin 文件。

---

### Task 11:合并 PR + 观察首次自动 release

**Files:** 无。本任务为产出验证。

> **此任务不能由代理自动 merge**(merge 是高风险跨工作流动作)。由用户在 GitHub UI 或本地用 `gh pr merge` 手动触发。代理负责合并后的观察与确认。

- [ ] **Step 1:用户 confirm 准备合并**

代理在等到用户确认前不应继续。

- [ ] **Step 2:观察 Auto Release workflow run**

```bash
gh run list --workflow=auto-release.yml --limit 1
gh run watch  # 或 gh run view --log
```

期望 step 输出:
- `Compute next version` step:`NEXT=1.12.1`、`PREV_TAG=v1.12.0`
- `Detect changed plugins` step:两个空列表
- `Bump version fields` step:无 stderr 警告
- `Commit and push bump` step:`bumped=true`(因为 #1 必然 diff)
- `Auto Tag` step:输出 `new_tag=v1.12.1`
- `Create GitHub Release` step:成功

- [ ] **Step 3:验证仓库最终状态**

```bash
cd /home/xuhao/skill-workshop && git fetch --tags --prune && git pull origin main
git log --oneline -5
git tag --sort=version:refname
jq -r .metadata.version .claude-plugin/marketplace.json
```

Expected:
- `git log` 顶部:`chore: bump versions to v1.12.1` (bot 提交) → 上一行是 PR merge commit
- `git tag --sort=version:refname` 输出 2 行(从旧到新):
  - `v1.12.0`(T9 种下的 baseline,保留)
  - `v1.12.1`(本次自动 release)
- `metadata.version`:`1.11.0` → `1.12.1`
- 所有 plugin 的 #2/#3/#4 字段保持原值。

  **原因**:`v1.12.0` 是 T9 在 README commit `a54ca37` 上种下的 —— 该 commit 在 hotfix/codex 历史中**晚于**所有 codex-plugins 引入 commit。`v1.12.0..HEAD` 只覆盖 spec + plan 这两个 docs commit,不触及任何 plugin 路径,因此 `detect-changed-plugins.sh` 输出空列表,bump 仅作用于 #1 metadata.version。验证命令:`bash scripts/release/detect-changed-plugins.sh v1.12.0` 输出 `CLAUDE_PLUGINS=` 与 `CODEX_PLUGINS=`(均空)。

  注意:用 `origin/main` 作为 PREV 时输出会不同(会看到上轮 Codex 双轨工作),但 workflow 实际走 `v1.12.0`(最新 v* tag),不走 main —— 不要把这两种预测混为一谈。
- 所有 `plugins/*/.claude-plugin/plugin.json` 与 `codex-plugins/*/.codex-plugin/plugin.json` 中的 `version` **保持原值**(本 PR 没改 plugin 内容)。

- [ ] **Step 4:验证 GitHub Release 页**

```bash
gh release view v1.12.1
```

Expected:Release 标题 `v1.12.1`,自动生成 release notes 包含本 PR 的 commits/PR title。

---

### Task 12:更新项目知识库(KB)

- [ ] **Step 1:调用 `superpowers-memory:update`**

合并 + 首次 release 验证通过后,跑:

```
[invoke Skill: superpowers-memory:update]
```

让其读取本 plan(`triggered_by_plan: 2026-04-27-auto-release-versioning-plan.md`),增量更新 `docs/project-knowledge/` 中相关的:
- `architecture.md`(release 管线作为新组件)
- `tech-stack.md`(新增 jacexh/action-autotag、softprops/action-gh-release、scripts/release/ shell)
- `features.md`(自动化 release 流水线、R-X bump 策略、tag 清理)
- `conventions.md`(分支前缀 → bump 映射、`vX.Y.Z` tag 唯一约定)
- `decisions.md`(可选:登记 ADR-014 候选,但请先与用户确认是否升格为正式 ADR)

- [ ] **Step 2:Commit KB 更新**

`superpowers-memory:update` 自带 KB 写锁逻辑。它会自己 commit。

---

## 自审 / Self-Review

按 writing-plans 自审清单逐项过:

**1. Spec 覆盖性:**

| Spec 章节 | 实施任务 |
|---|---|
| 核心决策(A2/R-X/(ii)/P1-Forward/Q-ii/S-β v1.12.0/K-1) | T6(workflow)、T7(K-1)、T9(Q-ii+S-β),核心决策的运行期行为由 T2–T5 测试覆盖 |
| 版本字段更新规则(#1–#5 各自规则) | T4 单元测试 + T5 集成测试逐条断言 |
| Workflow 架构 7 个 step | T6 一一映射(actions/checkout、preview、changed、bump、commit-push、autotag、release) |
| Step 2 / Step 6 算法等价性根基 | T6 中 preview step 复用 `compute-next-version.sh`,**与 autotag.sh 共享同一份"取最新 tag + 解析分支前缀 + awk bump"逻辑**;T2 测试覆盖各 prefix → bump 映射 |
| 一次性 migration | T9 全覆盖,且加了 STOP gate |
| 边界行为速查表 | T2/T3 单元测试覆盖空列表、unrecognized 分支、多 plugin、idempotent;Step 5 safety net 在 T6 workflow 与 T11 验证中均显式 |
| 风险与缓解("第三方误打非 v* tag") | T8 在 README 写入"未来仅打 vX.Y.Z 形态 tag"约定 |

无 spec 章节未被任务覆盖。

**2. 占位符扫描:**无 TBD/TODO;每个 step 都给了完整 code/command;无 "implement later" / "similar to Task N"。

**3. 类型 / 接口一致性:**

- 三脚本的输入输出契约:env `BRANCH` / arg `PREV_REF` / env `NEXT`+`CLAUDE_PLUGINS`+`CODEX_PLUGINS` —— Task 6 workflow 的 env 与 step output 完全对齐
- stdout 三/两行 KEY=VAL 格式:T2/T3 测试 grep `^KEY=` 与 T6 workflow `grep ^KEY= | cut -d= -f2-` 一致
- workflow step id:`preview`、`changed`、`bump`、`autotag` —— T6 与 spec §3 命名一致

**4. 范围:**单 plan 范围为"自动化 release 流水线"。一次性 destructive migration(T9)是该流水线生效的前置条件,故并入本 plan。完成后 plugin 内容本身没有变化 —— 第一次真正 bump plugin.json 的 release 会发生在下一个改动 plugin 文件的 PR,这超出本 plan。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-27-auto-release-versioning-plan.md`. Two execution options:**

**1. Subagent-Driven(recommended)** — 主代理为每个 Task 派生 fresh subagent,每个 task 独立执行 + 两阶段 review,迭代快;适合本 plan(T2–T5 都是 TDD,边界清晰)。

**2. Inline Execution** — 在当前会话直接连续跑;适合 T9(destructive migration 需要主代理可见 dry-run 输出并暂停等用户批准)、T11(需要在合并后续动作中观察 workflow log)。

**混合建议**:T1–T8 由 subagent 并发推进(脚本/测试/workflow/README 之间依赖弱);T9 / T10–T12 必须 inline(destructive + 跨 GitHub 状态)。

哪种方式?
