# SEO

所有**可被搜索引擎索引的公开页**都要遵守的约定,以及把登录后的工具挡在索引之外的边界。适用于本仓库(Next.js App Router + next-intl,公开页语言路由 `/zh-CN` `/en-US`)。

配合阅读 [`i18n.md`](./i18n.md)、[`ssr-routing-and-rsc.md`](./ssr-routing-and-rsc.md)、[`ssr-cache-and-performance.md`](./ssr-cache-and-performance.md)。

## 三个正交维度(每加一个路由先判定归属)

三个维度**互不推导**:可索引不等于参与语言路由,可匿名访问也不等于可索引。每个路由必须逐条显式声明;
骨架的单一事实源是 `src/shared/navigation/public-route-visibility.ts`,proxy 白名单、`sitemap.ts`、
`robots.ts` 和架构边界测试共同消费它。

| 维度         | 含义                              | 典型                                    |
| ------------ | --------------------------------- | --------------------------------------- |
| 匿名可访问   | 未登录能否拿到内容                | 公开页是;工作台否(跳登录)               |
| 可索引       | 是否要排名、是否进 sitemap        | 公开页可以;认证入口、工具区、BFF 路径否 |
| 参与语言路由 | URL 是否带 `/zh-CN` `/en-US` 前缀 | 公开内容页是;**其它一律否**             |

- **公开内容区** —— 营销页、落地页、公开展示/内容页,落在 `src/app/[locale]/**`,URL 带语言前缀。
  必须可爬、要排名,下面所有规则都适用。
- **App / 工具区** —— `src/app/(app)/**` 下的一切(工作台、控制台、编辑器等)。是外壳后面的产品功能,
  **不是**要排名的内容,也不做语言镜像。
  - 显式踢出索引:在该区 layout 上 `export const metadata = { robots: { index: false, follow: false } }`(或在 `robots.ts` 里屏蔽这些路径)。
  - 这里**允许** `ssr:false` / 纯客户端渲染(它是工具,不是内容);公开区**禁止**。
  - 工具路由**不进** sitemap,且**不得**出现语言前缀(`/zh-CN/login` 必须 404)。
- **认证入口区** —— `src/app/(auth)/**`(登录等)。**不参与语言路由**,骨架缺省 **`noindex, nofollow`**
  (该区 layout 声明 + `robots.ts` 屏蔽,由 `src/test/architecture/seo-boundary.test.ts` 断言):它做语言
  判定的依据是 cookie / `Accept-Language`,不是 URL。项目若确实要让入口被收录,**必须同时**改该区
  layout 的 `robots` 与 `robots.ts` 的屏蔽清单,不得只改一处。

判断口诀:陌生人应该能通过搜索找到它 → 公开区;否则 → 工具区。

## 渲染

- 公开页是 **Server Component**;首屏 HTML 响应里就要有真实、可索引的内容(标题、标题层级、正文、链接)。用 `curl` 看**源码**验证,不是看渲染后的 DOM。
- 绝不把可索引内容藏在 `ssr:false`、只在 `useEffect` 里拉的数据、或纯客户端状态后面。爬虫必须看到的数据一律服务端(RSC 内调 BFF service)拉。
- 客户端交互没问题,只要**有意义的内容在服务端 HTML 里**、再渐进增强即可。

## Metadata

- 每个公开路由都 export `metadata` 或 `generateMetadata`,带**页面专属**的 `title` 和 `description`。文案走 i18n(`getTranslations('metadata.*')`),不硬编码。
- 根 layout 负责站点级默认值,必须设:
  - `metadataBase: new URL(<公开站点 origin,取自 env>)` —— 必需,否则 `openGraph` / `canonical` / 图片 URL 无法解析成绝对地址。
  - `title.template`(如 `'%s | <站点名>'`,站点名走配置不硬编码)+ `title.default`、`description`、`icons`、`manifest`。
  - 默认 `openGraph`(`type`、`siteName`)与 `twitter`(`card: 'summary_large_image'`);这里**不要**写
    `images` 与 `locale` —— 公开页的完整 OG(含图与语言)由 `buildPublicOpenGraph()` 产出。**具体页面不得
    裸写 `openGraph`**:Next 是整块替换,只写 `title`/`description`/`locale` 会把根 layout 的
    `type`/`siteName` 与文件约定图片一起抹掉(见「社交卡片」)。
  - 根 layout **不得**硬编码 `openGraph.locale`:语言相关的 OG 字段由公开页 metadata 按当前 URL 语言提供(见「i18n 与 SEO」)。
