# AGENTS.md

## Always-on

- 本仓库是可复制的 SSR/BFF 项目骨架，不是正式业务应用。
- 本仓库承载前端、共享与 Next 后端规则；Java 后端规则不随前端骨架分发。
- 没有配套 Java 后端仓库的 SSR 项目仍可使用自身 BFF 或外部 API，不需要创建占位后端仓库。
- 初始化时必须选择 `bff-only` 或 `next-backend`；初始化 CLI 未传模式时仅为兼容旧命令回退到
  `bff-only`，正式运行时仍必须显式配置 `BACKEND_MODE`。
- `next-backend` 允许当前 Next 应用承载受控后端能力，但所有 Web 业务仍必须经过 `src/bff/**`，
  数据库和中间件不得穿透 BFF。
- 新应用复制后，必须先完成 `docs/rules/shared/project-naming.md` 的项目变量绑定。
- 未完成项目变量绑定，不得开始业务功能开发或接入真实后端。
- Next.js 16 使用 `src/proxy.ts`；不得新增 `middleware.ts`。
- BFF Route Handler 默认使用 `/<project-id>-api/**`，不得直接占用 `/api/**`。
- 所有 Web 数据流先进入 `bff/routes|actions -> services`；远程能力经 `gateway`，本地
  `next-backend` 能力经 `server/application -> domain -> infrastructure`，结果统一由 `adapter`
  映射为 view model。
- `gateway` 是唯一 HTTP 出站边界，`adapter` 是 DTO 或 application result 到 view model 的唯一映射边界。
- Client Component 不消费 raw DTO，不读取服务端环境变量，不导入 server-only BFF 运行时。
- Server Action 仅放在 `src/bff/actions/`；服务端模块首行使用 `import 'server-only'`。
- interface 使用 `I` 前缀；type alias 使用语义化 PascalCase；状态联合类型使用业务名。
- 所有用户可见文案进入 `src/locale/**`；错误处理必须可观测，不得静默吞错。
- 构建、发布和验证统一使用 pnpm；不得重新引入 `package-lock.json`。
- 当前骨架的 `ssr-app`、`ssr-app-web`、`ssr_app_auth` 和 `/ssr-app-api` 都是待替换占位值。

## Routing

- 用户要求初始化复制后的 SSR 骨架并提供一个 kebab-case 项目名时，使用
  `.agents/skills/initialize-ssr-project/SKILL.md`，并确认 `--backend-mode` 及适用的后端关系参数，
  不要手工进行全仓库替换。
- 用户要求检查或同步上游架构规范时，使用
  `.agents/skills/sync-architecture-rules/SKILL.md`，不得直接合并骨架分支。
- 修改 `src/app`、RSC、Route Handler、metadata、图片或字体前，读取 SSR routing、SEO 和 UI runtime 规范。
- 修改公开页语言前缀、`[locale]` 段、hreflang/canonical 或语言解析链前，读取 `docs/rules/frontend/ssr-i18n.md`
  与 `docs/rules/frontend/seo.md`；公开区路由登记的唯一事实源是
  `src/shared/navigation/public-route-visibility.ts`。
- 修改 BFF、鉴权、cookie、gateway、adapter、service 或 action 前，读取 SSR BFF、security 和 error handling 规范。
- 修改环境变量、构建、standalone、PM2 或 Nginx 前，读取 SSR runtime config、environments and build、deployment 文档。
- 修改 release ID、版本端点或发布后自动刷新前，读取 frontend release refresh 规范。
- 修改 OpenAPI、Prism、DTO 或 mock 前，读取 SSR contracts and mock 规范。
- 修改前后端协作文档、模块契约或交付流程前，读取 `docs/rules/shared/intake-and-delivery.md`、
  `docs/rules/shared/module-documentation.md` 和 `docs/rules/shared/team-collaboration.md`。
- 修改日志、request ID、CSP、CORS 或错误响应前，读取 observability 和 security 规范。
- 新增测试、架构边界、CI 或浏览器验证前，读取 `docs/rules/frontend/ssr-verification.md`。
- 新应用的真实名称、cookie、BFF 前缀、PM2 名和日志目录只能在完成项目变量绑定后写入代码。

## Rule references

- 项目变量：[`docs/rules/shared/project-naming.md`](./docs/rules/shared/project-naming.md)
- 规范来源：`.agents/architecture-source.json`
- 初始化清单：[`docs/initialization/ssr-app-initialization.md`](./docs/initialization/ssr-app-initialization.md)
- SSR 架构：[`docs/rules/frontend/ssr-frontend-architecture.md`](./docs/rules/frontend/ssr-frontend-architecture.md)
- 路由与 RSC：[`docs/rules/frontend/ssr-routing-and-rsc.md`](./docs/rules/frontend/ssr-routing-and-rsc.md)
- BFF 边界：[`docs/rules/frontend/ssr-bff-boundaries.md`](./docs/rules/frontend/ssr-bff-boundaries.md)
- 运行时配置：[`docs/rules/frontend/ssr-runtime-config.md`](./docs/rules/frontend/ssr-runtime-config.md)
- 安全基线：[`docs/rules/frontend/ssr-security-baseline.md`](./docs/rules/frontend/ssr-security-baseline.md)
- 构建环境：[`docs/rules/frontend/environments-and-build.md`](./docs/rules/frontend/environments-and-build.md)
- 发版刷新：[`docs/rules/frontend/frontend-release-refresh.md`](./docs/rules/frontend/frontend-release-refresh.md)
- 部署发布：[`docs/deployment/online-release.md`](./docs/deployment/online-release.md)
- SSR 验证：[`docs/rules/frontend/ssr-verification.md`](./docs/rules/frontend/ssr-verification.md)
- 共享规则：`docs/rules/shared/`
