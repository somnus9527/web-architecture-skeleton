# SSR Frontend Architecture Rules

## Scope

本规则用于基于 `product-to-dev-skill` 生成或改造 SSR / Next.js App Router 前端项目。它不替代既有项目规范；当目标项目已有更严格的目录、BFF、契约或测试门禁时，按目标项目执行。

## Required Reading

- 改 `src/app`、RSC、Client Component、Route Handler、Server Action、metadata、image/font/script 前，读 `ssr-routing-and-rsc.md`。
- 改 MUI SSR、Emotion/cache provider、ThemeProvider、CSS layer、Tailwind 共存、暗色模式防闪烁或 MUI client leaf 边界前，读 `ssr-ui-runtime.md`。
- 改 BFF、鉴权上下文、gateway、adapter、service、route facade 或 Server Action 编排前，读 `ssr-bff-boundaries.md`。
- 改 OpenAPI、Prism mock、DTO、endpoint id、response wrapper、API 文档或 backend gap 前，读 `ssr-contracts-and-mock.md`。
- 改缓存、revalidation、服务端数据流、性能、bundle 或 RSC 序列化前，读 `ssr-cache-and-performance.md`。
- 改 request id、日志、trace、Web Vitals、客户端错误、审计事件或敏感字段脱敏前，读 `ssr-observability-and-logging.md`。
- 改 security headers、cookies、CSRF、CORS、输入校验、上传下载、redirect、XSS 防线或私有数据缓存前，读 `ssr-security-baseline.md`。
- 改环境变量、public/server config、secret 注入、feature flag、base URL、PM2 env 或配置校验前，读 `ssr-runtime-config.md`。
- 改 next-intl、语言切换、locale 上下文、metadata 文案、BFF locale header 或 locale cache key 前，读 `ssr-i18n.md`。
- 改 monorepo、workspace、`apps/*`、`packages/*`、共享 DTO/tools/UI、跨 app package 依赖或 pnpm catalog 前，读 `monorepo-workspace.md`。
- 新建 SSR 项目、改质量工具链(lint/format/typecheck/commit hooks/脚本/alias/边界扫描)前读 `quality-tooling.md`；新增手写 TS/TSX/JS、Route Handler、Server Action、BFF gateway/service/adapter、组件或类型前按项目 AGENTS 读取 TypeScript 与 comment 规则,SSR lane 不豁免通用注释和命名规则。
- 交付前，读 `ssr-verification.md`。

## Architecture Baseline

- SSR 项目默认采用 Next.js App Router、React Server Components、TypeScript、BFF gateway、OpenAPI/Prism mock 和分环境配置；本骨架固定 BFF-only，不提供 `next-backend` 模式。
- 本规则只定义 SSR / BFF 架构边界；monorepo、workspace 或跨应用包治理由 `monorepo-workspace.md` 决定。
- SSR 项目必须保持 `src/app`、`src/bff`、`src/features`、`src/shared`、`mock` 的职责边界；目标项目已有更强目录约定时按目标项目执行。
- C 端公开内容、商品详情、分类列表、可分享页面和 SEO 关键页面优先评估 SSR；B 端运营、相关方、管理、企业内网等登录后工具默认优先评估 SPA，除非存在明确 SSR 收益。
- `src/app` 只负责路由、布局、服务端渲染入口、metadata、error/loading/not-found 和 API 边界入口。
- `src/bff` 是 SSR 应用访问远程后端或 Prism 的唯一服务端业务边界；HTTP 请求必须经 gateway，数据库/中间件不得穿透 BFF。
- `src/features` 负责业务 UI 和客户端交互；不直接拼后端 URL，不导入 server-only BFF gateway，不消费后端 raw DTO。
- `src/shared` 只放浏览器安全且跨业务复用的 UI、hooks、工具和常量；BFF-only helper 放 `src/bff/shared`。
- SSR 新项目仍采用 MUI-first，但 MUI 在 SSR 项目中定位为 SSR-compatible Client Component 交互体系，不作为 Server Component primitive；服务端数据、metadata、缓存和鉴权仍归 `src/app` / `src/bff`。
- 使用 MUI 的 Next.js App Router 项目必须接入与 Next 主版本匹配的 `@mui/material-nextjs/*-appRouter` cache provider，统一挂载 MUI `ThemeProvider`，并声明 Emotion/CSS 注入、防首屏样式闪烁和 Tailwind CSS layer 策略。
- SSR app 根目录下的 `mock/openapi.yaml` 是 mock runtime 的事实来源；SSR 服务端数据也必须能经 Prism/OpenAPI 运行。
- SSR/BFF 项目默认使用 `next-intl` 管理语言上下文；公开内容区使用 `app/[locale]`（ADR-000），非公开区使用 cookie + refresh，不新增语言前缀，详见 [`./ssr-i18n.md`](./ssr-i18n.md)。
- Draft / Preview / CMS 预览态暂不纳入当前 SSR 通用基线；需要时单独设计。

