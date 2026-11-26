# SSR Delivery Workflow

## Choose SSR Or SPA

选择 SSR / Next.js App Router：

- C 端公开访问、商品/内容详情、分类列表、营销承接页、可分享页面或搜索引擎可见页面。
- 页面需要 SEO、metadata、Open Graph、sitemap、robots 或可分享内容。
- 首屏依赖服务端鉴权、服务端数据预取、缓存策略或减少客户端请求瀑布。
- 项目需要 BFF gateway、后端契约治理、OpenAPI/Prism mock、服务端缓存或受控 webhook / 外部 REST 入口。
- 业务同时包含公开内容页、登录态页面、BFF API 或 webhook，且 SSR 收益高于部署和运维复杂度。

选择 SPA：

- B 端运营、相关方、管理、企业账户、CRM、配置台等纯登录后工具，搜索引擎不可见，服务端渲染收益低。
- 既有项目稳定采用 Vite SPA，且用户没有批准迁移。
- SSR 带来的部署、缓存、鉴权和运维复杂度明显高于业务收益。

## Intake Checklist

- 新建项目还是既有项目改造。
- Next/React/TypeScript 目标版本、Next 主版本文件约定、`middleware.ts` 或 `proxy.ts` 选择，以及 async request API 写法。
- Next 执行约定：特殊文件、route group、parallel/intercepting routes、`template.tsx`、`default.tsx`、metadata files、sitemap/robots/manifest。
- 业务面向 B 端还是 C 端；页面是否公开可访问、可分享、需要 SEO 或服务端首屏数据。
- 页面类型：公开 SEO、登录态、权限态、后台操作、webhook、健康检查、外部 REST。
- i18n 策略：使用 `next-intl`；公开区使用 locale 路由，非公开区使用 cookie + refresh；语言切换刷新当前页面相关接口并提供 loading/pending 状态。
- 数据源：Prism mock、真实后端、第三方 API、backend gap。
- 鉴权方式：浏览器会话、BFF authorization header、角色/权限/租户模型。
- 安全基线：security headers、cookie 属性、CSRF、CORS、输入校验、redirect allowlist、上传下载、source map、私有数据缓存。
- 配置基线：server secret、server runtime、client public、build-time config、request context、required env、secret 注入、feature flag、base URL、PM2 env。
- 缓存策略：static、ISR、dynamic、no-store、tag/path revalidation。
- 观测策略：统一 logger 落点、local/prod 行为、client/server transport、request id、普通日志、接口日志、上游调用摘要、降级/异常日志、Web Vitals、客户端错误、审计事件、敏感字段脱敏和 PM2 日志管理。
- 运行资产策略：`next/image`、`next/font`、`next/script`、`next/link`、第三方脚本、CSS import、polyfill、bundle analyzer。
- UI runtime 策略：按 `ssr-ui-runtime.md` 声明 antd/icons/registry 依赖集合、`@ant-design/nextjs-registry`、`AntdRegistry`、`ConfigProvider`、CSS 变量、暗色模式防闪烁和 antd bundle 优化。
- 验证门禁：typecheck、lint、build、mock smoke、boundary tests、e2e、截图。

## Default Layout

```text
src/
  app/
  bff/
    gateway/
    services/
    adapter/
    routes/
    actions/
    dto/
    shared/
    transform/
  features/
  shared/
  types/
    dto/
  locale/
mock/
  openapi.yaml
  examples/
```

如果目标项目已经有自定义 app 根目录，本规则只要求保留同等职责边界，不规定项目组织形态。

## Migration Matrix

- 既有项目改造前先输出迁移矩阵，逐项标注状态。矩阵的 Area 维度与下方 Handoff Matrix 一致(Framework / Package manager / Routing / UI library / Data layer / Contract / Mock / Auth / Security / Runtime config / Cache / Observability / Deployment / Runtime assets / i18n / Quality),改造阶段每个 Area 记录当前 `Decision` / 处理方式。
- 状态使用 `compliant`、`migrated`、`compatible-exception`、`non-compliant`；不能把 `non-compliant` 项当作完成。

## Delivery Steps

> 按 intake 清单 + handoff 矩阵执行,逐项验边界(见 [`./ssr-verification.md`](./ssr-verification.md))。先判断 SSR/SPA(既有项目先做迁移矩阵),再按 App Router => UI runtime => BFF => 配置 => 安全 => 观测 => i18n => 错误/状态页 => mock 顺序建立基线,然后按业务模块实现页面并配置缓存/部署/运行资产,最后加边界门禁并验证交付。

## Handoff Matrix

| Area           | Required Evidence                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Framework      | Next/React/TypeScript 版本、App Router、runtime                                                                            |
| Rendering      | static/ISR/dynamic/no-store 策略                                                                                           |
| BFF            | gateway、service、adapter、route/action facade                                                                             |
| Contract       | endpoint id、OpenAPI path、operationId、DTO、错误码                                                                        |
| Mock           | Prism 启动命令、关键 endpoint smoke                                                                                        |
| Auth           | session source、authorization header 映射                                                                                  |
| Security       | header 来源、cookie/CSRF/CORS/validation/redirect/upload/source map/private cache 策略                                     |
| Runtime config | env key 清单、敏感级别、server/client 分界、注入方式、校验方式、PM2 env                                                    |
| UI library     | antd/icons/registry 依赖、provider 入口、`AntdRegistry`、`ConfigProvider`、CSS 变量、client leaf 边界和兼容例外     |
| Cache          | revalidate/tag/path/no-store 和失效点                                                                                      |
| Observability  | logger 落点、request id、普通日志/接口日志、上游摘要、降级/异常日志、脱敏、生产 client console、PM2、Web Vitals/客户端错误 |
| Deployment     | standalone、runtime、cache handler、多实例缓存一致性和 healthcheck                                                         |
| Runtime assets | image/font/script/link/CSS/antd registry/CSS 变量/polyfill/bundle 处理证据                                            |
| I18n           | next-intl、locale 来源、无 locale route、语言切换刷新范围、loading 状态、BFF header、cache key                             |
| Boundary       | 静态扫描或单测覆盖的禁止依赖                                                                                               |
| UX             | loading/error/empty/not-found/redirect/unauthorized                                                                        |
| Verification   | typecheck、lint、build、mock smoke、e2e 或截图                                                                             |
