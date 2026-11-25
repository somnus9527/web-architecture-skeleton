# SSR I18n

## Goals

- SSR / BFF 项目使用 `next-intl` 作为语言文案、formatter 和语言上下文的默认方案。
- 站点按**两个区**分轨处理语言，不得混用：
  - **公开内容区**（可被搜索引擎索引的营销页、落地页、内容页）使用 **locale route**：URL 语言前缀
    `/zh-CN/**`、`/en-US/**`，URL 是语言的唯一权威。落点、SEO 契约与根路径处理见
    [`./seo.md`](./seo.md) 与 [`./ssr-routing-and-rsc.md`](./ssr-routing-and-rsc.md)。
  - **非公开区**（认证区、工具区、`/<project-id>-api/**`）**不使用** locale route，不带语言前缀，
    语言走用户设置 → 同源 cookie → 浏览器 header → 无信号兜底语言（`en-US`），切换只刷新 locale
    上下文与当前页面相关接口，不做整页 URL 跳转。
- 禁止第三种形态：不得按语言复制路由树，不得用受控 rewrite 把带前缀地址映射到无前缀目录，不得给
  非公开页加语言前缀（`/zh-CN/login` 这类地址必须是 404）。

## next-intl Wiring

**铁律**:SSR / BFF 项目的文案读取与格式化**只能**走 next-intl,不得自建并行的 i18n 基础能力。

- **禁止自建 i18n primitive**:不得手写 message accessor / formatter——例如自建 `getMessages` / `formatMessage` / 用字符串模板替换实现插值 / 把整个 messages 字典作为 props 逐层下传给组件。这类"看起来能跑"的简化实现绕过了 next-intl 的 locale 上下文、ICU、复数与缺失 key 处理,属于明确违规。
- **必须的接入点(缺一即不合规)**:
  - **依赖**:项目必须**实际安装** `next-intl`(出现在 app `package.json` 的 dependencies 中),不能仅在文档或注释里声明"使用 next-intl"却不接入。
  - **next.config**:挂 `createNextIntlPlugin('./src/i18n/request.ts')`(公开区 locale route 与根 layout 共用的接法)。
  - **`src/i18n/request.ts`**:用 `getRequestConfig` 返回 `{ locale, messages }`;`locale` 按下文 `Locale Source` 的优先级解析;公开页的 URL 语言压在 cookie/header 之上,非公开页不使用 URL 语言;`messages` 从 `../locale/<locale>.json` 读取(落点见 `Messages And Copy`)。
  - **公开页 URL 语言的可见性**:URL 语言必须在**整棵渲染树**（含根 layout 的 `<html lang>` 与站点级 metadata）可见。next-intl 4.x 的 `requestLocale` 只来自 `setRequestLocale()` 缓存或它自家 middleware 写入的 `X-NEXT-INTL-LOCALE`，**不会**从 `[locale]` 段参数推导；而根 layout 位于 `[locale]` 之上、先于子 layout 渲染，子 layout 再调 `setRequestLocale()` 对本次请求无效（`getRequestConfig` 结果被 React `cache()` 记忆化）。因此在 `src/proxy.ts` 里对合法语言前缀写入受控请求头，并在 `request.ts` 的优先级链中读取它。该头必须由 proxy **先剥离入站值再写入**，客户端不可伪造。注入范围是**任意合法语言前缀**，不限于已登记公开路径：`/en-US/<未登记>`、`/zh-CN/login` 的 404 页也按 URL 语言渲染，否则同一个 URL 会随 cookie 变成另一种语言；路径是否可访问由 `src/proxy.ts` 的非法前缀拒绝（改写成路由层 404）与公开页入口的 `assertPublicLocaleSegment()`（兜 matcher 之外的含点路径）共同决定，404 文档由根 layout + 根级 `app/not-found.tsx` 提供）。
  - **root layout**:挂 `NextIntlClientProvider`(messages/locale 经 request config 流入);`<html lang>` 用 `getLocale()`。
  - **取文案**:Server Component 用 `getTranslations`(`next-intl/server`),Client Component 用 `useTranslations`(`next-intl`);插值与复数用 next-intl 的 ICU(`{name}` 占位),不自己拼字符串。
- **error / code 命名空间结构约束**:当用后端 `code`(形如 `user.email_code_invalid`,含 `.`)动态取文案时,messages 中对应命名空间**必须用嵌套结构**(`errors: { user: { email_code_invalid: "…" } }`),**不得用扁平带点 key**(`errors: { "user.email_code_invalid": "…" }`)——后者与 next-intl 的点号嵌套寻址冲突,`t(code)` 会把 `.` 当作路径分隔而取不到值。缺失的 code 用 `t.has(code)` 判断后回退到 `codeMsg` 或通用错误文案。

