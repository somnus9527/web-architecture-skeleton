---
name: initialize-spa-project
description: 初始化当前仓库的 Vite React SPA 项目骨架。用户提供 kebab-case 基础项目名并明确配套后端路径或纯前端模式时使用；初始化器自动追加 -web，同步应用身份、前后端关系、base path、版本刷新标识和项目文档。
metadata:
  short-description: 初始化 React SPA 项目身份
---

# SPA 项目初始化

## 适用场景

仅用于从本仓库复制出来、尚未开始业务开发的 React SPA 骨架。用户需要提供一个小写
kebab-case 基础项目名，并明确项目是否有配套后端。项目名不需要包含 `-web`：

```text
帮我初始化这个纯前端项目，项目名称是 supply-chain
```

如果用户提供 `supply-chain-web`，初始化器会规范化为 `supply-chain`，不得生成
`supply-chain-web-web`。

## 执行方式

1. 从用户输入中提取唯一项目名，拒绝空值、路径、斜杠、空格和非 kebab-case 值。
2. 纯前端项目使用 `--no-backend`；已确定配套后端时使用相对于前端根目录的
   `--backend-root <relative-path>`。
3. 先执行 dry-run，确认当前仍是 SPA 骨架且没有部分初始化：

   ```bash
   node .agents/skills/initialize-spa-project/scripts/initialize-spa-project.mjs \
     --dry-run --no-backend <project-id>
   ```

4. dry-run 成功后执行实际模式，不再要求逐项确认派生值：

   ```bash
   node .agents/skills/initialize-spa-project/scripts/initialize-spa-project.mjs \
     --no-backend <project-id>
   ```

5. 初始化完成后运行：

   ```bash
   pnpm typecheck
   pnpm lint
   pnpm mock:check
   pnpm test
   pnpm format:check
   node --env-file=.env.example scripts/run-vite-with-env.mjs .env.prod build --mode prod
   git diff --check
   ```

6. 汇报项目名、派生值、修改文件和验证结果。不要把 API upstream、正式域名、Nginx 主机名
   或密钥伪造为已配置。
7. 配套后端使用 `backend-architecture-skeleton` 中的 `$initialize-backend-project` 初始化。两边必须
   记录互相可解析的相对路径；纯前端项目不需要创建空后端仓库。

## 派生规则

输入为 `<project-id>` 时，统一派生：

```text
应用标题 / package = <project-id>-web
base path          = /<project-id>/
静态目录建议       = /var/www/<project-id>
版本 BroadcastChannel = <project-id>-frontend-version
版本 sessionStorage key = <project-id>:last-refreshed-version
```

## 边界

- 只在 `package.json` 仍为 `spa-app-web`，且环境文件仍使用骨架标题时执行。
- 已经初始化、部分初始化或输入不合法时停止并说明原因。
- 不修改 API base URL、Nginx upstream、server name、真实域名、secret 或业务页面。
- 不猜测配套后端仓库位置；必须通过 `--backend-root` 或 `--no-backend` 显式选择。
- Nginx 示例和通用规则中的 `<project-id>` 等占位表达保持不变。
- 不使用全仓库无差别字符串替换；所有替换由脚本的明确文件清单完成。
