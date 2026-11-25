# Verification

## Required Gates

- `.agents/ssr-project.md` 与基线 ADR 中的项目身份、配套后端关系和交付文档根必须一致。
- 仓库不得创建或启用 `src/server/**`，也不得引入数据库或中间件运行时。
- 数据库、Redis、MQ、worker 和领域实现只能存在于配套 Java 后端仓库。
- capability 状态必须与依赖、环境变量和 PM2 发布交接一致。

```bash
pnpm check
pnpm mock:check
pnpm test
pnpm build
pnpm build:dist:prod
```

## Local Smoke

1. 使用 `pnpm dev` 同时启动 Prism 与 Next.js。
2. 验证 `/` 返回服务端 HTML，并包含 showcase 数据。
3. 验证 `/robots.txt` 屏蔽 `/ssr-app-api/`。
4. 验证 `/sitemap.xml` 只包含公开可索引页面。
5. 验证 `/manifest.webmanifest` 和 `/icon.svg` 可访问。
6. 验证 `/ssr-app-api/health` 返回稳定 JSON 和 `no-store`。
7. 验证 `/ssr-app-api/showcase` 返回统一信封和 request id。
8. 验证 `/showcase-console` 未登录时跳转 `/login`，认证区和工具区 metadata 为 `noindex`。

## Process Cleanup

验证结束后停止本次启动的 Next、Prism 和浏览器自动化进程。
