# 公开页 locale routing 机制（提案 / 实现记录）

- 日期：2026-10-12
- 状态：已实施（规范与骨架同步落地）
- 范围：仅公开内容页；非公开页（`/login`、`/showcase-console`、`/<project-id>-api/**`）保持 cookie + `router.refresh()` 不变
- 权威规范：`docs/rules/frontend/ssr-i18n.md`、`docs/rules/frontend/seo.md`、`docs/rules/frontend/ssr-routing-and-rsc.md`
- 注意：`docs/proposals/**` 不在规则同步面内（`docs/rules/**` 才是），本文件不下发派生项目，只作为骨架机制的设计记录

## 背景与问题

原基线是「单 URL 语言自适应」：同一 URL 按 cookie / `Accept-Language` 出不同语言，并引入
`NO_SIGNAL_FALLBACK_LOCALE = 'en-US'` 让无语言信号的爬虫被索引成英文。代价是中文没有独立网址，
无法获得中文自然流量，也无法输出可信的 hreflang。

需求：公开页改为语言路由 `/zh-CN`、`/en-US`，URL 是公开页语言的唯一权威；非公开页继续 cookie 方案。

## 概念模型：三个正交维度

`public-indexable` 不能推导出「参与语言路由」。每条路由必须显式声明三个维度，登记表唯一事实源为
`src/shared/navigation/public-route-visibility.ts`。

| 路径                                                                                    | 匿名可访问     | 可索引             | 参与语言路由                 |
| --------------------------------------------------------------------------------------- | -------------- | ------------------ | ---------------------------- |
| `/`                                                                                     | 是（308 出口） | 否（不是最终 URL） | 是（308 → 默认公开语言 URL） |
| `/{locale}` 及未来 `/{locale}/**`                                                       | 是             | 是                 | 是                           |
| `/login`                                                                                | 是             | 否（noindex）      | 否                           |
| `/showcase-console`                                                                     | 否（redirect） | 否                 | 否                           |
| `/<project-id>-api/**`                                                                  | 是（API）      | 否                 | 否                           |
| `/robots.txt`、`/sitemap.xml`、`/manifest.webmanifest`、`/icon.svg`、`/opengraph-image` | 是             | —                  | 否                           |

登记表的消费者：`src/proxy.ts`（受控 locale 头白名单）、`src/app/sitemap.ts`（多语言条目）、
`src/app/robots.ts`（私有前缀）、架构边界测试。

## 机制选型

**采用：真实路由段 `src/app/[locale]/**` + proxy 只做「根路径 308」与「受控 locale 头」。**

否决「受控 rewrite 到无前缀目录」：实测 `/zh` 会二次进入 proxy 且第二次 pathname 变成 `/`（路径分叉），
`usePathname()` 首屏 `/`、客户端 `/zh`，抛 `Hydration failed`。真实路由段无此问题。

**关键约束（已在 next-intl 4.13.0 源码核对）**：`[locale]` 段本身不会让 next-intl 知道当前语言。
`server/react-server/RequestLocale.js` 的解析是
`getCachedRequestLocale() || headers().get('X-NEXT-INTL-LOCALE')`：段参数不参与，`X-NEXT-INTL-LOCALE`
由 next-intl 的 middleware 写入，`setRequestLocale()` 写的是 React `cache()`。而
`receiveRuntimeConfig` 被 `cache()` 记忆化，`src/app/layout.tsx`（位于 `[locale]` 之上）先渲染并读
locale，子 layout 再调 `setRequestLocale` 对本次渲染已经无效。

因此 URL locale 由 proxy 以受控请求头 `x-public-locale` 注入：proxy 先无条件剥离入站值（客户端不可
伪造），再在首段是**任意**受支持语言码时重新写入（不限于已登记公开路径——`/en-US/<未登记>`、
`/zh-CN/login` 的 404 页也必须按 URL 语言渲染）；`src/i18n/request.ts` 按显式声明优先级读取。这样根
layout 的 `<html lang>`、站点级 metadata 和 `[locale]` 子树看到的语言完全一致。

代价：公开页动态渲染（读 header 即 dynamic）。与改造前一致（首页本来就要 `headers()` 取 requestId
走 BFF），本期零损失。若要公开页 SSG/ISR，唯一路径是把 locale-aware 的 `<html>` + Provider 下沉为
`[locale]` 自己的 root layout（多 root layout 路线），列为后续项。