以下横切关注点在本文只作架构入口声明，规则正文以对应 canonical 文件为准：统一 logger / 生产 console 清除 / PM2 JSON line / Web Vitals / 客户端错误见 [`./ssr-observability-and-logging.md`](./ssr-observability-and-logging.md)；安全基线(headers/cookie/CSRF/CORS/校验/redirect/上传下载/私有缓存/source map)见 [`./ssr-security-baseline.md`](./ssr-security-baseline.md)；运行时配置(server secret/runtime/public/build-time/request context/校验)见 [`./ssr-runtime-config.md`](./ssr-runtime-config.md)；quality tooling 见 [`./quality-tooling.md`](./quality-tooling.md)；中文注释见 [`../shared/comments.md`](../shared/comments.md)；`I` 前缀 interface、PascalCase type、import alias 边界见 [`../shared/typescript.md`](../shared/typescript.md)。

## Non-Negotiable Boundaries

- Client Component 不能是 async component，不能导入 server-only 模块，不能读取服务端环境变量。
- Server Component 传给 Client Component 的 props 必须可序列化，并且只传 UI 实际需要的字段。
- Route Handler 只允许作为 BFF HTTP 入口、webhook、健康检查、外部 REST 或受控 legacy 兜底；不得直接操作 DB/Redis/MQ/后台任务。
- Server Action 只用于 Next UI 内部 mutation；公开 HTTP 契约、第三方回调和外部系统访问必须使用 Route Handler。
- BFF service、action、route facade 和 adapter 不得直接拼后端 base URL；远程请求只由 gateway 发起。
- 后端 DTO、Java envelope、Prism example、数据库字段不得直接泄漏到页面组件或 Client Component。
- 目录按**归属**(层职责 / 业务域)组织,不靠文件扩展名或文件名前缀区分用途;尤其 `src/bff` 不得用业务子文件夹 + 文件名后缀(如 `bff/user/user-auth-gateway.ts`)替代 canonical 层目录,层边界以 [`./ssr-bff-boundaries.md`](./ssr-bff-boundaries.md) 的 "Forbidden BFF Layouts" 为准。
- `backend-gap` 只能作为契约缺口说明；mock 默认响应不得用缺口或 501 替代业务验收数据。

## Default Data Path

> 默认数据链路先进入 `src/bff/routes|actions => services`，再经 `gateway` 访问远程后端或 Prism，
> 结果统一经 `adapter` 映射为 view model。gateway 独占 HTTP 出站、adapter 独占模型映射、UI 不消费
> raw DTO 三条边界以 [`./ssr-bff-boundaries.md`](./ssr-bff-boundaries.md) 为准；小型项目可合并
> `routes` 与 `services`，但上述边界不可放弃。

## Delivery Gates

- 每个 SSR 数据能力必须能追溯到 endpoint id、OpenAPI operationId、DTO、BFF adapter、mock example、API 文档和错误码。
- 每个登录态或权限态页面必须声明动态渲染、`no-store` 或等价缓存隔离策略；每个公开页面必须声明 metadata 来源、canonical/OG 策略和图片/font/script 处理方式。
- 每个使用 MUI 的 SSR 项目必须声明 MUI provider 入口、`@mui/material-nextjs` 版本路径、CSS layer / Tailwind 共存策略、ThemeProvider 位置和 bundle 优化策略。
- 示例、模板、脚手架片段统一放 `assets/ssr/` 下，不直接塞入 reference；主入口按 SPA/SSR route 分流后再统一整理可复用资产。
- 每次交付必须运行窄验证；共享路由、BFF、契约或缓存变化必须增加边界测试或 mock smoke。
  > 各横切关注点(observability/security/config/i18n schema、quality tooling 状态、注释与 TS 命名自检)的逐项交付门以 [`./ssr-verification.md`](./ssr-verification.md) 为准。
