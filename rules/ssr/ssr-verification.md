# SSR Verification

## Minimum Checks

- 跑项目最窄 `typecheck` / `lint`(或边界静态扫描) / `format:check`(或对触达文件 Prettier) / 生产 `next build` / OpenAPI Prism contract check 或 mock smoke；新项目由 `check` 聚合 lint、typecheck、format。
- 确认以下项已在 handoff 中声明(或记录缺口):quality tooling 接入(见 quality-tooling.md)、Next 主版本/`middleware.ts`-`proxy.ts`/runtime/部署模式、TypeScript 命名与注释自检(见项目 AGENTS)。
- 开发调试先确认真实 dev server 端口；Next 16+ 可用 `/_next/mcp` 获取 routes/errors/logs，`next build --debug-build-paths` 缩小验证范围。

## Boundary Tests (compact)

每项是一条边界检查；规则全文见各自 canonical 文件,本表不复述:

- [ ] Server Action 仅在 `src/bff/actions`(平铺、可 grep 穷举) / gateway 唯一出站 / Route Handler 不绕过 route facade 直调 service / Route Handler 不导入 DB/Redis/MQ/旧 server lib — 见 [`./ssr-bff-boundaries.md`](./ssr-bff-boundaries.md)。
- [ ] 三层鉴权链:`<project-snake>_auth` cookie => Bearer + `X-User-*`，后端不见 raw cookie；server secret 不用 `NEXT_PUBLIC_*`，Client/ client-safe shared 不读 server env — 见 [`./ssr-bff-boundaries.md`](./ssr-bff-boundaries.md)、[`./ssr-runtime-config.md`](./ssr-runtime-config.md)。
- [ ] 分区语言路由:公开区 `app/[locale]/**` 存在且导出 `generateStaticParams()`(不得依赖 `dynamicParams` 拦未登记语言前缀:动态路由下它不生效,含点路径会 200),每个公开页渲染入口调用 `assertPublicLocaleSegment()` 兜 proxy matcher 看不见的含点路径(`/wp-login.php`、`/fr.js`、`/xx.png`),`src/proxy.ts` 把非法前缀拒绝为路由层 404 且只放行 `_next` 内部段(`/_foo` 必须 404),非公开区(`(auth)`/`(app)`/`<project-id>-api`)不含语言段;根路径 308 到默认公开语言 URL;非法前缀在路由层被拒并返回 404;`next.config.ts` **不得**开 `experimental.globalNotFound`(开它在构建期摘掉 `/_not-found` 的根 layout)、`src/app/global-not-found.tsx` 不得存在,路由层 404 由根级 `src/app/not-found.tsx` 承运(套在根 layout 内,服务端直出、带 `lang` 与应用样式,`<html lang>` 按 URL 前缀 → cookie → 浏览器 header → `en-US`)、公开段内主动抛出的 `notFound()` 由 `[locale]/not-found.tsx` 承运(文档为 Next 内置错误壳,仅 proxy matcher 看不见的含点路径会走到,已知取舍);**不得**靠加 `Suspense` 边界(如 `[locale]/loading.tsx`)或 `[locale]/[...rest]` catch-all 去「修」那份错误壳——前者把 404 变成 **200** 软 404,后者会吃掉 proxy 哨兵路径并让 `/fr` 也掉进错误壳;公开页 canonical/hreflang 与 sitemap alternates 互指、社交卡片整套启用或整套退出(启用档的 `/zh-CN`、`/en-US` 必须有 `og:image`,「有 `twitter:card` 无图」即半成品回归) — 见 [`./ssr-i18n.md`](./ssr-i18n.md)、[`./seo.md`](./seo.md)。
- [ ] adapter 纯映射:不发请求、不读 cookies/headers、不触发 revalidation — 见 [`./ssr-bff-boundaries.md`](./ssr-bff-boundaries.md)。
- [ ] config accessor:gateway base URL、Prism URL、backend URL 只来自 config accessor，生产不指向 localhost/mock/debug 域名 — 见 [`./ssr-runtime-config.md`](./ssr-runtime-config.md)。
- [ ] mock runtime 用 Prism/OpenAPI,不返回 hardcoded service fallback;backend gap 不成为默认成功或默认 501 — 见 [`./ssr-contracts-and-mock.md`](./ssr-contracts-and-mock.md)。
- [ ] 统一 logger 落点 + request id 透传 + 脱敏 + 生产 client console 清除 + PM2 日志策略 — 见 [`./ssr-observability-and-logging.md`](./ssr-observability-and-logging.md)。
- [ ] RSC 边界:Client Component 不声明 async;Server -> Client props 可序列化且字段最小;Server Component 不 `fetch('/<project-id>-api/...')` 自调;`useSearchParams()`/动态路由 `usePathname()` 被 `Suspense` 包裹(或有版本/`generateStaticParams` 例外) — 见 [`./ssr-routing-and-rsc.md`](./ssr-routing-and-rsc.md)。
- [ ] 导航异常:Server Action / Route Handler catch 不吞 `redirect()`/`notFound()`/`unauthorized()`/`forbidden()` — 见 [`./ssr-routing-and-rsc.md`](./ssr-routing-and-rsc.md)。
- [ ] 错误/状态页:`error.tsx`/`global-error.tsx` 是 Client Component,`global-error.tsx` 含 `<html>`/`<body>`;使用 `unauthorized()` / `forbidden()` 的项目必须提供 `unauthorized.tsx` / `forbidden.tsx` — 见 [`./ssr-routing-and-rsc.md`](./ssr-routing-and-rsc.md)。
- [ ] parallel route 每个 `@slot` 有 `default.tsx`;intercepting modal 关闭用 `router.back()`;route matcher 层级有说明 — 见 [`./ssr-routing-and-rsc.md`](./ssr-routing-and-rsc.md)。
- [ ] antd runtime:`@ant-design/nextjs-registry` + `AntdRegistry`,antd-heavy UI 在叶子 Client Component,原生 CSS/CSS 变量,无暗色模式 hydration mismatch,大型 UI/icon 包按需导入 — 见 [`./ssr-ui-runtime.md`](./ssr-ui-runtime.md)。
- [ ] import 边界:跨目录用 alias,同目录才 `./`,不 `../../../` 绕过 `src/app`/`src/bff`/`src/features`/`src/shared`;`src/shared/**` 不依赖 `src/app/**`/`src/bff/**`/feature — 见 [`./ssr-frontend-architecture.md`](./ssr-frontend-architecture.md)。
- [ ] 通用 Web 安全(runtime validation、cookie 安全属性、CSRF/签名、CORS allowlist、redirect allowlist、token 不外泄)按 OWASP/行业标准,项目专属点见 [`./ssr-security-baseline.md`](./ssr-security-baseline.md)。
- [ ] 运行资产(`next/image` sizes/remotePatterns、`next/font` 单点初始化、`next/script` id、本地 CSS 走构建、无冗余 polyfill)按 Next 文档执行。

