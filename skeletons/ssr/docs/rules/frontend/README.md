# Frontend Rules

## SSR 必读路径

- 架构：[`ssr-frontend-architecture.md`](./ssr-frontend-architecture.md)
- 路由与 RSC：[`ssr-routing-and-rsc.md`](./ssr-routing-and-rsc.md)
- BFF：[`ssr-bff-boundaries.md`](./ssr-bff-boundaries.md)
- 契约与 Mock：[`ssr-contracts-and-mock.md`](./ssr-contracts-and-mock.md)
- UI runtime：[`ssr-ui-runtime.md`](./ssr-ui-runtime.md)
- 运行时配置：[`ssr-runtime-config.md`](./ssr-runtime-config.md)
- 安全：[`ssr-security-baseline.md`](./ssr-security-baseline.md)
- 日志：[`ssr-observability-and-logging.md`](./ssr-observability-and-logging.md)
- i18n：[`ssr-i18n.md`](./ssr-i18n.md)
- 交付：[`ssr-delivery-workflow.md`](./ssr-delivery-workflow.md)
- 验证：[`ssr-verification.md`](./ssr-verification.md)

## 适用原则

- 本目录约束 Next.js 的 Web、SSR 和 BFF 表面，在 `bff-only` 与 `next-backend` 两种模式下都生效；
  目录名不表示 `next-backend` 项目只需执行后端规则。
- SSR 项目默认使用 Next.js App Router、RSC、BFF gateway 和 OpenAPI/Prism mock。
- `bff-only` 表示 Next.js 只承担 Web、SSR 和 BFF，不承担领域或数据基础设施；它不是纯浏览器运行模式。
- 项目初始化选择 `next-backend` 时，除本目录外还必须读取
  [`../next-backend/README.md`](../next-backend/README.md)，且所有本地后端能力继续经过 BFF。
- 公开页面负责 SSR、metadata 和 SEO；认证和工具页面默认 `noindex`。
- Client Component 不读取 server env，不导入 server-only BFF 运行时。
- 真实应用标识、cookie、BFF 前缀和部署名称必须来自项目变量绑定。
