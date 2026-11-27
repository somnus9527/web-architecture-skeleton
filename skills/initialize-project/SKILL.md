---
name: initialize-project
description: 前端应用初始化技能：按 SPA / SSR / RN / monorepo 从骨架仓库生成新项目。用户要新建前端项目、脚手架、初始化骨架、创建 monorepo 或子应用时使用。
metadata:
  short-description: 从骨架仓库生成前端项目
---

# 前端应用初始化

## 适用场景

用户要从零创建一个前端项目（SPA / SSR / RN / monorepo），或要在新目录里落地本骨架。

## 交互流程

### 1. 亮身份并分叉

第一句必须先说明：

> 这是前端应用初始化技能，支持 SPA、SSR、RN 和 monorepo。先确认：你要单个应用，还是 monorepo？

不要让用户回答“是否 monorepo”，直接二选一。

### 2. 单应用

依次问（能合并成一条消息就合并）：

1. 类型：SPA / SSR / RN
2. 应用名：kebab-case（如 `supply-chain`）
3. 目标目录：默认 `./<应用名>`，允许绝对路径

**不问后端关系**：单应用一律按纯前端初始化（`--no-backend`）。后端绑定是初始化之后的独立动作。

### 3. monorepo

1. 编排名（kebab-case）与目标目录（默认 `./<编排名>`）
2. **子应用数量**：1–6。只放 1 个时提示“建议直接用单应用模式”
3. 给出结构化填写模板，必须带示例：

   ```text
   请按「类型:名称」每行一个填写，共 3 个：

   spa:web
   ssr:site
   rn:mobile

   类型可选 spa / ssr / rn；名称 kebab-case 且不能重复。
   共享包不用填：模板固定带 packages/types、packages/tools、packages/ui。
   ```

4. 校验：数量一致、类型合法、名称唯一且 kebab-case；不合法就让用户重填。

共享包固定三件套，不提供增删；额外共享包等出现第二个使用方后再拆。

### 4. 最终确认（必须做）

用一张清单复述，等用户明确确认后再执行：

```text
类型    <spa|ssr|rn|monorepo>
名称    <name>
目录    <绝对路径>
来源    <repo> @ <最新 tag>（执行时解析 commit）
子应用  <仅 monorepo：spa:web → apps/web …>
会做    复制骨架 → 身份绑定 → git init → pnpm install → 全量检查
不会    不建远端仓库、不配域名/Nginx、不写任何密钥、不绑定后端
```

## 执行方式

1. 取最新 tag（用户未指定时）：

   ```bash
   git ls-remote --tags --refs <repo> | sed 's#.*refs/tags/##' | grep -E '^v?[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1
   ```

2. clone 到临时目录（浅克隆）：

   ```bash
   git clone --depth 1 --branch <tag> <repo> <tmp>
   ```

3. 运行脚手架，把 tag 与仓库作为来源记录：

   ```bash
   node <tmp>/tools/scaffold.mjs \
     --type <type> --name <name> --target <target> \
     --source <tmp> --repo <repo> --ref <tag> \
     [--apps spa:web,ssr:site]
   ```

4. 脚手架负责：复制、身份绑定、`git init`、`pnpm install`、`pnpm quality:check`。
   - 退出码 0：初始化与检查都通过。
   - 退出码 2：初始化成功，但全量检查未通过；按输出修复后重跑 `pnpm quality:check`。
   - 其他退出码：初始化失败；目标目录不会被留下半成品，临时目录已清理。

5. 汇报：类型、名称、目录、tag 与 commit、检查结果；失败时给出具体失败命令。

## 边界

- 默认纯前端；不创建远端仓库、不配域名、不写密钥。
- 只支持从带 tag 的骨架仓库初始化；仓库没有 tag 时明确失败，不回退 main。
- 目标目录必须不存在或为空；非空直接拒绝。
- 离线或本地调试时，把 `--source` 直接指向本地骨架仓库，可省略 clone 步骤。

## 参考

- [SPA](./references/spa.md)
- [SSR](./references/ssr.md)
- [RN](./references/rn.md)
- [monorepo](./references/monorepo.md)