## Contract Tests

- 每个 implemented endpoint 有 OpenAPI path、operationId、schema、example 和 DTO；每个 frontend/BFF method 能映射到 endpoint id。
- response wrapper 缺失、业务 code 失败、HTTP non-2xx、malformed JSON 和 timeout 都有稳定错误。
- 鉴权失败、权限不足、校验失败、业务失败至少各有一个 example 或测试覆盖。
- API 文档中 implemented/planned/backend-gap/mock-unavailable 状态与 OpenAPI 和前端调用一致。

## Runtime Smoke

- 公开 SSR 页面返回非空 HTML 且含关键业务内容或 skeleton；登录态页面无会话时返回登录/401/redirect 且不泄漏用户数据；权限不足返回 403/forbidden 且资源 id 校验归属。
- 私有数据响应含 no-store 或等价 cache header；公开缓存不命中用户态/租户态/权限态数据。
- 非公开页语言切换后 URL path 不变化；当前页面相关 BFF/客户端 GET 按新 locale 刷新；切换期间有 pending/loading 防重复。
- 公开页语言切换是换语言 URL 且显示语言随 URL 变化；根路径 308 保留 query 且不随 cookie/`Accept-Language` 改变目标；带其它语言 cookie 访问 `/zh-CN` 仍出中文。
- 公开区 404 矩阵逐条实测（curl 状态码 + `<html lang>`）：非法前缀（`/fr`、`/de/docs/x`）与「合法前缀 + 未登记路径」（`/en-US/whatever`、`/zh-CN/login`）必须是 404 且文档自带 `lang`；含点路径（`/wp-login.php`、`/fr.js`、`/xx.png`）与 `_` 前缀路径（`/_foo`、`/__foo`）必须是 404——**任何一条返回 200 + 首页都是软 404 回归**（含点路径的文档是 Next 内置错误壳，允许，但状态码必须 404 且带 `noindex`）；同时确认 `/en-US`、`/zh-CN` 仍 200 且 canonical/hreflang 自指。
- 配置校验失败能 fail fast；本地缺失 required env 有明确错误，生产不静默 fallback 到 mock。
- 关键 Route Handler 在 mock 模式下返回稳定 wrapper、status、headers 和 request id；mutation 成功后触发正确 revalidation 或客户端刷新；webhook/外部入口验证签名或来源，缺失时拒绝。
- 至少一个成功请求、一个上游失败和一个可降级失败能在日志中用 request id 串联入口、gateway、异常或降级事件；接口日志含时间、request id、用户 id、cookie 摘要、接口地址、入参/出参摘要、状态、耗时，且生产敏感字段已脱敏。
- PM2 生产部署能说明 stdout/stderr、out/error 文件、实例标识、日志轮转和日志平台采集；自托管/多实例时 ISR/tag cache 的共享 cache handler、禁用策略或一致性风险已验证。

