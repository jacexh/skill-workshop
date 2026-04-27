# 自动化 Marketplace / Plugin 版本发布设计

- **状态**: Draft
- **日期**: 2026-04-27
- **作者**: xuhao + Claude
- **关联 ADR**: ADR-013 (Codex marketplace 双轨 Strategy A)
- **取代**: 现有 `.github/workflows/release.yml`(手动 workflow_dispatch)

## 背景

仓库当前同时供给两条 marketplace 轨道:

- **Claude 轨**: `.claude-plugin/marketplace.json` + `plugins/<name>/.claude-plugin/plugin.json` × 3
- **Codex 轨**: `.agents/plugins/marketplace.json` + `codex-plugins/<name>/.codex-plugin/plugin.json` × 3

每个 plugin 的 declared version 散落在 5 个字段中(同名 plugin 同时存在于双轨):

| # | 文件 | 字段 |
|---|------|------|
| 1 | `.claude-plugin/marketplace.json` | `metadata.version` |
| 2 | `.claude-plugin/marketplace.json` | `plugins[].version`(逐个 entry) |
| 3 | `plugins/<name>/.claude-plugin/plugin.json` | `version` |
| 4 | `codex-plugins/<name>/.codex-plugin/plugin.json` | `version` |
| 5 | `.agents/plugins/marketplace.json` | (该文件本身无 version 字段) |

现有 `release.yml`:
- 触发: `workflow_dispatch`,人工填表选 plugin + version
- 行为: 仅更新 #1/#2/#3,**完全忽略 #4**(Codex 轨在 ADR-013 接入后的遗留缺口)
- 打 tag 形式: `<plugin>-vX.Y.Z`(per-plugin tag)
- 历史遗留: 39 个 `<plugin>-v*` tag + 1 个 `v1.0.2`(更早一次实验留下的全局 tag)

## 目标

