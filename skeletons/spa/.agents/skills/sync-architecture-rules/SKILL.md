---
name: sync-architecture-rules
description: 检查并同步当前项目对应 SPA、SSR 或 RN 骨架分支中的最新架构规范。用户要求检查、拉取或更新上游 docs/rules 文档时使用；不会合并骨架代码或覆盖项目命名、ADR 和部署文档。
metadata:
  short-description: 同步上游架构规范
---

# 架构规范同步

## 适用场景

用于从当前项目记录的骨架仓库和架构分支同步最新 `docs/rules/**` 规范，例如：

```text
$sync-architecture-rules
```

也可以直接使用自然语言：

```text
帮我同步当前项目对应架构的最新规范
```

## 执行方式

1. 读取 `.agents/architecture-source.json` 和 `.agents/architecture-rules-lock.json`，不得根据
   当前业务仓库的 `origin` 猜测规范来源。
2. 先执行只读检查：

   ```bash
   node .agents/skills/sync-architecture-rules/scripts/sync-architecture-rules.mjs --check
   ```

3. 用户明确要求拉取、同步或更新，且检查没有冲突时执行：

   ```bash
   node .agents/skills/sync-architecture-rules/scripts/sync-architecture-rules.mjs --apply
   ```

4. 同步后执行：

   ```bash
   pnpm exec prettier --check docs/rules .agents/architecture-source.json .agents/architecture-rules-lock.json
   git diff --check
   ```

5. 汇报来源分支、同步前后的 commit、文件变化、本地修改和冲突。规范更新不代表业务代码
   已经自动符合新规范，不得顺带修改业务代码。

## 同步边界

- 只同步上游分支中的 `docs/rules/**/*.md`。
- 不同步 `docs/rules/shared/project-naming.md`。
- 不同步 README、AGENTS、`.agents/**`、初始化文档、ADR、部署文档、代码、配置或脚本。
- 不执行 `git pull`、`git merge`、`git checkout` 或上游仓库中的任何脚本。
- 本地文件相对上次同步基线有修改，且上游也修改或删除同一文件时，停止应用并报告冲突。
- 上游新增文件与本地同名文件内容不一致时，停止应用并报告冲突。
- 不通过全仓库复制或字符串替换同步规范。