## Browser And Screenshot Checks

- 涉及 UI、响应式、metadata、图片、首屏、复杂交互或 hydration 风险时，用 Playwright/e2e 或截图验证 desktop 和 mobile 两类视口。
- 检查 console error、network failure、hydration warning、layout shift、加载/空态/错误态；内容详情页检查 title/description/canonical/OG/主要图片;Suspense fallback 不造成明显 layout shift,hydration 后不重复请求首屏关键数据。
- antd 页面检查首屏无样式闪烁、CSS 变量作用域、暗色模式闪烁和 icon/chunk 体积；浏览器检查 security headers、CSP 报错、mixed content、source map 暴露、第三方脚本和跨站 cookie 行为。
- metadata、错误页、空态、mock 文案、BFF locale header 和 cache tag/key 使用当前 locale。

## Handoff Requirements

交付说明必须包含:

- 变更的路由、BFF、契约、mock、缓存和验证范围。
- 每类页面的 rendering/cache 策略：static、ISR、dynamic、no-store、tag/path revalidation。
- Next 主版本、`middleware.ts`/`proxy.ts`、Node/Edge runtime、standalone/self-hosting 和多实例缓存策略。
- Next 特殊文件使用情况：`template.tsx`、parallel `default.tsx`、route group、intercepting route、metadata files、sitemap/robots/manifest。
- next/image、next/font、next/script、next/link、bundle analyzer、serverExternalPackages/transpilePackages 的采用或不适用原因。
- antd SSR 说明：`@ant-design/nextjs-registry` 版本、`AntdRegistry`、`ConfigProvider`、CSS 变量、暗色模式防闪烁、client leaf 边界和兼容例外。
- security headers 来源、cookie/CSRF/CORS/input validation/redirect/upload/source map/private cache 策略和例外。
- runtime config key 清单、敏感级别、server/client public 分界、required env、secret 注入、base URL、feature flag、PM2 env 和校验方式。
- i18n 策略：next-intl 接入点、locale 来源、无 locale route、语言切换刷新范围、loading 状态、BFF locale 透传、cache locale 隔离、多语言 SEO 风险。
- logger 落点、local/prod 与 client/server 行为、request id 生成/透传、普通日志/接口日志 schema、上游调用摘要、降级/异常日志、敏感字段脱敏、生产 client console 清除、PM2 日志策略、Web Vitals/客户端错误接入状态。
- quality tooling 状态：ESLint、Prettier、EditorConfig、Commitlint、Husky/lint-staged、pnpm/package manager、`check` 脚本、alias 配置和边界扫描已接入或兼容缺口。
- comment 与 TypeScript 命名自检结果：手写 TS/TSX/JS 注释、DTO 字段说明、TSX 关键结构注释、复杂分支注释、`I` interface 和语义化 PascalCase type alias 是否满足项目规则。
- 已接入 Prism 的 endpoint 和仍存在的 backend gap。
- 已运行命令及结果；未能运行的命令要说明具体原因。
- 残余风险，例如未覆盖的浏览器检查、后端未实现、mock 与真实服务差异、项目级 lint 噪音。