## Locale Routing Policy

**Decision rationale**：非公开区（登录后工作台、控制台、认证入口）用 cookie + `router.refresh()`，
保持 URL 路径稳定、降低多语言路由维护成本；公开内容区需要多语言 SEO URL，用 locale route 让每个
语种有独立网址并输出可信的 hreflang。两区正交，互不推导。骨架默认同时提供这两条基线，派生项目在
ADR 中声明是否保留公开区 locale route。

- 公开区 locale route 落点：`src/app/[locale]/**`，`[locale]` 是**真实路由段**，只承载公开内容页。
- URL 语言使用**全码** `/zh-CN`、`/en-US`，与内部 locale、`src/locale/<locale>.json` 文件名、cookie
  值和 BFF locale header 同名；不得为此维护 URL 短码与内部 locale 的映射表。
- **未登记语言段的 404 由两条链拒绝，缺一即漏**（Next 16.2 standalone 生产构建实测）：
  1. `src/proxy.ts` 拒掉 matcher 看得见的请求（`isLocaleCode` 判定首段，排除私有区前缀与
     `/opengraph-image` 这类真实非语言路由），改写成「一定匹配不到路由」的路径，落回**路由层 404**。
     matcher 里只放行 `_next` 这一个内部段，不得放宽成「所有 `_` 前缀」——`/_foo`、`/__foo` 不是内部路由，
     会被 `[locale]` 匹配成语言段并渲染出 200 首页。
  2. 公开页入口调用 `src/shared/i18n/public-locale-guard.ts` 的 `assertPublicLocaleSegment()`，兜住
     matcher 看不见的含点路径（`/wp-login.php`、`/fr.js`、`/xx.png`）——它们会直接落到公开页，不拦就是
     **200 + 整页首页**（软 404 / 重复内容）。代价：这类 404 的文档是 Next 内置错误壳（无 `<html lang>`、
     无应用样式），状态码与 `noindex` 仍正确。

  两条都不得改写成「渲染公开页」或「重定向到无前缀路径」；非法前缀（`/fr`）与「语言前缀 + 非公开路径」
  （`/zh-CN/login`）都必须是 404。放宽 matcher 不是选项：`public/` 根下的静态资源一旦漏登记就会被改成 404。

- **不得依赖 `dynamicParams = false`**：`/[locale]` 因根 layout 读取请求上下文而是动态路由，Next 不为它
  产出静态路径 / fallback 表，放在 layout 或 page 上都不产生路由层拒绝（实测含点路径照样 200）。公开页
  不再导出该 segment config。
- **路由层 404 的文档**：由 Next 渲染根 layout + `src/app/not-found.tsx`——`<html lang>` 来自根 layout 的
  `getLocale()`（走同一解析链：合法前缀跟 URL；非法/无前缀跟 cookie → `Accept-Language` → `en-US`），样式与
  主题复用 app shell，`noindex` 由 Next 按 404 状态码自动注入（app-render 的 `NonIndex`，`statusCode > 400`）。
  **不得开启 `experimental.globalNotFound`**：它在构建期摘掉 `/_not-found` 的根 layout，改用一份必须自带
  `<html>`/`<body>` 的自包含 `global-not-found.tsx`，正好丢掉上面这些白拿的东西（决策过程见
  `docs/proposals/2026-10-12-public-locale-routing-mechanism.md` 第三次修订）。只有改成多 root layout
  （`[locale]` 自带 `<html>`、删除 `src/app/layout.tsx`）时才需要它。
- **不要在 layout 里用 `notFound()` 兜这类 404**：组件抛出的 `notFound()` 由 Next 内置错误边界承接，文档
  没有 `<html lang>`、没有应用样式——应用 404 组件只存在于 RSC payload，服务端首屏是内置错误壳（dev 与
  standalone 都复现过）。唯一必需的例外是上面第 2 条：公开页入口的 `assertPublicLocaleSegment()` 用同一
  机制换「matcher 之外也 404」的完整性，这是已知并接受的代价。