- 每个公开页设 `alternates.canonical`(自指 canonical)与 `alternates.languages`(hreflang + `x-default`),两者必须由同一 helper 与同一路由登记表生成,保证互指关系不会写歪。
- `<html lang>` 反映当前语种(通过 `getLocale` 接入;公开页即 URL 语言)。

## 社交卡片(Open Graph / Twitter):可选能力

OG / Twitter 卡片只影响**链接被贴到聊天与社交平台时的预览**,不参与搜索排名与收录。因此它是**可选能力**:
应用可以整套不做,但**不得停在半成品** —— 字段残缺时平台照样渲染,结果比没有卡片更糟。

**可选边界**:可选的只有本节的 `og:*` / `twitter:*`。`<title>`、`description`、canonical、hreflang、
sitemap、robots、`<html lang>` 是搜索面必备项,与本选择无关。

### 未启用档(干净退出)

一个字段都不输出:不得有 `og:*` / `twitter:*`(含 `twitter:card`),也不得存在
`src/app/opengraph-image.*`。按「退出清单」一次删干净。

### 已启用档(骨架缺省:完整清单)

**可分享的页面(公开内容页)必须成套输出**:

| 字段                                      | 要求                                                              |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `og:type` / `og:site_name`                | 站点级默认值由根 layout 提供                                      |
| `og:title` / `og:description`             | 与页面 `<title>` / `description` 一致                             |
| `og:url`                                  | 与 canonical 同址                                                 |
| `og:image`(`width`/`height`/`alt`/`type`) | 绝对地址,来自 `src/app/opengraph-image.tsx` 或公开页显式 `images` |
| `og:locale` / `og:locale:alternate`       | 公开页按 URL 语言输出(见「i18n 与 SEO」)                          |
| `twitter:card` + 图片                     | 不显式写 `twitter` 时由 `openGraph` 自动继承(实测成立)            |

`noindex` 页(404、工具区)只继承站点级部分即可:`og:type`/`og:site_name`/`og:title`/`og:description`/
`og:image` 由根 layout 与文件约定提供,**不需要** `og:locale`;而且**不得**用 `og:url` 变相声明 canonical
—— 404 页有意不带 canonical,`og:url` 会把这条信号又加回去。除这类页面外,只要输出了 OG 字段就必须成套。

**硬约束(踩过的坑)**:Next 的 metadata 是**逐字段覆盖、`openGraph` 整块替换、不深合并**;而
`opengraph-image.tsx` 这类文件约定图片只在**声明它的那一段**(根段)注入。公开页一旦为了按 URL 语言输出
`og:locale` 而自己声明 `openGraph`,根 layout 的 `type`/`siteName` 与文件约定注入的 `images` 会被一起
**静默替换掉** —— 页面照样输出 `twitter:card: summary_large_image`,却没有图。所以:**公开页声明
`openGraph` 必须走 `buildPublicOpenGraph()` 一次性补齐**(`src/shared/seo/public-locale-metadata.ts`),
不得手写只含 `title`/`description`/`locale` 的对象;图片路径/尺寸/类型的单一事实源是
`src/shared/seo/og-image.ts`。该约束由 `src/test/architecture/seo-boundary.test.ts` 锁住。

### 启用 / 退出清单

- **启用**:保留 `src/app/opengraph-image.tsx`;根 layout 声明 `openGraph`(`type`/`siteName`)与
  `twitter.card`;公开页用 `buildPublicOpenGraph()` 产出完整 `openGraph`。
- **退出**:三处一起删 —— `src/app/opengraph-image.tsx`、根 layout 的 `openGraph` 与 `twitter`、
  公开页的 `openGraph` 字段(含 helper 调用),并同步 `seo-boundary.test.ts` 的档位断言。
  只删一半(例如留下 `twitter:card`)就是半成品。

## 语义化 HTML

按权重排序,先抓大杠杆:

