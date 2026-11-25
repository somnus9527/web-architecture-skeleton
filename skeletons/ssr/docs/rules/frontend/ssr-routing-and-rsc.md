# SSR Routing And RSC

## Generic RSC And Routing

> 通用 RSC 模型(server-by-default、template vs layout、parallel/intercepting routes、async request API 写法)按 Next.js 文档执行,本文只列项目专属决策。

## App Router Ownership

- `src/app` 只拥有路由段、layout、page、loading、error、global-error、not-found、forbidden、unauthorized、metadata、Route Handler、Server Action 入口和 provider 装配。
- 业务 UI 放 `src/features/<module>`；跨业务前端安全能力放 `src/shared`；服务端 BFF 能力放 `src/bff`。private folder 用 `_folder` 表示不参与路由，只放 segment 内部私有 UI/helper，不替代 `src/features` / `src/shared` 边界。
- 不在同一路由目录同时放 `page.tsx` 和 `route.ts`。需要页面和请求处理同名能力时，页面留业务路径，Next BFF Route Handler 放 `src/app/<project-id>-api/**`，对外 URL 前缀为 `/<project-id>-api/**`。
- 路由组、parallel routes、intercepting routes 只在真实产品交互需要时使用；parallel route 每个 `@slot` 必须提供 `default.tsx`；intercepting route 关闭 modal 默认用 `router.back()`，route matcher 按 URL segment 匹配,使用 `(.)`/`(..)`/`(...)` 前必须说明目标 URL 层级。
- 每个 SSR 项目必须在 handoff 或项目规则中声明 Next.js 主版本；同一项目内不得混用不同主版本的文件约定。
- Next 14/15 使用根级 `middleware.ts`；Next 16+ 使用根级 `proxy.ts` / `proxyConfig`，不得继续新增 `middleware.ts`。

## Locale Route Ownership

> 公开区 / 非公开区的语言分轨策略权威见 [`./ssr-i18n.md`](./ssr-i18n.md)

- `app/[locale]/**` 只承载公开内容页。`[locale]` 是唯一允许的语言路由段，必须导出
  `generateStaticParams()`；**未登记语言段的 404 由两条链承担**：`src/proxy.ts` 把 matcher 看得见的请求
  改写成路由层 404；公开页入口调用 `assertPublicLocaleSegment()` 兜住 matcher 看不见的含点路径
  （`/wp-login.php`、`/fr.js` 会直接落到公开页并渲染成 200 整页首页）。不能依赖 `dynamicParams = false`
  ——`/[locale]` 是动态路由，Next 不为它产出 fallback 表，该 segment config 放在 layout 或 page 上都不生效。
- 路由层拒绝产生的 404：由 Next 渲染**根 layout + `src/app/not-found.tsx`**，因此根 layout 给的
  `<html lang>`（`getLocale()`，走同一条语言解析链）、MUI 主题与应用样式、Next 按 404 状态码自动注入的
  `noindex` 全都在。**不得开启 `experimental.globalNotFound`**：该开关会在构建期把 `/_not-found` 路由的根
  layout 从文件列表里过滤掉，改用一份必须自带 `<html>`/`<body>` 的自包含 `global-not-found.tsx`，正好丢掉
  上面这些。组件级 `notFound()`（含上面的守卫）由 Next 内置错误边界承接，文档没有 `lang`、没有应用样式，
  但状态码与 `noindex` 正确；**不得靠给抛错段加 Suspense 边界（`loading.tsx`）或段内 catch-all 去「修」它**
  ——前者把状态码吞成 **200**（软 404，比错误壳更糟），后者会吃掉 proxy 的哨兵路径、连路由层 404 一起弄坏
  （均实测于 Next 16.2 standalone）。URL 未命中时 Next 永远渲染 root 级 `/_not-found`，
  `[locale]/not-found.tsx` 只承接段内主动抛出的 `notFound()`。只有改成多 root layout（`[locale]` 自带
  `<html>`、删除 `src/app/layout.tsx`）时，才需要重新评估这个开关。
- 路由层 404 的 `<title>` 由根级 `not-found.tsx` 的 `generateMetadata` 给出（实测 Next 16.2 standalone 对
  `/_not-found` 生效）；不写就会继承根 layout 的站点名。`robots: noindex` **不要**手写：Next 已按 404 状态码
  自动注入，再写一次会产出两条 `robots` meta。
- 非公开路由（`(auth)`、`(app)`、`<project-id>-api`）不得放进 `[locale]`，也不得自带语言前缀；它们的
  语言走 cookie + `router.refresh()`。
- `robots.ts`、`sitemap.ts`、`manifest.ts`、`icon.svg`、`opengraph-image.tsx`、`not-found.tsx`、
  `error.tsx`、`global-error.tsx` 必须留在 `src/app` 根，不得放进语言段
  （`/zh-CN/sitemap.xml` 是无效地址）。根路径不再由 `page.tsx` 提供内容，由 proxy 308 到默认公开语言 URL。
- 公开区路由登记（可索引性、是否参与语言路由）必须是单一事实源，并被 proxy 白名单、`sitemap.ts`、
  `robots.ts` 与架构边界测试共同消费；新增公开页时不得只改其中一个消费者。