## URL 与 SEO 契约

| 项                 | 约定                                                                                                                                                                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL 形式           | `/zh-CN`、`/en-US`，全码，与内部 locale / 字典文件名 / cookie 值 / BFF locale 同名（零映射表）                                                                                                                                                                                    |
| 根路径             | `GET /` → `308 /en-US`（保留 query），proxy 内完成，`Cache-Control: public, max-age=3600`                                                                                                                                                                                         |
| `/` 是否进 sitemap | 否（不是最终 URL）                                                                                                                                                                                                                                                                |
| canonical          | 每个语言 URL 自指，绝对地址                                                                                                                                                                                                                                                       |
| hreflang           | `zh-CN`、`en-US`、`x-default`（→ `/en-US`），由同一 helper + 同一登记表生成，天然互指                                                                                                                                                                                             |
| sitemap            | 每个可索引语言路由 × 语言数，每条带 `alternates.languages`（含 `x-default`）                                                                                                                                                                                                      |
| robots             | 只屏蔽私有路径，不含任何语言前缀屏蔽                                                                                                                                                                                                                                              |
| OG                 | `og:locale` = `zh_CN` / `en_US`（下划线格式的唯一映射），`og:locale:alternate` 列另一语言                                                                                                                                                                                         |
| `<html lang>`      | 当前 URL 语言（公开页）/ cookie→header 解析语言（非公开页）                                                                                                                                                                                                                       |
| 非法语言前缀       | `/fr`、`/zh-CN/login` 等 → 404（`/fr` 这类由 proxy 拒绝为路由层 404），带合法前缀的 404 页语言跟随 URL，非法前缀的 404 页跟随 cookie→header→`en-US`。**⚠️ 已作废**：404 文档由 `app/global-not-found.tsx` 提供的说法在第三次修订中作废，实际为根 layout + `src/app/not-found.tsx` |
| 大小写变体         | `/zh-cn` → 404（不额外做归一重定向，避免多一条重定向规则；日志出现命中再评估）                                                                                                                                                                                                    |
| 尾斜杠             | `/zh-CN/` 由 Next `trailingSlash: false` 默认 308 到 `/zh-CN`，canonical 不带尾斜杠                                                                                                                                                                                               |
| 不做               | 不引入基于 `Accept-Language` / cookie 的根路径重定向（会让 UA 与爬虫看到不同目标，削弱信号合并）                                                                                                                                                                                  |

默认公开语言 URL（`DEFAULT_PUBLIC_URL_LOCALE = 'en-US'`）与 UI 默认语言（`DEFAULT_LOCALE = 'zh-CN'`，
2026-10-13 已删除）保持解耦。

> **2026-10-13 修订（项目 owner 决定）**：`NO_SIGNAL_FALLBACK_LOCALE = 'en-US'` **恢复**为解析链的链尾。
> 上一版删除它的依据是「URL 语言取代了它的动机」，但那只覆盖**带合法前缀的公开页**；非公开页与无前缀
> 404 页仍需要一个确定的兜底语言，owner 选择 en-US 而不是 UI 默认语言。`DEFAULT_LOCALE` 因此不再被
> `src/i18n/request.ts` 消费，并于同日由 owner 追加决定**删除**该常量（全仓无消费点，留着会被误读为兜底）；
> UI 默认语言自此没有代码级声明，「默认公开语言与 UI 默认语言解耦」由「根本不存在该常量」满足。

## locale 解析优先级

`src/i18n/request.ts`：

1. 显式 locale（`getTranslations({ locale })` 等）
2. `requestLocale`（`setRequestLocale` 缓存 / next-intl 自家 middleware 头；当前骨架恒空，保留通道）
3. `x-public-locale`（proxy 受控，URL 权威；覆盖 `[locale]` 之外的渲染，例如根 layout metadata）
4. cookie（非公开页用户偏好）
5. `Accept-Language`
6. `NO_SIGNAL_FALLBACK_LOCALE`（en-US，无信号兜底）

要求：3 命中即返回，不读 cookie / header（惰性求值），保留未来回到静态渲染的可能；URL 必须压过 cookie。

