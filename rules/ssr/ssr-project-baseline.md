# SSR Project Baseline

## Scope

本文件只适用于新增 Next.js App Router + BFF Route Handler 的 SSR/BFF app;Vite SPA 不适用。

只有当项目新增 Next.js App Router + BFF Route Handler 的 SSR/BFF app 时,才启用本文件。新增前必须先在 ADR 中确认 app 名、路由策略、BFF 边界、auth cookie 名和部署方式。

## Required Baseline

- 公开内容区使用 `app/[locale]`（见 ADR-000），非公开区不使用语言段；两类区域的语言解析细节见 [`./ssr-i18n.md`](./ssr-i18n.md)。
- BFF contract lives at `<frontend-root>/mock/openapi.yaml`.
- Browser auth cookie name follows project ID, using `<project-snake>_auth` by default.
- BFF-to-backend authentication follows the confirmed backend contract and remains server-side. 鉴权链路权威定义见
  [`./ssr-bff-boundaries.md`](./ssr-bff-boundaries.md)。
- Ant Design SSR provider setup follows [`./next-app-router-antd-provider.md`](./next-app-router-antd-provider.md)。

## Checklist

- [ ] SSR/BFF app name and route strategy are recorded in ADR
- [ ] Public pages under `app/[locale]`; non-public pages carry no locale segment
- [ ] Route Handlers use GET / POST only unless backend ADR changes the HTTP method policy
- [ ] BFF outbound calls inject trace id and locale
- [ ] User-visible copy is locale-backed
