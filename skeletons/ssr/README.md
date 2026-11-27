# SSR Application Skeleton

这是一个可复制的 Next.js SSR/BFF 项目骨架，不是正式业务应用，也不以任何业务服务作为后续规则来源。

骨架默认提供：

- Next.js 16 App Router、React Server Components、TypeScript strict
- 公开 SSR 页面与 SEO 基础设施
- 可选认证区和登录后工具区
- BFF gateway / service / adapter / route / action 分层
- 固定 BFF-only 模式，不提供 `next-backend` 本地后端能力
- OpenAPI + Prism mock
- 公开区 `app/[locale]` 语言段，非公开区 cookie + refresh
- Ant Design 6 SSR（AntdRegistry）、原生 CSS + CSS 变量
- standalone 构建、PM2 发布包和 Nginx 反向代理说明
- production 发布版本检测与稳定确认后的自动整页刷新
- Vitest、架构边界测试、ESLint、Prettier、Husky 和 commitlint

## 复制后的第一步

复制本仓库作为新应用后，先使用仓库内的初始化 skill，输入一个不带 `-web` 的小写
kebab-case 基础项目名：

```text
$initialize-ssr-project --no-backend supply-chain
```

初始化器会自动追加 `-web`，并同步项目标识、仓库关系、BFF 路由、cookie、PM2、日志和发布刷新标识。
初始化完成后再开始业务开发或接入真实后端；需要偏离默认值时记录到基线 ADR。
已有配套 Java 后端时使用 `--backend-root ../<backend-project>`；没有配套仓库时使用 `--no-backend`。

SSR 骨架固定 BFF-only：Next.js 承担 SSR 与 BFF，但不承担领域、数据库或中间件基础设施。完整规则
激活范围见 [`docs/rules/README.md`](./docs/rules/README.md)。

默认派生关系：

```text
project-snake       = project-id 转 snake_case
package/service/PM2 = <project-id>-web
auth cookie         = <project-snake>_auth
locale cookie       = <project-snake>_locale
BFF prefix          = /<project-id>-api
log directory       = /data/logs/<project-id>-web
```

`ssr-app`、`ssr-app-web`、`ssr_app_auth` 和 `/ssr-app-api` 只是本骨架的占位值，正式应用不得直接沿用。

## 项目绑定

本仓库承载前端与共享规则；Java 后端规则不随前端骨架分发。

- 前端根：当前仓库。
- 后端根与交付文档根：按项目实际路径绑定，没有配套 Java 后端时为 `N/A` 与当前仓库。
- 仓库关系只记录相对路径，不得写个人绝对路径。

## 同步架构规范

正式项目可以从上游 `skeletons/ssr/docs/rules/` 检查并同步最新规范：

```text
$sync-architecture-rules
```

同步器不会合并骨架代码，也不会覆盖项目命名、初始化记录、ADR 或部署文档。

## 本地命令

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm mock:check
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm check:error-codes
pnpm check:licenses
pnpm check:sri
pnpm licenses:notice
pnpm test:a11y   # 真实 Chromium + axe；首次需 pnpm exec playwright install chromium
pnpm check
pnpm build
pnpm build:dist:prod
pnpm start:prod
```

`pnpm dev` 默认同时启动 Prism mock 和 Next.js。环境文件只提交 `.env.example` 与 `.env.mock`；`.env.dev`、`.env.test`、`.env.prod` 由本地或部署平台注入。

`NODE_ENV=development` 不要求 `NEXT_DEPLOYMENT_ID`，也不启动浏览器版本轮询。`next build` 属于
production 构建，构建脚本会优先使用 CI 注入的 `NEXT_DEPLOYMENT_ID`，未注入时自动生成一次
`APP_ENV-Git短SHA-UTC构建时间` 形式的 release ID。

## 目录约定

```text
src/app/        公开区 `[locale]` 路由、布局、RSC、metadata、Route Handler
src/bff/        gateway、service、adapter、route、action 和服务端配置
src/features/   业务 UI 与 Client Component
src/shared/     client-safe UI、配置、logger、hooks、utils、store
src/i18n/       next-intl 请求配置
src/locale/     locale 字典
src/test/       单测与架构边界测试
mock/           OpenAPI/Prism mock 事实源
scripts/        环境加载、release ID 和 standalone 发布包脚本
docs/           规范、初始化、ADR 和部署文档
```

默认数据流：

```text
RSC / Route Handler / Server Action
  -> bff/routes|actions
  -> services
  -> gateway -> backend / Prism
  -> adapter -> view model
```

`gateway` 是唯一 HTTP 出站边界，`adapter` 是 DTO 到 view model 的唯一映射边界，Client Component
不消费 raw DTO。当前仓库不得创建或启用本地 Application、Domain 或 Infrastructure 后端实现。

## 发布基线

```text
目标环境加载 env
  -> 取得或生成一次 release ID
  -> Next production build
  -> .next/standalone + .next/static + public
  -> dist/ 发布包
  -> deploy.sh 激活 PM2 standalone server
  -> Nginx / CDN / WAF
```

线上安装和构建统一使用 pnpm：

```bash
pnpm install --frozen-lockfile
pnpm build:dist:prod
cd dist
bash deploy.sh
```

详见 [`docs/deployment/online-release.md`](./docs/deployment/online-release.md)。

`deploy.sh` 默认派生 PM2 应用名 `<project-id>-web`，并在启动前创建
`/data/logs/<project-id>-web`。可通过 `PM2_APP_NAME`、`PM2_LOG_DIRECTORY` 覆盖；脚本不执行
Nginx 操作，也不固定服务器发布目录。

发布后的旧标签页通过 `/<project-id>-api/version` 检查稳定的新 release ID，完成二次确认后使用整页
reload 获取同一版本的 HTML、RSC、JS 和 CSS。development 模式不挂载该观察器。

## 图片域名配置

为了让骨架复制后可以直接运行，`next.config.ts` 默认允许宽泛的远程图片 hostname。正式应用必须尽快替换为明确的图片域名和路径白名单。

不配置白名单可能导致：

- 任意外部图片源被应用代理或优化
- SSR、带宽和缓存成本不可控
- SSRF 和恶意远程资源风险扩大
- CSP、CDN 和图片缓存策略难以收敛
- 受限环境中远程图片无法渲染

这是模板默认值，不代表生产安全配置已经完成。

## 规范入口

- 协作入口：[`AGENTS.md`](./AGENTS.md)
- 项目变量：[`docs/rules/shared/project-naming.md`](./docs/rules/shared/project-naming.md)
- SSR 初始化：[`docs/initialization/ssr-app-initialization.md`](./docs/initialization/ssr-app-initialization.md)
- SSR 规则：[`docs/rules/frontend/ssr-frontend-architecture.md`](./docs/rules/frontend/ssr-frontend-architecture.md)
- 共享规则：[`docs/rules/shared/`](./docs/rules/shared/)
- 部署发布：[`docs/deployment/online-release.md`](./docs/deployment/online-release.md)
- 基线 ADR：[`docs/decisions/adr-000-ssr-project-baseline.md`](./docs/decisions/adr-000-ssr-project-baseline.md)