## 目录结构

```
src/app/
  layout.tsx                    ← 保留：站点级 metadata、html/body、Provider（不感知语言归属）
  [locale]/                     ← 公开区唯一入口
    layout.tsx                  ← 透传（segment config 与校验都不在这里）
    page.tsx                    ← 公开首页 + generateStaticParams（未登记语言段由 proxy.ts 拒绝）
    not-found.tsx               ← 公开区 404（组件内 notFound() 用，按 URL 语言，链接回当前语言首页）
  global-not-found.tsx          ← **已作废**（第三次修订已删除该文件与 `experimental.globalNotFound`；路由层 404 由根级 not-found.tsx 在根 layout 内承运）
  (auth)/login/**               ← 不变；保留 cookie 式语言切换，作为非公开页能力入口
  (app)/showcase-console/**     ← 不变
  ssr-app-api/**                ← 不变
  robots.ts sitemap.ts manifest.ts icon.svg opengraph-image.tsx not-found.tsx error.tsx global-error.tsx
```

SEO 基建文件必须留在根：`/robots.txt`、`/sitemap.xml` 只能在 origin 根，`manifest` / `icon` /
`opengraph-image` 是站点级资源，放进 `[locale]` 会产出 `/zh-CN/sitemap.xml` 这类无效地址。

依赖的 Next 路由优先级：静态段优先于动态段，因此 `/login`、`/showcase-console`、
`/ssr-app-api/**` 仍命中各自的静态路由，不会被 `[locale]` 吃掉。

## 新增 / 改动落点

| 动作   | 文件                                                                                                                                                                                                                                     |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新增   | `src/app/[locale]/layout.tsx`、`src/app/[locale]/page.tsx`、`src/app/[locale]/not-found.tsx`                                                                                                                                             |
| 新增   | `src/shared/navigation/public-route-visibility.ts`（登记表，唯一事实源）                                                                                                                                                                 |
| 新增   | `src/shared/i18n/public-locale-routing.ts`（URL locale 解析 / 拼接 / 交换）                                                                                                                                                              |
| 新增   | `src/shared/seo/public-locale-metadata.ts`（canonical + hreflang + OG locale）                                                                                                                                                           |
| 新增   | `src/features/locale-switcher/public-locale-switcher.tsx`（Link 式切换）                                                                                                                                                                 |
| 改     | `src/proxy.ts`、`src/i18n/locale-config.ts`、`src/i18n/request.ts`、`src/app/layout.tsx`、`src/app/robots.ts`、`src/app/sitemap.ts`、`src/app/not-found.tsx`、`src/app/(auth)/login/page.tsx`、`src/features/showcase/showcase-page.tsx` |
| 删     | `src/app/page.tsx`（迁入 `[locale]`）                                                                                                                                                                                                    |
| 改测试 | `src/test/architecture/no-locale-route.test.ts` → `public-locale-routing.test.ts`；`src/test/architecture/seo-boundary.test.ts`                                                                                                          |

## 非公开页不变清单

`(auth)/login/**`、`(app)/showcase-console/**`、`ssr-app-api/**`、鉴权 cookie 链、`setLocaleAction`、
noindex 边界、BFF / gateway / adapter / service 全部不变。实际变化只有两点：

1. 非公开页不可能出现语言前缀（`/zh-CN/login` = 404）；
2. 无语言信号时从 `en-US` 回到 `DEFAULT_LOCALE`（`zh-CN`），纯 UI 偏好，无 SEO 含义。
   （2026-10-13 已回退：链尾恢复 `en-US`，`DEFAULT_LOCALE` 常量删除，见上文修订。）

## 部署 / 缓存 / CDN 注意

- `docs/deployment/nginx.example.conf` 只有 `location /`，locale 前缀与 `-` / `.` 不涉及 nginx 匹配语法，无需改动。
- CDN 缓存键必须包含完整 path（默认即是）；**禁止**添加「剥掉或归一化首段路径」的规则，否则 `/zh-CN` 与 `/en-US` 会串内容。
- 语言是 URL 维度，公开页不需要 `Vary: Accept-Language`；非公开页维持 dynamic / no-store 语义，不进共享缓存。
- `/` 的 308 可缓存 1 小时（非 immutable），保留策略调整空间。

