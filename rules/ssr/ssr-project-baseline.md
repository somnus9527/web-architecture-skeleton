# SSR Project Baseline

## Scope

本文件只适用于新增 Next.js App Router + BFF Route Handler 的 SSR/BFF app;Vite SPA 不适用。

只有当项目新增 Next.js App Router + BFF Route Handler 的 SSR/BFF app 时,才启用本文件。新增前必须先在 ADR 中确认 app 名、路由策略、BFF 边界、auth cookie 名和部署方式。

## Required Baseline

- Locale route segment 默认不启用。是否使用 `app/[locale]` 必须由 ADR 明确批准;无 locale 路由段的细节见 [`./ssr-i18n.md`](./ssr-i18n.md)。
- BFF contract lives at `<frontend-root>/mock/openapi.yaml`.
- Browser auth cookie name follows project ID, using `<project-snake>_auth` by default.
- BFF-to-backend authentication follows the confirmed backend contract and remains server-side. 鉴权链路权威定义见
  [`./ssr-bff-boundaries.md`](./ssr-bff-boundaries.md)。
- MUI SSR provider setup follows [`./next-app-router-mui-provider.md`](./next-app-router-mui-provider.md)。

## Checklist

- [ ] SSR/BFF app name and route strategy are recorded in ADR
- [ ] No `app/[locale]` unless ADR approves it
- [ ] Route Handlers use GET / POST only unless backend ADR changes the HTTP method policy
- [ ] BFF outbound calls inject trace id and locale
- [ ] User-visible copy is locale-backed
