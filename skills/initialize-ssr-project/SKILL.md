---
name: initialize-ssr-project
description: 初始化当前仓库的 Next.js SSR/BFF 项目骨架（固定 BFF-only）。用户提供 kebab-case 基础项目名并确认配套 Java 后端路径或纯 BFF 模式时使用；初始化器同步项目标识、后端关系、能力绑定、BFF 路由、cookie、PM2、日志和发布刷新标识。
metadata:
  short-description: 初始化 SSR/BFF 项目身份
---

# SSR 项目初始化

## 适用场景

仅用于从本仓库复制出来、尚未开始业务开发的 SSR/BFF 骨架。用户需要提供一个小写
kebab-case 基础项目名，并确认配套 Java 后端关系。项目名不需要包含 `-web`：

```text
帮我初始化 SSR 项目，项目名称是 supply-chain，没有配套 Java 后端仓库
```

如果用户提供 `supply-chain-web`，先规范化为 `supply-chain`，不得生成
`supply-chain-web-web`。

SSR 骨架固定 BFF-only：Next.js 只承担 Web、SSR 和 BFF，不承担领域、数据库或中间件基础设施。
初始化器只接受 `--backend-root` 或 `--no-backend`，不提供其他后端模式开关。

## 执行方式

1. 从用户输入中提取唯一项目名，拒绝空值、路径、斜杠、空格和非 kebab-case 值。
2. 确认配套 Java 后端关系，二选一：
   - 没有配套、由本项目维护的 Java 后端仓库时使用 `--no-backend`。
   - 已确定配套 Java 后端仓库时使用 `--backend-root <relative-path>`。
3. 先执行 dry-run，确认当前仍是 SSR 骨架且没有部分初始化或目标路径冲突：

   ```bash
     node .agents/skills/initialize-ssr-project/scripts/initialize-ssr-project.mjs \
     --dry-run --no-backend <project-id>
   ```

4. dry-run 成功后立即执行实际模式，不再要求用户逐项确认派生值：

   ```bash
     node .agents/skills/initialize-ssr-project/scripts/initialize-ssr-project.mjs \
     --no-backend <project-id>
   ```

   已有配套 Java 后端时把 `--no-backend` 换成 `--backend-root <relative-path>`。

5. 初始化完成后运行：

   ```bash
   pnpm check
   pnpm mock:check
   pnpm test
   git diff --check
   ```

6. 汇报实际项目名、配套后端关系、能力矩阵、派生值、修改文件和验证结果。不要把数据库、ORM、
   后端地址、正式域名、密钥或图片白名单伪造为已完成配置。

## 派生规则

输入为 `<project-id>` 时，统一派生：

```text
应用名 / package / service / PM2 = <project-id>-web
project snake_case               = <project-id> 转 snake_case
认证 cookie                      = <project-snake>_auth
locale cookie                    = <project-snake>_locale
BFF 前缀                         = /<project-id>-api
后端仓库                          = <backend-root> | N/A
交付文档根                        = <backend-root> | .
日志目录                         = /data/logs/<project-id>-web
版本 BroadcastChannel            = <project-id>-frontend-version
版本 sessionStorage key          = <project-id>:last-refreshed-version
```

## 边界

- 只在 `package.json` 仍为 `ssr-app-web` 且 `src/app/ssr-app-api/` 仍存在时执行。
- 已经初始化、部分初始化、目标 BFF 路由目录已存在或输入不合法时停止并说明原因。
- 不按目录名猜测配套 Java 后端仓库位置；必须通过 `--backend-root` 或 `--no-backend` 显式选择。
- BFF-only 不是纯浏览器模式；允许 RSC、Route Handler、Server Action 和 BFF HTTP gateway，但
  禁止当前仓库拥有 Application、Domain、数据库或中间件基础设施。
- 不修改真实后端配置、secret、Nginx 规则以外的运维策略，也不删除业务文件。
- `docs/rules/frontend/**` 等通用规范保持占位和泛化表达；项目绑定、README、初始化、部署
  文档和运行时代码中的项目身份由脚本同步替换。
- 不使用全仓库无差别字符串替换；所有实际替换由脚本的受控文件扫描完成。