## 验收矩阵（`pnpm dev:mock` 起真实 dev server 后逐条核对）

| 请求                                                   | 期望                                                                                   |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `GET /`                                                | 308，`Location: /en-US`                                                                |
| `GET /?utm=1`                                          | 308，`Location: /en-US?utm=1`                                                          |
| `GET /en-US`                                           | 200，`<html lang="en-US">`，英文 title，canonical 自指 `/en-US`，3 条 hreflang         |
| `GET /zh-CN`                                           | 200，`<html lang="zh-CN">`，中文 title，canonical 自指 `/zh-CN`，3 条 hreflang         |
| `GET /fr`、`/zh-cn`、`/zh-CN/login`、`/zh-CN/whatever` | 404                                                                                    |
| `GET /login`                                           | 200，无前缀，`<meta name="robots" content="noindex">`，语言随 cookie/`Accept-Language` |
| `GET /showcase-console`（无 session）                  | 307 → `/login`                                                                         |
| `GET /ssr-app-api/health`                              | 200                                                                                    |
| `GET /sitemap.xml`                                     | 2 条 URL，每条带 3 个 alternates                                                       |
| `GET /robots.txt`                                      | 屏蔽 `/login`、`/showcase-console`、`/ssr-app-api/`，无语言前缀屏蔽                    |
| `cookie: ssr_app_locale=en-US` + `GET /zh-CN`          | 仍为中文（URL 优先）                                                                   |
| `Accept-Language: zh-CN` + `GET /`                     | 仍 308 → `/en-US`（不依赖 header）                                                     |
| 公开页切换                                             | URL 变化且语言正确，无 hydration warning，cookie 同步写入                              |
| 非公开页切换                                           | URL 不变，`router.refresh()` 生效                                                      |

## 未验证项 / 后续项

- 生产 `standalone` 构建下的 404 状态码、`dynamicParams` 行为、proxy 调用次数（**2026-10-13 已在本地
  Docker + Nginx + standalone 栈验证**）；缓存键仍未验证。
- `[locale]` + 动态渲染（读 header）组合下 `/fr` 的 404：**2026-10-13 落地为「proxy 拒绝非法前缀 +
  `experimental.globalNotFound` + `src/app/global-not-found.tsx`」**。**⚠️ 该组合已于同日第三次修订改为
  「proxy 拒绝非法前缀 + 根级 `src/app/not-found.tsx`」：下文涉及 `global-not-found` 的措辞均已作废，
  仍有效的是「proxy 必须把非法前缀改写成路由层 404」这条结论**。排查结论（Next 16.2 实测）：

  1. **`dynamicParams = false` 在这条路由上不起作用**。`/[locale]` 因根 layout 读取请求上下文而是动态路由，
     Next 不为它产出静态路径 / fallback 表，于是 `/fr` 直接渲染公开首页并返回 **200**（语言退化成 cookie /
     浏览器语言）；把 `dynamicParams` 放在 layout 或 page 上都不生效，dev 与 production 行为还不一致。
     因此「基线里 `/fr` 是 404」真正的来源是 layout 里那句 `notFound()`，与 `dynamicParams` 无关。
  2. **组件抛出的 `notFound()` 拿不到像样的文档**：layout 与 page 都一样，Next 内置错误边界产出的文档是
     `<html id="__next_error__">`——无 `<html lang>`、无应用样式表，应用 404 组件只存在于 RSC payload
     （客户端渲染后才可见）。
  3. **只有「匹配不到路由」的 404 可被接管**：`experimental.globalNotFound` + `app/global-not-found.tsx`
     对 `/en-US/<未登记>`、`/zh-CN/login` 这类请求有效（自带 `<html lang>`，语言按 URL / cookie / header
     解析）。因此 `src/proxy.ts` 增加**非法前缀拒绝**：首段不是合法语言码、也不是私有区前缀或
     `/opengraph-image` 时，把请求改写成「一定匹配不到路由」的路径（原路径 + 哨兵段，幂等），落回路由层
     404 → `global-not-found` 文档 + `<html lang>`（无信号 en-US、cookie/`Accept-Language` 可覆盖）。
     dev 与 standalone 产物均实测：`/fr`、`/zh-cn`、`/whatever` → 404 且 `lang` 可判定；`/en-US/<未登记>`
     仍按 URL 语言。