1. 用 `jacexh/action-autotag` 在 PR 合并到 main 时自动产出仓库级 tag(`vX.Y.Z`)。
2. 自动化更新所有受影响的 plugin manifest(#1–#4),保证 git tag 指向的 commit 中文件版本号与 tag 一致。
3. 修复 ADR-013 接入后的 Codex 侧 #4 缺口。
4. 清理历史 per-plugin tag 污染,让 autotag 的"取最新 tag"逻辑在未来保持稳定。

## 非目标

- 不向 `.agents/plugins/marketplace.json` 增加 version 字段(Codex marketplace 规范本身无此要求)。
- 不修改 `jacexh/action-autotag` 仓库代码——清理旧 tag 后,默认行为已可用。
- 不为 plugin 之外的资产(docs、KB、CI 自身)做单独版本号——它们随 marketplace metadata 走。
- 不实现 changelog 自动生成——交给 `softprops/action-gh-release` 的 `generate_release_notes` 自动从 PR 标题汇总。

## 核心决策

| 维度 | 选择 | 理由 |
|---|---|---|
| 版本作用域 | **A2 差异 bump**——只 bump 实际改动的 plugin | 保留 plugin.json 的语义诚实性,延续手动 release.yml 的初衷 |
| Bump 检测粒度 | **R-X 物理路径独立**——`plugins/<name>/**` 与 `codex-plugins/<name>/**` 各自独立判断 | 不强制双轨同名锁步,允许 Claude/Codex 同名 plugin 版本分叉 |
| 触发模型 | **PR merge to main**(`pull_request: types:[closed]` + `merged==true`) | autotag 官方推荐;项目本身就是 PR-driven;分支前缀(`hotfix/`/`feat/`/`release/`)天然落入 autotag 规则 |
| Bump 等级 | autotag 默认映射:`fix\|hotfix\|bugfix\|feat\|feature` → patch;`release` → minor;`breaking\|major` → major | 沿用 autotag 内置语义,不二次发明 |
| Bump 时序 | **P1-Forward**——bot 在 main 上追加 `chore: bump` commit,autotag 在该 commit 上打 tag | tag 与文件状态严格一致;开发者零纪律负担 |
| 起点 tag | **`v1.12.0`**——清理后种为 baseline,首次自动 release 产出 `v1.12.1` | 比当前 `metadata.version=1.11.0` 高一个 minor,标记"自动化纪元开启";避免 `v1.0.3` 视觉倒退 |
| 旧 release.yml | **删除** | 新方案完全覆盖;保留它会造成路径分歧(且它漏 #4) |
| 空 plugin 改动 PR(纯文档/CI) | **照样打 tag**(只更新 #1) | marketplace metadata 演进本身视为一次 release |

## 版本字段更新规则

PR 合并触发后,workflow 计算出 `NEXT_VERSION = "X.Y.Z"`(对应 tag `vX.Y.Z`),按以下规则更新:

| 字段 | 更新条件 | 更新值 |
|---|---|---|
| #1 `.claude-plugin/marketplace.json` `metadata.version` | **每次 release 都更新** | `NEXT_VERSION` |
| #2 `.claude-plugin/marketplace.json` `plugins[name=N].version` | `git diff --name-only $PREV_TAG..HEAD` 命中 `plugins/N/**` | `NEXT_VERSION` |
| #3 `plugins/N/.claude-plugin/plugin.json` `version` | 同 #2 条件 | `NEXT_VERSION` |
| #4 `codex-plugins/N/.codex-plugin/plugin.json` `version` | `git diff --name-only $PREV_TAG..HEAD` 命中 `codex-plugins/N/**` | `NEXT_VERSION` |
| #5 `.agents/plugins/marketplace.json` | 永不更新 | — |

**不变量**:
- 任意 plugin 的 #3 / #4 版本 = "它最后一次被改动时所在的 marketplace tag"
- #1 metadata.version 单调递增,与最新 tag 同号
- 同名 plugin 在 Claude/Codex 两轨可能版本分叉(R-X 的代价,被接受)

## Workflow 架构

新增 `.github/workflows/auto-release.yml`:

```yaml
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
      # ── Step 1: checkout main with full history + tags ──
      - uses: actions/checkout@v6
        with:
          ref: main
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      # ── Step 2: preview next version (复刻 autotag 算法) ──
      - id: preview
        run: |
          set -euo pipefail
          BRANCH="${GITHUB_HEAD_REF}"
          if [[ "$BRANCH" =~ ^(release)[/-] ]]; then
            BUMP=minor
          elif [[ "$BRANCH" =~ ^(breaking|major)[/-] ]]; then
            BUMP=major
          else
            BUMP=patch
          fi
          LATEST=$(git tag --sort=version:refname | tail -1)
          LATEST=${LATEST:-v0.0.0}
          IFS='.' read -r MAJ MIN PAT <<< "${LATEST#v}"
          case "$BUMP" in
            patch) PAT=$((PAT+1));;
            minor) MIN=$((MIN+1)); PAT=0;;
            major) MAJ=$((MAJ+1)); MIN=0; PAT=0;;
          esac
          echo "next=$MAJ.$MIN.$PAT" >> "$GITHUB_OUTPUT"
          echo "prev_tag=$LATEST" >> "$GITHUB_OUTPUT"

      # ── Step 3: detect changed plugins per physical path (R-X) ──
      - id: changed
        run: |
          set -euo pipefail
          PREV="${{ steps.preview.outputs.prev_tag }}"
          CLAUDE=$(git diff --name-only "$PREV"..HEAD -- 'plugins/' \
            | awk -F/ 'NF>=2 {print $2}' | sort -u | grep -v '^$' || true)
          CODEX=$(git diff --name-only "$PREV"..HEAD -- 'codex-plugins/' \
            | awk -F/ 'NF>=2 {print $2}' | sort -u | grep -v '^$' || true)
          {
            echo "claude<<EOF"; echo "$CLAUDE"; echo "EOF"
            echo "codex<<EOF";  echo "$CODEX";  echo "EOF"
          } >> "$GITHUB_OUTPUT"

      # ── Step 4: bump version fields (jq) ──
      - run: |
          set -euo pipefail
          NEXT="${{ steps.preview.outputs.next }}"
          # #1: marketplace metadata always bumps
          tmp=$(mktemp)
          jq --arg v "$NEXT" '.metadata.version = $v' .claude-plugin/marketplace.json > "$tmp"
          mv "$tmp" .claude-plugin/marketplace.json
          # #2 + #3: claude-side changed plugins
          while IFS= read -r p; do
            [ -z "$p" ] && continue
            [ -d "plugins/$p" ] || continue
            tmp=$(mktemp)
            jq --arg n "$p" --arg v "$NEXT" \
              '(.plugins[] | select(.name == $n) | .version) = $v' \
              .claude-plugin/marketplace.json > "$tmp"
            mv "$tmp" .claude-plugin/marketplace.json
            tmp=$(mktemp)
            jq --arg v "$NEXT" '.version = $v' \
              "plugins/$p/.claude-plugin/plugin.json" > "$tmp"
            mv "$tmp" "plugins/$p/.claude-plugin/plugin.json"
          done <<< "${{ steps.changed.outputs.claude }}"
          # #4: codex-side changed plugins
          while IFS= read -r p; do
            [ -z "$p" ] && continue
            [ -d "codex-plugins/$p" ] || continue
            tmp=$(mktemp)
            jq --arg v "$NEXT" '.version = $v' \
              "codex-plugins/$p/.codex-plugin/plugin.json" > "$tmp"
            mv "$tmp" "codex-plugins/$p/.codex-plugin/plugin.json"
          done <<< "${{ steps.changed.outputs.codex }}"

      # ── Step 5: commit + push the bump to main ──
      - id: bump
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

      # ── Step 6: autotag — tag the bump commit ──
      - id: autotag
        if: steps.bump.outputs.bumped == 'true'
        uses: jacexh/action-autotag@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          default_bump: patch

      # ── Step 7: GitHub Release ──
      - if: steps.bump.outputs.bumped == 'true' && steps.autotag.outputs.new_tag != ''
        uses: softprops/action-gh-release@v1
        with:
          tag_name: ${{ steps.autotag.outputs.new_tag }}
          name: ${{ steps.autotag.outputs.new_tag }}
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 正确性根基:Step 2 与 Step 6 的"算 next" 必须等价

P1-Forward 依赖一个等价性:Step 2(workflow 内 inline)与 Step 6(autotag docker)算出的 next version 必须**相同**,否则 commit message 与 tag 不一致。等价性靠以下三点保证:

1. 同一份 `git tag --sort=version:refname | tail -1` 取上一个 tag(autotag.sh:21)
2. 同一份分支前缀映射(autotag.sh 解析 `GITHUB_HEAD_REF`,workflow 也读 `GITHUB_HEAD_REF`)
3. 同一份 awk 增量算法

风险:autotag 上游若改了算法,等价性破裂。缓解:在 workflow 注释中钉死 `jacexh/action-autotag@v1`(不用浮动 tag),并在 spec 与 plan 里登记"action 升级时需重审 Step 2 inline 逻辑"。

## 一次性迁移步骤

以下操作不可逆,必须在 plan 阶段获得用户**逐步显式确认**后,在 hotfix/codex 分支或一次专用清理 PR 中执行:

```bash
# 1. 同步远程 tag 状态
git fetch --tags --prune

# 2. 远程删除 39 个 per-plugin tag
git tag --list '*-v*' | xargs -n1 -I{} git push origin --delete {}

# 3. 远程删除前一次实验留下的全局 tag v1.0.2
git push origin --delete v1.0.2

# 4. 本地清理同样的 tag 引用
git tag --list '*-v*' | xargs git tag -d
git tag -d v1.0.2

# 5. seed 新 baseline tag
git tag v1.12.0
git push origin v1.12.0

# 6. 删除旧 workflow,新增新 workflow
git rm .github/workflows/release.yml
# (auto-release.yml 在同一次提交中加入)

# 7. commit + push 到 hotfix/codex,开 PR 合并到 main
```

PR 合并后:
- autotag 检测到 `hotfix/codex` 分支前缀 → patch
- 上一个 tag = `v1.12.0`,next = `v1.12.1`
- diff `v1.12.0..HEAD` 命中的路径:`.github/workflows/auto-release.yml`(新增)、`.github/workflows/release.yml`(删除)、`docs/superpowers/specs/...`、`docs/superpowers/plans/...`
- **没有** `plugins/*/` 或 `codex-plugins/*/` 路径变化
- ⇒ 第一次自动 release **只 bump #1** metadata.version: `1.11.0 → 1.12.1`,所有 plugin 的 #2/#3/#4 保持原值。开局干净。

## 边界行为速查

| 场景 | 行为 |
|---|---|
| `release/foo` 分支合并 | tag minor++(如 `v1.12.1` → `v1.13.0`)|
| `breaking/foo` 或 `major/foo` 合并 | tag major++(如 `v1.12.1` → `v2.0.0`)|
| 任何其他分支(含 `hotfix/`、`feat/`) | tag patch++ |
| PR 无 plugin 文件改动 | 仅 #1 bump,仍出 tag + Release |
| PR 改 N 个 plugin | 全部 bump 到同一新 tag 数字 |
| PR 同时改 `plugins/foo/` 和 `codex-plugins/foo/` | #2/#3 + #4 都 bump |
| PR 关闭未合并 | `if: merged == true` 拦截,job 不跑 |
| 同名 plugin 仅一侧改动 | 仅那一侧 bump,另一侧版本号保持(R-X 允许版本分叉)|
| Step 5 检测到 `git diff --cached --quiet` | 理论上不可能(#1 总会变);safety net:Step 5 输出 `bumped=false`,Step 6/7 通过 `if` 守卫整体跳过,job 成功但不打 tag、不发 Release |

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| Step 2 与 autotag@v1 算法分歧 | tag 与 commit message 数字不一致 | 钉死 action 版本;升级时 spec 强制重审;两段算法贴近放置便于 diff |
| 第三方误打非 `v*` 形态 tag(如 `release-2026-04`) | autotag 取最新 tag 时可能错位 | 文档约定"未来仅打 `vX.Y.Z` 形态 tag";在 README/CONTRIBUTING 写明 |
| GitHub branch protection 阻止 bot push to main | Step 5 失败 | plan 阶段确认 main 分支保护规则允许 `github-actions[bot]` 直推 chore commit;否则改用 `peter-evans/create-pull-request` 自动开 bump PR(更复杂,延后讨论) |
| autotag@v1 推 tag 失败(权限/冲突) | release 中断 | `permissions: contents: write` 显式声明;runner 重试政策默认即可 |
| PR 合并后立即又有人 push to main(竞态) | Step 5 push 失败(non-fast-forward) | 罕见;失败时人工介入(workflow 失败可见);不引入 retry 复杂度 |
| 清理 39 个旧 tag 触碰他人手中的 git refs | 用户本地 `git fetch --prune` 后旧 ref 消失 | 在 README 加一段 migration note;旧 release artifact 仍可通过 commit hash 访问 |

## 文件清单

### 新增

- `.github/workflows/auto-release.yml`(完整 workflow,如上)

### 删除

- `.github/workflows/release.yml`

### 不动

- 所有 `plugins/`、`codex-plugins/` 内容
- `.claude-plugin/marketplace.json`(只在 release 时被 workflow 改,本次设计不修改其结构)
- `.agents/plugins/marketplace.json`(永不被 workflow 触碰)
- KB(`docs/project-knowledge/`)在合并后由 `superpowers-memory:update` 单独维护

### Git tag 操作(一次性)

- 删除 39 个 `<plugin>-v*` tag(remote + local)
- 删除 `v1.0.2`(remote + local)
- 新增 `v1.12.0` baseline(remote + local)

## 后续工作(超出本 spec 范围)

- README 增加 "Releases" 章节,说明分支前缀 → bump 规则
- CONTRIBUTING(若有)明确"未来仅打 `vX.Y.Z` 形态 tag"
- ADR 是否要为本次决策新增一条(候选 ADR-014:Auto Release Pipeline)——交给 plan 阶段决定