## Server / Client Boundary

- Server Component 负责首屏数据、metadata 数据、服务端鉴权上下文读取、渲染决策和传递最小 view model；可调用 `src/bff/routes` / `src/bff/services` 的 server-only 能力,但不能把 gateway 或后端 raw response 传给 Client Component。
- Server Component 读取内部数据时不得 `fetch('/<project-id>-api/...')` 自调同站 Route Handler；内部 read 走 `src/bff/services` 或项目 server facade，避免服务端内回环 HTTP 和重复鉴权。
- 不在 Server Component 模块级保存 request/user/session/tenant 等可变状态。
- Client Component 不导入 `src/bff/gateway`、server-only BFF helper、Node API、服务端环境变量或后端 SDK；不能声明为 `async function` 或 `await` 服务端数据。
- 从 Server Component 传入 Client Component 的 props 必须 JSON 可序列化且字段最小化：`Date` 转 ISO，`Map/Set` 转对象/数组，class instance 转 plain object。
- 使用 `useSearchParams()` 的 Client Component 必须被最近的 `Suspense` 包住，避免静态路由整体 CSR bailout；动态路由中使用 `usePathname()` 的 Client Component 同样必须被 `Suspense` 包住(已用 `generateStaticParams` 且目标 Next 版本确认不触发 bailout 时可例外)。
- 内部导航使用 `next/link`，不要用普通 `<a href>` 做站内跳转；程序式导航只在事件处理、表单结果、modal 关闭或受控流程中使用 `useRouter()`。

## MUI And Style Runtime

- MUI、Emotion/cache provider、ThemeProvider、CSS layer、Tailwind 共存、暗色模式防闪烁、图标依赖和 UI bundle 规则统一见 [`./ssr-ui-runtime.md`](./ssr-ui-runtime.md)。
- 本文件只保留 RSC 归属原则：MUI-heavy UI 下沉到叶子 Client Component，`page.tsx` / `layout.tsx` 仍负责服务端数据、metadata、鉴权和缓存策略。

## Route Handlers

- `<project-id>` BFF Route Handler 默认只实现 `GET` 和 `POST`,与后端契约保持一致；未实现 method
  应返回稳定 405。除非后端 ADR 明确变更,不要新增 `PUT`、`PATCH`、`DELETE`。
- Route Handler 只做入口编排：读取请求上下文、生成/透传 request id、鉴权、参数整理、调用 BFF route/action facade、返回稳定 JSON/headers/status；不用于 Server Component 内部读数据。
- GET Route Handler 的缓存语义必须显式：公开可缓存数据声明 cache header 或 revalidate 来源；登录态数据默认 no-store。
- webhook、外部 REST、移动端 API、第三方回调、健康检查使用 Route Handler；UI 内部 mutation 优先 Server Action。
- Route Handler catch 块中如果捕获到 Next 导航异常，必须用 `unstable_rethrow(error)` 或等价方式重新抛出。

## Server Actions

> Server Action 落点权威见 [`./ssr-bff-boundaries.md`](./ssr-bff-boundaries.md) "Forbidden Action Locations"(铁律:仅落在 `src/bff/actions/`,平铺,可被 grep 穷举)。

- Server Action 文件顶部使用 `'use server'`，只服务当前 Next UI 的 mutation；必须鉴权、校验输入、调用 BFF service/gateway、返回稳定 action result，并在成功后按影响范围 revalidate。
- Server Action 不返回 token、后端 raw response、异常堆栈、邮箱/手机号/密码等敏感信息；需要公开 HTTP 契约或非 Next 调用方访问时不使用 Server Action。
- `redirect()`、`permanentRedirect()`、`notFound()`、`unauthorized()`、`forbidden()` 不得被普通 `try-catch` 吞掉；在 catch 中统一调用 `unstable_rethrow(error)` 后再处理业务错误，或把导航调用放在 try-catch 外。

## Error And Status Pages

- `error.tsx` / `global-error.tsx` 必须是 Client Component；`global-error.tsx` 返回完整 `<html>` 和 `<body>`。
- 登录态缺失优先使用 `unauthorized()` 或项目统一 redirect；权限不足使用 `forbidden()`；采用 `unauthorized()` / `forbidden()` 的项目必须提供对应 `unauthorized.tsx` / `forbidden.tsx`；资源不存在调用 `notFound()`。
- 错误页、未授权页、无权限页和 not-found 页的用户可见文案必须走 locale 字典。

## Metadata And Runtime Assets

> metadata / generateMetadata API、`next/image`、`next/font`、`next/script` 用法按 Next.js 文档执行,本文只列项目专属决策。

- 项目存在稳定多语言 URL 策略时（骨架的公开区 locale route 即该策略），公开内容页**必须**输出
  `alternates.canonical`（自指）与 `alternates.languages`（含 `x-default`）；非公开页与无前缀页不得
  输出伪造的 locale `alternates`。SEO 契约见 [`./seo.md`](./seo.md)。
- OG 图不能依赖 search params；需要动态内容时使用 route params 或服务端数据源；不要为了 OG 图默认切 Edge runtime。