- 副作用（**已作废**，第三次修订后不再启用该开关）：`experimental.globalNotFound` 会接管**所有**路由层
  404（含 `/en-US/<未登记>`），因此 `app/not-found.tsx` 与 `[locale]/not-found.tsx` 只服务组件内主动抛出的
  `notFound()`。当前口径：路由层 404 由根级 `src/app/not-found.tsx` 承运，`[locale]/not-found.tsx` 只服务
  公开段内主动抛出的 `notFound()`。
- 公开页 SSG/ISR：需要多 root layout 路线（`[locale]` 自带 `<html>` + Provider），并把
  `request.ts` 的 header 读取降级为 `setRequestLocale`。
- 登记表路径不得含 `.`：proxy matcher 排除了含点路径，含点公开路径会绕过受控 locale 头，由架构测试锁住。
- 外部反向链接若传 `?utm_*` 等参数，hreflang / canonical 不带参数，按 URL 归一由 Next 默认处理。

### 2026-10-13 第二次修订：堵住 proxy matcher 之外的 200 软 404

复核（骨架全新 production standalone 构建实测）发现上面的拒绝链有一个洞：**proxy 只能拒绝 matcher 看得见
的请求**。

- 含点路径（`/wp-login.php`、`/fr.js`、`/xx.png`）被 matcher 的 `.*\..*` 整段排除 → proxy 收不到 →
  `[locale]` 匹配单段 → **200 + 整页首页**（canonical 指向 `/en-US`），典型软 404 / 抓取预算浪费。
- `_` 前缀路径（`/_foo`、`/__foo`、`/_next-fake`）被 `firstSegment.startsWith('_')` 放行 → 同样 200 首页；
  而 `/%5Ffoo`（编码）反而 404。该判断的原意只针对 `_next` 内部路由。

修订：

1. proxy 的内部段放行收窄为 `firstSegment === '_next'`（新增 `NEXT_INTERNAL_SEGMENT` 常量）。
2. 新增 `src/shared/i18n/public-locale-guard.ts` 的 `assertPublicLocaleSegment()`，每个公开页在渲染入口调用
   （骨架当前只有 `[locale]/page.tsx`），兜住 matcher 之外的路径；架构测试静态扫描强制。
3. `[locale]/page.tsx` 不再导出 `dynamicParams = false`：实测该 segment config 在这条动态路由上不产生路由层
   拒绝（layout / page 都一样），留着只会被误读成拒绝手段。
4. 文档同步：含点路径的 404 文档是 Next 内置错误壳（无 `<html lang>`、无应用样式），状态码与 `noindex` 正确；
   想同时拿到好文档只能放宽 matcher + 维护静态资源白名单，代价更大，明确不做。

实测矩阵（Next 16.2.10 standalone）：`/fr`、`/en-US/whatever`、`/foo.bar/baz`、`/%5Ffoo` → 404 且文档自带
`lang`；`/_foo`、`/__foo`、`/_next-fake` → 404 且文档自带 `lang`（收窄放行后由 proxy 拒绝）；
`/wp-login.php`、`/fr.js`、`/xx.png` → 404（内置错误壳 + `noindex`）；`/en-US`、`/zh-CN` → 200 且 canonical
自指。

### 2026-10-13 第三次修订：删除 `global-not-found`，路由层 404 回到根 layout

第二轮「路由层 404 由 `experimental.globalNotFound` + `src/app/global-not-found.tsx` 接管、以自带
`<html lang>`」的结论被推翻。查 Next 16.2.10 的构建代码（
`next/dist/build/webpack/loaders/next-app-loader/index.js` 的 `isNotFoundRoute && isGlobalNotFoundEnabled` 分支）：
**该开关在构建期把 `/_not-found` 路由的根 layout 从 `definedFilePaths` 里过滤掉**，再把自己的文件当 layout
塞进去。也就是说，那份「404 文档没有 `lang` / 没有样式」的结论只适用于**组件抛出的 `notFound()`**（Next 内置
错误边界），不适用于路由层 404 —— 不开开关时，路由层 404 渲染的是根 layout + `src/app/not-found.tsx`，
`<html lang>`（根 layout 的 `getLocale()`，走同一条解析链）、MUI 主题与应用样式都在，`noindex` 由 app-render
的 `NonIndex` 按 `statusCode > 400` 自动注入（不需要在 404 组件里手写）。

