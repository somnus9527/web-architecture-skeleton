---
name: sync-architecture-rules
description: 把上游骨架仓库的最新架构规则同步到当前项目。用户要求检查、拉取或更新 docs/rules 规范时使用；不改项目代码、不合并骨架分支。
metadata:
  short-description: 同步上游架构规则
---

# 同步架构规则

## 适用场景

当前项目由骨架仓库初始化而来，需要检查或拉取上游 `docs/rules/` 的最新规则。

## 前置

项目根目录必须有 `.agents/architecture-source.json`，至少包含：

```json
{ "schemaVersion": 2, "variant": "spa", "repository": "<repo>", "ref": "v1.0.0", "commit": "<sha>" }
```

缺少该文件时**停止**，要求用户显式提供 `--repo` 与 `--ref`，不要猜测上游。

## 执行方式

1. 读取来源配置，确认 `repository` 与 `ref` 合法（tag 优先，不接受分支名）。

2. 浅克隆对应 ref 到临时目录：

   ```bash
   git clone --depth 1 --branch <ref> <repository> <tmp>
   ```

3. 先检查差异（默认只读）：

   ```bash
   node <tmp>/tools/sync-rules.mjs --root <project> --check
   ```

4. 把差异摘要给用户确认；确认后再写入：

   ```bash
   node <tmp>/tools/sync-rules.mjs --root <project> --apply
   ```

5. 写入后重跑一次 `--check`，确认无残留差异；汇报新增/更新/删除的规则文件数与 lock 变化。

## 边界

- 只同步 `docs/rules/` 与 `.agents/architecture-rules-lock.json`。
- 不合并骨架分支、不覆盖项目命名、ADR、部署文档与 `.agents/architecture-source.json`。
- 冲突不自动解决：保留项目侧内容并逐条报告。
- 项目侧主动改过的规则文件不静默覆盖，按脚本输出的冲突列表由用户决定。