- **一页一个有意义的 `<h1>`**,再逻辑嵌套 `h2` / `h3`。不跳级、不出现多个 `<h1>`、不为了样式滥用标题标签。
- **导航用真锚点** —— `<a href>` / next `<Link href>`。凡是希望爬虫跟进的跳转,绝不用 `<div onClick>`,那种链接对搜索**等于不存在**。
- **`<img>` 带有意义的 `alt`**(纯装饰图才用 `alt=""`)。优先 `next/image` 以控制尺寸 / CWV。
- Landmark:页面区域包进 `header` / `nav` / `main`(一页一个)/ `footer`。
- 分区标签(`<article>` / `<section>` / `<aside>`)是**可访问性与可维护性优先**,直接排名权重很小 —— 为正确性用它们,不要当排名手段。别指望把 `<div>` 改成 `<section>` 就涨排名。

## 结构化数据(JSON-LD)

在相应 Server Component 里用 `<script type="application/ld+json">` 输出。必须与可见内容一致(不许 cloaking)。

- 站点级(根 / 落地页):`Organization` + `WebSite`。
- 视频内容 / 展示页:`VideoObject`(name、description、thumbnailUrl、uploadDate、duration)。
- 列表页:`ItemList`。
- 多层级页:`BreadcrumbList`。

结构化数据是比分区标签更高杠杆的"机器可读"信号 —— 对能拿富媒体结果(rich result)的页面优先做。

## 抓取基建

- `src/app/robots.ts` —— 放行公开区,屏蔽 `(app)` 工具路径及私有 / API 路径;`sitemap` 指向 sitemap URL。屏蔽前缀必须从路由登记表读取,不得散落硬编码。
- `src/app/sitemap.ts` —— 只列公开 URL,**带每语种条目 + `alternates.languages`**。绝不列工具区、`noindex` 页,也不列 `/`(它是 308 出口,不是最终 URL)。
- `robots.ts` / `sitemap.ts` 必须留在 `src/app` 根,不得放进语言段。
- 工具区保持 `noindex`(见「三个正交维度」)。

## Core Web Vitals

CWV 是明确的排名输入项;[`ssr-cache-and-performance.md`](./ssr-cache-and-performance.md) 的 SSR / 性能规则适用。公开页额外注意:

- 给图片 / 媒体预留尺寸(width/height 或 aspect-ratio),避免 CLS。
- 用 `next/font`(或预加载字体)避免字体切换时的布局抖动。
- 落地页 LCP 元素保持服务端渲染,不要懒加载。

## i18n 与 SEO(已定:公开页语言路由 + hreflang)

产品支持 `zh-CN` / `en-US`。公开内容区**每个语种一个独立 URL**,URL 是语言的唯一权威:

| 项                 | 约定                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL 形式           | `/zh-CN/**`、`/en-US/**`,**全码**,与内部 locale / `src/locale/<locale>.json` / cookie 值 / BFF locale 同名(不维护短码映射表)                                                                                                                                        |
| 根路径             | `GET /` → **308** 到默认公开语言 URL(`/en-US`,保留 query)。`/` 不是内容页,不进 sitemap                                                                                                                                                                              |
| 默认公开语言       | 独立配置项,与 UI 默认语言解耦;不得用一个常量同时承担两件事                                                                                                                                                                                                          |
| canonical          | 每个语言 URL **自指**,绝对地址                                                                                                                                                                                                                                      |
| hreflang           | 每个公开页输出 `zh-CN`、`en-US`、`x-default`(→ 默认公开语言 URL);必须互指,且必须与 sitemap alternates 一致                                                                                                                                                          |
| sitemap            | 每个可索引公开路由 × 语言数,每条带 `alternates.languages`(含 `x-default`)                                                                                                                                                                                           |
| robots             | 只屏蔽私有/BFF 路径,不含任何语言前缀屏蔽                                                                                                                                                                                                                            |
| OG                 | `openGraph.locale` = `zh_CN` / `en_US`(下划线格式的唯一映射),`alternateLocale` 列另一语言;**不得**在根 layout 硬编码单一语言;完整清单见「社交卡片」                                                                                                                 |
| `<html lang>`      | 当前 URL 语言                                                                                                                                                                                                                                                       |
| 非法/越权前缀      | `/fr`、`/zh-cn`、`/whatever` 一律 404:`src/proxy.ts` 把非法前缀拒绝为**路由层** 404,不进 `[locale]` 渲染;404 文档 = 根 layout + `app/not-found.tsx`(带 `lang`、应用样式与自动 `noindex`),`<html lang>` 按 cookie → `Accept-Language` → en-US(没有合法 URL 前缀可跟) |
| 含点/`_` 前缀路径  | `/wp-login.php`、`/fr.js`、`/xx.png`、`/_foo` 一律 404:它们绕过 proxy matcher 或内部段放行,直接落到公开页,由 `assertPublicLocaleSegment()` 拦下(文档是内置错误壳,状态码 404 + `noindex`;返回 200 首页即软 404 回归)                                                 |
| 带前缀的未登记路径 | `/zh-CN/login`、`/zh-CN/<未登记路径>` 一律 404,`<html lang>` 跟随 URL 前缀(不随 cookie)                                                                                                                                                                             |
| 禁止               | 不引入基于 `Accept-Language` / cookie 的根路径重定向(会让爬虫与用户看到不同目标,削弱信号合并)                                                                                                                                                                       |