修订：

1. 删除 `src/app/global-not-found.tsx`；`next.config.ts` 移除 `experimental.globalNotFound`。
2. 404 统一由根级 `src/app/not-found.tsx`（路由层未命中）与 `src/app/[locale]/not-found.tsx`（公开段内组件抛出的
   `notFound()`）承运；两份都**不得**自带 `<html>`/`<body>`，由架构测试锁住。
3. 本文件第一、二轮中「404 文档由 `app/global-not-found.tsx` 提供」的表述（含上文表格与目录树）均已作废，
   以本节为准；开关本身只在改成多 root layout（`[locale]` 自带 `<html>`、删除 `src/app/layout.tsx`）时才需要。

### 2026-10-13 第四次修订（记录，不改结构）：404 形态定案 + 两份 404 视觉统一

owner 追问「所有报错是否都不该落 Next 内置错误壳」与「`[locale]/aaa` 是否该用 `[locale]/not-found.tsx`」。
用两个临时探针（`[locale]/[...rest]/page.tsx` 抛 `notFound()`、`[locale]/loading.tsx` 提供 Suspense 边界）
在 standalone 生产构建上补测，得到决定性事实：

| 形态                           | 状态码        | 文档                                                                     |
| ------------------------------ | ------------- | ------------------------------------------------------------------------ |
| 路由层未命中                   | 404           | 根 layout + `app/not-found.tsx`，`lang`/样式/404 UI 服务端直出           |
| `notFound()`，无 Suspense 边界 | 404           | `<html id="__next_error__">`：无 `lang`，body 空，UI 仅 hydration 后可见 |
| `notFound()`，有 Suspense 边界 | **200**       | app shell 保住，但状态码被吞成 200（软 404）                             |
| 抛 `Error`（同上对照）         | 500 / **200** | 内置错误壳 / app shell（状态码同样被吞）                                 |

即**状态码与文档质量二选一**：Next 16.2 下「404 + 服务端直出文档」只有**路由层未命中**一条路，任何靠抛
`notFound()` 的方案都拿不到；且 `[locale]/[...rest]` catch-all 会吃掉 proxy 的哨兵路径
（`/fr/__unknown-locale` 是两段），连 `/fr` 都从服务端直出掉进错误壳。原因仍是客户端 `HTTPAccessFallbackBoundary`
—— 有 Suspense 边界时 shell 已刷出，状态码无法再改。

owner 决定（本节即记录）：**结构维持现状**。两链并存（路由层未命中 → 根级 `not-found.tsx`；公开段内主动抛
`notFound()` → `[locale]/not-found.tsx`，文档为内置错误壳，实际只有含点路径会走到）；**不**引入 catch-all，
**不**放宽 proxy matcher 加固含点路径。第三轮的两链结论与「已知取舍」保持不变。

本轮唯一的代码改动是视觉：#4 两份 `not-found.tsx` 统一为已删除的 `global-not-found.tsx` 版式（居中、48px
`404`、标题、描述、反色圆角按钮），改用 MUI + 主题 token（跟随亮/暗色），不再需要自包含内联样式；为此新增
`src/shared/ui/link-button.tsx`（client 叶子）—— `Button component={Link}` 从 Server Component 传函数引用会
触发 RSC 序列化错误、让路由层 404 变 500，站内跳转仍必须走 `next/link`。

## 行为变化与非目标

- `POST /` 由原来的 405（`/` 曾是页面路由）变为 404：proxy 只对 GET/HEAD 做 308，其余方法交给 App Router，
  而根路径已无页面。公开区没有写入口，属可接受变化；若将来需要稳定 405，在 proxy 内补一条分支。
- OG 图仍为站点级 `/opengraph-image`，不按语言拆分；营销需要分语言 OG 图时，再在 `[locale]` 内加段级
  `opengraph-image.tsx`。
- 非公开区的鉴权、cookie、BFF 分层、noindex 边界与语言切换（cookie + `router.refresh()`）未改动；登录页
  新增同一个 cookie 式切换控件，使该能力在非公开区仍可被人工验证。