- **不要试图用 Suspense 边界或段内 catch-all「修好」这份错误壳**（Next 16.2 standalone 实测）：给抛错段加
  Suspense 边界（如 `[locale]/loading.tsx`）会把 `notFound()` / 抛 `Error` 的**状态码吞成 200**（软 404，比
  错误壳更糟——文档质量与状态码只能二选一）；在 `[locale]` 下加 `[...rest]` catch-all 则会把 proxy 的哨兵
  路径（`/fr/__unknown-locale`，两段）一并吃掉，连 `/fr` 都从服务端直出的 404 掉进错误壳。也**不可能**让
  `/en-US/aaa` 渲染 `[locale]/not-found.tsx`：URL 未命中时 Next 永远渲染 root 级 `/_not-found`（
  `router-server.js` 的 `invokeRender('/_not-found', { invokeStatus: 404 })`），「最近优先」只适用于组件主动
  抛出的 `notFound()`。
- 根路径与旧的无前缀公开地址必须 **308**（永久、保留 query）到默认公开语言 URL；默认公开语言 URL 与
  UI 默认语言是两个独立配置，不得用同一常量承担。骨架不保留 UI 默认语言常量：`DEFAULT_LOCALE` 已于
  2026-10-13 删除，默认公开语言 URL 由 `DEFAULT_PUBLIC_URL_LOCALE` 单独承担。
- 禁止用受控 rewrite / 重写把**带前缀地址映射到无前缀目录**：实测会造成同一请求二次进入 proxy、路径
  分叉（`usePathname()` 首屏与客户端不一致）与 hydration 失败。唯一的例外是 `src/proxy.ts` 的**非法前缀
  拒绝**：它不映射内容，只把不该存在的 URL（首段不是合法语言码）改写成匹配不到路由的路径以产生路由层
  404，保持原路径形状并带幂等哨兵段。
- 禁止按语言复制路由树（`/(en)`、`/(zh-CN)`、`app/en/**`）。
- 非公开区不得新增语言前缀，也不得放进 `[locale]`；它的语言解析链保持 cookie → 浏览器 header →
  无信号兜底语言（`en-US`，见 `Locale Source`）。骨架**不**提供「UI 默认语言兜底」分支：无信号一律按
  `en-US` 交付，这是 2026-10-13 的项目口径。
- 既有项目已经使用其它 locale 路由形态时，不在本规范中自动迁移；需要单独 migration 方案和用户确认。
- `metadata.alternates.languages` / hreflang 只在存在稳定多语言 URL 策略时输出（公开区 locale route
  即该策略）；非公开页与无前缀页不得伪造 locale URL。SEO 契约见 [`./seo.md`](./seo.md)。

## Locale Source

- **公开区** locale 来源优先级：显式 locale 覆盖 → URL 语言段（受控请求头，URL 是唯一权威，对**任意合法
  语言前缀**生效，含 404 页）→ 同源 cookie → 浏览器 header → 无信号兜底语言（`en-US`）。URL 必须压过
  cookie：带 `cookie=<其它语言>` 访问 `/zh-CN/**` 必须仍出中文。
- **非公开区** locale 来源优先级：用户设置 → 同源 cookie → 浏览器 header → 无信号兜底语言（`en-US`，
  不含 URL 段）。
- 解析链必须惰性求值：命中 URL 语言后不得再读 cookie / `Accept-Language` 等用户信号。公开页一旦无条件
  读取这些来源，就会把 URL 语言与用户偏好的优先级写乱，并永久失去回到静态渲染的可能（读取 URL 语言
  头本身即动态渲染，这是本机制的既有代价，见 `Locale Routing Policy`）。
- BFF 读取 locale 后透传给后端或 Prism，例如 `Accept-Language` 或项目等价 header。
- Server Component、metadata、Route Handler、Server Action、gateway 和 logger 使用同一个 request locale context。
- locale、currency、tenant、permission 等会影响数据和展示的上下文必须进入 cache key、tag 或 no-store 决策。

## Language Switch Flow

**非公开区**的语言切换必须按当前页面局部刷新处理：

1. 用户在 Client Component 中选择语言。
2. 通过 `next-intl` / 项目 locale action 更新当前 locale preference，例如 cookie、用户设置或内存状态。
3. 进入 pending/loading 状态，禁用重复点击，并保持当前 URL path 不变。
4. 刷新当前页面相关服务端数据：优先使用 `router.refresh()` 刷新 Server Component 与 BFF read 数据。
5. 刷新当前页面相关客户端 GET：使用 SWR `mutate`、React Query `invalidateQueries` / `refetchQueries` 或项目请求 hook，只刷新当前页面 scope 的 key。
6. 切换完成后恢复交互；失败时回滚语言选择或展示 locale-backed 错误提示。

禁止（非公开区）：

- 通过跳转到 locale path 完成语言切换。
- 用 `window.location.reload()` 或强制整页刷新替代当前页面接口刷新。
- 切换语言后无条件刷新全站 query/cache。
- 只切换 UI 字典但不刷新依赖 locale 的 BFF/后端数据。