- 公开页语言切换是**换 URL**(真实 `<Link hrefLang>` 链接),不是 `router.refresh()`;切换时 best-effort
  写 locale cookie,只用于「公开页 → 非公开页」交接不跳语言。非公开页语言切换仍是 cookie + refresh。
- **非公开页不做语言镜像**:`/login`、`/showcase-console`、`/<project-id>-api/**` 不带语言前缀,也不
  输出 locale `alternates`;它们做语言判定用 cookie / `Accept-Language`,与 SEO 无关(多数已 noindex)。
- 无语言信号(含多数爬虫、不带 `Accept-Language` 的客户端)一律兜底 **en-US**(`NO_SIGNAL_FALLBACK_LOCALE`):URL 语言只对带合法前缀的公开页生效,非公开页与无前缀 404 页仍需要确定的兜底语言。2026-10-13 项目口径,取代此前「删除该机制、回落 UI 默认语言」的做法。骨架**不**保留 UI 默认语言常量(`DEFAULT_LOCALE` 已于 2026-10-13 删除),默认公开语言 URL 由 `DEFAULT_PUBLIC_URL_LOCALE` 单独承担。
- 详细机制、目录落点、解析优先级与验收矩阵见
  [`../../proposals/2026-10-12-public-locale-routing-mechanism.md`](../../proposals/2026-10-12-public-locale-routing-mechanism.md)
  (提案目录不在规则同步面内)与 [`./ssr-i18n.md`](./ssr-i18n.md)。

## 验证

- 看每个公开页的**源码**(不是 DOM):`env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u all_proxy curl --noproxy '*' <url>` —— 确认 `<title>`、`<h1>`、正文、真 `<a href>` 链接都在原始 HTML 里。
- 确认 `(auth)` 与 `(app)` 路由源码里有 `<meta name="robots" content="noindex">`。
- 确认根路径 308 到默认公开语言 URL(保留 query),且目标不随 cookie / `Accept-Language` 改变。
- 确认无 cookie 且无 `Accept-Language` 时回落到 en-US(无信号兜底),而不是 UI 默认语言。
- 逐个公开页确认:canonical 自指当前语言 URL、三条 hreflang 互指、`<html lang>` 与 URL 一致。
- 社交卡片(启用档):`/zh-CN`、`/en-US` 源码里 `og:type`、`og:site_name`、`og:url`、`og:image`(含
  `width`/`height`/`alt`)与按 URL 语言的 `og:locale` 成套出现(`twitter:image` 可由 `openGraph` 继承);
  未启用档则这些字段**全无**。出现「有 `twitter:card` 无图」或「有 `openGraph` 无 `og:image`」即半成品回归。
- 确认非法语言前缀、语言前缀 + 非公开路径与带前缀的未登记路径都返回 404,且 404 页的 `<html lang>` 可判定:合法前缀跟 URL(带其它语言 cookie 访问时不变),非法/无前缀跟 cookie → `Accept-Language` → `en-US`。
- `/robots.txt`、`/sitemap.xml` 可访问且只列预期 URL,sitemap 每条带 `alternates.languages`。
- 用 Google Rich Results Test 校验 JSON-LD,用分享调试器校验 OG / Twitter 卡片。
- 公开页 Lighthouse / PSI 的 SEO 与 Core Web Vitals 通过。