**公开区**的语言切换是换 URL，不是刷新当前页：

- 切换入口必须是真实链接（`next/link` + `hrefLang`，必要时保留当前 path 与 query），保证爬虫可发现
  各语言 URL；不得只用 `onClick` + `router.push` 而让语言 URL 对爬虫不可见。
- 切换时**顺带** best-effort 写入同一份 locale cookie：公开页 URL 仍是唯一权威，cookie 只用于
  「公开页 → 非公开页」交接时不让语言跳变。cookie 写失败不得阻塞导航。
- 公开区禁止把语言切换做成 `router.refresh()` 而不改 URL（那会让 URL 语言与显示语言不一致）。

## Loading And UX

> 通用切换 loading / pending / skeleton 交互按行业标准执行，本文只列 i18n 专属决策。

- 语言切换按钮必须有 pending 状态并防重复提交；`router.refresh()` 期间可保留旧内容但要给出明确的切换中反馈。
- 当前页面依赖 locale 的数据岛刷新时不能造成布局跳动或控件重置，除非业务明确要求。

## Messages And Copy

- 用户可见文案必须来自 `next-intl` messages、后端 i18n 契约或 locale-aware mock 来源。
- **messages JSON 文件位于 `src/locale/<lang>.json`**,**不**用 next-intl 默认的 `src/messages/`(脚手架默认值,与本规范冲突);`src/i18n/request.ts` 的 import **必须**从 `../locale/` 读取,例如 `import enUS from '../locale/en-US.json'`。
- metadata、OG、错误页、not-found、unauthorized、forbidden、loading/empty/error 状态都必须读取当前 locale。
- OpenAPI example 中会被 UI 直接展示的文案必须说明 locale 来源；mock 不能只内置单语言文案后假装多语言完成。
- locale key 命名按业务模块组织，避免全局 message 文件变成无边界公共池。
- 长文档、教程正文、帮助中心正文可作为 locale-aware content asset 放在对应 feature 子目录中,不强制塞进 `src/locale/*.json`;但页面壳层、SEO metadata、按钮、导航、空态、错误态仍必须走 `next-intl` messages。正文内容必须按 locale 明确拆分并由服务端按当前 locale 选择,禁止在 TSX 渲染组件中维护双语正文对象。

## BFF And Cache

- BFF service input 必须包含 locale，或从 request context 安全读取；adapter 不自行读取 cookie/header。
- gateway 出站请求应透传 locale header；后端返回 locale-aware `codeMsg` 时可作为契约展示。
- 公开可缓存页面若内容受 locale 影响，cache tag/key 必须包含 locale；未做隔离时使用 dynamic/no-store。
- 语言切换后的 revalidation 只影响当前 locale 和当前页面相关业务对象，不做全站刷新。

## Verification

- 非公开区：验证语言切换后 URL path 不变化，不出现 locale route 跳转。
- 非公开区：验证 `router.refresh()` 或项目等价刷新被触发，当前页面相关 BFF/客户端 GET 按 locale 重新请求。
- 公开区：验证根路径与旧无前缀公开地址返回 308（保留 query）到默认公开语言 URL，且不随 cookie /
  `Accept-Language` 改变目标。
- 公开区：验证每个公开页的 `<html lang>`、title/description、canonical、hreflang、sitemap alternates
  与当前 URL 语言一致且互指；非法前缀与非公开路径的语言前缀返回 404，且这些 404 页的 `<html lang>`
  跟随 URL 语言（带其它语言的 locale cookie 访问时不变）。
- 非公开区：验证无 cookie 且无 `Accept-Language` 时回落到无信号兜底语言（`en-US`），不再回落 UI 默认语言。
- 公开区：验证带 `cookie=<其它语言>` 访问 `/zh-CN/**` 仍出中文（URL 权威）；受控 locale 头不出现在
  客户端可伪造的路径上（入站值被 proxy 剥离）。
- 验证 pending/loading 状态、防重复点击、失败回滚或错误提示。
- 验证 metadata、错误页、空态、mock example、BFF header 和 cache key/tag 使用当前 locale。
- 验证 next-intl 已安装并按 `next-intl Wiring` 接好(plugin / `i18n/request.ts` / `NextIntlClientProvider` / `getTranslations` / `useTranslations`),且**不存在**自建 message accessor/formatter 或把 messages 字典逐层下传的写法。
- 交付说明必须列出 locale 来源、next-intl 接入点、语言切换刷新范围、loading 策略、cache locale 隔离和未覆盖的多语言 SEO 风险。
